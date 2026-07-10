/**
 * Graph validation (Req 1.6 + P5) — pure, DB-free. Runs on save and before
 * publish; `error` severity blocks publish, `warning` does not (notes §2.3).
 *
 * Registry-dependent checks (tool names, model aliases) take the known sets
 * as parameters — the host enumerates UnifiedToolRegistry/alias rows and
 * passes them in (D48: no registry imports in core).
 */

import { GraphDocument, GraphDocumentSchema } from './types';
import { estimateTokensFromChars } from '@/lib/ai/pricing';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code:
    | 'schema'
    | 'start_node'
    | 'offgraph_node'
    | 'dangling_edge'
    | 'duplicate_id'
    | 'unreachable_node'
    | 'always_cycle'
    | 'always_outside_start_chain'
    | 'unknown_tool'
    | 'unknown_alias'
    | 'context_budget'
    | 'undeclared_slot';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationContext {
  /** Live UnifiedToolRegistry names; omit to skip the tool check. */
  knownTools?: string[];
  /** D4 alias names; omit to skip the alias check. */
  knownAliases?: string[];
}

const DEFAULT_NODE_BUDGET_TOKENS = 1200; // notes §6

export function validateGraph(documentRaw: unknown, ctx: ValidationContext = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const parsed = GraphDocumentSchema.safeParse(documentRaw);
  if (!parsed.success) {
    for (const err of parsed.error.errors.slice(0, 20)) {
      issues.push({ severity: 'error', code: 'schema', message: `${err.path.join('.')}: ${err.message}` });
    }
    return issues; // structural failure — nothing else is meaningful
  }
  const document: GraphDocument = parsed.data;

  const nodeIds = new Map<string, number>();
  for (const node of document.nodes) nodeIds.set(node.id, (nodeIds.get(node.id) ?? 0) + 1);
  for (const [id, count] of nodeIds) {
    if (count > 1) issues.push({ severity: 'error', code: 'duplicate_id', message: `Node id "${id}" appears ${count} times`, nodeId: id });
  }
  const edgeIds = new Map<string, number>();
  for (const edge of document.edges) edgeIds.set(edge.id, (edgeIds.get(edge.id) ?? 0) + 1);
  for (const [id, count] of edgeIds) {
    if (count > 1) issues.push({ severity: 'error', code: 'duplicate_id', message: `Edge id "${id}" appears ${count} times`, edgeId: id });
  }

  const startNodes = document.nodes.filter((n) => n.role === 'start');
  if (startNodes.length !== 1) {
    issues.push({ severity: 'error', code: 'start_node', message: `Graph must have exactly one start node (found ${startNodes.length})` });
  }
  const offgraphNodes = document.nodes.filter((n) => n.role === 'offgraph');
  if (offgraphNodes.length !== 1) {
    issues.push({ severity: 'error', code: 'offgraph_node', message: `Graph must have exactly one offgraph node (found ${offgraphNodes.length}) — off-graph is normal operation (Req 2.5)` });
  }

  for (const edge of document.edges) {
    for (const end of [edge.from, edge.to]) {
      if (!nodeIds.has(end)) {
        issues.push({ severity: 'error', code: 'dangling_edge', message: `Edge "${edge.id}" references missing node "${end}"`, edgeId: edge.id });
      }
    }
  }

  // ---- always-edge analysis (P5 + §3 turn-zero rule) ----
  const alwaysEdges = document.edges.filter((e) => e.condition.type === 'always');
  // Cycle detection over the always-subgraph
  const alwaysAdj = new Map<string, string[]>();
  for (const e of alwaysEdges) alwaysAdj.set(e.from, [...(alwaysAdj.get(e.from) ?? []), e.to]);
  const visiting = new Set<string>();
  const done = new Set<string>();
  const hasCycleFrom = (id: string): boolean => {
    if (done.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    for (const next of alwaysAdj.get(id) ?? []) {
      if (hasCycleFrom(next)) return true;
    }
    visiting.delete(id);
    done.add(id);
    return false;
  };
  for (const from of alwaysAdj.keys()) {
    if (hasCycleFrom(from)) {
      issues.push({ severity: 'error', code: 'always_cycle', message: `'always' edges form a cycle reachable from "${from}" (P5)`, nodeId: from });
      break;
    }
  }
  // 'always' edges are only followed during startPolicy — warn when authored
  // outside the start chain (they will never fire at runtime).
  if (startNodes.length === 1) {
    const chain = new Set<string>([startNodes[0].id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const e of alwaysEdges) {
        if (chain.has(e.from) && !chain.has(e.to)) {
          chain.add(e.to);
          grew = true;
        }
      }
    }
    for (const e of alwaysEdges) {
      if (!chain.has(e.from)) {
        issues.push({ severity: 'warning', code: 'always_outside_start_chain', message: `'always' edge "${e.id}" is outside the start chain — it will never fire at runtime (§3 turn-zero rule)`, edgeId: e.id });
      }
    }
  }

  // ---- reachability (warning) ----
  if (startNodes.length === 1) {
    const adj = new Map<string, string[]>();
    for (const e of document.edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    const reachable = new Set<string>([startNodes[0].id]);
    const queue = [startNodes[0].id];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const next of adj.get(cur) ?? []) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    for (const node of document.nodes) {
      // offgraph is entered implicitly (Req 2.5) — reachability doesn't apply
      if (node.role !== 'offgraph' && !reachable.has(node.id)) {
        issues.push({ severity: 'warning', code: 'unreachable_node', message: `Node "${node.name}" (${node.id}) is unreachable from the start node`, nodeId: node.id });
      }
    }
  }

  // ---- per-node checks ----
  for (const node of document.nodes) {
    // Static-item budget estimate (full budget enforcement with entity/chunk
    // sizes happens at runtime assembly — notes §6; validation flags what it
    // can compute without a DB).
    const budget = node.contextBudgetTokens ?? DEFAULT_NODE_BUDGET_TOKENS;
    const staticTokens = node.contextSet
      .filter((i): i is Extract<typeof i, { type: 'static' }> => i.type === 'static')
      .reduce((sum, i) => sum + estimateTokensFromChars(i.text.length), 0);
    if (staticTokens > budget) {
      issues.push({ severity: 'warning', code: 'context_budget', message: `Node "${node.name}": static context items alone (~${staticTokens} tokens) exceed the ${budget}-token budget — items will be dropped at runtime`, nodeId: node.id });
    }

    if (ctx.knownTools && node.toolAllowlist) {
      for (const tool of node.toolAllowlist) {
        if (!ctx.knownTools.includes(tool)) {
          issues.push({ severity: 'error', code: 'unknown_tool', message: `Node "${node.name}": tool "${tool}" is not in the registry (Req 1.6)`, nodeId: node.id });
        }
      }
    }
    if (ctx.knownAliases && node.modelAlias && !ctx.knownAliases.includes(node.modelAlias)) {
      issues.push({ severity: 'error', code: 'unknown_alias', message: `Node "${node.name}": model alias "${node.modelAlias}" is not in the registry (D4)`, nodeId: node.id });
    }

    // {{slots.x}} placeholders must reference a slot declared SOMEWHERE (P21)
    const declared = new Set(document.nodes.flatMap((n) => n.slots?.capture.map((c) => c.name) ?? []));
    const texts = [...node.guidance.promptFragments, ...node.contextSet.filter((i) => i.type === 'static').map((i) => (i as { text: string }).text)];
    for (const text of texts) {
      for (const match of text.matchAll(/\{\{slots\.([a-zA-Z0-9_]+)\}\}/g)) {
        if (!declared.has(match[1])) {
          issues.push({ severity: 'error', code: 'undeclared_slot', message: `Node "${node.name}": template references undeclared slot "${match[1]}" (P21)`, nodeId: node.id });
        }
      }
    }
  }

  // Slot conditions referencing undeclared slots
  const declaredSlots = new Set(document.nodes.flatMap((n) => n.slots?.capture.map((c) => c.name) ?? []));
  for (const edge of document.edges) {
    if (edge.condition.type === 'slot' && !declaredSlots.has(edge.condition.name)) {
      issues.push({ severity: 'error', code: 'undeclared_slot', message: `Edge "${edge.id}": slot condition references undeclared slot "${edge.condition.name}"`, edgeId: edge.id });
    }
  }

  return issues;
}
