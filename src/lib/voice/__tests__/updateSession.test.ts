/**
 * D47(d) updateSession + engine-directive application + floating-block
 * injector — deterministic tests (conversation-engine Block A, tasks A2–A4).
 *
 * The base-class contracts (seq gating P4, mid-response queueing P19,
 * every-turn vs on-change flush cadence P27, per-field failure isolation)
 * are tested through a minimal TestAdapter; Google and cascade adapters are
 * tested against fake transports. The OpenAI adapter's live behavior
 * (session.update acceptance without reconnect) is the Block A fake-mic
 * drill — a provider contract, not unit-testable.
 */

import {
  BaseConversationalAgentAdapter,
  SessionUpdateFieldResult,
} from '../IConversationalAgentAdapter';
import { GoogleLiveAdapter } from '../GoogleLiveAdapter';
import { CascadeVoiceAdapter } from '../CascadeVoiceAdapter';
import type { ContextBlock } from '@/lib/ai/context-buffer';
import type { AdapterInitOptions } from '@/types/voice-agent';

class TestAdapter extends BaseConversationalAgentAdapter {
  applied: Array<{ field: string; value: unknown }> = [];
  loggedBodies: Array<Record<string, unknown>> = [];
  responding = false;
  flushMode: 'every-turn' | 'on-change' | 'none' = 'every-turn';

  constructor() {
    super('openai', { provider: 'openai', capabilities: [], quality: 'high' } as any);
    this._connectionStatus = 'connected';
  }

  protected _contextFlushMode() {
    return this.flushMode;
  }
  protected _isModelResponding(): boolean {
    return this.responding;
  }
  protected async _applyInstructions(instructions: string): Promise<SessionUpdateFieldResult> {
    this.applied.push({ field: 'instructions', value: instructions });
    return 'applied';
  }
  protected async _applyToolSchema(tools: Array<Record<string, unknown>>): Promise<SessionUpdateFieldResult> {
    this.applied.push({ field: 'tools', value: tools });
    return 'applied';
  }
  protected async _applyContextBlock(block: ContextBlock): Promise<SessionUpdateFieldResult> {
    this.applied.push({ field: 'contextBlock', value: block.text });
    return 'applied';
  }
  protected _postConversationLog(body: Record<string, unknown>): void {
    this.loggedBodies.push(body);
  }
  getConversationSessionId(): string | null {
    return 'session_test';
  }

  // Public accessors for protected seams under test
  handleDirective(raw: unknown): void {
    this._handleEngineDirective(raw);
  }
  handleWindow(raw: unknown): void {
    this._handleEngineWindow(raw);
  }
  turnBoundary(): void {
    this._onTurnBoundary();
  }

