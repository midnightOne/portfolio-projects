/**
 * Integration tests for voice configuration system
 */

import {
  DEFAULT_OPENAI_CONFIG,
  DEFAULT_ELEVENLABS_CONFIG,
  OpenAIRealtimeConfigSchema,
  ElevenLabsConfigSchema,
  validateEnvironmentVariable,
  getDefaultConfigForProvider,
  isOpenAIConfig,
  isElevenLabsConfig
} from '../../../types/voice-config';

import { VoiceConfigValidator, VoiceConfigHelpers } from '../config-validation';

describe('Voice Configuration Integration', () => {
  describe('Default Configurations', () => {
    it('should provide valid OpenAI default configuration', () => {
      const config = DEFAULT_OPENAI_CONFIG;
      
      expect(config.provider).toBe('openai');
      expect(config.enabled).toBe(true);
      expect(config.model).toBe('gpt-realtime');
      expect(config.voice).toBe('alloy');
      expect(config.sessionConfig.transport).toBe('webrtc');
      
      // Should validate successfully
      const result = OpenAIRealtimeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should provide valid ElevenLabs default configuration', () => {
      const config = DEFAULT_ELEVENLABS_CONFIG;
      
      expect(config.provider).toBe('elevenlabs');
      expect(config.enabled).toBe(true);
      expect(config.model).toBe('eleven_turbo_v2_5');
      expect(config.voiceSettings.stability).toBe(0.5);
      
      // Should validate successfully
      const result = ElevenLabsConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate OpenAI configuration with VoiceConfigValidator', () => {
      const result = VoiceConfigValidator.validateOpenAIConfig(DEFAULT_OPENAI_CONFIG);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ElevenLabs configuration with VoiceConfigValidator', () => {
      const result = VoiceConfigValidator.validateElevenLabsConfig(DEFAULT_ELEVENLABS_CONFIG);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid OpenAI configuration', () => {
      const invalidConfig = {
        ...DEFAULT_OPENAI_CONFIG,
        temperature: 5.0, // Invalid: should be 0-2
        voice: 'invalid-voice' as any
      };

      const result = VoiceConfigValidator.validateOpenAIConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid ElevenLabs configuration', () => {
      const invalidConfig = {
        ...DEFAULT_ELEVENLABS_CONFIG,
        voiceSettings: {
          ...DEFAULT_ELEVENLABS_CONFIG.voiceSettings,
          stability: 2.0 // Invalid: should be 0-1
        }
      };

      const result = VoiceConfigValidator.validateElevenLabsConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify OpenAI configuration', () => {
      expect(isOpenAIConfig(DEFAULT_OPENAI_CONFIG)).toBe(true);
      expect(isOpenAIConfig(DEFAULT_ELEVENLABS_CONFIG)).toBe(false);
    });

    it('should correctly identify ElevenLabs configuration', () => {
      expect(isElevenLabsConfig(DEFAULT_ELEVENLABS_CONFIG)).toBe(true);
      expect(isElevenLabsConfig(DEFAULT_OPENAI_CONFIG)).toBe(false);
    });
  });

  describe('Configuration Helpers', () => {
    it('should merge configurations with defaults', () => {
      const partial = {
        displayName: 'Custom Assistant',
        temperature: 0.9
      };

      const merged = VoiceConfigHelpers.mergeWithDefaults(partial, DEFAULT_OPENAI_CONFIG);
      
      expect(merged.displayName).toBe('Custom Assistant');
      expect(merged.temperature).toBe(0.9);
      expect(merged.provider).toBe('openai'); // From defaults
      expect(merged.voice).toBe('alloy'); // From defaults
    });

    it('should sanitize configuration for client use', () => {
      const configWithSecrets = {
        ...DEFAULT_OPENAI_CONFIG,
        apiKeyEnvVar: 'SECRET_API_KEY',
        baseUrlEnvVar: 'SECRET_BASE_URL'
      };

      const sanitized = VoiceConfigHelpers.sanitizeForClient(configWithSecrets);
      
      expect(sanitized.apiKeyEnvVar).toBeUndefined();
      expect(sanitized.baseUrlEnvVar).toBeUndefined();
      expect(sanitized.displayName).toBe(configWithSecrets.displayName);
    });
  });

  describe('Environment Variable Validation', () => {
    it('should validate environment variables', () => {
      // Test with a variable that should exist
      const result = validateEnvironmentVariable('NODE_ENV', 'test');
      
      expect(result.available).toBe(true);
      expect(result.value).toBeDefined();
    });

    it('should handle missing environment variables', () => {
      const result = validateEnvironmentVariable('NONEXISTENT_VAR');
      
      expect(result.available).toBe(false);
      expect(result.error).toContain('not set');
    });

    it('should use fallback values', () => {
      const result = validateEnvironmentVariable('NONEXISTENT_VAR', 'fallback-value');
      
      expect(result.available).toBe(true);
      expect(result.value).toBe('fallback-value');
    });
  });

  describe('Factory Functions', () => {
    it('should get default configuration for provider', () => {
      const openaiConfig = getDefaultConfigForProvider('openai');
      const elevenLabsConfig = getDefaultConfigForProvider('elevenlabs');
      
      expect(openaiConfig.provider).toBe('openai');
      expect(elevenLabsConfig.provider).toBe('elevenlabs');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        getDefaultConfigForProvider('unknown' as any);
      }).toThrow('Unknown provider');
    });
  });

  describe('Health Checks', () => {
    it('should perform health check on valid configuration', () => {
      const healthCheck = VoiceConfigValidator.performHealthCheck(DEFAULT_OPENAI_CONFIG);
      
      expect(healthCheck.schema.valid).toBe(true);
      expect(healthCheck.recommendations).toBeDefined();
      // Allow warning status due to environment variables not being set in test
      expect(['healthy', 'warning'].includes(healthCheck.overall)).toBe(true);
    });

    it('should detect configuration issues in health check', () => {
      const problematicConfig = {
        ...DEFAULT_OPENAI_CONFIG,
        temperature: 2.5, // Too high
        instructions: 'x'.repeat(5000) // Too long
      };

      const healthCheck = VoiceConfigValidator.performHealthCheck(problematicConfig);
      
      expect(healthCheck.overall).toBe('error');
      expect(healthCheck.schema.valid).toBe(false);
    });
  });
});