/**
 * Anthropic provider implementation
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base-provider';
import { ProviderChatRequest, ProviderChatResponse, AIProviderType } from '../types';

export class AnthropicProvider extends BaseProvider {
  name: AIProviderType = 'anthropic';
  private client: Anthropic;
  
  constructor(apiKey: string) {
    super(apiKey);
    this.client = new Anthropic({ 
      apiKey,
      timeout: 30000, // 30 second timeout
    });
  }
  
  async testConnection(): Promise<boolean> {
    try {
      // Test with a minimal request since Anthropic doesn't have a models endpoint
      await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch (error) {
      console.error('Anthropic connection test failed:', error);
      return false;
    }
  }
  
  async listModels(): Promise<string[]> {
    // Anthropic doesn't have a models API endpoint, return known models
    // These are the current available models as of 2024
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }
  
  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    this.validateChatRequest(request);
    
    try {
      // Convert messages to Anthropic format
      const messages = request.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
      
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 4000,
        temperature: request.temperature ?? 0.7,
        system: request.systemPrompt,
        messages
      });
      
      const content = response.content[0];
      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      
      return {
        content: content.type === 'text' ? content.text : '',
        model: request.model,
        tokensUsed,
        cost: this.calculateCost(tokensUsed, request.model),
        finishReason: this.mapFinishReason(response.stop_reason)
      };
    } catch (error) {
      console.error('Anthropic chat request failed:', error);
      throw new Error(this.parseProviderError(error));
    }
  }
  
  estimateTokens(text: string): number {
    // Anthropic's token estimation is similar to OpenAI
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
  
  calculateCost(tokens: number, model: string): number {
    // Anthropic pricing as of 2024 (per 1K tokens)
    // Note: These are input token prices - output tokens may be different
    const costs: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 0.003,    // $3.00 per 1M input tokens
      'claude-3-5-haiku-20241022': 0.00025,   // $0.25 per 1M input tokens
      'claude-3-opus-20240229': 0.015,        // $15.00 per 1M input tokens
      'claude-3-sonnet-20240229': 0.003,      // $3.00 per 1M input tokens
      'claude-3-haiku-20240307': 0.00025,     // $0.25 per 1M input tokens
    };
    
    const costPer1k = costs[model] ?? 0.003; // Default fallback cost
    return (tokens / 1000) * costPer1k;
  }
  
  /**
   * Map Anthropic stop reasons to our standard format
   */
  public mapFinishReason(reason: string | null): 'stop' | 'length' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'error';
    }
  }
}