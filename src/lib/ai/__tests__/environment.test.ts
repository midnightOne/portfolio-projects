/**
 * Tests for environment validation utilities
 */

import { EnvironmentValidator } from '../environment';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('EnvironmentValidator', () => {
  describe('validateAIConfig', () => {
    it('should return not configured when no API keys are set', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const result = EnvironmentValidator.validateAIConfig();

      expect(result.openai.configured).toBe(false);
      expect(result.openai.keyPreview).toBe('Not configured');
      expect(result.anthropic.configured).toBe(false);
      expect(result.anthropic.keyPreview).toBe('Not configured');
    });

    it('should return configured when API keys are set', () => {
      process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test1234567890abcdef';

      const result = EnvironmentValidator.validateAIConfig();

      expect(result.openai.configured).toBe(true);
      expect(result.openai.keyPreview).toBe('sk-t...cdef');
      expect(result.anthropic.configured).toBe(true);
      expect(result.anthropic.keyPreview).toBe('sk-a...cdef');
    });

    it('should handle short API keys', () => {
      process.env.OPENAI_API_KEY = 'short';

      const result = EnvironmentValidator.validateAIConfig();

      expect(result.openai.configured).toBe(true);
      expect(result.openai.keyPreview).toBe('short');
    });
  });

  describe('hasAnyAIProvider', () => {
    it('should return false when no providers are configured', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(EnvironmentValidator.hasAnyAIProvider()).toBe(false);
    });

    it('should return true when OpenAI is configured', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      delete process.env.ANTHROPIC_API_KEY;

      expect(EnvironmentValidator.hasAnyAIProvider()).toBe(true);
    });

    it('should return true when Anthropic is configured', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';

      expect(EnvironmentValidator.hasAnyAIProvider()).toBe(true);
    });

    it('should return true when both providers are configured', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';

      expect(EnvironmentValidator.hasAnyAIProvider()).toBe(true);
    });
  });

  describe('getConfiguredProviders', () => {
    it('should return empty array when no providers are configured', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(EnvironmentValidator.getConfiguredProviders()).toEqual([]);
    });

    it('should return only openai when OpenAI is configured', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      delete process.env.ANTHROPIC_API_KEY;

      expect(EnvironmentValidator.getConfiguredProviders()).toEqual(['openai']);
    });

    it('should return only anthropic when Anthropic is configured', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';

      expect(EnvironmentValidator.getConfiguredProviders()).toEqual(['anthropic']);
    });

    it('should return both providers when both are configured', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';

      expect(EnvironmentValidator.getConfiguredProviders()).toEqual(['openai', 'anthropic']);
    });
  });

  describe('getEnvironmentStatus', () => {
    it('should return comprehensive status with warnings', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const status = EnvironmentValidator.getEnvironmentStatus();

      expect(status.hasAnyProvider).toBe(false);
      expect(status.configuredProviders).toEqual([]);
      expect(status.isFullyConfigured).toBe(false);
      expect(status.warnings).toContain('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables.');
    });

    it('should return status with partial configuration warnings', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      delete process.env.ANTHROPIC_API_KEY;

      const status = EnvironmentValidator.getEnvironmentStatus();

      expect(status.hasAnyProvider).toBe(true);
      expect(status.configuredProviders).toEqual(['openai']);
      expect(status.isFullyConfigured).toBe(false);
      expect(status.warnings).toContain('Anthropic not configured. Set ANTHROPIC_API_KEY to enable Claude models.');
    });

    it('should return fully configured status', () => {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';

      const status = EnvironmentValidator.getEnvironmentStatus();

      expect(status.hasAnyProvider).toBe(true);
      expect(status.configuredProviders).toEqual(['openai', 'anthropic']);
      expect(status.isFullyConfigured).toBe(true);
      expect(status.warnings).toEqual([]);
    });
  });
});