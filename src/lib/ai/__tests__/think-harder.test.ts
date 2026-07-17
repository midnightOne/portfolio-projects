/**
 * think_harder (ai-assistant 7.17 — D41 voice↔reasoning escalation).
 * Load-bearing behaviors: the cost gate refuses basic-tier sessions BEFORE any
 * model call; the escalation runs through the Block M secondary-LLM path with
 * the `default-reasoning` alias (never a model id); grounding failures degrade
 * (the escalation still runs); timeout and unparseable output return HONEST
 * failure messages the voice model can recover from — never a fabricated
 * answer; a gateway meter is passed through for tier/reflink attribution.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/services/ai/secondary-llm', () => ({
  runSecondaryLLMJob: jest.fn(),
}));
jest.mock('@/lib/ai/start-frame', () => ({
  assembleStartFrame: jest.fn(),
}));
jest.mock('@/lib/services/ai/conversation-history-manager', () => ({
  conversationHistoryManager: {
    getConversationRefBySessionId: jest.fn(),
    getTurnsSince: jest.fn(),
    recordSessionMarker: jest.fn(),
  },
}));

import { runSecondaryLLMJob } from '@/lib/services/ai/secondary-llm';
import { assembleStartFrame } from '@/lib/ai/start-frame';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';
import { runThinkHarder } from '../think-harder';

const mockJob = runSecondaryLLMJob as jest.Mock;
const mockFrame = assembleStartFrame as jest.Mock;
const mockHistory = conversationHistoryManager as unknown as {
  getConversationRefBySessionId: jest.Mock;
  getTurnsSince: jest.Mock;
  recordSessionMarker: jest.Mock;
};

const okOutcome = {
  result: { answer: 'A deep, grounded answer.' },
  timedOut: false,
  raw: '{"answer":"A deep, grounded answer."}',
  provider: 'fake',
  modelId: 'fake-reasoning',
  usage: { inputTokens: 1000, outputTokens: 200 },
};

const search = jest.fn();
const fetchContent = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockJob.mockResolvedValue(okOutcome);
  mockFrame.mockResolvedValue('OWNER FRAME');
  mockHistory.getConversationRefBySessionId.mockResolvedValue({ id: 'conv-1', latestState: null });
  mockHistory.getTurnsSince.mockResolvedValue([
    { id: 'm1', itemId: 'm1', role: 'user', content: 'Tell me about the kiln PID loop' },
    { id: 'm2', itemId: 'm2', role: 'assistant', content: 'It uses a PID controller.' },
  ]);
  search.mockResolvedValue([
    { id: 'chunk-1', project: 'kiln', source: { label: 'PROJECT' }, title: 'Firmware', oneLiner: 'PID control loop' },
  ]);
  fetchContent.mockResolvedValue([
    { id: 'chunk-1', title: 'Firmware', content: 'The dual-thermocouple PID loop applies gain scheduling across temperature bands to handle changing thermal mass.' },
  ]);
});

describe('runThinkHarder — cost gate (7.17 tier gating)', () => {
  it('refuses basic-tier sessions BEFORE any model call', async () => {
    const result = await runThinkHarder({
      question: 'Why PID and not bang-bang control?',
      sessionId: 'sess_1',
      accessLevel: 'basic',
      search,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not available at this access tier');
    expect(mockJob).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('requires a question', async () => {
    const result = await runThinkHarder({
      question: '   ',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      search,
    });
    expect(result.success).toBe(false);
    expect(mockJob).not.toHaveBeenCalled();
  });
});

describe('runThinkHarder — the escalation (Block M path)', () => {
  it('runs through runSecondaryLLMJob with the default-reasoning ALIAS and full grounding', async () => {
    const result = await runThinkHarder({
      question: 'Why PID and not bang-bang control for the kiln?',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      uiState: { currentProject: 'kiln' },
      search,
      fetch: fetchContent,
    });
    expect(result.success).toBe(true);
    expect(result.answer).toBe('A deep, grounded answer.');
    expect(result.message).toContain('your own voice');

    const spec = mockJob.mock.calls[0][0];
    expect(spec.alias).toBe('default-reasoning'); // D39/D4 — alias, never a model id
    expect(spec.usageType).toBe('think_harder');
    expect(spec.timeoutMs).toBeGreaterThan(0);
    const system = spec.prompt[0].content as string;
    expect(system).toContain('OWNER FRAME');
    expect(system).toContain('PID control loop'); // retrieval one-liners
    expect(system).toContain('gain scheduling across temperature bands'); // FULL TEXT of top hits
    expect(system).toContain('Tell me about the kiln PID loop'); // conversation tail
    // search got the caller's UI state (current-project boost)
    expect(search.mock.calls[0][1]).toMatchObject({ currentProject: 'kiln' });
    // fetch received the top hit ids with a real token budget
    expect(fetchContent.mock.calls[0][0]).toEqual(['chunk-1']);
    expect(fetchContent.mock.calls[0][1]).toBeGreaterThanOrEqual(1000);
    // observability: grounding stats ride the result (and thus the tool row)
    expect(result.grounding).toMatchObject({ retrievalItems: 1, fullTextItems: 1, conversationTurns: 2 });
    expect(result.grounding!.groundingChars).toBeGreaterThan(100);
  });

  it('persists the escalation marker: model + FULL grounding text, and reports the model in the result', async () => {
    const result = await runThinkHarder({
      question: 'Why PID?',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      search,
      fetch: fetchContent,
    });
    // model visible in the tool result (transcript row)
    expect(result.model).toBe('fake/fake-reasoning');
    // marker row: admin-only record of what the reasoning model received
    const [convId, marker] = mockHistory.recordSessionMarker.mock.calls[0];
    expect(convId).toBe('conv-1');
    expect(marker).toMatchObject({
      type: 'think_harder_escalation',
      provider: 'fake',
      modelId: 'fake-reasoning',
      outcome: 'ok',
      question: 'Why PID?',
      usage: { inputTokens: 1000, outputTokens: 200 },
    });
    expect(marker.groundingText).toContain('OWNER FRAME');
    expect(marker.groundingText).toContain('gain scheduling across temperature bands');
    // the grounding text must NOT ride the model-facing result
    expect(JSON.stringify(result)).not.toContain('OWNER FRAME');
  });

  it('a marker-write failure never affects the answer', async () => {
    mockHistory.recordSessionMarker.mockRejectedValue(new Error('marker down'));
    const result = await runThinkHarder({
      question: 'Deep question',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      search,
    });
    expect(result.success).toBe(true);
    expect(result.answer).toBe('A deep, grounded answer.');
  });

  it('degrades to one-liner grounding when the full-text fetch fails', async () => {
    fetchContent.mockRejectedValue(new Error('get down'));
    const result = await runThinkHarder({
      question: 'Deep question',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      search,
      fetch: fetchContent,
    });
    expect(result.success).toBe(true);
    const system = mockJob.mock.calls[0][0].prompt[0].content as string;
    expect(system).toContain('PID control loop'); // one-liners survive
    expect(result.grounding).toMatchObject({ fullTextItems: 0 });
  });

  it('passes a gateway meter through for tier/reflink spend attribution', async () => {
    const meter = jest.fn().mockResolvedValue({});
    await runThinkHarder({
      question: 'Deep question',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      meter,
      search,
    });
    const spec = mockJob.mock.calls[0][0];
    expect(typeof spec.meter).toBe('function');
    await spec.meter({ provider: 'p', modelId: 'm', inputTokens: 10, outputTokens: 5, ok: true, timedOut: false });
    expect(meter).toHaveBeenCalledWith(
      expect.objectContaining({ usageType: 'think_harder', provider: 'p', inputTokens: 10 })
    );
  });

  it('grounding failures degrade — the escalation still runs', async () => {
    mockFrame.mockRejectedValue(new Error('frame down'));
    search.mockRejectedValue(new Error('search down'));
    mockHistory.getConversationRefBySessionId.mockRejectedValue(new Error('db down'));
    const result = await runThinkHarder({
      question: 'Deep question',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      search,
    });
    expect(result.success).toBe(true);
    expect(mockJob).toHaveBeenCalled();
  });
});

describe('runThinkHarder — honest failure paths (P1/P10)', () => {
  it('timeout returns an honest recover-yourself message, never an answer', async () => {
    mockJob.mockResolvedValue({ ...okOutcome, result: null, timedOut: true });
    const result = await runThinkHarder({
      question: 'Deep question',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      search,
    });
    expect(result.success).toBe(false);
    expect(result.answer).toBeUndefined();
    expect(result.message).toContain('timed out');
  });

  it('unparseable output returns an honest failure, never a fabricated answer', async () => {
    mockJob.mockResolvedValue({ ...okOutcome, result: null, timedOut: false });
    const result = await runThinkHarder({
      question: 'Deep question',
      sessionId: 'sess_1',
      accessLevel: 'premium',
      search,
    });
    expect(result.success).toBe(false);
    expect(result.answer).toBeUndefined();
    expect(result.message).toContain('do not present a guess');
  });
});
