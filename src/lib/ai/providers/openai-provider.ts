/**
 * OpenAI provider implementation
 */

import OpenAI from 'openai';
import { BaseProvider } from './base-provider';
import { ProviderChatRequest, ProviderChatResponse, AIProviderType } from '../types';

export class OpenAIProvider extends BaseProvider {
  name: AIProviderType = 'openai';
  private client: OpenAI;
  
  constructor(apiKey: string) {
    super(apiKey);
    this.client = new OpenAI({ 
      apiKey,
      timeout: 30000, // 30 second timeout
      dangerouslyAllowBrowser: process.env.NODE_ENV === 'test', // Allow in test environment
    });
  }
  
  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }
  
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id)
        .sort();
    } catch (error) {
      console.error('Failed to list OpenAI models:', error);
      throw new Error(this.parseProviderError(error));
    }
  }
  
  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    this.validateChatRequest(request);
    
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      
      // Add system prompt if provided
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      
      // Add conversation messages
      messages.push(...request.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })));
      
      const completion = await this.client.chat.completions.create({
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4000,
      });
      
      const choice = completion.choices[0];
      const tokensUsed = completion.usage?.total_tokens ?? 0;
      
      return {
        content: choice.message.content ?? '',
        model: request.model,
        tokensUsed,
        cost: this.calculateCost(tokensUsed, request.model),
        finishReason: this.mapFinishReason(choice.finish_reason)
      };
    } catch (error) {
      console.error('OpenAI chat request failed:', error);
      throw new Error(this.parseProviderError(error));
    }
  }
  
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for GPT models
    // This is a simplified estimation - for production use, consider using tiktoken
    return Math.ceil(text.length / 4);
  }
  
  calculateCost(tokens: number, model: string): number {
    // OpenAI pricing as of 2024 (per 1K tokens)
    // Note: These are input token prices - output tokens may be different
    const costs: Record<string, number> = {
      'gpt-4o': 0.0025,           // $2.50 per 1M input tokens
      'gpt-4o-2024-11-20': 0.0025,
      'gpt-4o-2024-08-06': 0.0025,
      'gpt-4o-2024-05-13': 0.005, // $5.00 per 1M input tokens
      'gpt-4o-mini': 0.00015,     // $0.15 per 1M input tokens
      'gpt-4o-mini-2024-07-18': 0.00015,
      'gpt-4-turbo': 0.01,        // $10.00 per 1M input tokens
      'gpt-4-turbo-2024-04-09': 0.01,
      'gpt-4': 0.03,              // $30.00 per 1M input tokens
      'gpt-4-0613': 0.03,
      'gpt-4-0314': 0.03,
      'gpt-3.5-turbo': 0.0005,    // $0.50 per 1M input tokens
      'gpt-3.5-turbo-0125': 0.0005,
      'gpt-3.5-turbo-1106': 0.001,
    };
    
    const costPer1k = costs[model] ?? 0.002; // Default fallback cost
    return (tokens / 1000) * costPer1k;
  }
  
  /**
   * Map OpenAI finish reasons to our standard format
   */
  public mapFinishReason(reason: string | null): 'stop' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
      case 'function_call':
      case 'tool_calls':
      default:
        return 'error';
    }
  }
}