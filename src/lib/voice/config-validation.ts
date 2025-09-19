/**
 * Voice AI Configuration Validation Utilities
 * 
 * Provides comprehensive validation utilities for voice AI configurations
 * including environment variable validation, schema validation, and
 * configuration health checks.
 * 
 * Updated to use serializer validation first, then augment with environment checks.
 */

import { 
  VoiceProviderConfig,
  OpenAIRealtimeConfig,
  ElevenLabsConfig,
  ValidationResult,
  ConfigValidationResult,
  EnvValidationResult,
  validateEnvironmentVariable,
  validateEnvironmentVariables,
  getEnvironmentVariable,
  OpenAIRealtimeConfigSchema,
  ElevenLabsConfigSchema,
  VoiceProviderConfigSchema
} from '../../types/voice-config';
import { getSerializerForProvider } from './config-serializers';

/**
 * Comprehensive configuration validator that uses serializer validation first, then augments with environment checks
 */
export class VoiceConfigValidator {
  
  /**
   * Validate any voice provider configuration using serializer validation first
   */
  static validateConfig(config: Partial<VoiceProviderConfig>): ValidationResult {
    try {
      // Determine provider type
      if (!config.provider) {
        return {
          valid: false,
          errors: [{
            field: 'provider',
            message: 'Provider is required',
            code: 'REQUIRED'
          }]
        };
      }

      // Use serializer validation first
      const serializer = getSerializerForProvider(config.provider);
      const serializerResult = serializer.validate(config);
      
      if (!serializerResult.valid) {
        return serializerResult;
      }
      
      // Augment with additional environment variable validation
      const envWarnings = this.validateConfigEnvironmentVariables(config as VoiceProviderConfig);
      
      // Merge warnings from serializer and environment validation
      const allWarnings = [
        ...(serializerResult.warnings || []),
        ...envWarnings.map(w => ({
          field: w.error?.includes('OPENAI_API_KEY') ? 'apiKeyEnvVar' : 'baseUrlEnvVar',
          message: w.error || 'Environment variable issue',
          suggestion: 'Ensure environment variables are properly configured'
        }))
      ];
      
      return {
        valid: true,
        errors: [],
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'config',
          message: `Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }
  
  /**
   * Validate OpenAI Realtime configuration specifically using serializer validation first
   */
  static validateOpenAIConfig(config: Partial<OpenAIRealtimeConfig>): ValidationResult {
    try {
      // Use OpenAI serializer validation first
      const serializer = getSerializerForProvider('openai');
      const serializerResult = serializer.validate(config);
      
      if (!serializerResult.valid) {
        return serializerResult;
      }
      
      // Augment with environment variable validation
      const envWarnings = this.validateOpenAIEnvironmentVariables(config as OpenAIRealtimeConfig);
      
      // Merge warnings
      const allWarnings = [
        ...(serializerResult.warnings || []),
        ...envWarnings.map(w => ({
          field: w.error?.includes('OPENAI_API_KEY') ? 'apiKeyEnvVar' : 'baseUrlEnvVar',
          message: w.error || 'Environment variable issue',
          suggestion: 'Ensure OpenAI environment variables are properly configured'
        }))
      ];
      
      return {
        valid: true,
        errors: [],
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'config',
          message: `OpenAI configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }
  
  /**
   * Validate ElevenLabs configuration specifically using serializer validation first
   */
  static validateElevenLabsConfig(config: Partial<ElevenLabsConfig>): ValidationResult {
    try {
      // Use ElevenLabs serializer validation first
      const serializer = getSerializerForProvider('elevenlabs');
      const serializerResult = serializer.validate(config);
      
      if (!serializerResult.valid) {
        return serializerResult;
      }
      
      // Augment with environment variable validation
      const envWarnings = this.validateElevenLabsEnvironmentVariables(config as ElevenLabsConfig);
      
      // Merge warnings
      const allWarnings = [
        ...(serializerResult.warnings || []),
        ...envWarnings.map(w => ({
          field: w.error?.includes('ELEVENLABS_API_KEY') ? 'apiKeyEnvVar' : 'baseUrlEnvVar',
          message: w.error || 'Environment variable issue',
          suggestion: 'Ensure ElevenLabs environment variables are properly configured'
        }))
      ];
      
      return {
        valid: true,
        errors: [],
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'config',
          message: `ElevenLabs configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }
  
  /**
   * Validate environment variables for any configuration
   */
  private static validateConfigEnvironmentVariables(config: VoiceProviderConfig): EnvValidationResult[] {
    const results: EnvValidationResult[] = [];
    
    if (config.apiKeyEnvVar) {
      results.push(validateEnvironmentVariable(config.apiKeyEnvVar));
    }
    
    if (config.baseUrlEnvVar) {
      results.push(validateEnvironmentVariable(config.baseUrlEnvVar));
    }
    
    return results.filter(r => !r.available);
  }
  
  /**
   * Validate OpenAI-specific environment variables
   */
  private static validateOpenAIEnvironmentVariables(config: OpenAIRealtimeConfig): EnvValidationResult[] {
    const envVars = [
      { name: config.apiKeyEnvVar || 'OPENAI_API_KEY', required: true },
      { name: config.baseUrlEnvVar || 'OPENAI_BASE_URL', required: false }
    ];
    
    try {
      const results = validateEnvironmentVariables(envVars);
      return Object.values(results).filter(r => !r.available);
    } catch (error) {
      return [{
        available: false,
        error: error instanceof Error ? error.message : String(error)
      }];
    }
  }
  
  /**
   * Validate ElevenLabs-specific environment variables
   */
  private static validateElevenLabsEnvironmentVariables(config: ElevenLabsConfig): EnvValidationResult[] {
    const envVars = [
      { name: config.apiKeyEnvVar || 'ELEVENLABS_API_KEY', required: true },
      { name: config.baseUrlEnvVar || 'ELEVENLABS_BASE_URL', required: false }
    ];
    
    try {
      const results = validateEnvironmentVariables(envVars);
      return Object.values(results).filter(r => !r.available);
    } catch (error) {
      return [{
        available: false,
        error: error instanceof Error ? error.message : String(error)
      }];
    }
  }
  
  /**
   * Perform a comprehensive health check on a configuration using serializer validation
   */
  static performHealthCheck(config: VoiceProviderConfig): {
    overall: 'healthy' | 'warning' | 'error';
    validation: ValidationResult;
    environment: EnvValidationResult[];
    recommendations: string[];
  } {
    const validation = this.validateConfig(config);
    const environment = this.validateConfigEnvironmentVariables(config);
    const recommendations: string[] = [];
    
    // Generate recommendations based on configuration
    if (config.provider === 'openai') {
      const openaiConfig = config as OpenAIRealtimeConfig;
      
      if (openaiConfig.temperature > 1.5) {
        recommendations.push('Consider lowering temperature for more consistent responses');
      }
      
      if (openaiConfig.instructions.length > 3000) {
        recommendations.push('Consider shortening instructions for better performance');
      }
      
      if (!openaiConfig.sessionConfig.audio.input.turnDetection.createResponse) {
        recommendations.push('Enable createResponse for better conversation flow');
      }
    }
    
    if (config.provider === 'elevenlabs') {
      const elevenLabsConfig = config as ElevenLabsConfig;
      
      if (!elevenLabsConfig.agentId || elevenLabsConfig.agentId === 'default-agent') {
        recommendations.push('Configure a valid ElevenLabs agent ID');
      }
      
      if (!elevenLabsConfig.voiceId || elevenLabsConfig.voiceId === 'default-voice') {
        recommendations.push('Configure a valid ElevenLabs voice ID');
      }
      
      if (elevenLabsConfig.conversationConfig.maxDuration > 1800) {
        recommendations.push('Consider limiting conversation duration to reduce costs');
      }
    }
    
    // Determine overall health
    let overall: 'healthy' | 'warning' | 'error' = 'healthy';
    
    if (!validation.valid) {
      overall = 'error';
    } else if (validation.warnings?.length || recommendations.length > 0 || environment.some(e => !e.available)) {
      overall = 'warning';
    }
    
    return {
      overall,
      validation,
      environment,
      recommendations
    };
  }
}

/**
 * Configuration validation helpers for specific use cases
 */
export class VoiceConfigHelpers {
  
  /**
   * Validate configuration before saving to database
   */
  static validateForSave(config: VoiceProviderConfig): ValidationResult {
    const result = VoiceConfigValidator.validateConfig(config);
    
    if (!result.valid) {
      const errorMessages = result.errors.map(e => `${e.field}: ${e.message}`);
      throw new Error(`Configuration validation failed: ${errorMessages.join(', ')}`);
    }
    
    return result;
  }
  
  /**
   * Validate configuration before using in production
   */
  static validateForProduction(config: VoiceProviderConfig): ValidationResult {
    const healthCheck = VoiceConfigValidator.performHealthCheck(config);
    
    if (healthCheck.overall === 'error') {
      const errorMessages = healthCheck.validation.errors.map(e => `${e.field}: ${e.message}`);
      throw new Error(
        `Configuration is not ready for production: ${errorMessages.join(', ')}`
      );
    }
    
    return healthCheck.validation;
  }
  
  /**
   * Get configuration with environment variable resolution
   */
  static resolveEnvironmentVariables(config: VoiceProviderConfig): VoiceProviderConfig {
    const resolved = { ...config };
    
    // Resolve API key from environment if specified
    if (config.apiKeyEnvVar) {
      const apiKey = getEnvironmentVariable(config.apiKeyEnvVar, true);
      // Note: We don't actually store the API key in the config for security
      // This is just for validation purposes
    }
    
    // Resolve base URL from environment if specified
    if (config.baseUrlEnvVar) {
      const baseUrl = getEnvironmentVariable(config.baseUrlEnvVar, false);
      // Note: Base URL could be stored in config if needed
    }
    
    return resolved;
  }
  
  /**
   * Sanitize configuration for client-side use (remove sensitive data)
   */
  static sanitizeForClient(config: VoiceProviderConfig): Partial<VoiceProviderConfig> {
    const sanitized = { ...config };
    
    // Remove environment variable references (security)
    delete (sanitized as any).apiKeyEnvVar;
    delete (sanitized as any).baseUrlEnvVar;
    
    return sanitized;
  }
  
  /**
   * Merge configuration with defaults
   */
  static mergeWithDefaults(
    config: Partial<VoiceProviderConfig>, 
    defaults: VoiceProviderConfig
  ): VoiceProviderConfig {
    const merged = {
      ...defaults,
      ...config,
    } as VoiceProviderConfig;
    
    // Deep merge nested objects based on provider type
    if (config.provider === 'openai' && defaults.provider === 'openai') {
      const openaiDefaults = defaults as OpenAIRealtimeConfig;
      const openaiConfig = config as Partial<OpenAIRealtimeConfig>;
      
      (merged as OpenAIRealtimeConfig).sessionConfig = {
        ...openaiDefaults.sessionConfig,
        ...(openaiConfig.sessionConfig || {}),
        audio: {
          ...openaiDefaults.sessionConfig.audio,
          ...(openaiConfig.sessionConfig?.audio || {}),
          input: {
            ...openaiDefaults.sessionConfig.audio.input,
            ...(openaiConfig.sessionConfig?.audio?.input || {})
          },
          output: {
            ...openaiDefaults.sessionConfig.audio.output,
            ...(openaiConfig.sessionConfig?.audio?.output || {})
          }
        }
      };
    }
    
    if (config.provider === 'elevenlabs' && defaults.provider === 'elevenlabs') {
      const elevenLabsDefaults = defaults as ElevenLabsConfig;
      const elevenLabsConfig = config as Partial<ElevenLabsConfig>;
      
      (merged as ElevenLabsConfig).voiceSettings = {
        ...elevenLabsDefaults.voiceSettings,
        ...(elevenLabsConfig.voiceSettings || {})
      };
      
      (merged as ElevenLabsConfig).conversationConfig = {
        ...elevenLabsDefaults.conversationConfig,
        ...(elevenLabsConfig.conversationConfig || {})
      };
    }
    
    return merged;
  }
}

/**
 * Export validation functions for direct use
 */
export {
  validateEnvironmentVariable,
  validateEnvironmentVariables,
  getEnvironmentVariable
} from '../../types/voice-config';