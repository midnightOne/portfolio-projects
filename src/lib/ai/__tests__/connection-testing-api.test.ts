/**
 * Tests for the AI Connection Testing functionality
 * 
 * This test suite verifies:
 * - Real API connection testing for each provider
 * - Detailed error reporting with actionable messages
 * - Connection status with available models list
 * - Error handling and guidance generation
 * 
 * Requirements: 4.1, 4.2, 4.3, 9.1, 9.2
 */

import { AIServiceManager } from '@/lib/ai/service-manager';
import { ProviderFactory } from '@/lib/ai/provider-factory';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the provider factory and providers
jest.mock('@/lib/ai/provider-factory');
jest.mock('@/lib/ai/providers/openai-provider');
jest.mock('@/lib/ai/providers/anthropic-provider');

describe('AI Connection Testing', () => {
  let aiService: AIServiceManager;
  let mockProviderFactory: jest.Mocked<typeof ProviderFactory>;
  let mockOpenAIProvider: any;
  let mockAnthropicProvider: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock providers
    mockOpenAIProvider = {
      name: 'openai',
      testConnection: jest.fn(),
      listModels: jest.fn()
    };
    
    mockAnthropicProvider = {
      name: 'anthropic',
      testConnection: jest.fn(),
      listModels: jest.fn()
    };
    
    // Mock provider factory
    mockProviderFactory = ProviderFactory as jest.Mocked<typeof ProviderFactory>;
    mockProviderFactory.createAvailableProviders.mockReturnValue(new Map([
      ['openai', mockOpenAIProvider],
      ['anthropic', mockAnthropicProvider]
    ]));
    
    aiService = new AIServiceManager();
  });

  describe('Connection Testing', () => {
    it('should successfully test OpenAI connection', async () => {
      // Mock successful connection test
      mockOpenAIProvider.testConnection.mockResolvedValue(true);
      mockOpenAIProvider.listModels.mockResolvedValue(['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']);

      const result = await aiService.testConnection('openai');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected successfully');
      expect(result.availableModels).toHaveLength(5);
      expect(result.availableModels).toContain('gpt-4o');
      expect(mockOpenAIProvider.testConnection).toHaveBeenCalled();
      expect(mockOpenAIProvider.listModels).toHaveBeenCalled();
    });

    it('should successfully test Anthropic connection', async () => {
      // Mock successful connection test
      mockAnthropicProvider.testConnection.mockResolvedValue(true);
      mockAnthropicProvider.listModels.mockResolvedValue(['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']);

      const result = await aiService.testConnection('anthropic');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected successfully');
      expect(result.availableModels).toHaveLength(3);
      expect(result.availableModels).toContain('claude-3-5-sonnet-20241022');
      expect(mockAnthropicProvider.testConnection).toHaveBeenCalled();
      expect(mockAnthropicProvider.listModels).toHaveBeenCalled();
    });

    it('should handle connection failure with detailed error reporting', async () => {
      // Mock connection failure
      const error = new Error('Invalid API key');
      (error as any).status = 401;
      mockOpenAIProvider.testConnection.mockRejectedValue(error);

      const result = await aiService.testConnection('openai');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid API key for openai');
      expect(result.error?.code).toBe('INVALID_API_KEY');
      expect(result.error?.actionable).toBe(true);
      expect(mockOpenAIProvider.testConnection).toHaveBeenCalled();
    });

    it('should handle provider not configured error', async () => {
      // Mock provider factory returning empty map (no providers configured)
      mockProviderFactory.createAvailableProviders.mockReturnValue(new Map());
      
      // Create new service manager with no providers
      const serviceWithNoProviders = new AIServiceManager();
      
      const result = await serviceWithNoProviders.testConnection('anthropic');

      expect(result.success).toBe(false);
      expect(result.message).toContain('anthropic not configured');
      expect(result.error?.code).toBe('NOT_CONFIGURED');
      expect(result.error?.actionable).toBe(true);
    });

    it('should handle rate limit errors', async () => {
      // Mock rate limit error
      const error = new Error('Rate limit exceeded');
      (error as any).status = 429;
      mockOpenAIProvider.testConnection.mockRejectedValue(error);

      const result = await aiService.testConnection('openai');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Rate limit exceeded for openai');
      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.error?.actionable).toBe(false); // Rate limits are not considered actionable by user
    });

    it('should handle network errors', async () => {
      // Mock network error
      const error = new Error('Network error');
      (error as any).code = 'ECONNREFUSED';
      mockAnthropicProvider.testConnection.mockRejectedValue(error);

      const result = await aiService.testConnection('anthropic');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error connecting to anthropic');
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.actionable).toBe(false);
    });

    it('should handle connection test returning false', async () => {
      // Mock connection test returning false (but not throwing)
      mockOpenAIProvider.testConnection.mockResolvedValue(false);

      const result = await aiService.testConnection('openai');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection test failed for openai');
      expect(result.error?.code).toBe('CONNECTION_FAILED');
      expect(mockOpenAIProvider.testConnection).toHaveBeenCalled();
    });

    it('should handle unknown errors gracefully', async () => {
      // Mock unknown error
      const error = new Error('Unknown error');
      mockAnthropicProvider.testConnection.mockRejectedValue(error);

      const result = await aiService.testConnection('anthropic');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed: Unknown error');
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.actionable).toBe(false);
    });
  });

  describe('Error Classification', () => {
    it('should classify 401 errors as INVALID_API_KEY', async () => {
      const error = new Error('Unauthorized');
      (error as any).status = 401;
      mockOpenAIProvider.testConnection.mockRejectedValue(error);

      const result = await aiService.testConnection('openai');

      expect(result.error?.code).toBe('INVALID_API_KEY');
      expect(result.error?.actionable).toBe(true);
    });

    it('should classify 429 errors as RATE_LIMIT_EXCEEDED', async () => {
      const error = new Error('Too many requests');
      (error as any).status = 429;
      mockOpenAIProvider.testConnection.mockRejectedValue(error);

      const result = await aiService.testConnection('openai');

      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.error?.actionable).toBe(false); // Rate limits are not considered actionable by user
    });

    it('should classify network errors correctly', async () => {
      const error = new Error('Network error');
      (error as any).code = 'ENOTFOUND';
      mockOpenAIProvider.testConnection.mockRejectedValue(error);

      const result = await aiService.testConnection('openai');

      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.actionable).toBe(false);
    });

    it('should classify 400 errors as BAD_REQUEST', async () => {
      const error = new Error('Bad request');
      (error as any).status = 400;
      mockOpenAIProvider.testConnection.mockRejectedValue(error);

      const result = await aiService.testConnection('openai');

      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.actionable).toBe(true);
    });
  });
});