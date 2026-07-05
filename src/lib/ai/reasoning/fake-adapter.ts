import { createHash } from 'crypto';
import type {
  ReasoningAdapter,
  ReasoningChatOptions,
  ReasoningMessage,
  ReasoningResult,
} from './types';

/**
 * FakeReasoningAdapter (verification spec task 4.1): deterministic, zero-network.
 *
 * Scripted behavior:
 *  - If tools include `content_search` and no tool result is in the transcript yet,
 *    it calls `content_search` with the last user message as the query (exercising
 *    the real server-side tool loop and retrieval trace).
 *  - Otherwise it answers deterministically, quoting a stable digest of the
 *    transcript and the first ~200 chars of the latest tool result, so tests can
 *    assert both grounding and repeatability.
 */
export class FakeReasoningAdapter implements ReasoningAdapter {
  readonly provider = 'fake';
  readonly modelId = 'fake-reasoning';

  async chat(messages: ReasoningMessage[], options?: ReasoningChatOptions): Promise<ReasoningResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const lastTool = [...messages].reverse().find((m) => m.role === 'tool');
    const inputTokens = messages.reduce((s, m) => s + Math.ceil((m.content?.length ?? 0) / 4), 0);
    const digest = createHash('sha256')
      .update(messages.map((m) => `${m.role}:${m.content}`).join('\n'))
      .digest('hex')
      .slice(0, 12);

    const searchTool = options?.tools?.find((t) => t.name === 'content_search');
    if (searchTool && !lastTool) {
      return {
        content: null,
        toolCalls: [
          {
            id: `fake_call_${digest}`,
            name: 'content_search',
            arguments: JSON.stringify({ query: lastUser?.content ?? '', k: 3 }),
          },
        ],
        usage: { inputTokens, outputTokens: 8 },
        modelId: this.modelId,
        provider: this.provider,
      };
    }

    const grounding = lastTool ? ` Grounded on: ${lastTool.content.slice(0, 200)}` : '';
    const content = `[fake-reasoning ${digest}] Deterministic answer to: "${lastUser?.content ?? ''}".${grounding}`;
    return {
      content,
      toolCalls: [],
      usage: { inputTokens, outputTokens: Math.ceil(content.length / 4) },
      modelId: this.modelId,
      provider: this.provider,
    };
  }
}
