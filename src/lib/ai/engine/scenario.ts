/**
 * Golden-scenario runner (conversation-engine Req 10, Block F2; P16).
 *
 * Runs scripted user turns through the REAL ConversationEngine (production
 * pipeline, D56 — never a parallel evaluator) with deterministic fakes for
 * every non-deterministic dependency:
 *
 *  - classifier: each turn may script the batched cheap-call result
 *    (edge scores, probe, lowEffort, slots, flags) — absent fields default
 *    per CheapCallResultSchema, exactly like a real parse;
 *  - embeddings: a stable sha256-derived unit vector (the same construction
 *    as the D46 fake in src/lib/ai/embeddings.ts — reimplemented here rather
 *    than imported because embeddings.ts drags the model registry (Prisma)
 *    into agent-core, which D48 forbids; the vectors only ever compare
 *    against each other inside one run, so parity of construction, not of
 *    module, is what determinism needs). Intent exemplars are re-embedded
 *    with the same fake, so an utterance matching an exemplar verbatim fires
 *    by similarity — the deterministic authoring rail. `intentMode:
 *    'classifier-only'` strips embeddings instead (the P11 degrade path),
 *    letting scripted edge scores govern intent edges;
 *  - clock: injectable monotonic fake (P16 — no wall-clock dependence).
 *
 * A scenario that needs a live model is not a golden scenario — it's a
 * live-fire drill (P16). This module is pure agent-core (D48): no Prisma, no
 * routes; hosts load GraphScenario rows / documents and hand them in.
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import { ConversationEngine, EngineStateStore } from './engine';
import type { EvaluatedEdge } from './evaluator';
import { CheapCallResultSchema, type CheapCallResult } from './cheap-call';
import {
  GraphDocumentSchema,
  VisitorFlagsSchema,
  type EngineState,
  type GraphDocument,
  type TransitionRecord,
} from './types';

// ============================================================================
// Scenario document schemas (stored in GraphScenario.turns / .expectedPath)
// ============================================================================

export const ScenarioTurnSchema = z.object({
  utterance: z.string(),
  /** Chip-tap evidence (P22) — fires `chip` edges deterministically by id. */
  chipId: z.string().optional(),
  /** Simulated tool results this turn (tool_result conditions). */
  toolEvents: z.array(z.object({ tool: z.string(), result: z.unknown() })).optional(),
  /** Simulated UI events (ui_state conditions; UI-less runtimes just omit). */
  uiEvents: z.array(z.record(z.unknown())).optional(),
  /**
   * Scripted classifier result for THIS turn (P16). Absent fields take the
   * CheapCallResultSchema defaults — identical to a real model response that
   * omitted them.
   */
  cheap: z
    .object({
      edgeScores: z.record(z.number().min(0).max(1)).optional(),
      probe: z.boolean().optional(),
      lowEffort: z.boolean().optional(),
      slots: z.record(z.string()).optional(),
      flags: VisitorFlagsSchema.optional(),
    })
    .optional(),
});
export type ScenarioTurn = z.infer<typeof ScenarioTurnSchema>;

/** The GraphScenario.turns column stores this whole object. */
export const ScenarioScriptSchema = z.object({
  turns: z.array(ScenarioTurnSchema).min(1),
  /**
   * 'embeddings' (default): intent exemplars re-embed with the stable fake —
   * verbatim exemplar text in an utterance fires by similarity.
   * 'classifier-only': embeddings stripped (P11 degrade) — scripted
   * cheap.edgeScores govern intent edges (recorded scenarios use this).
   */
  intentMode: z.enum(['embeddings', 'classifier-only']).default('embeddings'),
});
export type ScenarioScript = z.infer<typeof ScenarioScriptSchema>;

/** The GraphScenario.expectedPath column: ordered node ids, graph entry first. */
export const ScenarioExpectedPathSchema = z.array(z.string().min(1)).min(1);

