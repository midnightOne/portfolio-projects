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
  };
}

export interface AIProvider {
  name: 'openai' | 'anthropic';
  
  // Connection and validation
  testConnection(): Promise<boolean>;
  listModels(): Promise<string[]>;
  
  // AI operations
  chat(request: ProviderChatRequest): Promise<ProviderChatResponse>;
  
  // Utility methods
  estimateTokens(text: string): number;
  calculateCost(tokens: number, model: string): number;
}

export type AIProviderType = 'openai' | 'anthropic';

export interface AIProviderStatus {
  name: AIProviderType;
  configured: boolean;
  connected: boolean;
  error?: string;
  models: string[];
  lastTested: Date;
}