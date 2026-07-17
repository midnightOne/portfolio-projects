/**
 * Block M1 — the shared secondary-LLM job path: alias resolution (D4),
 * metering on every completion incl. post-timeout (D33), the shared defensive
 * JSON parse + Zod schema, timeout → fail-safe null. Adapter/ledger/embedding
 * deps are mocked; the real wiring is exercised by the in-session drills.
 */

import { z } from 'zod';

const mockChat = jest.fn();
const mockRecordUsage = jest.fn().mockResolvedValue({ ledgerId: 'led_1', costUsd: 0.001 });

jest.mock('@/lib/ai/reasoning', () => ({
  getReasoningAdapter: jest.fn(async () => ({
    provider: 'openai',
    modelId: 'gpt-test',
    chat: mockChat,
  })),
}));
jest.mock('@/lib/ai/ledger', () => ({
  recordUsage: (...args: unknown[]) => mockRecordUsage(...args),
}));
jest.mock('@/lib/ai/embeddings', () => ({
  generateEmbeddings: jest.fn(async (texts: string[]) => ({
    vectors: texts.map(() => [0.1, 0.2]),
    modelId: 'embed-test',
    provider: 'google',
    tokensUsed: 42,
  })),
}));
jest.mock('@/lib/ai/pricing', () => ({
  estimateCost: jest.fn(async () => 0.0001),
}));
jest.mock('@/lib/content/SemanticBudgetManager', () => ({
  semanticBudgetManager: {
    canAffordOperation: jest.fn(async () => ({ canAfford: true, remainingFunds: 10 })),
  },
}));

import { runSecondaryLLMJob, runMeteredEmbeddingBatch } from '../secondary-llm';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';
import { parseJsonWithSchema } from '@/lib/ai/llm-json';

const Shape = z.object({ answer: z.string(), score: z.number().default(0) });

const chatResult = (content: string) => ({
  content,
  toolCalls: [],
  usage: { inputTokens: 10, outputTokens: 5 },
  modelId: 'gpt-test',
  provider: 'openai',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRecordUsage.mockResolvedValue({ ledgerId: 'led_1', costUsd: 0.001 });
});

describe('parseJsonWithSchema (shared M1 posture)', () => {
  it('strips fences and surrounding prose', () => {
    expect(parseJsonWithSchema('Sure!\n```json\n{"answer":"hi"}\n```', Shape)).toEqual({ answer: 'hi', score: 0 });
  });
  it('returns null on garbage or schema mismatch', () => {
    expect(parseJsonWithSchema('no json here', Shape)).toBeNull();
    expect(parseJsonWithSchema('{"answer": 42}', Shape)).toBeNull();
    expect(parseJsonWithSchema(null, Shape)).toBeNull();
  });
  it('repairs literal control characters INSIDE strings (Gemini multi-paragraph answers, 2026-07-17)', () => {
    // Raw newline inside the string value — strict JSON.parse rejects this.
    expect(parseJsonWithSchema('{"answer": "first paragraph.\n\nsecond\tparagraph."}', Shape)).toEqual({
      answer: 'first paragraph.\n\nsecond\tparagraph.',
      score: 0,
    });
    // Pretty-printed JSON (newlines BETWEEN tokens) still parses strictly — no repair distortion.
    expect(parseJsonWithSchema('{\n  "answer": "hi"\n}', Shape)).toEqual({ answer: 'hi', score: 0 });
    // Already-escaped sequences pass through unchanged.
    expect(parseJsonWithSchema('{"answer": "line\\nbreak \\"quoted\\""}', Shape)).toEqual({
      answer: 'line\nbreak "quoted"',
      score: 0,
    });
  });
});

