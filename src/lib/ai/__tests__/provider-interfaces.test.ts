/**
 * Tests for AI provider interfaces and factory
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProviderFactory } from '../provider-factory';
import { BaseProvider } from '../providers/base-provider';
import { AIProvider, ProviderChatRequest, ProviderChatResponse, AIProviderType } from '../types';

// Mock provider for testing
class MockProvider extends BaseProvider {
  name: AIProviderType = 'openai';
  
  async testConnection(): Promise<boolean> {
    return true;
  }
  
  async listModels(): Promise<string[]> {
    return ['mock-model-1', 'mock-model-2'];
  }
  
  async chat(request: ProviderChatRequest): Promise<ProviderChatResponse> {
    this.validateChatRequest(request);
    return {
      content: 'Mock response',
      model: request.model,
      tokensUsed: 10,
      cost: 0.001,
      finishReason: 'stop'
    };
  }
  
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  calculateCost(tokens: number, model: string): number {
    return tokens * 0.0001;
  }
}

describe('AI Provider Interfaces', () => {
  beforeEach(() => {
    // Clear any registered providers
    (ProviderFactory as any).providers.clear();
  });
  
  describe('ProviderFactory', () => {
    it('should register and create providers', () => {
      ProviderFactory.registerProvider('openai', MockProvider);
      
      expect(ProviderFactory.isProviderRegistered('openai')).toBe(true);
      expect(ProviderFactory.isProviderRegistered('anthropic')).toBe(false);
      
      const provider = ProviderFactory.createProvider('openai', 'test-key');
      expect(provider).toBeInstanceOf(MockProvider);
      expect(provider?.name).toBe('openai');
    });
    
    it('should return null for missing API key', () => {
      ProviderFactory.registerProvider('openai', MockProvider);
      
      const provider = ProviderFactory.createProvider('openai');
      expect(provider).toBeNull();
    });
    
    it('should throw error for unregistered provider', () => {
      expect(() => {
        ProviderFactory.createProvider('openai', 'test-key');
      }).toThrow('Provider openai not registered');
    });
    
    it('should get available provider types', () => {
      ProviderFactory.registerProvider('openai', MockProvider);
      ProviderFactory.registerProvider('anthropic', MockProvider);
      
      const types = ProviderFactory.getAvailableProviderTypes();
      expect(types).toContain('openai');
      expect(types).toContain('anthropic');
    });
  });
  
  describe('BaseProvider', () => {
    let provider: MockProvider;
    
    beforeEach(() => {
      provider = new MockProvider('test-key');
    });
    
    it('should require API key', () => {
      expect(() => new MockProvider('')).toThrow('API key is required');
    });
    
    it('should validate chat requests', async () => {
      const validRequest: ProviderChatRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }]
      };
      
      const response = await provider.chat(validRequest);
      expect(response.content).toBe('Mock response');
      expect(response.model).toBe('test-model');
      expect(response.tokensUsed).toBe(10);
    });
    
    it('should validate chat request parameters', async () => {
      const invalidRequest: ProviderChatRequest = {
        model: '',
        messages: []
      };
      
      await expect(provider.chat(invalidRequest)).rejects.toThrow('Model is required');
    });
    
    it('should validate temperature range', async () => {
      const invalidRequest: ProviderChatRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 2.0
      };
      
      await expect(provider.chat(invalidRequest)).rejects.toThrow('Temperature must be between 0 and 1');
    });
    
    it('should estimate tokens', () => {
      const tokens = provider.estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
    });
    
    it('should calculate cost', () => {
      const cost = provider.calculateCost(100, 'test-model');
      expect(cost).toBeGreaterThan(0);
    });
    
    it('should parse provider errors', () => {
      const error401 = { status: 401 };
      const message = provider['parseProviderError'](error401);
      expect(message).toContain('Invalid API key');
      
      const error429 = { status: 429 };
      const message429 = provider['parseProviderError'](error429);
      expect(message429).toContain('Rate limit exceeded');
    });
  });
  
  describe('Type Interfaces', () => {
    it('should have correct ChatMessage structure', () => {
      const message = {
        role: 'user' as const,
        content: 'Hello'
      };
      
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
    });
    
    it('should have correct ProviderChatRequest structure', () => {
      const request: ProviderChatRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are helpful'
      };
      
      expect(request.model).toBe('test-model');
      expect(request.messages).toHaveLength(1);
      expect(request.temperature).toBe(0.7);
    });
    
    it('should have correct ProviderChatResponse structure', () => {
      const response: ProviderChatResponse = {
        content: 'Hello back',
        model: 'test-model',
        tokensUsed: 10,
        cost: 0.001,
        finishReason: 'stop'
      };
      
      expect(response.content).toBe('Hello back');
      expect(response.finishReason).toBe('stop');
    });
  });
});