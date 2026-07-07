/**
 * Reasoning-adapter interface (D39 — classic/text LLMs behind one seam, parallel to
 * the voice adapter family). Phase 2 ships OpenAI + Fake; Anthropic/Google join in
 * Phase 4 (ai-admin task 4). Consumers never import provider SDKs directly.
 */

export interface ReasoningMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** For role 'assistant' echoing prior tool calls, and role 'tool' answering them. */
  toolCallId?: string;
  /** Tool NAME for role 'tool' — required by providers that key results by name (Google). */
  name?: string;
  toolCalls?: ReasoningToolCall[];
}

export interface ReasoningToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ReasoningToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments exactly as the model produced them. */
  arguments: string;
}

export interface ReasoningUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ReasoningResult {
  content: string | null;
  toolCalls: ReasoningToolCall[];
  usage: ReasoningUsage;
  modelId: string;
  provider: string;
}

export interface ReasoningChatOptions {
  tools?: ReasoningToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ReasoningAdapter {
  readonly provider: string;
  readonly modelId: string;
  chat(messages: ReasoningMessage[], options?: ReasoningChatOptions): Promise<ReasoningResult>;
}
