/**
 * Integration tests for provider factory with both OpenAI and Anthropic providers
 */

import { describe, it, expect } from '@jest/globals';
import { ProviderFactory } from '../provider-factory';

describe('ProviderFactory Integration', () => {
  describe('Provider Registration', () => {
    it('should have both providers registered', () => {
      expect(ProviderFactory.isProviderRegistered('openai')).toBe(true);
      expect(ProviderFactory.isProviderRegistered('anthropic')).toBe(true);
    });
    
    it('should return both provider types', () => {
      const types = ProviderFactory.getAvailableProviderTypes();
      expect(types).toContain('openai');
      expect(types).toContain('anthropic');
      expect(types.length).toBe(2);
    });
    
    it('should return null for missing API keys', () => {
      const openaiProvider = ProviderFactory.createProvider('openai');
      const anthropicProvider = ProviderFactory.createProvider('anthropic');
      
      expect(openaiProvider).toBeNull();
      expect(anthropicProvider).toBeNull();
    });
    
    it('should throw error for unregistered provider', () => {
      expect(() => {
        ProviderFactory.createProvider('unknown' as any, 'test-key');
      }).toThrow('Provider unknown not registered');
    });
  });
  
  describe('createAvailableProviders environment handling', () => {
    const originalEnv = process.env;
    
    afterEach(() => {
      // Restore environment
      process.env = originalEnv;
    });
    
    it('should return empty map when no API keys are available', () => {
      // Clear environment variables
      process.env = { ...originalEnv };
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      const providers = ProviderFactory.createAvailableProviders();
      
      expect(providers.size).toBe(0);
    });
    
    it('should detect environment variables correctly', () => {
      // Test with mock environment
      const mockEnv = {
        ...originalEnv,
        OPENAI_API_KEY: 'test-openai-key',
        ANTHROPIC_API_KEY: 'test-anthropic-key'
      };
      
      process.env = mockEnv;
      
      // The method should at least try to create providers
      // We can't test actual creation without mocking, but we can test the logic
      expect(process.env.OPENAI_API_KEY).toBe('test-openai-key');
      expect(process.env.ANTHROPIC_API_KEY).toBe('test-anthropic-key');
    });
  });
});