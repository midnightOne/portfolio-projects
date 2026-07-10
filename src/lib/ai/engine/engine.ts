/**
 * ConversationEngine — orchestration only (notes §1/§2). Pure given deps:
 * receives a GraphSource, a state store, evaluator deps, and a context
 * resolver — never Prisma, never providers, never routes (D48; the
 * Prisma-backed composition lives in src/lib/services/ai/engine-runtime.ts).
 *
 * Serverless truths (notes §3): no in-memory engine state — every processTurn
 * reconstructs from latestState + the request payload; concurrent invocations
 * are resolved by the CAS claim (P3); replayed turns by the idempotency gate
 * (P2). Engine errors NEVER break the conversation — callers wrap in
 * swallow-all (P1); this class also fails toward "no transition".
 */

import type { GraphSource } from './graph-source';
import type {
  EngineDirective,
  EngineState,
  GraphDocument,
  GraphNode,
  StartDirective,
  TransitionRecord,
  TurnEvidence,
} from './types';
import { EngineStateSchema } from './types';
import { evaluateEdges, EvaluatorDeps, EvaluatedEdge } from './evaluator';
import { buildEngineContextText, buildTransitionDirective } from './directive';

const DEFAULT_NODE_BUDGET_TOKENS = 1200; // notes §6
const MAX_ALWAYS_HOPS = 3; // P5 hard cap

export interface EngineStateStore {
  /** Tolerant read of latestState.engine (missing/invalid → null — P18). */
  readEngineState(conversationId: string): Promise<EngineState | null>;
  /** MERGE into latestState.engine, never blob-replace (P18). */
  mergeEngineState(conversationId: string, patch: Partial<EngineState>): Promise<void>;
  /**
   * Atomic CAS (P3): set engine.lastEvaluatedTurnId = turnId iff it still
   * equals expected. False = a concurrent invocation won — abort silently.
   */
  claimTurn(conversationId: string, expected: string | null, turnId: string): Promise<boolean>;
  recordTransition(conversationId: string, record: TransitionRecord): Promise<void>;
  /** Debug/test sessions only (Req 7.3) — evaluated-but-not-taken rows. */
  recordEvaluated(conversationId: string, turnMessageId: string, rows: EvaluatedEdge[]): Promise<void>;
}

export interface ResolveContextOptions {
  isPublic: boolean;
  budgetTokens: number;
}

export interface EngineHostDeps {
  graphSource: GraphSource;
  stateStore: EngineStateStore;
  evaluator: EvaluatorDeps;
  /** B4: typed context-set resolution (visibility-filtered, budgeted — P12/P13). */
  resolveContextSet(
    items: GraphNode['contextSet'],
    opts: ResolveContextOptions
  ): Promise<{ text: string | null; drops: string[] }>;
  /** Full provider-ready tool array for a node allowlist (P8); undefined = don't carry tools. */
  buildProviderTools?(provider: string, allowlist: string[]): Array<Record<string, unknown>> | undefined;
  log?: (message: string, data?: unknown) => void;
}

export interface ProcessTurnContext {
  provider: string;
  /** Native voice gets directives on the /log response; cascade/text re-derive (notes §2.2.9). */
  isNative: boolean;
  isPublic: boolean;
  /** Debug/test session — record evaluated-but-not-taken edges (Req 7.3). */
  debug?: boolean;
}

export interface ProcessTurnResult {
  directive: EngineDirective | null;
  transition: TransitionRecord | null;
}

export class ConversationEngine {
  constructor(private readonly deps: EngineHostDeps) {}

  private log(message: string, data?: unknown): void {
    this.deps.log?.(message, data);
  }

