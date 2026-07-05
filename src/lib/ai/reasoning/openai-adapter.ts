import type {
  ReasoningAdapter,
  ReasoningChatOptions,
  ReasoningMessage,
  ReasoningResult,
} from './types';

export class OpenAIReasoningAdapter implements ReasoningAdapter {
  readonly provider = 'openai';

  constructor(readonly modelId: string) {}

  async chat(messages: ReasoningMessage[], options?: ReasoningChatOptions): Promise<ReasoningResult> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: this.modelId,
      temperature: options?.temperature,
      max_tokens: options?.maxOutputTokens,
      messages: messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId ?? '' };
        }
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'assistant' as const,
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          };
        }
        return { role: m.role, content: m.content };
      }),
      tools: options?.tools?.length
        ? options.tools.map((t) => ({
            type: 'function' as const,
            function: { name: t.name, description: t.description, parameters: t.parameters },
          }))
        : undefined,
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content,
      toolCalls: (choice.message.tool_calls ?? []).flatMap((tc) =>
        tc.type === 'function'
          ? [{ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }]
          : []
      ),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      modelId: this.modelId,
      provider: this.provider,
    };
  }
}
