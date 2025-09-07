/**
 * ElevenLabs Conversational AI Configuration Serializer
 * 
 * Handles serialization, validation, and schema generation for ElevenLabs Conversational AI configurations.
 * Supports the ElevenLabs REST API and React SDK configuration format.
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
  ElevenLabsConfig,
  ElevenLabsConfigSchema,
  DEFAULT_ELEVENLABS_CONFIG,
  ConfigValidationResult,
  EnvValidationResult
} from '../../../types/voice-config';
import { VoiceProvider } from '../../../types/voice-agent';

// Re-export types for backward compatibility
export type { ElevenLabsConfig } from '../../../types/voice-config';

export class ElevenLabsSerializer implements VoiceConfigSerializer<ElevenLabsConfig> {
  
  getProviderType(): VoiceProvider {
    return 'elevenlabs';
  }
  
  serialize(config: ElevenLabsConfig): string {
    try {
      // Validate before serializing
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new ConfigValidationError(
          'Configuration validation failed',
          'elevenlabs',
          validation.errors
        );
      }
      
      return JSON.stringify(config, null, 2);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new ConfigSerializationError(
        'Failed to serialize ElevenLabs configuration',
        'elevenlabs',
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  
  deserialize(json: string): ElevenLabsConfig {
    try {
      const config = JSON.parse(json) as ElevenLabsConfig;
      
      // Validate deserialized config
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new ConfigValidationError(
          'Deserialized configuration is invalid',
          'elevenlabs',
          validation.errors
        );
      }
      
      return config;
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        throw error;
      }
      throw new ConfigSerializationError(
        'Failed to deserialize ElevenLabs configuration',
        'elevenlabs',
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  
  validate(config: Partial<ElevenLabsConfig>): ValidationResult {
    try {
      // Use Zod schema for validation
      const result = ElevenLabsConfigSchema.safeParse(config);
      
      if (result.success) {
        // Additional custom validations and warnings
        const warnings: ValidationWarning[] = [];
        
        // Check for empty agent/voice IDs (common configuration issue)
        if (config.agentId === '') {
          warnings.push({
            field: 'agentId',
            message: 'Agent ID is empty',
            suggestion: 'Configure a valid ElevenLabs agent ID for voice conversations'
          });
        }
        
        if (config.voiceId === '') {
          warnings.push({
            field: 'voiceId',
            message: 'Voice ID is empty',
            suggestion: 'Configure a valid ElevenLabs voice ID for speech synthesis'
          });
        }
        
        // Check language code format
        if (config.conversationConfig?.language && !/^[a-z]{2}(-[A-Z]{2})?$/.test(config.conversationConfig.language)) {
          warnings.push({
            field: 'conversationConfig.language',
            message: 'Language should be in ISO 639-1 format (e.g., "en", "en-US")',
            suggestion: 'Use standard language codes like "en", "es", "fr", etc.'
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
  

  
  getDefaultConfig(): ElevenLabsConfig {
    return DEFAULT_ELEVENLABS_CONFIG;
  }
  
  getConfigSchema(): ConfigSchema {
    return {
      type: 'object',
      title: 'ElevenLabs Conversational AI Configuration',
      description: 'Configuration for ElevenLabs Conversational AI platform',
      required: ['provider', 'enabled', 'displayName', 'description', 'agentId', 'voiceId', 'model'],
      properties: {
        provider: {
          type: 'string',
          title: 'Provider',
          description: 'Voice AI provider (must be "elevenlabs")',
          enum: ['elevenlabs'],
          default: 'elevenlabs'
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
          default: 'ElevenLabs Conversational AI'
        },
        description: {
          type: 'string',
          title: 'Description',
          description: 'Description of this configuration',
          default: 'Real-time voice conversation using ElevenLabs Conversational AI platform'
        },
        version: {
          type: 'string',
          title: 'Version',
          description: 'Configuration version',
          default: '1.0.0'
        },
        agentId: {
          type: 'string',
          title: 'Agent ID',
          description: 'ElevenLabs agent identifier',
          pattern: '^[a-zA-Z0-9_-]+$'
        },
        agentName: {
          type: 'string',
          title: 'Agent Name',
          description: 'Human-readable agent name',
          default: 'Portfolio Assistant'
        },
        voiceId: {
          type: 'string',
          title: 'Voice ID',
          description: 'ElevenLabs voice identifier',
          pattern: '^[a-zA-Z0-9_-]+$'
        },
        voiceName: {
          type: 'string',
          title: 'Voice Name',
          description: 'Human-readable voice name',
          default: 'Default Voice'
        },
        model: {
          type: 'string',
          title: 'Model',
          description: 'ElevenLabs model to use',
          enum: ['eleven_turbo_v2_5', 'eleven_turbo_v2', 'eleven_multilingual_v2'],
          default: 'eleven_turbo_v2_5'
        },
        voiceSettings: {
          type: 'object',
          title: 'Voice Settings',
          description: 'Voice synthesis parameters',
          properties: {
            stability: {
              type: 'number',
              title: 'Stability',
              description: 'Voice stability (0-1)',
              minimum: 0,
              maximum: 1,
              default: 0.5
            },
            similarityBoost: {
              type: 'number',
              title: 'Similarity Boost',
              description: 'Voice similarity boost (0-1)',
              minimum: 0,
              maximum: 1,
              default: 0.8
            },
            style: {
              type: 'number',
              title: 'Style',
              description: 'Voice style exaggeration (0-1)',
              minimum: 0,
              maximum: 1,
              default: 0.0
            },
            useSpeakerBoost: {
              type: 'boolean',
              title: 'Use Speaker Boost',
              description: 'Enable speaker boost for better clarity',
              default: true
            }
          }
        },
        conversationConfig: {
          type: 'object',
          title: 'Conversation Configuration',
          description: 'Conversation behavior settings',
          properties: {
            language: {
              type: 'string',
              title: 'Language',
              description: 'Conversation language (ISO 639-1)',
              pattern: '^[a-z]{2}(-[A-Z]{2})?$',
              default: 'en'
            },
            maxDuration: {
              type: 'number',
              title: 'Max Duration (seconds)',
              description: 'Maximum conversation duration',
              minimum: 60,
              maximum: 3600,
              default: 1800
            },
            timeoutMs: {
              type: 'number',
              title: 'Timeout (ms)',
              description: 'Connection timeout in milliseconds',
              minimum: 1000,
              maximum: 30000,
              default: 10000
            },
            enableInterruption: {
              type: 'boolean',
              title: 'Enable Interruption',
              description: 'Allow users to interrupt AI responses',
              default: true
            }
          }
        },
        context: {
          type: 'object',
          title: 'Context & Personalization',
          description: 'Context and personalization settings',
          properties: {
            systemPrompt: {
              type: 'string',
              title: 'System Prompt',
              description: 'System instructions for the AI agent',
              format: 'textarea',
              default: 'You are a helpful assistant for a portfolio website. You can answer questions about the portfolio owner\'s background, projects, and experience. Be professional, friendly, and informative.'
            },
            firstMessage: {
              type: 'string',
              title: 'First Message',
              description: 'Initial greeting message',
              default: 'Hello! I\'m here to help you learn about this portfolio. What would you like to know?'
            },
            personalizedGreeting: {
              type: 'boolean',
              title: 'Personalized Greeting',
              description: 'Use personalized greetings for reflink users',
              default: true
            },
            contextNotes: {
              type: 'string',
              title: 'Context Notes',
              description: 'Additional context notes for the AI',
              format: 'textarea'
            }
          }
        },
        advanced: {
          type: 'object',
          title: 'Advanced Settings',
          description: 'Advanced configuration options',
          properties: {
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
            },
            signedUrlExpiry: {
              type: 'number',
              title: 'Signed URL Expiry (seconds)',
              description: 'Expiry time for signed conversation URLs',
              minimum: 300,
              maximum: 86400,
              default: 3600
            }
          }
        }
      }
    };
  }
}