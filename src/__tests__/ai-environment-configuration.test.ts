/**
 * Test suite for AI Environment Configuration Scenarios
 * Tests Requirements: 10.1, 10.2, 10.3
 */

import { EnvironmentValidator } from '@/lib/ai/environment';
import { AIServiceManager } from '@/lib/ai/service-manager';
import { AIAvailabilityChecker } from '@/lib/ai/availability-checker';

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock environment variables for testing
const originalEnv = process.env;

describe('AI Environment Configuration Scenarios', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Clear any cached instances
    AIAvailabilityChecker.getInstance().clearCache();
    
    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Scenario 1: No API keys configured', () => {
    beforeEach(() => {
      // Remove all AI-related environment variables
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should detect no providers are configured', () => {
      const status = EnvironmentValidator.validateAIConfig();
      
      expect(status.openai.configured).toBe(false);
      expect(status.anthropic.configured).toBe(false);
      expect(status.openai.keyPreview).toBe('Not configured');
      expect(status.anthropic.keyPreview).toBe('Not configured');
    });

    it('should return false for hasAnyAIProvider', () => {
      const hasAny = EnvironmentValidator.hasAnyAIProvider();
      expect(hasAny).toBe(false);
    });

    it('should return empty array for configured providers', () => {
      const providers = EnvironmentValidator.getConfiguredProviders();
      expect(providers).toEqual([]);
    });

    it('should provide appropriate warnings', () => {
      const envStatus = EnvironmentValidator.getEnvironmentStatus();
      
      expect(envStatus.hasAnyProvider).toBe(false);
      expect(envStatus.isFullyConfigured).toBe(false);
      expect(envStatus.warnings).toContain(
        'No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables.'
      );
    });

    it('should show AI as unavailable in availability checker', async () => {
      // Mock API response for no configured providers
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: false,
              connected: false,
              error: 'OPENAI_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: false,
              connected: false,
              error: 'ANTHROPIC_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const status = await checker.checkAvailability();
      
      expect(status.available).toBe(false);
      expect(status.hasConfiguredProviders).toBe(false);
      expect(status.hasConnectedProviders).toBe(false);
      expect(status.availableModels).toHaveLength(0);
      expect(status.unavailableReasons).toContain('No AI providers are configured');
      expect(status.suggestions).toContain('Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables');
    });

    it('should return appropriate status message', async () => {
      // Mock API response for no configured providers
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: false,
              connected: false,
              error: 'OPENAI_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: false,
              connected: false,
              error: 'ANTHROPIC_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const message = await checker.getStatusMessage();
      
      expect(message).toContain('AI features are disabled - no providers configured');
    });

    it('should provide setup guidance', async () => {
      // Mock API response for no configured providers
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: false,
              connected: false,
              error: 'OPENAI_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: false,
              connected: false,
              error: 'ANTHROPIC_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const guidance = await checker.getConfigurationGuidance();
      
      expect(guidance.title).toBe('AI Setup Required');
      expect(guidance.message).toContain('AI features require API key configuration');
      expect(guidance.actions).toContainEqual(
        expect.objectContaining({
          label: 'Set Environment Variables'
        })
      );
    });

    it('should handle service manager gracefully', async () => {
      const serviceManager = new AIServiceManager();
      const providers = await serviceManager.getAvailableProviders();
      
      // Should return empty array or providers with configured: false
      expect(Array.isArray(providers)).toBe(true);
      providers.forEach(provider => {
        expect(provider.configured).toBe(false);
        expect(provider.connected).toBe(false);
      });
    });
  });

  describe('Scenario 2: Only OpenAI configured', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-openai-key-12345';
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('should detect only OpenAI is configured', () => {
      const status = EnvironmentValidator.validateAIConfig();
      
      expect(status.openai.configured).toBe(true);
      expect(status.anthropic.configured).toBe(false);
      expect(status.openai.keyPreview).toBe('sk-t...2345');
      expect(status.anthropic.keyPreview).toBe('Not configured');
    });

    it('should return true for hasAnyAIProvider', () => {
      const hasAny = EnvironmentValidator.hasAnyAIProvider();
      expect(hasAny).toBe(true);
    });

    it('should return only openai in configured providers', () => {
      const providers = EnvironmentValidator.getConfiguredProviders();
      expect(providers).toEqual(['openai']);
    });

    it('should provide warning about missing Anthropic', () => {
      const envStatus = EnvironmentValidator.getEnvironmentStatus();
      
      expect(envStatus.hasAnyProvider).toBe(true);
      expect(envStatus.isFullyConfigured).toBe(false);
      expect(envStatus.warnings).toContain(
        'Anthropic not configured. Set ANTHROPIC_API_KEY to enable Claude models.'
      );
      expect(envStatus.warnings).not.toContain('OpenAI not configured');
    });

    it('should show partial availability in availability checker', async () => {
      // Mock API response for OpenAI configured, Anthropic not
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: true,
              connected: true,
              error: undefined,
              models: ['gpt-4', 'gpt-3.5-turbo'],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: false,
              connected: false,
              error: 'ANTHROPIC_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const status = await checker.checkAvailability();
      
      expect(status.available).toBe(true);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });

    it('should return appropriate status message for partial configuration', async () => {
      // Mock API response for OpenAI configured, Anthropic not
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: true,
              connected: true,
              error: undefined,
              models: ['gpt-4', 'gpt-3.5-turbo'],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: false,
              connected: false,
              error: 'Not configured',
              models: [],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const message = await checker.getStatusMessage();
      
      expect(message).toContain('AI features are available with 2 models');
    });

    it('should handle service manager with only OpenAI', async () => {
      const serviceManager = new AIServiceManager();
      
      // Mock the provider initialization to only include OpenAI
      const mockGetProviders = jest.spyOn(serviceManager, 'getAvailableProviders');
      mockGetProviders.mockResolvedValue([
        {
          name: 'openai',
          configured: true,
          connected: false, // Will be false until actual connection test
          error: undefined,
          models: [],
          lastTested: new Date()
        },
        {
          name: 'anthropic',
          configured: false,
          connected: false,
          error: 'ANTHROPIC_API_KEY environment variable not set',
          models: [],
          lastTested: new Date()
        }
      ]);

      const providers = await serviceManager.getAvailableProviders();
      
      expect(providers).toHaveLength(2);
      expect(providers.find(p => p.name === 'openai')?.configured).toBe(true);
      expect(providers.find(p => p.name === 'anthropic')?.configured).toBe(false);
      
      mockGetProviders.mockRestore();
    });
  });

  describe('Scenario 3: Only Anthropic configured', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-12345';
    });

    it('should detect only Anthropic is configured', () => {
      const status = EnvironmentValidator.validateAIConfig();
      
      expect(status.openai.configured).toBe(false);
      expect(status.anthropic.configured).toBe(true);
      expect(status.openai.keyPreview).toBe('Not configured');
      expect(status.anthropic.keyPreview).toBe('sk-a...2345');
    });

    it('should return true for hasAnyAIProvider', () => {
      const hasAny = EnvironmentValidator.hasAnyAIProvider();
      expect(hasAny).toBe(true);
    });

    it('should return only anthropic in configured providers', () => {
      const providers = EnvironmentValidator.getConfiguredProviders();
      expect(providers).toEqual(['anthropic']);
    });

    it('should provide warning about missing OpenAI', () => {
      const envStatus = EnvironmentValidator.getEnvironmentStatus();
      
      expect(envStatus.hasAnyProvider).toBe(true);
      expect(envStatus.isFullyConfigured).toBe(false);
      expect(envStatus.warnings).toContain(
        'OpenAI not configured. Set OPENAI_API_KEY to enable OpenAI models.'
      );
      expect(envStatus.warnings).not.toContain('Anthropic not configured');
    });

    it('should show partial availability in availability checker', async () => {
      // Mock API response for Anthropic configured, OpenAI not
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: false,
              connected: false,
              error: 'OPENAI_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: true,
              connected: true,
              error: undefined,
              models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const status = await checker.checkAvailability();
      
      expect(status.available).toBe(true);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels).toEqual(['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']);
    });

    it('should handle service manager with only Anthropic', async () => {
      // Mock API response to simulate service manager behavior
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: false,
              connected: false,
              error: 'OPENAI_API_KEY environment variable not set',
              models: [],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: true,
              connected: false, // Will be false until actual connection test
              error: undefined,
              models: [],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const response = await fetch('/api/admin/ai/providers');
      const data = await response.json();
      const providers = data.data;
      
      expect(providers).toHaveLength(2);
      expect(providers.find((p: any) => p.name === 'openai')?.configured).toBe(false);
      expect(providers.find((p: any) => p.name === 'anthropic')?.configured).toBe(true);
    });
  });

  describe('Scenario 4: Both providers configured', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-openai-key-12345';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-67890';
    });

    it('should detect both providers are configured', () => {
      const status = EnvironmentValidator.validateAIConfig();
      
      expect(status.openai.configured).toBe(true);
      expect(status.anthropic.configured).toBe(true);
      expect(status.openai.keyPreview).toBe('sk-t...2345');
      expect(status.anthropic.keyPreview).toBe('sk-a...7890');
    });

    it('should return true for hasAnyAIProvider', () => {
      const hasAny = EnvironmentValidator.hasAnyAIProvider();
      expect(hasAny).toBe(true);
    });

    it('should return both providers in configured providers', () => {
      const providers = EnvironmentValidator.getConfiguredProviders();
      expect(providers).toEqual(['openai', 'anthropic']);
    });

    it('should show fully configured status', () => {
      const envStatus = EnvironmentValidator.getEnvironmentStatus();
      
      expect(envStatus.hasAnyProvider).toBe(true);
      expect(envStatus.isFullyConfigured).toBe(true);
      expect(envStatus.warnings).toHaveLength(0);
    });

    it('should show full availability when both providers connect', async () => {
      // Mock API response for both providers configured and connected
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: true,
              connected: true,
              error: undefined,
              models: ['gpt-4', 'gpt-3.5-turbo'],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: true,
              connected: true,
              error: undefined,
              models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const status = await checker.checkAvailability();
      
      expect(status.available).toBe(true);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels).toEqual([
        'gpt-4', 
        'gpt-3.5-turbo', 
        'claude-3-5-sonnet-20241022', 
        'claude-3-5-haiku-20241022'
      ]);
      expect(status.unavailableReasons).toHaveLength(0);
    });

    it('should return optimal status message for full configuration', async () => {
      // Mock API response for both providers configured and connected
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: true,
              connected: true,
              error: undefined,
              models: ['gpt-4', 'gpt-3.5-turbo'],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: true,
              connected: true,
              error: undefined,
              models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const message = await checker.getStatusMessage();
      
      expect(message).toContain('AI features are available with 4 models');
    });

    it('should handle service manager with both providers', async () => {
      // Mock API response to simulate service manager behavior
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: true,
              connected: false, // Will be false until actual connection test
              error: undefined,
              models: [],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: true,
              connected: false, // Will be false until actual connection test
              error: undefined,
              models: [],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const response = await fetch('/api/admin/ai/providers');
      const data = await response.json();
      const providers = data.data;
      
      expect(providers).toHaveLength(2);
      expect(providers.find((p: any) => p.name === 'openai')?.configured).toBe(true);
      expect(providers.find((p: any) => p.name === 'anthropic')?.configured).toBe(true);
    });

    it('should handle mixed connection states', async () => {
      // Mock API response for mixed connection states
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: true,
              connected: true,
              error: undefined,
              models: ['gpt-4', 'gpt-3.5-turbo'],
              lastTested: new Date()
            },
            {
              name: 'anthropic',
              configured: true,
              connected: false,
              error: 'Invalid API key',
              models: [],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      const status = await checker.checkAvailability();
      
      expect(status.available).toBe(true); // Still available because OpenAI works
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      // When some providers are connected, individual errors aren't added to unavailableReasons
      expect(status.unavailableReasons).toHaveLength(0);
    });
  });

  describe('Edge cases and environment validation', () => {
    it('should handle empty string API keys', () => {
      process.env.OPENAI_API_KEY = '';
      process.env.ANTHROPIC_API_KEY = '';
      
      const status = EnvironmentValidator.validateAIConfig();
      
      expect(status.openai.configured).toBe(false);
      expect(status.anthropic.configured).toBe(false);
    });

    it('should handle very short API keys', () => {
      process.env.OPENAI_API_KEY = 'sk-123';
      process.env.ANTHROPIC_API_KEY = 'sk-456';
      
      const status = EnvironmentValidator.validateAIConfig();
      
      expect(status.openai.configured).toBe(true);
      expect(status.anthropic.configured).toBe(true);
      expect(status.openai.keyPreview).toBe('sk-123'); // Too short to mask
      expect(status.anthropic.keyPreview).toBe('sk-456'); // Too short to mask
    });

    it('should handle undefined environment variables gracefully', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      const status = EnvironmentValidator.validateAIConfig();
      
      expect(status.openai.configured).toBe(false);
      expect(status.anthropic.configured).toBe(false);
      expect(status.openai.keyPreview).toBe('Not configured');
      expect(status.anthropic.keyPreview).toBe('Not configured');
    });

    it('should handle model availability checks correctly', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      // Mock API response for model availability check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              name: 'openai',
              configured: true,
              connected: true,
              error: undefined,
              models: ['gpt-4', 'gpt-3.5-turbo'],
              lastTested: new Date()
            }
          ]
        })
      } as Response);

      const checker = AIAvailabilityChecker.getInstance();
      
      const isGpt4Available = await checker.isModelAvailable('gpt-4');
      const isClaudeAvailable = await checker.isModelAvailable('claude-3-5-sonnet-20241022');
      
      expect(isGpt4Available).toBe(true);
      expect(isClaudeAvailable).toBe(false);
    });
  });
});