// ============================================================================
// Deterministic embedding fake (P16 — same construction as the D46 fake)
// ============================================================================

const FAKE_DIMENSIONS = 256; // vectors only compare against each other here

export function scenarioStableVector(content: string): number[] {
  const vec: number[] = new Array(FAKE_DIMENSIONS);
  let seed = createHash('sha256').update(content).digest();
  let offset = 0;
  for (let i = 0; i < FAKE_DIMENSIONS; i++) {
    if (offset + 4 > seed.length) {
      seed = createHash('sha256').update(seed).digest();
      offset = 0;
    }
    vec[i] = seed.readUInt32BE(offset) / 0x80000000 - 1;
    offset += 4;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

// ============================================================================
// Runner
// ============================================================================

export interface ScenarioPerTurn {
  index: number;
  utterance: string;
  fired: { edgeId: string; from: string; to: string; conditionType: string; reason: string } | null;
  evaluated: EvaluatedEdge[];
  slotFills: Record<string, string>;
}

export interface ScenarioRunResult {
  pass: boolean;
  /** Node ids actually entered, graph entry first. */
  actualPath: string[];
  expectedPath: string[];
  perTurn: ScenarioPerTurn[];
  /** Human-readable path diff (Req 10.3) — '' when passing. */
  diff: string;
  /** Structural failure (invalid document/script) — the scenario cannot run. */
  error?: string;
}

/** In-memory EngineStateStore — single-threaded, CAS always honest. */
function memoryStore(collect: {
  transitions: TransitionRecord[];
  evaluated: Map<string, EvaluatedEdge[]>;
  slotFills: Map<string, Record<string, string>>;
}): EngineStateStore {
  let state: EngineState | null = null;
  return {
    async readEngineState() {
      return state ? { ...state, slots: { ...state.slots }, flags: { ...state.flags } } : null;
    },
    async mergeEngineState(_id, patch) {
      state = { ...(state ?? ({} as EngineState)), ...patch } as EngineState;
    },
    async claimTurn(_id, expected, turnId) {
      if (!state || state.lastEvaluatedTurnId !== expected) return false;
      state = { ...state, lastEvaluatedTurnId: turnId };
      return true;
    },
    async recordTransition(_id, record) {
      collect.transitions.push(record);
    },
    async recordEvaluated(_id, turnMessageId, rows) {
      collect.evaluated.set(turnMessageId, rows);
    },
    async recordSlotFills(_id, event) {
      collect.slotFills.set(event.turnMessageId, event.fills);
    },
  };
}

/** Renders the readable path diff (Req 10.3): aligned, divergence called out. */
export function renderScenarioDiff(expected: string[], actual: string[], perTurn: ScenarioPerTurn[]): string {
  const lines: string[] = [];
  lines.push(`expected: ${expected.join(' → ')}`);
  lines.push(`actual:   ${actual.join(' → ') || '(no traversal)'}`);
  let divergence = -1;
  const max = Math.max(expected.length, actual.length);
  for (let i = 0; i < max; i++) {
    if (expected[i] !== actual[i]) {
      divergence = i;
      break;
    }
  }
  if (divergence >= 0) {
    lines.push(
      `first divergence at step ${divergence + 1}: expected ${expected[divergence] ?? '(end of path)'}, actual ${actual[divergence] ?? '(end of path)'}`
    );
  }
  const noFire = perTurn.filter((t) => !t.fired);
  if (noFire.length > 0) {
    lines.push(`turns that fired nothing: ${noFire.map((t) => `#${t.index + 1} "${t.utterance.slice(0, 60)}"`).join(', ')}`);
  }
  return lines.join('\n');
}

export async function runScenario(args: {
  /** Raw graph document (draft or version doc) — validated here. */
  document: unknown;
  /** Raw GraphScenario.turns column value. */
  turns: unknown;
  /** Raw GraphScenario.expectedPath column value. */
  expectedPath: unknown;
  /** Production probe patterns (host config, D48). */
  probePatterns?: RegExp[];
  log?: (message: string, data?: unknown) => void;
}): Promise<ScenarioRunResult> {
  const empty: Omit<ScenarioRunResult, 'error'> = {
    pass: false,
    actualPath: [],
    expectedPath: [],
    perTurn: [],
    diff: '',
  };

  const docParse = GraphDocumentSchema.safeParse(args.document);
  if (!docParse.success) {
    return { ...empty, error: `graph document invalid: ${docParse.error.issues[0]?.message ?? 'parse failed'}` };
  }
  const scriptParse = ScenarioScriptSchema.safeParse(args.turns);
  if (!scriptParse.success) {
    return { ...empty, error: `scenario turns invalid: ${scriptParse.error.issues[0]?.message ?? 'parse failed'}` };
  }
  const pathParse = ScenarioExpectedPathSchema.safeParse(args.expectedPath);
  if (!pathParse.success) {
    return { ...empty, error: `expectedPath invalid: ${pathParse.error.issues[0]?.message ?? 'parse failed'}` };
  }
  const script = scriptParse.data;
  const expectedPath = pathParse.data;

  // Deterministic embeddings (P16): re-embed intent exemplars with the stable
  // fake ('embeddings' mode) or strip them entirely ('classifier-only' — the
  // P11 degrade path, where scripted scores govern).
  const document: GraphDocument = { ...docParse.data };
  if (script.intentMode === 'classifier-only') {
    delete document.embeddings;
  } else {
    const embeddings: NonNullable<GraphDocument['embeddings']> = {};
    for (const edge of document.edges) {
      if (edge.condition.type !== 'intent') continue;
      embeddings[edge.id] = {
        model: 'scenario-fake',
        vectors: edge.condition.exemplars.map((e) => scenarioStableVector(e)),
      };
    }
    document.embeddings = embeddings;
  }

  const collect = {
    transitions: [] as TransitionRecord[],
    evaluated: new Map<string, EvaluatedEdge[]>(),
    slotFills: new Map<string, Record<string, string>>(),
  };

  // Per-turn scripted cheap-call result, set before each processTurn.
  let currentCheap: CheapCallResult | null = null;

  // Injectable monotonic clock (P16): fixed epoch, +30s per read.
  let tick = 0;
  const fixedEpoch = Date.UTC(2026, 0, 1);

  const engine = new ConversationEngine({
    graphSource: {
      async getActiveGraph() {
        return { graphId: 'scenario', versionId: 'scenario-version', document };
      },
      async getVersion(versionId) {
        return versionId === 'scenario-version' ? document : null;
      },
    },
    stateStore: memoryStore(collect),
    evaluator: {
      embedUtterance: async (text) => scenarioStableVector(text),
      runCheapCall: async () => currentCheap,
      probePatterns: args.probePatterns ?? [],
      log: args.log,
    },
    resolveContextSet: async () => ({ text: null, drops: [] }),
    now: () => fixedEpoch + 30_000 * tick++,
    log: args.log,
  });

  const perTurn: ScenarioPerTurn[] = [];
  for (let i = 0; i < script.turns.length; i++) {
    const turn = script.turns[i];
    // Parse through the SAME schema a real classifier response goes through —
    // defaults and tolerance behave identically (D56: production pipeline).
    currentCheap = turn.cheap ? CheapCallResultSchema.parse(turn.cheap) : CheapCallResultSchema.parse({});
    const turnMessageId = `scenario_turn_${i + 1}`;
    const result = await engine.processTurn('scenario-conversation', {
      turnMessageId,
      utterance: turn.utterance,
      chipId: turn.chipId,
      toolEvents: turn.toolEvents as Array<{ tool: string; result: unknown }> | undefined,
      uiEvents: turn.uiEvents,
    }, {
      provider: 'scenario',
      isNative: false,
      isPublic: true,
      debug: true,
      memoryEnabled: true,
    });
    perTurn.push({
      index: i,
      utterance: turn.utterance,
      fired: result.debug?.fired ?? null,
      evaluated: collect.evaluated.get(turnMessageId) ?? result.debug?.evaluated ?? [],
      slotFills: collect.slotFills.get(turnMessageId) ?? {},
    });
  }

  const actualPath = collect.transitions.map((t) => t.toNode);
  const pass = actualPath.length === expectedPath.length && actualPath.every((n, i) => n === expectedPath[i]);
  return {
    pass,
    actualPath,
    expectedPath,
    perTurn,
    diff: pass ? '' : renderScenarioDiff(expectedPath, actualPath, perTurn),
  };
}

// ============================================================================
// Record-from-test-session (Req 10.2) — pure transform; hosts supply the data
// ============================================================================

/**
 * Build an editable scenario script from a finished (test) session's actual
 * traversal. Deterministic replay strategy per condition type:
 *  - pattern/chip/ui_state/tool_result: re-fire naturally from the recorded
 *    evidence (chip ids are recovered from the marker evidence text);
 *  - intent/pivot: `intentMode: 'classifier-only'` + a scripted winning score
 *    on the firing turn (the live similarity/score is not replayable);
 *  - slot: the recorded slot_filled events script `cheap.slots` on their turn;
 *  - probe: scripts `cheap.probe: true` on the firing turn (covers the
 *    classifier-flagged case; pattern probes also re-fire naturally);
 *  - turn_quality: scripts `cheap.lowEffort: true` on the firing turn only —
 *    thresholds > 1 whose earlier turns were classifier-flagged (not
 *    heuristic) need hand-editing, which Req 10.2 expects ("recorded, then
 *    edited").
 */
export function buildScenarioFromTraversal(args: {
  /** The conversation's user turns, in order. */
  userTurns: Array<{ id: string; content: string }>;
  /** node_transition markers, in order (turn-zero entry first). */
  transitions: Array<{
    toNode: string;
    turnMessageId: string | null;
    conditionType: string | null;
    edgeId: string | null;
    evidence?: string | null;
  }>;
  /** slot_filled events: turnMessageId → fills. */
  slotFills?: Array<{ turnMessageId: string; fills: Record<string, string> }>;
}): { turns: ScenarioScript; expectedPath: string[] } {
  const expectedPath = args.transitions.map((t) => t.toNode);
  const byTurn = new Map(args.transitions.filter((t) => t.turnMessageId).map((t) => [t.turnMessageId as string, t]));
  const fillsByTurn = new Map((args.slotFills ?? []).map((f) => [f.turnMessageId, f.fills]));
  let needsClassifierOnly = false;

  const turns: ScenarioTurn[] = args.userTurns.map((ut) => {
    const turn: ScenarioTurn = { utterance: ut.content };
    const cheap: NonNullable<ScenarioTurn['cheap']> = {};
    const fired = byTurn.get(ut.id);
    if (fired) {
      if (fired.conditionType === 'intent' || fired.conditionType === 'pivot') {
        needsClassifierOnly = true;
        if (fired.edgeId) cheap.edgeScores = { [fired.edgeId]: 0.9 };
      } else if (fired.conditionType === 'chip') {
        const m = /^chip (\S+) tapped$/.exec(fired.evidence ?? '');
        if (m) turn.chipId = m[1];
      } else if (fired.conditionType === 'probe') {
        cheap.probe = true;
      } else if (fired.conditionType === 'turn_quality') {
        cheap.lowEffort = true;
      }
    }
    const fills = fillsByTurn.get(ut.id);
    if (fills && Object.keys(fills).length > 0) cheap.slots = fills;
    if (Object.keys(cheap).length > 0) turn.cheap = cheap;
    return turn;
  });

  return {
    turns: { turns, intentMode: needsClassifierOnly ? 'classifier-only' : 'embeddings' },
    expectedPath,
  };
}
