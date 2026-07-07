import type {
  ReasoningAdapter,
  ReasoningChatOptions,
  ReasoningMessage,
  ReasoningResult,
  ReasoningToolCall,
} from './types';

/**
 * Anthropic reasoning adapter (D39/D40). Tool use and vision are supported by the
 * API (the old "no functionCalling/vision" capability table was wrong — D40);
 * structured JSON is achieved via tool-forcing when a consumer needs it.
 */
export class AnthropicReasoningAdapter implements ReasoningAdapter {
  readonly provider = 'anthropic';

  constructor(readonly modelId: string) {}

  async chat(messages: ReasoningMessage[], options?: ReasoningChatOptions): Promise<ReasoningResult> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Anthropic takes the system prompt out-of-band; tool results ride user turns.
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    type AnthropicMessage = { role: 'user' | 'assistant'; content: unknown };
    const mapped: AnthropicMessage[] = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      if (m.role === 'tool') {
        mapped.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId ?? '',
              content: m.content,
            },
          ],
        });
        continue;
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        const blocks: unknown[] = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: safeParseJson(tc.arguments),
          });
        }
        mapped.push({ role: 'assistant', content: blocks });
        continue;
      }
      mapped.push({ role: m.role, content: m.content });
    }

    const response = await client.messages.create({
      model: this.modelId,
      max_tokens: options?.maxOutputTokens ?? 4096,
      temperature: options?.temperature,
      system: system || undefined,
      messages: mapped as never,
      tools: options?.tools?.length
        ? options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters as never,
          }))
        : undefined,
    });

    let content: string | null = null;
    const toolCalls: ReasoningToolCall[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        content = (content ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) });
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      modelId: this.modelId,
      provider: this.provider,
    };
  }
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
