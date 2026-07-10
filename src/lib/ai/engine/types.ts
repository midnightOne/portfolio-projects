/**
 * conversation-engine — shared types (D47; module layout per
 * .kiro/specs/conversation-engine/design-implementation-notes.md §1).
 *
 * Block A seeds this file with the one contract that must cross the
 * client/server boundary before the engine core exists: the EngineDirective
 * that rides the `/api/ai/conversation/log` POST response (task A4). Block B1
 * adds the graph document types (GraphDocument, GraphNode, GraphEdge,
 * EdgeCondition, ContextItemSpec, TurnEvidence, TransitionRecord) alongside.
 *
 * D48: agent-core territory — no imports from src/app/** or components. Zod
 * schemas are the single source of validation; the admin editor client will
 * import these same schemas.
 */

import { z } from 'zod';

/**
 * Server → client engine directive (design §1 "directive return path").
 *
 * Always a FULL snapshot, never a delta (notes P8: OpenAI `session.update` is
 * replacement, not patch — so `instructions` is the complete assembled string
 * (base + node guidance) and `tools` is the complete provider-ready schema
 * array). `contextItems` are published into the D55 context buffer under
 * their source keys (replace-per-key) and reach the model via the floating
 * block, not as free-standing messages.
 *
 * `seq` is monotonically increasing per conversation; the base adapter applies
 * latest-wins and drops stale/duplicate directives (notes P4) — a retried /log
 * POST returning the same directive twice therefore applies it exactly once.
 *
 * Native voice only: cascade/text runtimes never consume this field — their
 * next turn re-derives everything server-side from `latestState` (notes §2.2.9).
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
