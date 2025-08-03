import { EnvironmentValidator } from '../environment';

describe('Environment Status API Logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('EnvironmentValidator.getEnvironmentStatus', () => {
    it('should return correct status when both providers are configured', () => {
      process.env.OPENAI_API_KEY = 'sk-1234567890abcdef1234567890abcdef';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-1234567890abcdef1234567890abcdef';

      const status = EnvironmentValidator.getEnvironmentStatus();

      expect(status.openai.configured).toBe(true);
      expect(status.openai.keyPreview).toBe('sk-1...cdef');
      expect(status.anthropic.configured).toBe(true);
      expect(status.anthropic.keyPreview).toBe('sk-a...cdef');
      expect(status.hasAnyProvider).toBe(true);
      expect(status.configuredProviders).toEqual(['openai', 'anthropic']);
      expect(status.isFullyConfigured).toBe(true);
      expect(status.warnings).toEqual([]);
    });

    it('should return correct status when only OpenAI is configured', () => {
      process.env.OPENAI_API_KEY = 'sk-1234567890abcdef1234567890abcdef';
      delete process.env.ANTHROPIC_API_KEY;

      const status = EnvironmentValidator.getEnvironmentStatus();

      expect(status.openai.configured).toBe(true);
      expect(status.openai.keyPreview).toBe('sk-1...cdef');
      expect(status.anthropic.configured).toBe(false);
      expect(status.anthropic.keyPreview).toBe('Not configured');
      expect(status.hasAnyProvider).toBe(true);
      expect(status.configuredProviders).toEqual(['openai']);
      expect(status.isFullyConfigured).toBe(false);
      expect(status.warnings).toEqual(['Anthropic not configured. Set ANTHROPIC_API_KEY to enable Claude models.']);
    });

    it('should return correct status when only Anthropic is configured', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-1234567890abcdef1234567890abcdef';

      const status = EnvironmentValidator.getEnvironmentStatus();

      expect(status.openai.configured).toBe(false);
      expect(status.openai.keyPreview).toBe('Not configured');
      expect(status.anthropic.configured).toBe(true);
      expect(status.anthropic.keyPreview).toBe('sk-a...cdef');
      expect(status.hasAnyProvider).toBe(true);
      expect(status.configuredProviders).toEqual(['anthropic']);
      expect(status.isFullyConfigured).toBe(false);
      expect(status.warnings).toEqual(['OpenAI not configured. Set OPENAI_API_KEY to enable OpenAI models.']);
    });

    it('should return correct status when no providers are configured', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const status = EnvironmentValidator.getEnvironmentStatus();

      expect(status.openai.configured).toBe(false);
      expect(status.openai.keyPreview).toBe('Not configured');
      expect(status.anthropic.configured).toBe(false);
      expect(status.anthropic.keyPreview).toBe('Not configured');
      expect(status.hasAnyProvider).toBe(false);
      expect(status.configuredProviders).toEqual([]);
      expect(status.isFullyConfigured).toBe(false);
      expect(status.warnings).toEqual(['No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables.']);
    });

    it('should mask API keys correctly', () => {
      process.env.OPENAI_API_KEY = 'sk-short';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-verylongapikeyhere1234567890';

      const status = EnvironmentValidator.getEnvironmentStatus();

      // Short keys should not be masked
      expect(status.openai.keyPreview).toBe('sk-short');
      
      // Long keys should be masked
      expect(status.anthropic.keyPreview).toBe('sk-a...7890');
    });
  });

  describe('API Response Structure Validation', () => {
    it('should generate the expected API response structure', () => {
      process.env.OPENAI_API_KEY = 'sk-1234567890abcdef1234567890abcdef';
      delete process.env.ANTHROPIC_API_KEY;

      const environmentStatus = EnvironmentValidator.getEnvironmentStatus();
      
      // Simulate the API response structure
      const apiResponse = {
        success: true,
        data: {
          // Individual provider status with masked API keys
          openai: {
            configured: environmentStatus.openai.configured,
            keyPreview: environmentStatus.openai.keyPreview,
            environmentVariable: 'OPENAI_API_KEY'
          },
          anthropic: {
            configured: environmentStatus.anthropic.configured,
            keyPreview: environmentStatus.anthropic.keyPreview,
            environmentVariable: 'ANTHROPIC_API_KEY'
          },
          
          // Overall status summary
          summary: {
            hasAnyProvider: environmentStatus.hasAnyProvider,
            configuredProviders: environmentStatus.configuredProviders,
            isFullyConfigured: environmentStatus.isFullyConfigured,
            totalConfigured: environmentStatus.configuredProviders.length,
            totalAvailable: 2
          },
          
          // Configuration warnings and guidance
          warnings: environmentStatus.warnings,
          
          // Setup instructions for missing providers
          setupInstructions: {
            openai: environmentStatus.openai.configured ? null : {
              message: 'Set OPENAI_API_KEY environment variable',
              documentation: 'https://platform.openai.com/api-keys',
              example: 'OPENAI_API_KEY=sk-...'
            },
            anthropic: environmentStatus.anthropic.configured ? null : {
              message: 'Set ANTHROPIC_API_KEY environment variable', 
              documentation: 'https://console.anthropic.com/settings/keys',
              example: 'ANTHROPIC_API_KEY=sk-ant-...'
            }
          }
        },
        timestamp: new Date().toISOString()
      };

      // Validate the structure matches requirements
      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data.openai.configured).toBe(true);
      expect(apiResponse.data.openai.keyPreview).toBe('sk-1...cdef');
      expect(apiResponse.data.openai.environmentVariable).toBe('OPENAI_API_KEY');
      
      expect(apiResponse.data.anthropic.configured).toBe(false);
      expect(apiResponse.data.anthropic.keyPreview).toBe('Not configured');
      expect(apiResponse.data.anthropic.environmentVariable).toBe('ANTHROPIC_API_KEY');
      
      expect(apiResponse.data.summary.hasAnyProvider).toBe(true);
      expect(apiResponse.data.summary.configuredProviders).toEqual(['openai']);
      expect(apiResponse.data.summary.isFullyConfigured).toBe(false);
      expect(apiResponse.data.summary.totalConfigured).toBe(1);
      expect(apiResponse.data.summary.totalAvailable).toBe(2);
      
      expect(apiResponse.data.warnings).toEqual(['Anthropic not configured. Set ANTHROPIC_API_KEY to enable Claude models.']);
      
      expect(apiResponse.data.setupInstructions.openai).toBeNull();
      expect(apiResponse.data.setupInstructions.anthropic).toEqual({
        message: 'Set ANTHROPIC_API_KEY environment variable',
        documentation: 'https://console.anthropic.com/settings/keys',
        example: 'ANTHROPIC_API_KEY=sk-ant-...'
      });
      
      expect(apiResponse.timestamp).toBeDefined();
    });
  });
});