  /** Parse latestState.engine tolerantly (P18): anything invalid = engine inactive. */
  static parseEngineState(raw: unknown): EngineState | null {
    const parsed = EngineStateSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  /** Follow the start node's `always` chain, hard-capped (P5/notes §2.1.3). */
  private resolveLandingNode(document: GraphDocument): GraphNode | null {
    let current = document.nodes.find((n) => n.role === 'start') ?? null;
    if (!current) return null;
    for (let hop = 0; hop < MAX_ALWAYS_HOPS; hop++) {
      const next = document.edges
        .filter((e) => e.from === current!.id && e.condition.type === 'always')
        .sort((a, b) => a.priority - b.priority)[0];
      if (!next) break;
      const target = document.nodes.find((n) => n.id === next.to);
      if (!target) break;
      current = target;
    }
    return current;
  }

  private async buildNodeContext(
    node: GraphNode,
    slots: Record<string, string>,
    opts: { isPublic: boolean }
  ): Promise<{ text: string; drops: string[] }> {
    const budget = node.contextBudgetTokens ?? DEFAULT_NODE_BUDGET_TOKENS;
    const resolved = await this.deps.resolveContextSet(node.contextSet, {
      isPublic: opts.isPublic,
      budgetTokens: budget,
    });
    const built = buildEngineContextText(node, resolved.text, slots);
    return { text: built.text, drops: resolved.drops };
  }

  /**
   * Session-start policy (notes §2.1) — STATELESS: resolves the active graph
   * and shapes mint-time assembly. Conversation stamping happens at the first
   * processTurn (client-direct voice mints before the conversation exists).
   * Returns null when no graph is active → callers use today's static path
   * unchanged (Req 2.7).
   */
  async startPolicy(opts: { isPublic: boolean }): Promise<StartDirective | null> {
    const active = await this.deps.graphSource.getActiveGraph();
    if (!active) return null;
    const landing = this.resolveLandingNode(active.document);
    if (!landing) {
      this.log('engine: active graph has no start node — treating as inactive');
      return null;
    }
    const context = await this.buildNodeContext(landing, {}, { isPublic: opts.isPublic });
    return {
      graphId: active.graphId,
      graphVersionId: active.versionId,
      nodeId: landing.id,
      promptFragments: landing.guidance.promptFragments,
      contextText: context.text,
      toolAllowlist: landing.toolAllowlist,
      modelAlias: landing.modelAlias,
    };
  }

  /**
   * Resume policy (Req 2.6): a resumed leg re-enters the PERSISTED node — the
   * engine state survives leg boundaries. Falls back to startPolicy semantics
   * when the conversation has no engine state.
   */
  async resumePolicy(
    engineState: EngineState | null,
    opts: { isPublic: boolean }
  ): Promise<StartDirective | null> {
    if (!engineState || !engineState.nodeId || !engineState.graphVersionId) {
      return this.startPolicy(opts);
    }
    const document = await this.deps.graphSource.getVersion(engineState.graphVersionId);
    const node = document?.nodes.find((n) => n.id === engineState.nodeId);
    if (!document || !node) {
      this.log('engine: resume could not load pinned node — falling back to startPolicy', {
        graphVersionId: engineState.graphVersionId,
        nodeId: engineState.nodeId,
      });
      return this.startPolicy(opts);
    }
    const context = await this.buildNodeContext(node, engineState.slots, { isPublic: opts.isPublic });
    return {
      graphId: '',
      graphVersionId: engineState.graphVersionId,
      nodeId: node.id,
      promptFragments: node.guidance.promptFragments,
      contextText: context.text,
      toolAllowlist: node.toolAllowlist,
      modelAlias: node.modelAlias,
    };
  }

  /**
   * Per-turn evaluation (notes §2.2). Called AFTER the user turn is persisted.
   * P1 is enforced HERE as well as at call sites: any error inside is logged
   * and swallowed — a graph bug degrades to "the engine stopped steering",
   * never to a failed turn.
   */
  async processTurn(
    conversationId: string,
    evidence: TurnEvidence,
    ctx: ProcessTurnContext
  ): Promise<ProcessTurnResult> {
    try {
      return await this.processTurnInner(conversationId, evidence, ctx);
    } catch (err) {
      this.log('engine: processTurn failed — turn proceeds unsteered (P1)', err);
      return { directive: null, transition: null };
    }
  }

  private async processTurnInner(
    conversationId: string,
    evidence: TurnEvidence,
    ctx: ProcessTurnContext
  ): Promise<ProcessTurnResult> {
    const none: ProcessTurnResult = { directive: null, transition: null };
    let state = await this.deps.stateStore.readEngineState(conversationId);

    // ---- First sight of this conversation: stamp graph entry (or engine-off) ----
    if (state === null) {
      const active = await this.deps.graphSource.getActiveGraph();
      if (!active) {
        // Pin "no graph" for the conversation's lifetime (P6 applies to absence too)
        await this.deps.stateStore.mergeEngineState(conversationId, {
          engineStateVersion: 1,
          nodeId: null,
          graphVersionId: null,
          lastEvaluatedTurnId: null,
          directiveSeq: 0,
          consecutiveLowEffort: 0,
          slots: {},
        });
        return none;
      }
      const landing = this.resolveLandingNode(active.document);
      if (!landing) return none;
      state = {
        engineStateVersion: 1,
        nodeId: landing.id,
        graphVersionId: active.versionId,
        lastEvaluatedTurnId: null,
        directiveSeq: 0,
        consecutiveLowEffort: 0,
        slots: {},
      };
      await this.deps.stateStore.mergeEngineState(conversationId, state);
      // Turn-zero entry marker (notes §2.1.5) — replay shows graph entry
      await this.deps.stateStore.recordTransition(conversationId, {
        fromNode: null,
        toNode: landing.id,
        edgeId: null,
        conditionType: null,
        evidence: 'session start',
        graphVersionId: active.versionId,
        turnMessageId: null,
      });
    }

    if (!state.nodeId || !state.graphVersionId) return none; // engine off for this conversation

    // ---- Idempotency gate (P2): replayed turn → no re-evaluation ----
    if (state.lastEvaluatedTurnId === evidence.turnMessageId) return none;

    const document = await this.deps.graphSource.getVersion(state.graphVersionId);
    if (!document) {
      this.log('engine: pinned graph version unavailable — engine stops steering this conversation', {
        graphVersionId: state.graphVersionId,
      });
      return none;
    }
    const currentNode = document.nodes.find((n) => n.id === state!.nodeId);
    if (!currentNode) {
      this.log('engine: current node missing from pinned document', { nodeId: state.nodeId });
      return none;
    }

    // ---- Evaluate (also evaluates off-graph re-entry: same walk from the offgraph node) ----
    const outcome = await evaluateEdges({
      node: currentNode,
      document,
      evidence,
      state,
      deps: this.deps.evaluator,
    });

    // ---- CAS claim (P3): exactly one invocation wins this turn ----
    const claimed = await this.deps.stateStore.claimTurn(
      conversationId,
      state.lastEvaluatedTurnId,
      evidence.turnMessageId
    );
    if (!claimed) return none; // loser writes nothing — no markers, no directive

    // Per-turn state (counters, slot extractions) — merge-write (P18)
    await this.deps.stateStore.mergeEngineState(conversationId, {
      consecutiveLowEffort: outcome.lowEffortCount,
      slots: outcome.slots,
    });

    if (ctx.debug && outcome.evaluated.length > 0) {
      try {
        await this.deps.stateStore.recordEvaluated(conversationId, evidence.turnMessageId, outcome.evaluated);
      } catch (err) {
        this.log('engine: recordEvaluated failed (debug telemetry only)', err);
      }
    }

    if (!outcome.fired) return none; // staying put is the default (§2.2.7)

    const targetNode = document.nodes.find((n) => n.id === outcome.fired!.to);
    if (!targetNode) {
      this.log('engine: fired edge targets missing node — transition aborted', { edgeId: outcome.fired.id });
      return none;
    }

    // ---- Transition: marker → context → directive (notes §2.2.8) ----
    const transition: TransitionRecord = {
      fromNode: currentNode.id,
      toNode: targetNode.id,
      edgeId: outcome.fired.id,
      conditionType: outcome.fired.condition.type,
      evidence: (outcome.firedReason ?? '').slice(0, 300),
      graphVersionId: state.graphVersionId,
      turnMessageId: evidence.turnMessageId,
    };
    await this.deps.stateStore.recordTransition(conversationId, transition);

    // Purge policy (Req 3.6): 'replace' = target's context set replaces the
    // engine key; 'keep' = previous node's rendered context rides along.
    const targetContext = await this.buildNodeContext(targetNode, outcome.slots, { isPublic: ctx.isPublic });
    let engineText = targetContext.text;
    if (outcome.fired.purge === 'keep') {
      const previous = await this.buildNodeContext(currentNode, outcome.slots, { isPublic: ctx.isPublic });
      engineText = `${targetContext.text}\n\n[carried over from previous state — purge:'keep']\n${previous.text}`;
    }

    const seq = state.directiveSeq + 1;
    const providerTools =
      targetNode.toolAllowlist && this.deps.buildProviderTools
        ? this.deps.buildProviderTools(ctx.provider, targetNode.toolAllowlist)
        : undefined;

    await this.deps.stateStore.mergeEngineState(conversationId, {
      nodeId: targetNode.id,
      directiveSeq: seq,
    });

    const directive = buildTransitionDirective({
      seq,
      engineContextText: engineText,
      providerTools,
    });

    return { directive: ctx.isNative ? directive : null, transition };
  }
}
