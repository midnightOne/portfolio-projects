/**
 * Tests for AI Availability Checker
 */

import { AIAvailabilityChecker } from '../availability-checker';
import { AIServiceManager } from '../service-manager';

// Mock the service manager
jest.mock('../service-manager');

const mockServiceManager = AIServiceManager as jest.MockedClass<typeof AIServiceManager>;

describe('AIAvailabilityChecker', () => {
  let checker: AIAvailabilityChecker;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get fresh instance
    checker = AIAvailabilityChecker.getInstance();
    checker.clearCache();
  });

  describe('checkAvailability', () => {
    it('should return available when providers are configured and connected', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: true,
          error: undefined,
          models: ['gpt-4', 'gpt-3.5-turbo'],
          lastTested: new Date()
        },
        {
          name: 'anthropic' as const,
          configured: true,
          connected: true,
          error: undefined,
          models: ['claude-3-sonnet'],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const status = await checker.checkAvailability();

      expect(status.available).toBe(true);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet']);
      expect(status.unavailableReasons).toHaveLength(0);
    });

    it('should return unavailable when no providers are configured', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: false,
          connected: false,
          error: 'OPENAI_API_KEY environment variable not set',
          models: [],
          lastTested: new Date()
        },
        {
          name: 'anthropic' as const,
          configured: false,
          connected: false,
          error: 'ANTHROPIC_API_KEY environment variable not set',
          models: [],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const status = await checker.checkAvailability();

      expect(status.available).toBe(false);
      expect(status.hasConfiguredProviders).toBe(false);
      expect(status.hasConnectedProviders).toBe(false);
      expect(status.availableModels).toHaveLength(0);
      expect(status.unavailableReasons).toContain('No AI providers are configured');
      expect(status.suggestions).toContain('Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables');
    });

    it('should return unavailable when providers are configured but not connected', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: false,
          error: 'Invalid API key',
          models: [],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const status = await checker.checkAvailability();

      expect(status.available).toBe(false);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(false);
      expect(status.unavailableReasons).toContain('No AI providers are connected');
      expect(status.unavailableReasons).toContain('openai: Invalid API key');
      expect(status.suggestions).toContain('Check your API keys are valid and active');
    });

    it('should return unavailable when providers are connected but no models configured', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: true,
          error: undefined,
          models: [], // No models configured
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const status = await checker.checkAvailability();

      expect(status.available).toBe(false);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels).toHaveLength(0);
      expect(status.unavailableReasons).toContain('No AI models are configured');
      expect(status.suggestions).toContain('Configure models for your connected providers in AI Settings');
    });

    it('should handle errors gracefully', async () => {
      mockServiceManager.prototype.getAvailableProviders.mockRejectedValue(new Error('Network error'));

      const status = await checker.checkAvailability();

      expect(status.available).toBe(false);
      expect(status.unavailableReasons).toContain('Unable to check AI service status');
      expect(status.suggestions).toContain('Check your internet connection');
    });

    it('should cache results for performance', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: true,
          error: undefined,
          models: ['gpt-4'],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      // First call
      const status1 = await checker.checkAvailability();
      
      // Second call should use cache
      const status2 = await checker.checkAvailability();

      expect(status1).toEqual(status2);
      expect(mockServiceManager.prototype.getAvailableProviders).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache when forced', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: true,
          error: undefined,
          models: ['gpt-4'],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      // First call
      await checker.checkAvailability();
      
      // Force refresh
      await checker.checkAvailability(true);

      expect(mockServiceManager.prototype.getAvailableProviders).toHaveBeenCalledTimes(2);
    });
  });

  describe('isAIEnabled', () => {
    it('should return true when AI is available', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: true,
          error: undefined,
          models: ['gpt-4'],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const enabled = await checker.isAIEnabled();
      expect(enabled).toBe(true);
    });

    it('should return false when AI is not available', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: false,
          connected: false,
          error: 'Not configured',
          models: [],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const enabled = await checker.isAIEnabled();
      expect(enabled).toBe(false);
    });
  });

  describe('getStatusMessage', () => {
    it('should return appropriate status messages', async () => {
      // Available case
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: true,
          error: undefined,
          models: ['gpt-4', 'gpt-3.5-turbo'],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const message = await checker.getStatusMessage();
      expect(message).toContain('AI features are available with 2 models');
    });

    it('should return disabled message when not configured', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: false,
          connected: false,
          error: 'Not configured',
          models: [],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const message = await checker.getStatusMessage();
      expect(message).toContain('AI features are disabled - no providers configured');
    });
  });

  describe('getConfigurationGuidance', () => {
    it('should provide setup guidance when not configured', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: false,
          connected: false,
          error: 'Not configured',
          models: [],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const guidance = await checker.getConfigurationGuidance();
      
      expect(guidance.title).toBe('AI Setup Required');
      expect(guidance.message).toContain('AI features require API key configuration');
      expect(guidance.actions).toContainEqual(
        expect.objectContaining({
          label: 'Set Environment Variables'
        })
      );
    });

    it('should provide connection guidance when configured but not connected', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: false,
          error: 'Invalid API key',
          models: [],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const guidance = await checker.getConfigurationGuidance();
      
      expect(guidance.title).toBe('Connection Issues');
      expect(guidance.message).toContain('AI providers are configured but not connecting');
      expect(guidance.actions).toContainEqual(
        expect.objectContaining({
          label: 'Test Connections'
        })
      );
    });
  });

  describe('isModelAvailable', () => {
    it('should check if specific model is available', async () => {
      const mockProviderStatuses = [
        {
          name: 'openai' as const,
          configured: true,
          connected: true,
          error: undefined,
          models: ['gpt-4', 'gpt-3.5-turbo'],
          lastTested: new Date()
        }
      ];

      mockServiceManager.prototype.getAvailableProviders.mockResolvedValue(mockProviderStatuses);

      const isAvailable = await checker.isModelAvailable('gpt-4');
      const isNotAvailable = await checker.isModelAvailable('claude-3-sonnet');

      expect(isAvailable).toBe(true);
      expect(isNotAvailable).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AIAvailabilityChecker.getInstance();
      const instance2 = AIAvailabilityChecker.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});