describe('runSecondaryLLMJob (M1)', () => {
  it('parses a schema-valid response and meters via the default ledger path', async () => {
    mockChat.mockResolvedValue(chatResult('{"answer":"ok","score":0.5}'));
    const out = await runSecondaryLLMJob({
      alias: 'default-cheap',
      prompt: 'p',
      schema: Shape,
      usageType: 'test_job',
    });
    expect(out.result).toEqual({ answer: 'ok', score: 0.5 });
    expect(out.timedOut).toBe(false);
    expect(out.provider).toBe('openai');
    // Default meter is fire-and-forget — flush microtasks before asserting.
    await Promise.resolve();
    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ usageType: 'test_job', provider: 'openai', inputTokens: 10, outputTokens: 5 })
    );
  });

  it('unparseable output → result null, metered with ok:false', async () => {
    mockChat.mockResolvedValue(chatResult('not json'));
    const out = await runSecondaryLLMJob({ alias: 'default-cheap', prompt: 'p', schema: Shape, usageType: 't' });
    expect(out.result).toBeNull();
    expect(out.timedOut).toBe(false);
    await Promise.resolve();
    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ ok: false, timedOut: false }) })
    );
  });

  it('timeout → null result, and the late completion is still metered (D33)', async () => {
    let resolveChat: (v: unknown) => void = () => {};
    mockChat.mockReturnValue(new Promise((r) => (resolveChat = r)));
    const out = await runSecondaryLLMJob({
      alias: 'default-cheap',
      prompt: 'p',
      schema: Shape,
      usageType: 't',
      timeoutMs: 20,
    });
    expect(out.result).toBeNull();
    expect(out.timedOut).toBe(true);
    expect(mockRecordUsage).not.toHaveBeenCalled();
    resolveChat(chatResult('{"answer":"late"}'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ timedOut: true }) })
    );
  });

  it('transport error → null result, no throw', async () => {
    mockChat.mockRejectedValue(new Error('boom'));
    const out = await runSecondaryLLMJob({ alias: 'default-cheap', prompt: 'p', schema: Shape, usageType: 't' });
    expect(out.result).toBeNull();
  });

  it('custom meter is awaited and receives ok/timedOut', async () => {
    mockChat.mockResolvedValue(chatResult('{"answer":"ok"}'));
    const seen: unknown[] = [];
    await runSecondaryLLMJob({
      alias: 'default-reasoning',
      prompt: [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }],
      schema: Shape,
      usageType: 't',
      meter: async (u) => {
        await new Promise((r) => setTimeout(r, 5));
        seen.push(u);
      },
    });
    expect(seen).toHaveLength(1); // awaited, not fire-and-forget
    expect(seen[0]).toMatchObject({ ok: true, timedOut: false, provider: 'openai' });
    expect(mockRecordUsage).not.toHaveBeenCalled(); // custom meter replaces the default
  });

  it('custom meter errors propagate (spend governance)', async () => {
    mockChat.mockResolvedValue(chatResult('{"answer":"ok"}'));
    await expect(
      runSecondaryLLMJob({
        alias: 'default-cheap',
        prompt: 'p',
        schema: Shape,
        usageType: 't',
        meter: async () => {
          throw new Error('meter down');
        },
      })
    ).rejects.toThrow('meter down');
  });
});

describe('runMeteredEmbeddingBatch (M1 embedding variant)', () => {
  it('embeds, ledgers with the recorded model id, returns vectors', async () => {
    const out = await runMeteredEmbeddingBatch({
      texts: ['a', 'b'],
      taskType: 'document',
      usageType: 'engine_question_embedding',
      estimateModelId: 'embed-test',
    });
    expect(out).toMatchObject({ ok: true, modelId: 'embed-test', tokensUsed: 42 });
    expect((out as { vectors: number[][] }).vectors).toHaveLength(2);
    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'semantic', usageType: 'engine_question_embedding', modelId: 'embed-test' })
    );
  });

  it('budget gate declines → ok:false with an honest reason, nothing embedded', async () => {
    (semanticBudgetManager.canAffordOperation as jest.Mock).mockResolvedValueOnce({
      canAfford: false,
      remainingFunds: 0.01,
    });
    const out = await runMeteredEmbeddingBatch({
      texts: ['a'],
      taskType: 'document',
      usageType: 't',
      estimateModelId: 'embed-test',
    });
    expect(out.ok).toBe(false);
    expect((out as { reason: string }).reason).toContain('budget gate');
    expect(mockRecordUsage).not.toHaveBeenCalled();
  });

  it('empty batch is a no-op success', async () => {
    const out = await runMeteredEmbeddingBatch({
      texts: [],
      taskType: 'query',
      usageType: 't',
      estimateModelId: 'embed-test',
    });
    expect(out).toMatchObject({ ok: true, tokensUsed: 0 });
  });
});
