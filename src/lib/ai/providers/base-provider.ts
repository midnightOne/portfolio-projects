/**
 * Base provider class with common functionality
 */

import { AIProvider, ProviderChatRequest, ProviderChatResponse, AIProviderType } from '../types';

export abstract class BaseProvider implements AIProvider {
  abstract name: AIProviderType;
  protected apiKey: string;
  
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error(`API key is required for ${this.name} provider`);
    }
    this.apiKey = apiKey;
  }
  
  // Abstract methods that must be implemented by concrete providers
  abstract testConnection(): Promise<boolean>;
  abstract listModels(): Promise<string[]>;
  abstract chat(request: ProviderChatRequest): Promise<ProviderChatResponse>;
  abstract estimateTokens(text: string): number;
  abstract calculateCost(tokens: number, model: string): number;
  
  /**
   * Parse provider-specific errors into actionable messages
   */
  protected parseProviderError(error: any): string {
    if (error.status === 401 || error.code === 'invalid_api_key') {
      return `Invalid API key for ${this.name}`;
    }
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      return `Rate limit exceeded for ${this.name}`;
    }
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return `Network error connecting to ${this.name}`;
    }
    if (error.status === 400) {
      return `Invalid request to ${this.name}: ${error.message || 'Bad request'}`;
    }
    return `Connection failed: ${error.message || 'Unknown error'}`;
  }
  
  /**
   * Get error code for categorization
   */
  protected getErrorCode(error: any): string {
    if (error.status === 401 || error.code === 'invalid_api_key') {
      return 'INVALID_API_KEY';
    }
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      return 'RATE_LIMIT_EXCEEDED';
    }
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return 'NETWORK_ERROR';
    }
    if (error.status === 400) {
      return 'BAD_REQUEST';
    }
    return 'UNKNOWN_ERROR';
  }
  
  /**
   * Check if error is actionable by user
   */
  protected isActionableError(error: any): boolean {
    const code = this.getErrorCode(error);
    return ['INVALID_API_KEY', 'BAD_REQUEST'].includes(code);
  }
  
  /**
   * Validate chat request parameters
   */
  protected validateChatRequest(request: ProviderChatRequest): void {
    if (!request.model) {
      throw new Error('Model is required');
    }
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Messages are required');
    }
    if (request.temperature !== undefined && (request.temperature < 0 || request.temperature > 1)) {
      throw new Error('Temperature must be between 0 and 1');
    }
    if (request.maxTokens !== undefined && request.maxTokens < 1) {
      throw new Error('Max tokens must be greater than 0');
    }
  }
}