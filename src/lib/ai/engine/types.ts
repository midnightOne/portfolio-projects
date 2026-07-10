/**
 * conversation-engine — shared types (D47; module layout per
 * .kiro/specs/conversation-engine/design-implementation-notes.md §1).
 *
 * Single source for the graph document schema (design.md §3), runtime
 * evidence/state contracts, and the EngineDirective that rides the
 * `/api/ai/conversation/log` response (task A4). Zod schemas are the single
 * validation source — the admin editor client imports these same schemas.
 *
 * D48: agent-core territory — no imports from src/app/** or components, no
 * Prisma, no hardcoded prompts/content (all guidance comes from the graph
 * document; probe patterns etc. are injected as deps).
 */

import { z } from 'zod';

// ============================================================================
// Graph document (design §3) — one immutable JSON document per version
// ============================================================================

export const ContextItemSpecSchema = z.discriminatedUnion('type', [
  /** A project/ContentEntity → its T1 summary. */
  z.object({ type: z.literal('entity'), entityId: z.string().min(1) }),
  /** A specific T2/T3 chunk by id. */
  z.object({ type: z.literal('chunk'), chunkId: z.string().min(1) }),
  /** A stored query executed against ContentSearchService on node entry. */
  z.object({
    type: z.literal('search'),
    query: z.string().min(1),
    limit: z.number().int().positive().max(10).optional(),
  }),
  /** Owner-authored snippet, verbatim. */
  z.object({ type: z.literal('static'), text: z.string() }),
  /** Narrow F-I-D Details to a project/section (costs ~0 tokens). */
  z.object({
    type: z.literal('fid-scope'),
    projectId: z.string().min(1),
    sectionAnchor: z.string().optional(),
  }),
]);
export type ContextItemSpec = z.infer<typeof ContextItemSpecSchema>;

export const EdgeConditionSchema = z.discriminatedUnion('type', [
  /** Exemplar-embedding similarity (version-pinned vectors, P11) with a
   *  default-cheap classifier as the tiebreaker band (P10). */
  z.object({
    type: z.literal('intent'),
    exemplars: z.array(z.string().min(1)).min(1),
    threshold: z.number().min(0).max(1).optional(),
  }),
  /** Keyword/regex on the user turn — free tier. */
  z.object({ type: z.literal('pattern'), anyOf: z.array(z.string().min(1)).min(1) }),
  /** Predicate over a tool result this turn — free tier. */
  z.object({
    type: z.literal('tool_result'),
    tool: z.string().min(1),
    predicate: z.object({
      path: z.string(),
      op: z.enum(['contains', 'eq', 'exists']),
      value: z.unknown().optional(),
    }),
  }),
  /** Navigation/F-I-D event evidence — free tier (Req 6.2: never fires on UI-less runtimes). */
  z.object({
    type: z.literal('ui_state'),
    event: z.enum(['project_opened', 'section_viewed', 'route_changed']),
    match: z.string().optional(),
  }),
  /** Chip tap by id — the deterministic 100%-reliable rail (P22). */
  z.object({ type: z.literal('chip'), chipId: z.string().min(1) }),
  /** Slot state as transition evidence (Req 14.4). */
  z.object({
    type: z.literal('slot'),
    name: z.string().min(1),
    op: z.enum(['filled', 'missing', 'eq']),
    value: z.string().optional(),
  }),
  /** Consecutive low-effort counter (vague-browser escalation, Req 18.2). */
  z.object({ type: z.literal('turn_quality'), consecutiveLowEffort: z.number().int().min(1) }),
  /** Injection/off-topic probing (pattern + classifier v1; D41(b) watchdog later). */
  z.object({ type: z.literal('probe') }),
  /** Explicit topic-change detection (classifier-only). */
  z.object({ type: z.literal('pivot') }),
  /** Unconditional — start-chain only, resolved at startPolicy (never at runtime, P5/§3). */
  z.object({ type: z.literal('always') }),
]);
export type EdgeCondition = z.infer<typeof EdgeConditionSchema>;

