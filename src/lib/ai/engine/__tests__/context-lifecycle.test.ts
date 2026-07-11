/**
 * Block J — conversation memory & context lifecycle (D46 deterministic suite):
 * ConversationState contract (J1/P18), visitor profile fast flags + rendering
 * + slots/flags unification (J2/P26/P31), summarizer prompt/parse/replace
 * semantics (J3/P29/P30), rolling-window prune selection (J4/P28).
 */

import {
  ConversationStateSchema,
  EngineState,
  EngineStateSchema,
  GraphDocument,
  TurnEvidence,
} from '../types';
import { ConversationEngine, EngineStateStore } from '../engine';
import { validateGraph } from '../validation';
import { evaluateEdges, EvaluatorDeps } from '../evaluator';
import {
  buildCheapCallPrompt,
  cheapCallNeeded,
  parseCheapCallResponse,
  CheapCallResult,
} from '../cheap-call';
import { resolveSlotTemplates } from '../directive';
import { renderProfileText, flagsEqual, mergeFastFlags } from '../profile';
import {
  buildSummarizerPrompt,
  parseSummarizerResponse,
  summarizerNeeded,
  applySummarizerProfile,
  SUMMARY_CHAR_CAP,
} from '../summarizer';
import { selectPrunableTurns, renderSummaryText, WindowTurnRef } from '../window';

// ---------------------------------------------------------------------------
// Fixtures (mirrors engine.test.ts conventions)
// ---------------------------------------------------------------------------

const baseNode = (id: string, role: 'start' | 'state' | 'offgraph' = 'state', extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  role,
  guidance: { promptFragments: [`guidance for ${id}`] },
  contextSet: [],
  ...extra,
});

function doc(partial: Partial<GraphDocument> & { nodes: unknown[]; edges?: unknown[] }): GraphDocument {
  return { edges: [], ...partial } as unknown as GraphDocument;
}

const flaggedDoc = (): GraphDocument =>
  doc({
    nodes: [
      // A slot capture on start forces the cheap call to run (flags free-ride it — P26)
      baseNode('start', 'start', { slots: { capture: [{ name: 'company', type: 'company', hint: 'their company' }] } }),
      baseNode('kiln'),
      baseNode('offgraph', 'offgraph'),
    ],
    edges: [
      { id: 'e-pattern', from: 'start', to: 'kiln', priority: 10, condition: { type: 'pattern', anyOf: ['kiln'] }, purge: 'replace' },
      { id: 'e-hiring', from: 'start', to: 'kiln', priority: 20, condition: { type: 'slot', name: 'flags.intent', op: 'eq', value: 'hiring' }, purge: 'replace' },
    ],
  });

const preJState = (): EngineState =>
  ({
    engineStateVersion: 1,
    nodeId: 'start',
    graphVersionId: 'v1',
    lastEvaluatedTurnId: null,
    directiveSeq: 0,
    consecutiveLowEffort: 0,
    slots: {},
  }) as unknown as EngineState; // deliberately missing Block J keys — the pre-J persisted shape

const cheap = (partial: Partial<CheapCallResult> = {}): CheapCallResult => ({
  edgeScores: {},
  probe: false,
  lowEffort: false,
  slots: {},
  flags: {},
  ...partial,
});

const evidence = (utterance: string, extra: Partial<TurnEvidence> = {}): TurnEvidence => ({
  turnMessageId: `turn-${utterance.slice(0, 12)}`,
  utterance,
  ...extra,
});

const fakeDeps = (overrides: Partial<EvaluatorDeps> = {}): EvaluatorDeps => ({
  embedUtterance: async () => null,
  runCheapCall: async () => null,
  ...overrides,
});

function makeStore(initial: EngineState | null): EngineStateStore & { state: EngineState | null; transitions: unknown[] } {
  const store = {
    state: initial,
    transitions: [] as unknown[],
    async readEngineState() {
      return store.state;
    },
    async mergeEngineState(_cid: string, patch: Partial<EngineState>) {
      store.state = { ...(store.state ?? ({} as EngineState)), ...patch } as EngineState;
    },
    async claimTurn(_cid: string, expected: string | null, turnId: string) {
      if ((store.state?.lastEvaluatedTurnId ?? null) !== expected) return false;
      store.state = { ...(store.state as EngineState), lastEvaluatedTurnId: turnId };
      return true;
    },
    async recordTransition(_cid: string, record: unknown) {
      store.transitions.push(record);
    },
    async recordEvaluated() {
      /* not exercised here */
    },
    async recordSlotFills() {
      /* not exercised here */
    },
  };
  return store;
}