  // Unused abstract members
  async init(_o: AdapterInitOptions): Promise<void> {}
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async cleanup(): Promise<void> {}
  async startAudioInput(): Promise<void> {}
  async stopAudioInput(): Promise<void> {}
  async sendMessage(_m: string): Promise<void> {}
  async sendAudioData(_a: ArrayBuffer): Promise<void> {}
  async interrupt(): Promise<void> {}
  async updateConfig(_c: Partial<AdapterInitOptions>): Promise<void> {}
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const directive = (seq: number, extra: Record<string, unknown> = {}) => ({
  seq,
  instructions: `assembled instructions v${seq}`,
  tools: [{ type: 'function', name: 'content_search' }],
  ...extra,
});

describe('engine directive application (tasks A2/A4 — P2, P4, P19)', () => {
  it('surfaces directive-carried ux (chips + topic label) via onEngineUx, once per seq (G1, Req 13.1)', async () => {
    const a = new TestAdapter();
    const seen: unknown[] = [];
    (a as unknown as { _options: Partial<AdapterInitOptions> })._options = {
      onEngineUx: (ux: unknown) => seen.push(ux),
    } as Partial<AdapterInitOptions>;
    const ux = { chips: [{ id: 'c1', label: 'Chip one' }], topicLabel: 'Kiln project' };
    a.handleDirective(directive(1, { ux }));
    a.handleDirective(directive(1, { ux })); // retried POST — applies once (P4)
    await flush();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(ux);
    // a directive without ux leaves the surface untouched (no callback)
    a.handleDirective(directive(2));
    await flush();
    expect(seen).toHaveLength(1);
  });

  it('applies a directive exactly once when the same seq arrives twice (retried /log POST)', async () => {
    const a = new TestAdapter();
    a.handleDirective(directive(1));
    a.handleDirective(directive(1));
    await flush();

    const instructionApplies = a.applied.filter((x) => x.field === 'instructions');
    expect(instructionApplies).toHaveLength(1);
    const events = a.loggedBodies.filter((b) => (b.event as any)?.type === 'engine_directive');
    expect(events).toHaveLength(1);
    expect((events[0].event as any).detail.seq).toBe(1);
  });

  it('drops out-of-order (stale) directives — latest wins', async () => {
    const a = new TestAdapter();
    a.handleDirective(directive(2));
    await flush();
    a.handleDirective(directive(1));
    await flush();

    const instructionApplies = a.applied.filter((x) => x.field === 'instructions');
    expect(instructionApplies).toHaveLength(1);
    expect(instructionApplies[0].value).toBe('assembled instructions v2');
  });

  it('queues a directive that arrives mid-response and applies it at the turn boundary', async () => {
    const a = new TestAdapter();
    a.responding = true;
    a.handleDirective(directive(1));
    await flush();
    expect(a.applied).toHaveLength(0);

    a.responding = false;
    a.turnBoundary();
    await flush();
    expect(a.applied.filter((x) => x.field === 'instructions')).toHaveLength(1);
  });

  it('keeps only the NEWEST directive while queued mid-response', async () => {
    const a = new TestAdapter();
    a.responding = true;
    a.handleDirective(directive(1));
    a.handleDirective(directive(2));
    a.responding = false;
    a.turnBoundary();
    await flush();

    const applies = a.applied.filter((x) => x.field === 'instructions');
    expect(applies).toHaveLength(1);
    expect(applies[0].value).toBe('assembled instructions v2');
  });

  it('publishes directive contextItems into the buffer and flushes them in the block', async () => {
    const a = new TestAdapter();
    a.handleDirective(directive(1, { contextItems: [{ key: 'engine', text: 'node ctx' }] }));
    await flush();

    const blockApplies = a.applied.filter((x) => x.field === 'contextBlock');
    expect(blockApplies.length).toBeGreaterThanOrEqual(1);
    expect(String(blockApplies[blockApplies.length - 1].value)).toContain('node ctx');
  });

  it('rejects malformed directives without applying anything', async () => {
    const a = new TestAdapter();
    a.handleDirective({ seq: 'not-a-number', instructions: 42 });
    await flush();
    expect(a.applied).toHaveLength(0);
  });
});

describe('updateSession orchestration (task A2 — per-field isolation)', () => {
  it('one field failing does not block the others', async () => {
    const a = new TestAdapter();
    (a as any)._applyInstructions = async () => {
      throw new Error('transport hiccup');
    };
    const result = await a.updateSession({
      instructions: 'x',
      tools: [{ name: 't' }],
    });
    expect(result.fields.instructions).toBe('failed');
    expect(result.fields.tools).toBe('applied');
  });

  it('only touches fields present in the update (full-snapshot semantics, P8)', async () => {
    const a = new TestAdapter();
    const result = await a.updateSession({ instructions: 'only this' });
    expect(result.fields.instructions).toBe('applied');
    expect(result.fields.tools).toBeUndefined();
    expect(result.fields.contextBlock).toBeUndefined();
  });
});

describe('floating-block injector (task A3 — P27 cadences)', () => {
  it('every-turn: re-applies the block at each turn boundary even when unchanged', async () => {
    const a = new TestAdapter();
    a.publishPassiveContext('fid', { index: { route: '/' } });
    await flush();
    a.turnBoundary();
    await flush();
    a.turnBoundary();
    await flush();

    const blockApplies = a.applied.filter((x) => x.field === 'contextBlock');
    expect(blockApplies.length).toBe(3); // publish + 2 boundaries, bit-identical content
  });

  it('logs a context_flush history event on content CHANGE only', async () => {
    const a = new TestAdapter();
    a.publishPassiveContext('fid', { index: { route: '/' } });
    await flush();
    a.turnBoundary(); // unchanged re-append
    await flush();
    a.publishPassiveContext('fid', { index: { route: '/projects' } });
    await flush();

    const flushEvents = a.loggedBodies.filter((b) => (b.event as any)?.type === 'context_flush');
    expect(flushEvents).toHaveLength(2); // two content versions, three applies
  });

  it('on-change: skips delivery when content is unchanged', async () => {
    const a = new TestAdapter();
    a.flushMode = 'on-change';
    a.publishPassiveContext('fid', { index: { route: '/' } });
    await flush();
    a.turnBoundary();
    await flush();

    expect(a.applied.filter((x) => x.field === 'contextBlock')).toHaveLength(1);
  });

  it('defers delivery while the model is responding (P19) and catches up at the boundary', async () => {
    const a = new TestAdapter();
    a.responding = true;
    a.publishPassiveContext('fid', { index: { route: '/' } });
    await flush();
    expect(a.applied).toHaveLength(0);

    a.responding = false;
    a.turnBoundary();
    await flush();
    expect(a.applied.filter((x) => x.field === 'contextBlock')).toHaveLength(1);
  });

  it('retries a failed flush at the next boundary (buffer stays dirty)', async () => {
    const a = new TestAdapter();
    let fail = true;
    (a as any)._applyContextBlock = async (block: ContextBlock) => {
      if (fail) return 'failed';
      a.applied.push({ field: 'contextBlock', value: block.text });
      return 'applied';
    };
    a.publishPassiveContext('fid', { index: { route: '/' } });
    await flush();
    expect(a.applied).toHaveLength(0);
    // still no context_flush event for the failed attempt
    expect(a.loggedBodies.filter((b) => (b.event as any)?.type === 'context_flush')).toHaveLength(0);

    fail = false;
    a.turnBoundary();
    await flush();
    expect(a.applied.filter((x) => x.field === 'contextBlock')).toHaveLength(1);
    expect(a.loggedBodies.filter((b) => (b.event as any)?.type === 'context_flush')).toHaveLength(1);
  });
});

describe('turn evidence (task A4)', () => {
  it('attaches pending UI evidence to user transcript posts only, then clears it', () => {
    const a = new TestAdapter();
    // Restore the real _postConversationLog attachment logic but capture fetch.
    const bodies: any[] = [];
    (global as any).fetch = jest.fn(async (_url: string, init: any) => {
      bodies.push(JSON.parse(init.body));
      return { json: async () => ({ metadata: {} }) };
    });
    const proto = BaseConversationalAgentAdapter.prototype as any;
    (a as any)._recordUiEvidence({ type: 'navigation', target: { id: 'kiln' } });

    proto._postConversationLog.call(a, {
      sessionId: 'session_test',
      provider: 'openai',
      transcriptItem: { id: '1', type: 'ai_response', content: 'hi', timestamp: 'now', provider: 'openai' },
    });
    proto._postConversationLog.call(a, {
      sessionId: 'session_test',
      provider: 'openai',
      transcriptItem: { id: '2', type: 'user_speech', content: 'open kiln', timestamp: 'now', provider: 'openai' },
    });
    proto._postConversationLog.call(a, {
      sessionId: 'session_test',
      provider: 'openai',
      transcriptItem: { id: '3', type: 'user_speech', content: 'again', timestamp: 'now', provider: 'openai' },
    });

    expect(bodies[0].uiEvidence).toBeUndefined(); // assistant row: no evidence
    expect(bodies[1].uiEvidence).toHaveLength(1); // user row carries it
    expect(bodies[1].uiEvidence[0].type).toBe('navigation');
    expect(bodies[2].uiEvidence).toBeUndefined(); // consumed — not re-sent
  });
});

describe('rolling-window intake (task J4 — versioned, boundary-gated, P19/P28)', () => {
  const windowUpdate = (v: number) => ({
    summaryVersion: v,
    summaryText: `CONVERSATION SO FAR (running summary v${v} …): the kiln discussion`,
    upToItemId: 'item_5',
    config: { maxVerbatimAgeMs: 300_000, maxVerbatimTurns: 16 },
  });

  it('default mechanics put the summary into the floating block under key "summary"', async () => {
    const a = new TestAdapter();
    a.handleWindow(windowUpdate(1));
    await flush();
    const blockApplies = a.applied.filter((x) => x.field === 'contextBlock');
    expect(blockApplies.length).toBeGreaterThanOrEqual(1);
    expect(String(blockApplies[blockApplies.length - 1].value)).toContain('running summary v1');
  });

  it('applies a version exactly once — retried /log responses are dropped', async () => {
    const a = new TestAdapter();
    a.handleWindow(windowUpdate(1));
    await flush();
    const before = a.applied.filter((x) => x.field === 'contextBlock').length;
    a.handleWindow(windowUpdate(1));
    await flush();
    expect(a.applied.filter((x) => x.field === 'contextBlock')).toHaveLength(before);
  });

  it('drops stale versions — latest wins', async () => {
    const a = new TestAdapter();
    a.handleWindow(windowUpdate(2));
    await flush();
    a.handleWindow(windowUpdate(1));
    await flush();
    const blockApplies = a.applied.filter((x) => x.field === 'contextBlock');
    expect(String(blockApplies[blockApplies.length - 1].value)).toContain('running summary v2');
  });

  it('defers application while the model is responding; the boundary catches up (P19)', async () => {
    const a = new TestAdapter();
    a.responding = true;
    a.handleWindow(windowUpdate(1));
    await flush();
    expect(a.applied).toHaveLength(0);
    a.responding = false;
    a.turnBoundary();
    await flush();
    const blockApplies = a.applied.filter((x) => x.field === 'contextBlock');
    expect(blockApplies.length).toBeGreaterThanOrEqual(1);
    expect(String(blockApplies[blockApplies.length - 1].value)).toContain('running summary v1');
  });

  it('rejects malformed window updates without applying anything', async () => {
    const a = new TestAdapter();
    a.handleWindow({ summaryVersion: 'x', summaryText: 1 });
    await flush();
    expect(a.applied).toHaveLength(0);
  });
});

describe('GoogleLiveAdapter fidelity (task A2.2 — append-only stream)', () => {
  function googleWithFakeWs() {
    const adapter = new GoogleLiveAdapter();
    const sent: any[] = [];
    (adapter as any)._ws = {
      readyState: WebSocket.OPEN,
      send: (frame: string) => sent.push(JSON.parse(frame)),
    };
    return { adapter: adapter as any, sent };
  }

  // 2026-07-15 owner bug (conversation cmrmhao6w…): context/guidance frames
  // used to ride realtimeInput.text, which Gemini's activity detection treats
  // as a USER TURN — the model answered the autonav block out loud. They now
  // ride clientContent with turnComplete:false (appended WITHOUT starting
  // generation; drilled live on gemini-3.1). These tests pin that transport.
  const contextFrameText = (frame: any): string => {
    expect(frame.clientContent).toBeDefined();
    expect(frame.clientContent.turnComplete).toBe(false);
    expect(frame.clientContent.turns).toHaveLength(1);
    return frame.clientContent.turns[0].parts[0].text as string;
  };

  it('instructions fold into a superseding, non-triggering clientContent frame and report degraded (P7)', async () => {
    const { adapter, sent } = googleWithFakeWs();
    const result = await adapter._applyInstructions('new node guidance');
    expect(result).toBe('degraded');
    expect(sent).toHaveLength(1);
    const text = contextFrameText(sent[0]);
    expect(text).toMatch(/^\[UPDATED GUIDANCE v1 — harness state, not a visitor message; supersedes all previous guidance\. Apply silently\.\]\n/);
    expect(text).toContain('new node guidance');
  });

  it('tool schema is unsupported mid-session (token-locked setup; re-mint fallback)', async () => {
    const { adapter } = googleWithFakeWs();
    expect(await adapter._applyToolSchema([{ name: 'x' }])).toBe('unsupported');
  });

  it('context block delivers by versioned supersession WITHOUT triggering generation (P27)', async () => {
    const { adapter, sent } = googleWithFakeWs();
    const result = await adapter._applyContextBlock({ version: 3, text: 'ctx', keys: ['fid'], dropped: [], tokens: 1 });
    expect(result).toBe('superseded');
    const text = contextFrameText(sent[0]);
    expect(text).toContain('[CURRENT CONTEXT v3');
    expect(text).toContain('not a visitor message');
    expect(text).toMatch(/\nctx$/);
  });

  it('greeting cue is the ONE realtimeInput.text send — it must trigger generation (owner parity ask)', () => {
    const { adapter, sent } = googleWithFakeWs();
    adapter._triggerInitialGreeting(false);
    expect(sent).toHaveLength(1);
    expect(sent[0].realtimeInput.text).toContain('Greet them briefly now');
    adapter._triggerInitialGreeting(true);
    expect(sent[1].realtimeInput.text).toContain('reconnection acknowledgement');
  });

  it('reports failed (not silent success) when the socket is down', async () => {
    const adapter: any = new GoogleLiveAdapter();
    adapter._ws = null;
    expect(await adapter._applyInstructions('x')).toBe('failed');
  });

  it('uses on-change flush cadence — no unchanged re-sends on an append-only stream', () => {
    const adapter: any = new GoogleLiveAdapter();
    expect(adapter._contextFlushMode()).toBe('on-change');
  });
});

describe('CascadeVoiceAdapter fidelity (task A2.3 — we assemble every turn)', () => {
  it('reports applied for every field: next-turn server-side assembly IS the mechanism', async () => {
    const adapter = new CascadeVoiceAdapter();
    const result = await adapter.updateSession({
      instructions: 'x',
      tools: [{ name: 't' }],
      contextBlock: { version: 1, text: 'ctx', keys: ['engine'], dropped: [], tokens: 1 },
    });
    expect(result.fields.instructions).toBe('applied');
    expect(result.fields.tools).toBe('applied');
    expect(result.fields.contextBlock).toBe('applied');
  });
});