export const GraphNodeSchema = z.object({
  /** Stable across versions (Req 1.5) — telemetry and annotations join on it. */
  id: z.string().min(1),
  name: z.string().min(1),
  /** Exactly one 'start' and exactly one 'offgraph' per graph (validation). */
  role: z.enum(['start', 'state', 'offgraph']),
  /** Req 1.2 — grounded framing, never canned verbatim reply text. */
  guidance: z.object({
    promptFragments: z.array(z.string()).default([]),
    talkingPoints: z.array(z.string()).optional(),
    negative: z.array(z.string()).optional(),
    navRefs: z.array(z.object({ label: z.string(), navTarget: z.string() })).optional(),
    onEnterSuggestion: z.string().optional(),
    /** Req 19.6 — node's working goals, rendered into the floating block. */
    agenda: z.array(z.string()).optional(),
  }),
  contextSet: z.array(ContextItemSpecSchema).default([]),
  contextBudgetTokens: z.number().int().positive().optional(),
  /** Registry names; absent = session default tool set (Req 4.4). */
  toolAllowlist: z.array(z.string().min(1)).optional(),
  /** D4 alias; absent = keep the session's current model (Req 5.1). */
  modelAlias: z.string().optional(),
  voiceClipCategories: z.array(z.string()).optional(),
  /** Req 13 — visitor-visible surfaces (ride the directive; applied in Block G). */
  ux: z
    .object({
      chips: z
        .array(z.object({ id: z.string().min(1), label: z.string().min(1), sendText: z.string().optional() }))
        .optional(),
      topicLabel: z.string().optional(),
      onEnterStaging: z.object({ navTarget: z.string(), highlightText: z.string().optional() }).optional(),
    })
    .optional(),
  /** Req 14 — capture specs; values are conversation-scoped. */
  slots: z
    .object({
      capture: z.array(
        z.object({
          name: z.string().min(1),
          type: z.enum(['string', 'enum', 'email', 'company', 'freeform']),
          hint: z.string(),
          required: z.boolean().optional(),
        })
      ),
    })
    .optional(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  /** Evaluation order, ascending; first match fires (Req 2.2). */
  priority: z.number().int(),
  condition: EdgeConditionSchema,
  /** Engine-key purge policy on traversal (Req 3.6). */
  purge: z.enum(['replace', 'keep']).default('replace'),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphDocumentSchema = z.object({
  nodes: z.array(GraphNodeSchema).min(1),
  edges: z.array(GraphEdgeSchema).default([]),
  /** Editor canvas layout — persisted with the draft, opaque to the runtime. */
  layout: z.record(z.unknown()).optional(),
  /**
   * Intent-exemplar embeddings computed at publish (notes §2.3):
   * edgeId → { model (recorded id — P11 drift detection), vectors (one per exemplar) }.
   */
  embeddings: z
    .record(z.object({ model: z.string(), vectors: z.array(z.array(z.number())) }))
    .optional(),
});
export type GraphDocument = z.infer<typeof GraphDocumentSchema>;

// ============================================================================
// Runtime contracts
// ============================================================================

/** Per-turn evidence gathered by the hosting route (notes §2.2 step 5). */
export interface TurnEvidence {
  /** Persisted user-turn message id — the P2 idempotency key. */
  turnMessageId: string;
  utterance: string;
  /** Chip tap evidence (P22) — deterministic, no classifier. */
  chipId?: string;
  /** Tool events since the previous user turn (from the request payload). */
  toolEvents?: Array<{ tool: string; result: unknown }>;
  /** UI-state deltas from the request payload (task A4 uiEvidence). */
  uiEvents?: Array<Record<string, unknown>>;
}

/**
 * The engine's keys inside AIConversation.latestState (design §2
 * ConversationState.engine). Reads are tolerant (missing = engine inactive);
 * writes MERGE, never replace the blob (P18). `nodeId: null` means the
 * conversation started with no active graph and stays engine-off for its
 * lifetime (P6 pinning applies to "no graph" too).
 */
export const EngineStateSchema = z.object({
  engineStateVersion: z.literal(1),
  nodeId: z.string().nullable(),
  graphVersionId: z.string().nullable(),
  lastEvaluatedTurnId: z.string().nullable(),
  /** Monotonic directive sequence for this conversation (P4). */
  directiveSeq: z.number().int().nonnegative().default(0),
  consecutiveLowEffort: z.number().int().nonnegative().default(0),
  /** Stated facts captured from user turns (Req 14; extraction shares the P26 call). */
  slots: z.record(z.string()).default({}),
  pendingModelSwap: z.object({ alias: z.string(), requestedAt: z.string() }).optional(),
});
export type EngineState = z.infer<typeof EngineStateSchema>;

/** node_transition marker payload (Req 7.1). */
export interface TransitionRecord {
  fromNode: string | null;
  toNode: string;
  edgeId: string | null;
  conditionType: string | null;
  /** Compact evidence reference: utterance snippet / chip id / tool name. */
  evidence?: string;
  graphVersionId: string;
  turnMessageId: string | null;
}

/**
 * startPolicy output (notes §2.1): shapes session-mint instruction assembly.
 * Stateless — conversation stamping happens at the first processTurn, because
 * client-direct voice mints before the conversation row exists.
 */
export interface StartDirective {
  graphId: string;
  graphVersionId: string;
  nodeId: string;
  /** Appended AFTER base instructions (notes §2.1.4). */
  promptFragments: string[];
  /** Resolved node context set (budgeted, visibility-filtered). */
  contextText: string | null;
  /** Registry names; undefined = session default set. */
  toolAllowlist?: string[];
  /** Overrides the session alias AT MINT only (no deferred-swap machinery at start). */
  modelAlias?: string;
}

/**
 * Server → client engine directive (design §1 "directive return path").
 *
 * Always a FULL snapshot, never a delta (notes P8). Delivery strategy (owner,
 * 2026-07-09): sessions mint with full tools + guidance; node state reaches
 * the live model as engine-key context in the floating block (`contextItems`)
 * — strong appended guidance — rather than mid-session instruction
 * replacement. `tools` carries the complete provider-ready schema array when
 * a node narrows the surface (applied live on OpenAI; advisory-only on
 * Gemini, where enforcement is server-side in /api/ai/tools/execute).
 *
 * `seq` is monotonically increasing per conversation; the base adapter
 * applies latest-wins and drops stale/duplicate directives (notes P4) — a
 * retried /log POST returning the same directive twice applies once.
 *
 * Native voice only: cascade/text runtimes never consume this field — their
 * next turn re-derives everything server-side from `latestState`
 * (notes §2.2.9).
 */
export const EngineDirectiveSchema = z.object({
  seq: z.number().int().nonnegative(),
  /** Complete assembled instruction string (replacement semantics, P8). */
  instructions: z.string().optional(),
  /** Complete provider-ready tool schema array (replacement semantics, P8). */
  tools: z.array(z.record(z.unknown())).optional(),
  /** Engine-owned context, published into the D55 buffer per source key. */
  contextItems: z
    .array(
      z.object({
        key: z.string().min(1),
        text: z.string(),
        ttlMs: z.number().int().positive().optional(),
      })
    )
    .optional(),
});
export type EngineDirective = z.infer<typeof EngineDirectiveSchema>;
