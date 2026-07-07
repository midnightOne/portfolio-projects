/**
 * OpenAI provider: key validation + model listing (registry refresh source, D4).
 * Chat runs through `lib/ai/reasoning/openai-adapter` (D39).
 */

import OpenAI from 'openai';
import { BaseProvider } from './base-provider';
import { AIProviderType } from '../types';

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
}
