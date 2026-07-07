/**
 * Tests for AI provider interfaces and factory.
 * Providers are key-validation + model-listing surfaces (the D4 registry's refresh
 * source); chat runs through the reasoning-adapter layer (reasoning-adapters.test.ts).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProviderFactory } from '../provider-factory';
import { BaseProvider } from '../providers/base-provider';
import { AIProviderType } from '../types';

// Mock provider for testing
class MockProvider extends BaseProvider {
  name: AIProviderType = 'openai';

  async testConnection(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<string[]> {
    return ['mock-model-1', 'mock-model-2'];
  }
}

describe('AI Provider Interfaces', () => {
  const registered = new Map((ProviderFactory as any).providers);

  beforeEach(() => {
    (ProviderFactory as any).providers.clear();
  });

  afterEach(() => {
    // Restore the real registrations for other suites
    (ProviderFactory as any).providers = new Map(registered);
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
    it('should require API key', () => {
      expect(() => new MockProvider('')).toThrow('API key is required');
    });

    it('should expose the connection + listing surface', async () => {
      const provider = new MockProvider('test-key');
      await expect(provider.testConnection()).resolves.toBe(true);
      await expect(provider.listModels()).resolves.toEqual(['mock-model-1', 'mock-model-2']);
    });

    it('should parse provider errors', () => {
      const provider = new MockProvider('test-key');

      const error401 = { status: 401 };
      const message = provider['parseProviderError'](error401);
      expect(message).toContain('Invalid API key');

      const error429 = { status: 429 };
      const message429 = provider['parseProviderError'](error429);
      expect(message429).toContain('Rate limit exceeded');
    });
  });
});