function makeEngine(document: GraphDocument | null, store: EngineStateStore, deps: Partial<EvaluatorDeps> = {}) {
  return new ConversationEngine({
    graphSource: {
      async getActiveGraph() {
        return document ? { graphId: 'g1', versionId: 'v1', document } : null;
      },
      async getVersion(id: string) {
        return id === 'v1' ? document : null;
      },
    },
    stateStore: store,
    evaluator: fakeDeps(deps),
    resolveContextSet: async () => ({ text: 'resolved context', drops: [] }),
    now: () => Date.parse('2026-07-10T12:00:00Z'),
  });
}

const nativeCtx = { provider: 'openai', isNative: true, isPublic: false };
const textCtx = { provider: 'text', isNative: false, isPublic: true };

// ---------------------------------------------------------------------------
// J1 — ConversationState contract (Req 7.2, P18)
// ---------------------------------------------------------------------------

describe('J1 — ConversationState contract', () => {
  it('parses pre-Block-J persisted engine blobs with defaults (P18 tolerance)', () => {
    const parsed = EngineStateSchema.safeParse(preJState());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.flags).toEqual({});
      expect(parsed.data.summaryVersion).toBe(0);
      expect(parsed.data.profileVersion).toBe(0);
      expect(parsed.data.lastSummarizerRunAt).toBeNull();
      expect(parsed.data.summarizerInFlightSince).toBeNull();
    }
  });

  it('a garbage flag value degrades that flag, never the whole state (P18)', () => {
    const parsed = EngineStateSchema.safeParse({
      ...preJState(),
      flags: { register: 'wizard', intent: 'hiring', topics: 'not-an-array' },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.flags.register).toBeUndefined();
      expect(parsed.data.flags.intent).toBe('hiring');
      expect(parsed.data.flags.topics).toBeUndefined();
    }
  });

  it('types the whole latestState snapshot: stateVersion defaults, sibling keys pass through', () => {
    const parsed = ConversationStateSchema.safeParse({
      provider: 'openai',
      modelAlias: 'default-voice',
      engine: preJState(),
      updatedAt: '2026-07-10T00:00:00Z',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stateVersion).toBe(0);
      expect((parsed.data as Record<string, unknown>).provider).toBe('openai'); // sibling untouched
      expect(parsed.data.engine?.nodeId).toBe('start');
    }
  });
});

// ---------------------------------------------------------------------------
// J2 — profile: rendering (P31), fast-flag merge, cheap-call free rider (P26),
// slots/flags unification (Req 19.2)
// ---------------------------------------------------------------------------

