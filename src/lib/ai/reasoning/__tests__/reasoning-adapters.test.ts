/**
 * Reasoning-adapter layer tests (D39/D40): provider-specific message/tool/usage
 * mapping behind the common interface, with provider SDKs/HTTP mocked.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { ReasoningMessage, ReasoningToolDefinition } from '../types';

// ---- Anthropic ----------------------------------------------------------

const anthropicCreate = jest.fn<any>();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    messages = { create: anthropicCreate };
  },
}));

// ---- OpenAI --------------------------------------------------------------

const openaiCreate = jest.fn<any>();
jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    chat = { completions: { create: openaiCreate } };
  },
}));

import { AnthropicReasoningAdapter } from '../anthropic-adapter';
import { GoogleReasoningAdapter } from '../google-adapter';
import { OpenAIReasoningAdapter } from '../openai-adapter';
import { getReasoningAdapterForModel } from '../index';

const MESSAGES: ReasoningMessage[] = [
  { role: 'system', content: 'You are the portfolio.' },
  { role: 'user', content: 'What projects use ESP32?' },
];

const TOOLS: ReasoningToolDefinition[] = [
  {
    name: 'content_search',
    description: 'Search portfolio content',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

describe('AnthropicReasoningAdapter', () => {
  beforeEach(() => {
    anthropicCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('maps system out-of-band, returns text content and usage', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ESP32 powers the kiln controller.' }],
      usage: { input_tokens: 42, output_tokens: 17 },
    });

    const adapter = new AnthropicReasoningAdapter('claude-sonnet-test');
    const result = await adapter.chat(MESSAGES, { tools: TOOLS, temperature: 0.5 });

    const call = anthropicCreate.mock.calls[0][0] as any;
    expect(call.system).toBe('You are the portfolio.');
    expect(call.messages).toEqual([{ role: 'user', content: 'What projects use ESP32?' }]);
    expect(call.tools[0]).toMatchObject({ name: 'content_search' });

    expect(result.content).toBe('ESP32 powers the kiln controller.');
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 17 });
    expect(result.provider).toBe('anthropic');
    expect(result.modelId).toBe('claude-sonnet-test');
  });

  it('maps tool_use blocks to tool calls and tool results to tool_result blocks', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'content_search', input: { query: 'esp32' } }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const adapter = new AnthropicReasoningAdapter('claude-sonnet-test');
    const result = await adapter.chat(MESSAGES, { tools: TOOLS });
    expect(result.toolCalls).toEqual([
      { id: 'toolu_1', name: 'content_search', arguments: JSON.stringify({ query: 'esp32' }) },
    ]);

    // Feed the tool result back — assistant echo + tool answer
    await adapter.chat(
      [
        ...MESSAGES,
        { role: 'assistant', content: '', toolCalls: result.toolCalls },
        { role: 'tool', toolCallId: 'toolu_1', name: 'content_search', content: '{"items":[]}' },
      ],
      { tools: TOOLS }
    );
    const secondCall = anthropicCreate.mock.calls[1][0] as any;
    const assistantTurn = secondCall.messages[1];
    expect(assistantTurn.role).toBe('assistant');
    expect(assistantTurn.content[0]).toMatchObject({ type: 'tool_use', id: 'toolu_1', name: 'content_search' });
    const toolTurn = secondCall.messages[2];
    expect(toolTurn.role).toBe('user');
    expect(toolTurn.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"items":[]}' });
  });
});

describe('GoogleReasoningAdapter', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock<any>;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'test-key';
    fetchMock = jest.fn<any>();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('maps system to systemInstruction, strips unsupported schema keys, reads usageMetadata', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Grounded answer.' }] } }],
        usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 12 },
      }),
    });

    const adapter = new GoogleReasoningAdapter('gemini-test');
    const result = await adapter.chat(MESSAGES, { tools: TOOLS, maxOutputTokens: 500 });

    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toContain('/models/gemini-test:generateContent');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe('You are the portfolio.');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'What projects use ESP32?' }] }]);
    const decl = body.tools[0].functionDeclarations[0];
    expect(decl.name).toBe('content_search');
    expect(decl.parameters.additionalProperties).toBeUndefined();
    expect(body.generationConfig.maxOutputTokens).toBe(500);

    expect(result.content).toBe('Grounded answer.');
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 12 });
    expect(result.provider).toBe('google');
  });

  it('synthesizes tool-call ids and keys tool results by function name', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ functionCall: { name: 'content_search', args: { query: 'esp32' } } }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
      }),
    });

    const adapter = new GoogleReasoningAdapter('gemini-test');
    const result = await adapter.chat(MESSAGES, { tools: TOOLS });
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('content_search');

    await adapter.chat(
      [
        ...MESSAGES,
        { role: 'assistant', content: '', toolCalls: result.toolCalls },
        { role: 'tool', toolCallId: result.toolCalls[0].id, name: 'content_search', content: '{"items":[]}' },
      ],
      { tools: TOOLS }
    );
    const body = JSON.parse((fetchMock.mock.calls[1] as [string, any])[1].body);
    const modelTurn = body.contents[1];
    expect(modelTurn.role).toBe('model');
    expect(modelTurn.parts[0].functionCall.name).toBe('content_search');
    const toolTurn = body.contents[2];
    expect(toolTurn.role).toBe('user');
    expect(toolTurn.parts[0].functionResponse.name).toBe('content_search');
  });

  it('fails closed without GOOGLE_API_KEY', async () => {
    delete process.env.GOOGLE_API_KEY;
    const adapter = new GoogleReasoningAdapter('gemini-test');
    await expect(adapter.chat(MESSAGES)).rejects.toThrow('GOOGLE_API_KEY is not configured');
  });
});

describe('OpenAIReasoningAdapter', () => {
  beforeEach(() => {
    openaiCreate.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('maps messages and usage', async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Answer.', tool_calls: [] } }],
      usage: { prompt_tokens: 20, completion_tokens: 8 },
    });

    const adapter = new OpenAIReasoningAdapter('gpt-test');
    const result = await adapter.chat(MESSAGES, { tools: TOOLS });

    const call = openaiCreate.mock.calls[0][0] as any;
    expect(call.messages[0]).toEqual({ role: 'system', content: 'You are the portfolio.' });
    expect(call.tools[0].function.name).toBe('content_search');

    expect(result.content).toBe('Answer.');
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 8 });
    expect(result.provider).toBe('openai');
  });
});

describe('getReasoningAdapterForModel', () => {
  it('dispatches by provider', () => {
    expect(getReasoningAdapterForModel('openai', 'm')).toBeInstanceOf(OpenAIReasoningAdapter);
    expect(getReasoningAdapterForModel('anthropic', 'm')).toBeInstanceOf(AnthropicReasoningAdapter);
    expect(getReasoningAdapterForModel('google', 'm')).toBeInstanceOf(GoogleReasoningAdapter);
    expect(() => getReasoningAdapterForModel('nope', 'm')).toThrow("No reasoning adapter for provider 'nope'");
  });
});
