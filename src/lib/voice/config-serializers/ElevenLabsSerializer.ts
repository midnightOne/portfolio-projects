/**
 * ElevenLabs Conversational AI Configuration Serializer
 * 
 * Handles serialization, validation, and schema generation for ElevenLabs Conversational AI configurations.
 * Supports the ElevenLabs REST API and React SDK configuration format.
 */

import {
  VoiceConfigSerializer,
  BaseVoiceProviderConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ConfigSchema,
  SchemaProperty,
  ConfigSerializationError,
  ConfigValidationError
} from './index';
import { VoiceProvider } from '@/types/voice-agent';

// ElevenLabs Conversational AI specific configuration interface
export interface ElevenLabsConfig extends BaseVoiceProviderConfig {
  provider: 'elevenlabs';
  
  // Agent configuration
  agentId: string;
  agentName?: string;
  
  // Voice configuration
  voiceId: string;
  voiceName?: string;
  model: string;
  
  // Voice settings
  voiceSettings: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  
  // Conversation configuration
  conversationConfig: {
    language: string;
    maxDuration: number;
    timeoutMs: number;
    enableInterruption: boolean;
    turnDetection?: {
      type: 'server_vad';
      threshold?: number;
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
    };
  };
  
  // Context and personalization
  context: {
    systemPrompt?: string;
    firstMessage?: string;
    personalizedGreeting?: boolean;
    contextNotes?: string;
  };
  