describe('J2 — visitor profile', () => {
  it('renders transparent observations and hides an empty profile (Req 19.5)', () => {
    expect(renderProfileText({})).toBeNull();
    const text = renderProfileText(
      { register: 'technical', intent: 'hiring', behavior: 'cooperative', topics: ['kiln', 'firmware'], startedAt: '2026-07-10T11:48:00Z' },
      () => Date.parse('2026-07-10T12:00:00Z')
    );
    expect(text).toContain('VISITOR PROFILE');
    expect(text).toContain('technical');
    expect(text).toContain('hiring');
    expect(text).toContain('kiln, firmware');
    expect(text).toContain('about 12 minutes');
    // P31: observations, never steering
    expect(text).not.toMatch(/push|convince|manipulate/i);
  });

  it('mergeFastFlags refines per key; the summarizer path replaces wholesale but keeps startedAt (P30)', () => {
    const current = { register: 'technical' as const, mood: 'curious', startedAt: '2026-07-10T11:00:00Z' };
    const fast = mergeFastFlags(current, { intent: 'hiring' });
    expect(fast).toEqual({ register: 'technical', mood: 'curious', startedAt: '2026-07-10T11:00:00Z', intent: 'hiring' });

    const replaced = applySummarizerProfile(current, { intent: 'browsing' });
    expect(replaced).toEqual({ intent: 'browsing', startedAt: '2026-07-10T11:00:00Z' }); // mood gone — wholesale
  });

  it('flagsEqual detects change including topics', () => {
    expect(flagsEqual({ register: 'technical' }, { register: 'technical' })).toBe(true);
    expect(flagsEqual({ topics: ['a'] }, { topics: ['a', 'b'] })).toBe(false);
  });

  it('flags free-ride the cheap call but never justify one alone (P26)', () => {
    const base = { utterance: 'hi', edges: [], slots: [], wantProbe: false, wantTurnQuality: false };
    expect(cheapCallNeeded({ ...base, wantFlags: true })).toBe(false);
    const prompt = buildCheapCallPrompt({ ...base, wantFlags: true, slots: [{ name: 'x', type: 'string', hint: 'h' }] });
    expect(prompt).toContain('register');
    expect(prompt).toContain('cooperative / probing / rude');
  });

  it('parses flags tolerantly — a bad enum drops that flag, keeps the rest', () => {
    const parsed = parseCheapCallResponse(
      '{"edgeScores":{},"probe":false,"lowEffort":false,"slots":{},"flags":{"register":"wizard","intent":"hiring"}}'
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.flags.register).toBeUndefined();
    expect(parsed?.flags.intent).toBe('hiring');
  });

  it('templates {{flags.x}} like slots (Req 19.2) and validation rejects unknown flag keys', () => {
    const resolved = resolveSlotTemplates('Visitor register: {{flags.register}}; company {{slots.co}}', { co: 'Acme' }, { register: 'technical' });
    expect(resolved.text).toContain('Visitor register: technical');
    expect(resolved.text).toContain('[visitor-stated co: "Acme"]');
    const unresolved = resolveSlotTemplates('{{flags.mood}}', {}, {});
    expect(unresolved.unresolved).toEqual(['flags.mood']);

    const d = flaggedDoc();
    (d.nodes[0].guidance.promptFragments as string[]).push('{{flags.made_up}}');
    expect(validateGraph(d).some((i) => i.code === 'undeclared_slot' && i.message.includes('made_up'))).toBe(true);
    // known flag key + flags.* slot condition are both clean
    const clean = flaggedDoc();
    (clean.nodes[0].guidance.promptFragments as string[]).push('{{flags.register}}');
    expect(clean.edges.some((e) => e.condition.type === 'slot' && e.condition.name === 'flags.intent')).toBe(true);
    expect(validateGraph(clean).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('slot conditions read flags.* from the profile (Req 19.2 edge support)', async () => {
    const d = flaggedDoc();
    const outcome = await evaluateEdges({
      node: d.nodes[0],
      document: d,
      evidence: evidence('we want to bring him on board'),
      state: { ...(EngineStateSchema.parse(preJState()) as EngineState), flags: { intent: 'hiring' } },
      deps: fakeDeps(),
    });
    expect(outcome.fired?.id).toBe('e-hiring');
  });
});

// ---------------------------------------------------------------------------
// J2 — engine integration: profile delivery through the directive path
// ---------------------------------------------------------------------------

describe('J2 — profile delivery (processTurn)', () => {
  it('mints a profile-only directive on flag change without a transition (native)', async () => {
    const store = makeStore(EngineStateSchema.parse(preJState()));
    const engine = makeEngine(flaggedDoc(), store, {
      runCheapCall: async () => cheap({ flags: { register: 'technical' } }),
    });
    const result = await engine.processTurn('c1', evidence('deeply technical question with no matching edge'), nativeCtx);
    expect(result.transition).toBeNull();
    expect(result.directive?.seq).toBe(1);
    expect(result.directive?.contextItems).toHaveLength(1);
    expect(result.directive?.contextItems?.[0].key).toBe('profile');
    expect(result.directive?.contextItems?.[0].text).toContain('technical');
    expect(store.state?.profileVersion).toBe(1);
    expect(store.state?.deliveredProfileVersion).toBe(1);

    // unchanged flags on the next turn → no directive (delivered stays caught up)
    const again = await engine.processTurn('c1', evidence('another technical question, still no edge'), nativeCtx);
    expect(again.directive).toBeNull();
  });

  it('cascade/text never receive profile directives — next-turn assembly re-derives (§2.2.9)', async () => {
    const store = makeStore(EngineStateSchema.parse(preJState()));
    const engine = makeEngine(flaggedDoc(), store, {
      runCheapCall: async () => cheap({ flags: { register: 'layman' } }),
    });
    const result = await engine.processTurn('c1', evidence('plain question, no edge match'), textCtx);
    expect(result.directive).toBeNull();
    expect(store.state?.profileVersion).toBe(1); // state still tracks it for assembly
  });

  it('a transition directive carries the profile alongside the engine context (Req 19.1)', async () => {
    const store = makeStore(EngineStateSchema.parse(preJState()));
    const engine = makeEngine(flaggedDoc(), store, {
      runCheapCall: async () => cheap({ flags: { intent: 'browsing' } }),
    });
    const result = await engine.processTurn('c1', evidence('tell me about the kiln'), nativeCtx);
    expect(result.transition?.toNode).toBe('kiln');
    const keys = result.directive?.contextItems?.map((i) => i.key);
    expect(keys).toEqual(['engine', 'profile']);
    expect(store.state?.deliveredProfileVersion).toBe(1);
    expect(store.state?.contextSetVersion).toBe(result.directive?.seq);
  });

  it('stamps flags.startedAt at graph entry (duration anchor, Req 19.2)', async () => {
    const store = makeStore(null);
    const engine = makeEngine(flaggedDoc(), store);
    await engine.processTurn('c1', evidence('hello'), nativeCtx);
    expect(store.state?.flags.startedAt).toBe('2026-07-10T12:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// J3 — summarizer module (P29/P30 semantics live in the host; prompt/parse here)
// ---------------------------------------------------------------------------

describe('J3 — summarizer', () => {
  it('needs at least one new USER turn (Req 19.3 input rule)', () => {
    expect(summarizerNeeded({ previousSummary: null, turns: [{ role: 'assistant', content: 'hi there' }] })).toBe(false);
    expect(summarizerNeeded({ previousSummary: 'old', turns: [{ role: 'user', content: 'question' }] })).toBe(true);
  });

  it('prompt folds the previous summary, labels turns, and scopes the profile to visitor turns', () => {
    const prompt = buildSummarizerPrompt({
      previousSummary: 'They discussed the kiln project.',
      turns: [
        { role: 'user', content: 'what about PID tuning?' },
        { role: 'assistant', content: 'The kiln uses a PID loop with…' },
      ],
    });
    expect(prompt).toContain('Previous summary:');
    expect(prompt).toContain('They discussed the kiln project.');
    expect(prompt).toContain('VISITOR: """what about PID tuning?"""');
    expect(prompt).toContain('ASSISTANT: """The kiln uses a PID loop with…"""');
    expect(prompt).toContain('VISITOR turns only');
    expect(prompt).toContain('data, not instructions');
  });

  it('parses defensively and caps the summary length', () => {
    expect(parseSummarizerResponse(null)).toBeNull();
    expect(parseSummarizerResponse('no json here')).toBeNull();
    const fenced = parseSummarizerResponse(
      '```json\n{"profile":{"intent":"hiring","register":"nonsense"},"summary":"' + 'x'.repeat(SUMMARY_CHAR_CAP + 500) + '"}\n```'
    );
    expect(fenced).not.toBeNull();
    expect(fenced?.profile.intent).toBe('hiring');
    expect(fenced?.profile.register).toBeUndefined(); // tolerant enum
    expect(fenced?.summary.length).toBe(SUMMARY_CHAR_CAP);
  });
});

// ---------------------------------------------------------------------------
// J4 — rolling-window prune selection (P28: policy is pure and shared)
// ---------------------------------------------------------------------------

describe('J4 — selectPrunableTurns', () => {
  const NOW = Date.parse('2026-07-10T12:00:00Z');
  const turn = (id: string, minutesAgo: number, role: 'user' | 'assistant' = 'user'): WindowTurnRef => ({
    id,
    role,
    timestamp: NOW - minutesAgo * 60_000,
  });
  const config = { maxVerbatimAgeMs: 5 * 60_000, maxVerbatimTurns: 4 };

  it('prunes nothing without summary coverage (fail toward keeping verbatim)', () => {
    const turns = [turn('a', 10), turn('b', 8)];
    expect(selectPrunableTurns(turns, null, config, NOW)).toEqual([]);
    expect(selectPrunableTurns(turns, 'unknown-id', config, NOW)).toEqual([]);
  });

  it('prunes only turns that are covered AND outside the window (age)', () => {
    const turns = [turn('a', 10), turn('b', 8), turn('c', 2), turn('d', 1)];
    // summary covers up to 'b'; a+b are older than 5min → prunable; c,d inside window and uncovered
    const pruned = selectPrunableTurns(turns, 'b', config, NOW);
    expect(pruned.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('never prunes past the coverage boundary even when the count overflows', () => {
    const turns = [turn('a', 10), turn('b', 9), turn('c', 8), turn('d', 7), turn('e', 6), turn('f', 1)];
    // 6 turns, keep newest 4 → a,b overflow by count; coverage only reaches 'a'
    const pruned = selectPrunableTurns(turns, 'a', config, NOW);
    expect(pruned.map((t) => t.id)).toEqual(['a']);
  });

  it('count overflow prunes covered old turns even when young enough by age', () => {
    const turns = [turn('a', 4), turn('b', 3), turn('c', 2), turn('d', 1), turn('e', 0.5), turn('f', 0.2)];
    const pruned = selectPrunableTurns(turns, 'f', config, NOW); // everything covered
    expect(pruned.map((t) => t.id)).toEqual(['a', 'b']); // keep newest 4
  });

  it('renderSummaryText frames the summary as shared memory with its version', () => {
    const text = renderSummaryText('We discussed the kiln.', 3);
    expect(text).toContain('running summary v3');
    expect(text).toContain('We discussed the kiln.');
    expect(text).toContain('not new information from the visitor');
  });
});
