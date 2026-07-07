/**
 * Anthropic provider: key validation + model listing (registry refresh source, D4).
 * Chat runs through `lib/ai/reasoning/anthropic-adapter` (D39/D40).
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base-provider';
import { AIProviderType } from '../types';

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
      // The models endpoint validates the key without spending tokens
      await this.client.models.list({ limit: 1 });
      return true;
    } catch (error) {
      console.error('Anthropic connection test failed:', error);
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    // Live models API — no fossilized lists (D4); admin picks from here
    const models: string[] = [];
    for await (const model of this.client.models.list({ limit: 100 })) {
      models.push(model.id);
    }
    return models;
  }
}
