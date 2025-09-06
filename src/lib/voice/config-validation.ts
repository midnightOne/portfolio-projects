/**
 * Voice AI Configuration Validation Utilities
 * 
 * Provides comprehensive validation utilities for voice AI configurations
 * including environment variable validation, schema validation, and
 * configuration health checks.
 */

import { 
  VoiceProviderConfig,
  OpenAIRealtimeConfig,
  ElevenLabsConfig,
  ConfigValidationResult,
  EnvValidationResult,
  validateEnvironmentVariable,
  validateEnvironmentVariables,
  getEnvironmentVariable,
  OpenAIRealtimeConfigSchema,
  ElevenLabsConfigSchema,
  VoiceProviderConfigSchema
} from '../../types/voice-config';

/**
 * Comprehensive configuration validator that checks both schema and environment variables
 */
export class VoiceConfigValidator {
  
  /**
   * Validate any voice provider configuration
   */
  static validateConfig(config: Partial<VoiceProviderConfig>): ConfigValidationResult {
    try {
      const result = VoiceProviderConfigSchema.safeParse(config);
      
      if (result.success) {
        // Additional environment variable validation
        const envWarnings = this.validateConfigEnvironmentVariables(result.data as VoiceProviderConfig);
        
        return {
          valid: true,
          errors: [],
          warnings: envWarnings.length > 0 ? envWarnings.map(w => w.error || 'Environment variable issue') : undefined
        };
      } else {
        return {
          valid: false,
          errors: result.error.errors.map(err => err.message),
          warnings: undefined
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`],
        warnings: undefined
      };
    }
  }
  
  /**
   * Validate OpenAI Realtime configuration specifically
   */
  static validateOpenAIConfig(config: Partial<OpenAIRealtimeConfig>): ConfigValidationResult {
    try {
      const result = OpenAIRealtimeConfigSchema.safeParse(config);
      
      if (result.success) {
        const envWarnings = this.validateOpenAIEnvironmentVariables(result.data as OpenAIRealtimeConfig);
        
        return {
          valid: true,
          errors: [],
          warnings: envWarnings.length > 0 ? envWarnings.map(w => w.error || 'Environment variable issue') : undefined
        };
      } else {
        return {
          valid: false,
          errors: result.error.errors.map(err => err.message),
          warnings: undefined
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`OpenAI configuration validation failed: ${error instanceof Error ? error.message : String(error)}`],
        warnings: undefined
      };
    }
  }
  
  /**
   * Validate ElevenLabs configuration specifically
   */
  static validateElevenLabsConfig(config: Partial<ElevenLabsConfig>): ConfigValidationResult {
    try {
      const result = ElevenLabsConfigSchema.safeParse(config);
      
      if (result.success) {
        const envWarnings = this.validateElevenLabsEnvironmentVariables(result.data as ElevenLabsConfig);
        
        return {
          valid: true,
          errors: [],
          warnings: envWarnings.length > 0 ? envWarnings.map(w => w.error || 'Environment variable issue') : undefined
        };
      } else {
        return {
          valid: false,
          errors: result.error.errors.map(err => err.message),
          warnings: undefined
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`ElevenLabs configuration validation failed: ${error instanceof Error ? error.message : String(error)}`],
        warnings: undefined
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
   * Perform a comprehensive health check on a configuration
   */
  static performHealthCheck(config: VoiceProviderConfig): {
    overall: 'healthy' | 'warning' | 'error';
    schema: ConfigValidationResult;
    environment: EnvValidationResult[];
    recommendations: string[];
  } {
    const schema = this.validateConfig(config);
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
      
      if (!elevenLabsConfig.agentId) {
        recommendations.push('Configure a valid ElevenLabs agent ID');
      }
      
      if (!elevenLabsConfig.voiceId) {
        recommendations.push('Configure a valid ElevenLabs voice ID');
      }
      
      if (elevenLabsConfig.conversationConfig.maxDuration > 1800) {
        recommendations.push('Consider limiting conversation duration to reduce costs');
      }
    }
    
    // Determine overall health
    let overall: 'healthy' | 'warning' | 'error' = 'healthy';
    
    if (!schema.valid) {
      overall = 'error';
    } else if (schema.warnings?.length || recommendations.length > 0 || environment.some(e => !e.available)) {
      overall = 'warning';
    }
    
    return {
      overall,
      schema,
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
  static validateForSave(config: VoiceProviderConfig): ConfigValidationResult {
    const result = VoiceConfigValidator.validateConfig(config);
    
    if (!result.valid) {
      throw new Error(`Configuration validation failed: ${result.errors.join(', ')}`);
    }
    
    return result;
  }
  
  /**
   * Validate configuration before using in production
   */
  static validateForProduction(config: VoiceProviderConfig): ConfigValidationResult {
    const healthCheck = VoiceConfigValidator.performHealthCheck(config);
    
    if (healthCheck.overall === 'error') {
      throw new Error(
        `Configuration is not ready for production: ${healthCheck.schema.errors.join(', ')}`
      );
    }
    
    return healthCheck.schema;
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