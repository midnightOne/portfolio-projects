/**
 * Provider factory for dynamic AI provider instantiation
 */

import { AIProvider, AIProviderType } from './types';
import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';

export class ProviderFactory {
  private static providers: Map<AIProviderType, new (apiKey: string) => AIProvider> = new Map();
  
  // Auto-register known providers
  static {
    this.registerProvider('openai', OpenAIProvider);
    this.registerProvider('anthropic', AnthropicProvider);
  }
  
  /**
   * Register a provider class with the factory
   */
  static registerProvider(type: AIProviderType, providerClass: new (apiKey: string) => AIProvider) {
    this.providers.set(type, providerClass);
  }
  
  /**
   * Create a provider instance if API key is available
   */
  static createProvider(type: AIProviderType, apiKey?: string): AIProvider | null {
    if (!apiKey) {
      return null;
    }
    
    const ProviderClass = this.providers.get(type);
    if (!ProviderClass) {
      throw new Error(`Provider ${type} not registered`);
    }
    
    return new ProviderClass(apiKey);
  }
  
  /**
   * Get all available provider types
   */
  static getAvailableProviderTypes(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Check if a provider type is registered
   */
  static isProviderRegistered(type: AIProviderType): boolean {
    return this.providers.has(type);
  }
  
  /**
   * Create all available providers based on environment variables
   */
  static createAvailableProviders(): Map<AIProviderType, AIProvider> {
    const providers = new Map<AIProviderType, AIProvider>();
    
    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const openaiProvider = this.createProvider('openai', openaiKey);
      if (openaiProvider) {
        providers.set('openai', openaiProvider);
      }
    }
    
    // Check for Anthropic API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const anthropicProvider = this.createProvider('anthropic', anthropicKey);
      if (anthropicProvider) {
        providers.set('anthropic', anthropicProvider);
      }
    }
    
    return providers;
  }
}