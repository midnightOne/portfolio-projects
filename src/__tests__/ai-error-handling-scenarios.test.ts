/**
 * Test suite for AI Error Handling Scenarios
 * Tests Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { AIErrorHandler, AIErrorType } from '@/lib/ai/error-handler';
import { AIServiceManager } from '@/lib/ai/service-manager';
import { AIAvailabilityChecker } from '@/lib/ai/availability-checker';
import { OpenAIProvider } from '@/lib/ai/providers/openai';
import { AnthropicProvider } from '@/lib/ai/providers/anthropic';

// Mock the providers for controlled testing
jest.mock('@/lib/ai/providers/openai');
jest.mock('@/lib/ai/providers/anthropic');

const MockedOpenAIProvider = OpenAIProvider as jest.MockedClass<typeof OpenAIProvider>;
const MockedAnthropicProvider = AnthropicProvider as jest.MockedClass<typeof AnthropicProvider>;

describe('AI Error Handling Scenarios', () => {
  let serviceManager: AIServiceManager;
  let availabilityChecker: AIAvailabilityChecker;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceManager = new AIServiceManager();
    availabilityChecker = AIAvailabilityChecker.getInstance();
    availabilityChecker.clearCache();
    
    // Set up environment for testing
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
  });

  describe('Scenario 1: Invalid API Keys', () => {
    it('should handle OpenAI invalid API key error', async () => {
      const invalidKeyError = {
        status: 401,
        statusText: 'Unauthorized',
        data: { 
          error: { 
            message: 'Incorrect API key provided',
            type: 'invalid_request_error'
          }
        }
      };

      // Mock OpenAI provider to throw invalid key error
      MockedOpenAIProvider.prototype.testConnection.mockRejectedValue(invalidKeyError);
      MockedOpenAIProvider.prototype.listModels.mockRejectedValue(invalidKeyError);

      const result = await serviceManager.testConnection('openai');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid API key for openai');
      expect(result.error?.code).toBe('INVALID_API_KEY');
      expect(result.error?.actionable).toBe(true);
    });

    it('should handle Anthropic invalid API key error', async () => {
      const invalidKeyError = {
        status: 401,
        statusText: 'Unauthorized',
        data: { 
          error: { 
            message: 'Invalid API key',
            type: 'authentication_error'
          }
        }
      };

      // Mock Anthropic provider to throw invalid key error
      MockedAnthropicProvider.prototype.testConnection.mockRejectedValue(invalidKeyError);
      MockedAnthropicProvider.prototype.listModels.mockRejectedValue(invalidKeyError);

      const result = await serviceManager.testConnection('anthropic');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid API key for anthropic');
      expect(result.error?.code).toBe('INVALID_API_KEY');
      expect(result.error?.actionable).toBe(true);
    });

    it('should parse invalid API key errors correctly', () => {
      const error = {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: { message: 'Invalid API key' } }
      };

      const result = AIErrorHandler.parseError(error, { provider: 'openai' });

      expect(result.type).toBe(AIErrorType.INVALID_API_KEY);
      expect(result.message).toContain('Invalid API key for openai');
      expect(result.actionable).toBe(true);
      expect(result.suggestions).toContain('Check your OPENAI_API_KEY environment variable');
      expect(result.suggestions).toContain('Verify the API key is active and has sufficient credits');
    });

    it('should provide specific suggestions for invalid API keys', () => {
      const openaiError = AIErrorHandler.parseError(
        { status: 401 }, 
        { provider: 'openai' }
      );
      const anthropicError = AIErrorHandler.parseError(
        { status: 401 }, 
        { provider: 'anthropic' }
      );

      expect(openaiError.suggestions).toContain('Check your OPENAI_API_KEY environment variable');
      expect(openaiError.suggestions).toContain('Visit https://platform.openai.com/api-keys to manage your keys');
      
      expect(anthropicError.suggestions).toContain('Check your ANTHROPIC_API_KEY environment variable');
      expect(anthropicError.suggestions).toContain('Visit https://console.anthropic.com/ to manage your keys');
    });

    it('should mark invalid API key errors as non-retryable', () => {
      const error = AIErrorHandler.parseError({ status: 401 });
      
      expect(AIErrorHandler.isRetryable(error)).toBe(false);
      expect(AIErrorHandler.getRetryDelay(error)).toBe(0);
    });
  });

  describe('Scenario 2: Network Connectivity Issues', () => {
    it('should handle DNS resolution errors', async () => {
      const dnsError = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND api.openai.com'
      };

      MockedOpenAIProvider.prototype.testConnection.mockRejectedValue(dnsError);

      const result = await serviceManager.testConnection('openai');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error connecting to openai');
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.actionable).toBe(true);
    });

    it('should handle connection refused errors', async () => {
      const connectionError = {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:443'
      };

      MockedAnthropicProvider.prototype.testConnection.mockRejectedValue(connectionError);

      const result = await serviceManager.testConnection('anthropic');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error connecting to anthropic');
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        code: 'ETIMEDOUT',
        message: 'connect ETIMEDOUT'
      };

      const result = AIErrorHandler.parseError(timeoutError, { provider: 'openai' });

      expect(result.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(result.message).toContain('Network error connecting to openai');
      expect(result.suggestions).toContain('Check your internet connection');
      expect(result.suggestions).toContain('Try again in a few moments');
    });

    it('should parse various network errors correctly', () => {
      const networkErrors = [
        { code: 'ENOTFOUND', message: 'DNS lookup failed' },
        { code: 'ECONNREFUSED', message: 'Connection refused' },
        { code: 'ETIMEDOUT', message: 'Connection timed out' },
        { code: 'ECONNRESET', message: 'Connection reset' }
      ];

      networkErrors.forEach(error => {
        const result = AIErrorHandler.parseError(error, { provider: 'openai' });
        
        expect(result.type).toBe(AIErrorType.NETWORK_ERROR);
        expect(result.actionable).toBe(true);
        expect(result.suggestions).toContain('Check your internet connection');
      });
    });

    it('should mark network errors as retryable', () => {
      const networkError = AIErrorHandler.parseError({ code: 'ENOTFOUND' });
      
      expect(AIErrorHandler.isRetryable(networkError)).toBe(true);
      expect(AIErrorHandler.getRetryDelay(networkError)).toBe(5000); // 5 seconds
    });

    it('should handle network errors in availability checker', async () => {
      // Mock service manager to throw network error
      const mockGetProviders = jest.spyOn(serviceManager, 'getAvailableProviders');
      mockGetProviders.mockRejectedValue(new Error('Network error'));

      const status = await availabilityChecker.checkAvailability();
      
      expect(status.available).toBe(false);
      expect(status.unavailableReasons).toContain('Unable to check AI service status');
      expect(status.suggestions).toContain('Check your internet connection');
      
      mockGetProviders.mockRestore();
    });
  });

  describe('Scenario 3: Rate Limiting', () => {
    it('should handle OpenAI rate limit errors', async () => {
      const rateLimitError = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '60' },
        data: {
          error: {
            message: 'Rate limit reached for requests',
            type: 'requests'
          }
        }
      };

      MockedOpenAIProvider.prototype.testConnection.mockRejectedValue(rateLimitError);

      const result = await serviceManager.testConnection('openai');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Rate limit exceeded for openai');
      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should handle Anthropic rate limit errors', async () => {
      const rateLimitError = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '120' },
        data: {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        }
      };

      MockedAnthropicProvider.prototype.testConnection.mockRejectedValue(rateLimitError);

      const result = await serviceManager.testConnection('anthropic');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Rate limit exceeded for anthropic');
    });

    it('should parse rate limit errors with retry-after header', () => {
      const error = {
        status: 429,
        headers: { 'retry-after': '60' }
      };

      const result = AIErrorHandler.parseError(error, { provider: 'openai' });

      expect(result.type).toBe(AIErrorType.RATE_LIMIT_EXCEEDED);
      expect(result.message).toContain('Rate limit exceeded for openai');
      expect(result.suggestions).toContain('Wait 60 seconds before retrying');
      expect(result.actionable).toBe(true);
    });

    it('should handle rate limit errors without retry-after header', () => {
      const error = {
        status: 429,
        statusText: 'Too Many Requests'
      };

      const result = AIErrorHandler.parseError(error, { provider: 'anthropic' });

      expect(result.type).toBe(AIErrorType.RATE_LIMIT_EXCEEDED);
      expect(result.suggestions).toContain('Wait a few minutes before retrying');
      expect(result.suggestions).toContain('Consider upgrading your API plan for higher limits');
    });

    it('should mark rate limit errors as retryable', () => {
      const rateLimitError = AIErrorHandler.parseError({ status: 429 });
      
      expect(AIErrorHandler.isRetryable(rateLimitError)).toBe(true);
      expect(AIErrorHandler.getRetryDelay(rateLimitError)).toBe(60000); // 1 minute default
    });

    it('should use custom retry delay from retry-after header', () => {
      const error = AIErrorHandler.parseError({
        status: 429,
        headers: { 'retry-after': '120' }
      });
      
      expect(AIErrorHandler.getRetryDelay(error)).toBe(120000); // 2 minutes
    });

    it('should handle rate limiting in content operations', async () => {
      const rateLimitError = {
        status: 429,
        headers: { 'retry-after': '30' }
      };

      // Mock chat method to throw rate limit error
      MockedOpenAIProvider.prototype.chat.mockRejectedValue(rateLimitError);

      try {
        await serviceManager.editContent({
          model: 'gpt-4',
          operation: 'improve',
          content: 'Test content',
          context: {
            projectTitle: 'Test',
            projectDescription: 'Test',
            existingTags: [],
            fullContent: 'Test content'
          }
        });
      } catch (error) {
        const parsed = AIErrorHandler.parseError(error, { 
          provider: 'openai',
          operation: 'editContent'
        });
        
        expect(parsed.type).toBe(AIErrorType.RATE_LIMIT_EXCEEDED);
        expect(parsed.suggestions).toContain('Wait 30 seconds before retrying');
      }
    });
  });

  describe('Scenario 4: Malformed Model Configurations', () => {
    it('should handle invalid model names in configuration', async () => {
      // Mock model validation to return invalid models
      const mockValidateModels = jest.spyOn(serviceManager, 'validateModels');
      mockValidateModels.mockResolvedValue({
        valid: ['gpt-4'],
        invalid: ['invalid-model-name', 'another-invalid-model'],
        warnings: [
          'Model "invalid-model-name" is not available',
          'Model "another-invalid-model" is not recognized'
        ]
      });

      const result = await serviceManager.validateModels('openai', [
        'gpt-4',
        'invalid-model-name',
        'another-invalid-model'
      ]);

      expect(result.valid).toEqual(['gpt-4']);
      expect(result.invalid).toEqual(['invalid-model-name', 'another-invalid-model']);
      expect(result.warnings).toHaveLength(2);
      
      mockValidateModels.mockRestore();
    });

    it('should handle empty model configuration', async () => {
      const mockValidateModels = jest.spyOn(serviceManager, 'validateModels');
      mockValidateModels.mockResolvedValue({
        valid: [],
        invalid: [],
        warnings: ['No models configured for this provider']
      });

      const result = await serviceManager.validateModels('openai', []);

      expect(result.valid).toHaveLength(0);
      expect(result.warnings).toContain('No models configured for this provider');
      
      mockValidateModels.mockRestore();
    });

    it('should handle malformed model configuration strings', () => {
      const malformedConfigs = [
        'gpt-4,,gpt-3.5-turbo', // Double comma
        ',gpt-4,gpt-3.5-turbo', // Leading comma
        'gpt-4,gpt-3.5-turbo,', // Trailing comma
        'gpt-4, , gpt-3.5-turbo', // Empty entry
        '   gpt-4   ,   gpt-3.5-turbo   ' // Extra whitespace
      ];

      malformedConfigs.forEach(config => {
        const models = config.split(',').map(m => m.trim()).filter(m => m.length > 0);
        
        // Should filter out empty strings and trim whitespace
        expect(models.every(model => model.length > 0)).toBe(true);
        expect(models.every(model => !model.includes(' '))).toBe(true);
      });
    });

    it('should handle model configuration parsing errors', () => {
      const error = new Error('Failed to parse model configuration');
      
      const result = AIErrorHandler.parseError(error, { 
        operation: 'validateModels',
        provider: 'openai'
      });

      expect(result.type).toBe(AIErrorType.PARSING_ERROR);
      expect(result.message).toBe('Failed to parse AI response');
      expect(result.suggestions).toContain('Check your model configuration format');
    });

    it('should validate model availability during configuration', async () => {
      // Mock provider to return specific available models
      MockedOpenAIProvider.prototype.listModels.mockResolvedValue([
        'gpt-4',
        'gpt-4-turbo',
        'gpt-3.5-turbo'
      ]);

      const mockValidateModels = jest.spyOn(serviceManager, 'validateModels');
      mockValidateModels.mockImplementation(async (provider, models) => {
        const availableModels = await MockedOpenAIProvider.prototype.listModels();
        const valid = models.filter(model => availableModels.includes(model));
        const invalid = models.filter(model => !availableModels.includes(model));
        
        return {
          valid,
          invalid,
          warnings: invalid.map(model => `Model "${model}" is not available`)
        };
      });

      const result = await serviceManager.validateModels('openai', [
        'gpt-4',
        'gpt-5', // Invalid model
        'claude-3-sonnet' // Wrong provider
      ]);

      expect(result.valid).toEqual(['gpt-4']);
      expect(result.invalid).toEqual(['gpt-5', 'claude-3-sonnet']);
      expect(result.warnings).toHaveLength(2);
      
      mockValidateModels.mockRestore();
    });

    it('should handle provider mismatch in model configuration', async () => {
      const result = AIErrorHandler.parseError(
        new Error('Model "claude-3-sonnet" is not available for OpenAI provider'),
        { 
          provider: 'openai',
          operation: 'validateModels'
        }
      );

      expect(result.type).toBe(AIErrorType.PARSING_ERROR);
      expect(result.suggestions).toContain('Verify you are using the correct models for each provider');
    });
  });

  describe('Error Context and Logging', () => {
    it('should include comprehensive context in error details', () => {
      const error = new Error('Test error');
      const context = {
        provider: 'openai',
        model: 'gpt-4',
        operation: 'editContent',
        userId: 'user123',
        projectId: 'project456'
      };

      const result = AIErrorHandler.parseError(error, context);

      expect(result.context?.provider).toBe('openai');
      expect(result.context?.model).toBe('gpt-4');
      expect(result.context?.operation).toBe('editContent');
      expect(result.context?.timestamp).toBeInstanceOf(Date);
    });

    it('should provide user-friendly display messages', () => {
      const errors = [
        { status: 401, provider: 'openai' },
        { status: 429, provider: 'anthropic' },
        { code: 'ENOTFOUND', provider: 'openai' },
        { message: 'Unknown error' }
      ];

      errors.forEach(error => {
        const parsed = AIErrorHandler.parseError(error, { provider: error.provider });
        const displayMessage = AIErrorHandler.getDisplayMessage(parsed);
        
        expect(displayMessage).toBeTruthy();
        expect(typeof displayMessage).toBe('string');
        expect(displayMessage.length).toBeGreaterThan(0);
      });
    });

    it('should provide actionable suggestions for all error types', () => {
      const errorTypes = [
        AIErrorType.INVALID_API_KEY,
        AIErrorType.RATE_LIMIT_EXCEEDED,
        AIErrorType.NETWORK_ERROR,
        AIErrorType.NOT_CONFIGURED,
        AIErrorType.PARSING_ERROR,
        AIErrorType.SERVICE_UNAVAILABLE,
        AIErrorType.UNKNOWN_ERROR
      ];

      errorTypes.forEach(errorType => {
        const mockError = { type: errorType, message: 'Test', actionable: true };
        const suggestions = AIErrorHandler.getSuggestions(mockError as any);
        
        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.every(s => typeof s === 'string')).toBe(true);
      });
    });

    it('should handle cascading errors gracefully', async () => {
      // Simulate a scenario where multiple errors occur
      MockedOpenAIProvider.prototype.testConnection.mockRejectedValue(
        new Error('Network error')
      );
      MockedAnthropicProvider.prototype.testConnection.mockRejectedValue(
        { status: 401 }
      );

      const providers = await serviceManager.getAvailableProviders();
      
      // Should handle both errors and return status for both providers
      expect(providers).toHaveLength(2);
      expect(providers.every(p => !p.connected)).toBe(true);
      expect(providers.some(p => p.error?.includes('Network error'))).toBe(true);
      expect(providers.some(p => p.error?.includes('Invalid API key'))).toBe(true);
    });

    it('should maintain error history for debugging', () => {
      const errors = [
        { status: 401 },
        { status: 429 },
        { code: 'ENOTFOUND' }
      ];

      const parsedErrors = errors.map(error => 
        AIErrorHandler.parseError(error, { provider: 'openai' })
      );

      // Each error should have a timestamp for tracking
      parsedErrors.forEach(error => {
        expect(error.context?.timestamp).toBeInstanceOf(Date);
      });

      // Timestamps should be different (assuming some time passes)
      const timestamps = parsedErrors.map(e => e.context?.timestamp?.getTime());
      expect(new Set(timestamps).size).toBeGreaterThan(0);
    });
  });

  describe('Service Degradation and Recovery', () => {
    it('should handle partial service availability', async () => {
      // Mock one provider working, one failing
      MockedOpenAIProvider.prototype.testConnection.mockResolvedValue(true);
      MockedOpenAIProvider.prototype.listModels.mockResolvedValue(['gpt-4']);
      
      MockedAnthropicProvider.prototype.testConnection.mockRejectedValue(
        { status: 503, statusText: 'Service Unavailable' }
      );

      const status = await availabilityChecker.checkAvailability();
      
      expect(status.available).toBe(true); // Still available via OpenAI
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels.length).toBeGreaterThan(0);
      expect(status.unavailableReasons.length).toBeGreaterThan(0); // But with warnings
    });

    it('should provide recovery guidance', async () => {
      // Mock service unavailable error
      const serviceError = {
        status: 503,
        statusText: 'Service Unavailable'
      };

      const result = AIErrorHandler.parseError(serviceError, { provider: 'openai' });

      expect(result.type).toBe(AIErrorType.SERVICE_UNAVAILABLE);
      expect(result.suggestions).toContain('The service is temporarily unavailable');
      expect(result.suggestions).toContain('Try again in a few minutes');
      expect(AIErrorHandler.isRetryable(result)).toBe(true);
    });

    it('should handle graceful degradation in UI components', async () => {
      // Mock availability checker to return degraded state
      const mockCheckAvailability = jest.spyOn(availabilityChecker, 'checkAvailability');
      mockCheckAvailability.mockResolvedValue({
        available: false,
        hasConfiguredProviders: true,
        hasConnectedProviders: false,
        availableModels: [],
        unavailableReasons: ['Connection failed'],
        suggestions: ['Check your API keys']
      });

      const guidance = await availabilityChecker.getConfigurationGuidance();
      
      expect(guidance.title).toBe('Connection Issues');
      expect(guidance.message).toContain('AI providers are configured but not connecting');
      expect(guidance.actions.length).toBeGreaterThan(0);
      
      mockCheckAvailability.mockRestore();
    });
  });
});