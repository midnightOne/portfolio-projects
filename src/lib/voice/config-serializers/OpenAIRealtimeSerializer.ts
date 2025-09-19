/**
 * OpenAI Realtime Configuration Serializer
 * 
 * Handles serialization, validation, and schema generation for OpenAI Realtime API configurations.
 * Supports the @openai/agents SDK configuration format with comprehensive validation.
 */

import {
  VoiceConfigSerializer,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ConfigSchema,
  ConfigSerializationError,
  ConfigValidationError
} from './index';
import { 
  OpenAIRealtimeConfig,
  OpenAIRealtimeConfigSchema,
  DEFAULT_OPENAI_CONFIG,
  ConfigValidationResult,
  EnvValidationResult
} from '../../../types/voice-config';
import { VoiceProvider } from '../../../types/voice-agent';

// Re-export types for backward compatibility
export type { OpenAIRealtimeConfig } from '../../../types/voice-config';

export class OpenAIRealtimeSerializer implements VoiceConfigSerializer<OpenAIRealtimeConfig> {
  
  getProviderType(): VoiceProvider {
    return 'openai';
  }
  
  serialize(config: OpenAIRealtimeConfig): string {
    try {
      // CRITICAL FIX: Synchronize voice settings before serialization
      // Ensure the top-level voice matches sessionConfig.audio.output.voice
      const configCopy = JSON.parse(JSON.stringify(config)); // Deep copy to avoid mutating original
      if (configCopy.voice && configCopy.sessionConfig?.audio?.output) {
        if (configCopy.voice !== configCopy.sessionConfig.audio.output.voice) {
          console.log(`OpenAI Config Serialize: Synchronizing voice from '${configCopy.sessionConfig.audio.output.voice}' to '${configCopy.voice}'`);
          configCopy.sessionConfig.audio.output.voice = configCopy.voice;
        }
      }
      
      // Validate before serializing
      const validation = this.validate(configCopy);
      if (!validation.valid) {
        throw new ConfigValidationError(
          'Configuration validation failed',
          'openai',
          validation.errors
        );
      }
      
      return JSON.stringify(configCopy, null, 2);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new ConfigSerializationError(
        'Failed to serialize OpenAI Realtime configuration',
        'openai',
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  
  deserialize(json: string): OpenAIRealtimeConfig {
    try {
      const config = JSON.parse(json) as OpenAIRealtimeConfig;
      
      // CRITICAL FIX: Synchronize voice settings after deserialization
      // Ensure the top-level voice matches sessionConfig.audio.output.voice
      if (config.voice && config.sessionConfig?.audio?.output) {
        if (config.voice !== config.sessionConfig.audio.output.voice) {
          console.log(`OpenAI Config Deserialize: Synchronizing voice from '${config.sessionConfig.audio.output.voice}' to '${config.voice}'`);
          config.sessionConfig.audio.output.voice = config.voice;
        }
      }
      
      // Validate deserialized config
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new ConfigValidationError(
          'Deserialized configuration is invalid',
          'openai',
          validation.errors
        );
      }
      
      return config;
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new ConfigSerializationError(
        'Failed to deserialize OpenAI Realtime configuration',
        'openai',
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  
  validate(config: Partial<OpenAIRealtimeConfig>): ValidationResult {
    try {
      // Use Zod schema for validation
      const result = OpenAIRealtimeConfigSchema.safeParse(config);
      
      if (result.success) {
        // Additional custom validations and warnings
        const warnings: ValidationWarning[] = [];
        
        // Check for non-standard model names
        if (config.model && !config.model.startsWith('gpt-realtime')) {
          warnings.push({
            field: 'model',
            message: 'Using non-standard model name',
            suggestion: 'Consider using gpt-realtime for best compatibility'
          });
        }
        
        // Check for very long instructions
        if (config.instructions && config.instructions.length > 5000) {
          warnings.push({
            field: 'instructions',
            message: 'Instructions are very long and may impact performance',
            suggestion: 'Consider keeping instructions under 2000 characters'
          });
        }
        
        // Check environment variables if specified
        if (config.apiKeyEnvVar) {
          const { validateEnvironmentVariable } = require('../../../types/voice-config');
          const envResult = validateEnvironmentVariable(config.apiKeyEnvVar);
          if (!envResult.available) {
            warnings.push({
              field: 'apiKeyEnvVar',
              message: `Environment variable ${config.apiKeyEnvVar} is not set`,
              suggestion: 'Ensure the API key environment variable is properly configured'
            });
          }
        }
        
        return {
          valid: true,
          errors: [],
          warnings: warnings.length > 0 ? warnings : undefined
        };
      } else {
        // Convert Zod errors to ValidationError format
        const errors: ValidationError[] = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code.toUpperCase() as any,
          value: (err as any).received || (err as any).input || undefined
        }));
        
        return {
          valid: false,
          errors,
          warnings: undefined
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [{
          field: 'config',
          message: 'Configuration validation failed',
          code: 'VALIDATION_ERROR',
          value: error instanceof Error ? error.message : String(error)
        }],
        warnings: undefined
      };
    }
  }
  

  
  getDefaultConfig(): OpenAIRealtimeConfig {
    return DEFAULT_OPENAI_CONFIG;
  }
  
  getConfigSchema(): ConfigSchema {
    return {
      type: 'object',
      title: 'OpenAI Realtime Configuration',
      description: 'Configuration for OpenAI Realtime API voice assistant',
      required: ['provider', 'enabled', 'displayName', 'description', 'model', 'voice'],
      properties: {
        provider: {
          type: 'string',
          title: 'Provider',
          description: 'Voice AI provider (must be "openai")',
          enum: ['openai'],
          default: 'openai'
        },
        enabled: {
          type: 'boolean',
          title: 'Enabled',
          description: 'Whether this configuration is enabled',
          default: true
        },
        displayName: {
          type: 'string',
          title: 'Display Name',
          description: 'Human-readable name for this configuration',
          default: 'OpenAI Realtime Assistant'
        },
        description: {
          type: 'string',
          title: 'Description',
          description: 'Description of this configuration',
          default: 'Real-time voice conversation using OpenAI GPT-4 Realtime API'
        },
        version: {
          type: 'string',
          title: 'Version',
          description: 'Configuration version',
          default: '1.0.0'
        },
        model: {
          type: 'string',
          title: 'Model',
          description: 'OpenAI model to use for realtime conversations',
          enum: ['gpt-realtime', 'gpt-4o-realtime-preview-2025-06-03'],
          default: 'gpt-realtime'
        },
        temperature: {
          type: 'number',
          title: 'Temperature',
          description: 'Sampling temperature (0-2)',
          minimum: 0,
          maximum: 2,
          default: 0.7
        },
        maxTokens: {
          type: 'number',
          title: 'Max Tokens',
          description: 'Maximum tokens per response',
          minimum: 1,
          maximum: 128000,
          default: 4096
        },
        voice: {
          type: 'string',
          title: 'Voice',
          description: 'OpenAI voice to use for TTS',
          enum: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'shimmer', 'sage', 'verse', 'marin', 'cedar'],
          default: 'alloy'
        },
        name: {
          type: 'string',
          title: 'Agent Name',
          description: 'Name of the AI agent',
          default: 'Portfolio Assistant'
        },
        instructions: {
          type: 'string',
          title: 'Instructions',
          description: 'System instructions for the AI agent',
          format: 'textarea',
          default: 'You are a helpful assistant for a portfolio website. You can answer questions about the portfolio owner\'s background, projects, and experience. Be professional, friendly, and informative.'
        },
        sessionConfig: {
          type: 'object',
          title: 'Session Configuration',
          description: 'Advanced session settings',
          properties: {
            transport: {
              type: 'string',
              title: 'Transport',
              description: 'Connection transport method',
              enum: ['websocket', 'webrtc'],
              default: 'webrtc'
            },
            audioFormat: {
              type: 'string',
              title: 'Audio Format',
              description: 'Audio encoding format',
              enum: ['pcm16', 'g711_ulaw', 'g711_alaw'],
              default: 'pcm16'
            },
            turnDetection: {
              type: 'object',
              title: 'Turn Detection',
              description: 'Voice activity detection settings',
              properties: {
                type: {
                  type: 'string',
                  title: 'Type',
                  description: 'Turn detection method',
                  enum: ['server_vad', 'none'],
                  default: 'server_vad'
                },
                threshold: {
                  type: 'number',
                  title: 'Threshold',
                  description: 'Voice activity detection threshold',
                  minimum: 0,
                  maximum: 1,
                  default: 0.5
                },
                prefixPaddingMs: {
                  type: 'number',
                  title: 'Prefix Padding (ms)',
                  description: 'Audio padding before speech',
                  minimum: 0,
                  maximum: 1000,
                  default: 300
                },
                silenceDurationMs: {
                  type: 'number',
                  title: 'Silence Duration (ms)',
                  description: 'Silence duration to detect end of speech',
                  minimum: 100,
                  maximum: 2000,
                  default: 500
                }
              }
            }
          }
        },
        advanced: {
          type: 'object',
          title: 'Advanced Settings',
          description: 'Advanced configuration options',
          properties: {
            enableInterruption: {
              type: 'boolean',
              title: 'Enable Interruption',
              description: 'Allow users to interrupt AI responses',
              default: true
            },
            enableToolCalling: {
              type: 'boolean',
              title: 'Enable Tool Calling',
              description: 'Allow AI to call tools and functions',
              default: true
            },
            enableTranscriptLogging: {
              type: 'boolean',
              title: 'Enable Transcript Logging',
              description: 'Log conversation transcripts to server',
              default: true
            },
            maxRetries: {
              type: 'number',
              title: 'Max Retries',
              description: 'Maximum connection retry attempts',
              minimum: 0,
              maximum: 10,
              default: 3
            },
            connectionTimeout: {
              type: 'number',
              title: 'Connection Timeout (ms)',
              description: 'Connection timeout in milliseconds',
              minimum: 1000,
              maximum: 30000,
              default: 10000
            },
            reconnectDelay: {
              type: 'number',
              title: 'Reconnect Delay (ms)',
              description: 'Delay between reconnection attempts',
              minimum: 500,
              maximum: 10000,
              default: 2000
            }
          }
        }
      }
    };
  }
}