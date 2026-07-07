/**
 * Core AI provider interfaces and types
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProviderChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ProviderChatResponse {
  content: string;
  model: string;
  tokensUsed: number;
  cost: number;
  finishReason: 'stop' | 'length' | 'error';
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  availableModels?: string[];
  error?: {
    code: string;
    details: string;
    actionable: boolean;
    suggestions?: string[];
  };
}

/**
 * Provider surface for admin config: key validation + model listing (the D4
 * registry's refresh source). Chat/completions run through the reasoning-adapter
 * layer (`lib/ai/reasoning`, D39); cost lives in `lib/ai/pricing` (D38).
 */
export interface AIProvider {
  name: AIProviderType;

  // Connection and validation
  testConnection(): Promise<boolean>;
  listModels(): Promise<string[]>;
}

export type AIProviderType = 'openai' | 'anthropic' | 'google';

export interface AIProviderStatus {
  name: AIProviderType;
  configured: boolean;
  connected: boolean;
  error?: string;
  models: string[];
  lastTested: Date;
}