  // Advanced configuration
  advanced: {
    enableTranscriptLogging: boolean;
    maxRetries: number;
    connectionTimeout: number;
    reconnectDelay: number;
    signedUrlExpiry: number;
  };
}

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
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Required fields validation
    if (!config.provider || config.provider !== 'elevenlabs') {
      errors.push({
        field: 'provider',
        message: 'Provider must be "elevenlabs"',
        code: 'INVALID_PROVIDER',
        value: config.provider
      });
    }
    
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
      errors.push({
        field: 'enabled',
        message: 'Enabled must be a boolean value',
        code: 'INVALID_TYPE',
        value: config.enabled
      });
    }
    
    if (!config.displayName || typeof config.displayName !== 'string') {
      errors.push({
        field: 'displayName',
        message: 'Display name is required and must be a string',
        code: 'REQUIRED_FIELD',
        value: config.displayName
      });
    }
    
    if (!config.description || typeof config.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Description is required and must be a string',
        code: 'REQUIRED_FIELD',
        value: config.description
      });
    }
    
    // Agent ID validation
    if (!config.agentId || typeof config.agentId !== 'string') {
      errors.push({
        field: 'agentId',
        message: 'Agent ID is required and must be a string',
        code: 'REQUIRED_FIELD',
        value: config.agentId
      });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(config.agentId)) {
      errors.push({
        field: 'agentId',
        message: 'Agent ID must contain only alphanumeric characters, hyphens, and underscores',
        code: 'INVALID_FORMAT',
        value: config.agentId
      });
    }
    
    // Voice ID validation
    if (!config.voiceId || typeof config.voiceId !== 'string') {
      errors.push({
        field: 'voiceId',
        message: 'Voice ID is required and must be a string',
        code: 'REQUIRED_FIELD',
        value: config.voiceId
      });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(config.voiceId)) {
      errors.push({
        field: 'voiceId',
        message: 'Voice ID must contain only alphanumeric characters, hyphens, and underscores',
        code: 'INVALID_FORMAT',
        value: config.voiceId
      });
    }
    
    // Model validation
    if (!config.model || typeof config.model !== 'string') {
      errors.push({
        field: 'model',
        message: 'Model is required and must be a string',
        code: 'REQUIRED_FIELD',
        value: config.model
      });
    }
    
    // Voice settings validation
    if (config.voiceSettings) {
      const voiceSettings = config.voiceSettings;
      
      if (voiceSettings.stability !== undefined) {
        if (typeof voiceSettings.stability !== 'number' || voiceSettings.stability < 0 || voiceSettings.stability > 1) {
          errors.push({
            field: 'voiceSettings.stability',
            message: 'Stability must be a number between 0 and 1',
            code: 'INVALID_RANGE',
            value: voiceSettings.stability
          });
        }
      }
      
      if (voiceSettings.similarityBoost !== undefined) {
        if (typeof voiceSettings.similarityBoost !== 'number' || voiceSettings.similarityBoost < 0 || voiceSettings.similarityBoost > 1) {
          errors.push({
            field: 'voiceSettings.similarityBoost',
            message: 'Similarity boost must be a number between 0 and 1',
            code: 'INVALID_RANGE',
            value: voiceSettings.similarityBoost
          });
        }
      }
      
      if (voiceSettings.style !== undefined) {
        if (typeof voiceSettings.style !== 'number' || voiceSettings.style < 0 || voiceSettings.style > 1) {
          errors.push({
            field: 'voiceSettings.style',
            message: 'Style must be a number between 0 and 1',
            code: 'INVALID_RANGE',
            value: voiceSettings.style
          });
        }
      }
      
      if (voiceSettings.useSpeakerBoost !== undefined && typeof voiceSettings.useSpeakerBoost !== 'boolean') {
        errors.push({
          field: 'voiceSettings.useSpeakerBoost',
          message: 'Use speaker boost must be a boolean value',
          code: 'INVALID_TYPE',
          value: voiceSettings.useSpeakerBoost
        });
      }
    } else {
      errors.push({
        field: 'voiceSettings',
        message: 'Voice settings are required',
        code: 'REQUIRED_FIELD',
        value: config.voiceSettings
      });
    }
    
    // Conversation config validation
    if (config.conversationConfig) {
      const conversationConfig = config.conversationConfig;
      
      if (!conversationConfig.language || typeof conversationConfig.language !== 'string') {
        errors.push({
          field: 'conversationConfig.language',
          message: 'Language is required and must be a string',
          code: 'REQUIRED_FIELD',
          value: conversationConfig.language
        });
      } else {
        // Validate language code format (ISO 639-1)
        if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(conversationConfig.language)) {
          warnings.push({
            field: 'conversationConfig.language',
            message: 'Language should be in ISO 639-1 format (e.g., "en", "en-US")',
            suggestion: 'Use standard language codes like "en", "es", "fr", etc.'
          });
        }
      }
      
      if (conversationConfig.maxDuration !== undefined) {
        if (typeof conversationConfig.maxDuration !== 'number' || conversationConfig.maxDuration < 60 || conversationConfig.maxDuration > 3600) {
          errors.push({
            field: 'conversationConfig.maxDuration',
            message: 'Max duration must be a number between 60 and 3600 seconds',
            code: 'INVALID_RANGE',
            value: conversationConfig.maxDuration
          });
        }
      }
      
      if (conversationConfig.timeoutMs !== undefined) {
        if (typeof conversationConfig.timeoutMs !== 'number' || conversationConfig.timeoutMs < 1000 || conversationConfig.timeoutMs > 30000) {
          errors.push({
            field: 'conversationConfig.timeoutMs',
            message: 'Timeout must be a number between 1000 and 30000 milliseconds',
            code: 'INVALID_RANGE',
            value: conversationConfig.timeoutMs
          });
        }
      }
      
      if (conversationConfig.enableInterruption !== undefined && typeof conversationConfig.enableInterruption !== 'boolean') {
        errors.push({
          field: 'conversationConfig.enableInterruption',
          message: 'Enable interruption must be a boolean value',
          code: 'INVALID_TYPE',
          value: conversationConfig.enableInterruption
        });
      }
      
      // Turn detection validation
      if (conversationConfig.turnDetection) {
        const turnDetection = conversationConfig.turnDetection;
        
        if (turnDetection.type && turnDetection.type !== 'server_vad') {
          errors.push({
            field: 'conversationConfig.turnDetection.type',
            message: 'Turn detection type must be "server_vad"',
            code: 'INVALID_ENUM',
            value: turnDetection.type
          });
        }
        
        if (turnDetection.threshold !== undefined) {
          if (typeof turnDetection.threshold !== 'number' || turnDetection.threshold < 0 || turnDetection.threshold > 1) {
            errors.push({
              field: 'conversationConfig.turnDetection.threshold',
              message: 'Threshold must be a number between 0 and 1',
              code: 'INVALID_RANGE',
              value: turnDetection.threshold
            });
          }
        }
      }
    } else {
      errors.push({
        field: 'conversationConfig',
        message: 'Conversation config is required',
        code: 'REQUIRED_FIELD',
        value: config.conversationConfig
      });
    }
    
    // Context validation
    if (config.context) {
      const context = config.context;
      
      if (context.systemPrompt !== undefined) {
        if (typeof context.systemPrompt !== 'string') {
          errors.push({
            field: 'context.systemPrompt',
            message: 'System prompt must be a string',
            code: 'INVALID_TYPE',
            value: context.systemPrompt
          });
        } else if (context.systemPrompt.length > 5000) {
          warnings.push({
            field: 'context.systemPrompt',
            message: 'System prompt is very long and may impact performance',
            suggestion: 'Consider keeping system prompt under 2000 characters'
          });
        }
      }
      
      if (context.firstMessage !== undefined && typeof context.firstMessage !== 'string') {
        errors.push({
          field: 'context.firstMessage',
          message: 'First message must be a string',
          code: 'INVALID_TYPE',
          value: context.firstMessage
        });
      }
      
      if (context.personalizedGreeting !== undefined && typeof context.personalizedGreeting !== 'boolean') {
        errors.push({
          field: 'context.personalizedGreeting',
          message: 'Personalized greeting must be a boolean value',
          code: 'INVALID_TYPE',
          value: context.personalizedGreeting
        });
      }
    }
    
    // Advanced settings validation
    if (config.advanced) {
      const advanced = config.advanced;
      
      if (advanced.maxRetries !== undefined) {
        if (typeof advanced.maxRetries !== 'number' || advanced.maxRetries < 0 || advanced.maxRetries > 10) {
          errors.push({
            field: 'advanced.maxRetries',
            message: 'Max retries must be a number between 0 and 10',
            code: 'INVALID_RANGE',
            value: advanced.maxRetries
          });
        }
      }
      
      if (advanced.connectionTimeout !== undefined) {
        if (typeof advanced.connectionTimeout !== 'number' || advanced.connectionTimeout < 1000 || advanced.connectionTimeout > 30000) {
          errors.push({
            field: 'advanced.connectionTimeout',
            message: 'Connection timeout must be a number between 1000 and 30000 milliseconds',
            code: 'INVALID_RANGE',
            value: advanced.connectionTimeout
          });
        }
      }
      
      if (advanced.signedUrlExpiry !== undefined) {
        if (typeof advanced.signedUrlExpiry !== 'number' || advanced.signedUrlExpiry < 300 || advanced.signedUrlExpiry > 86400) {
          errors.push({
            field: 'advanced.signedUrlExpiry',
            message: 'Signed URL expiry must be a number between 300 and 86400 seconds',
            code: 'INVALID_RANGE',
            value: advanced.signedUrlExpiry
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
  
  getDefaultConfig(): ElevenLabsConfig {
    return {
      provider: 'elevenlabs',
      enabled: true,
      displayName: 'ElevenLabs Conversational AI',
      description: 'Real-time voice conversation using ElevenLabs Conversational AI platform',
      version: '1.0.0',
      
      agentId: '',
      agentName: 'Portfolio Assistant',
      
      voiceId: '',
      voiceName: 'Default Voice',
      model: 'eleven_turbo_v2_5',
      
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.8,
        style: 0.0,
        useSpeakerBoost: true
      },
      
      conversationConfig: {
        language: 'en',
        maxDuration: 1800, // 30 minutes
        timeoutMs: 10000,
        enableInterruption: true,
        turnDetection: {
          type: 'server_vad',
          threshold: 0.5,
          prefixPaddingMs: 300,
          silenceDurationMs: 700
        }
      },
      
      context: {
        systemPrompt: 'You are a helpful assistant for a portfolio website. You can answer questions about the portfolio owner\'s background, projects, and experience. Be professional, friendly, and informative.',
        firstMessage: 'Hello! I\'m here to help you learn about this portfolio. What would you like to know?',
        personalizedGreeting: true,
        contextNotes: ''
      },
      
      advanced: {
        enableTranscriptLogging: true,
        maxRetries: 3,
        connectionTimeout: 10000,
        reconnectDelay: 2000,
        signedUrlExpiry: 3600 // 1 hour
      }
    };
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