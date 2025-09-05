/**
 * OpenAI Realtime Configuration Serializer
 * 
 * Handles serialization, validation, and schema generation for OpenAI Realtime API configurations.
 * Supports the @openai/agents SDK configuration format with comprehensive validation.
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
import { VoiceProvider } from '../../../types/voice-agent';

// OpenAI Realtime specific configuration interface
export interface OpenAIRealtimeConfig extends BaseVoiceProviderConfig {
  provider: 'openai';
  
  // Model configuration
  model: 'gpt-4o-realtime-preview' | 'gpt-4o-realtime-preview-2024-10-01' | string;
  temperature: number;
  maxTokens: number;
  
  // Voice configuration
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  
  // Agent configuration
  instructions: string;
  name: string;
  
  // Session configuration
  sessionConfig: {
    transport: 'websocket' | 'webrtc';
    audioFormat: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    turnDetection: {
      type: 'server_vad' | 'none';
      threshold?: number;
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
    };
    outputGuardrails?: {
      debounceTextLength?: number;
      maxResponseLength?: number;
    };
  };
  
  // Tool configuration
  tools: OpenAIToolConfig[];
  
  // Advanced configuration
  advanced: {
    enableInterruption: boolean;
    enableToolCalling: boolean;
    enableTranscriptLogging: boolean;
    maxRetries: number;
    connectionTimeout: number;
    reconnectDelay: number;
  };
}

export interface OpenAIToolConfig {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export class OpenAIRealtimeSerializer implements VoiceConfigSerializer<OpenAIRealtimeConfig> {
  
  getProviderType(): VoiceProvider {
    return 'openai';
  }
  
  serialize(config: OpenAIRealtimeConfig): string {
    try {
      // Validate before serializing
      const validation = this.validate(config);
      if (!validation.valid) {
        throw new ConfigValidationError(
          'Configuration validation failed',
          'openai',
          validation.errors
        );
      }
      
      return JSON.stringify(config, null, 2);
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
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Required fields validation
    if (!config.provider || config.provider !== 'openai') {
      errors.push({
        field: 'provider',
        message: 'Provider must be "openai"',
        code: 'INVALID_PROVIDER',
        value: config.provider
      });
    }
    
    if (!config.enabled !== undefined && typeof config.enabled !== 'boolean') {
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
    
    // Model validation
    if (config.model) {
      const validModels = [
        'gpt-4o-realtime-preview',
        'gpt-4o-realtime-preview-2024-10-01'
      ];
      if (!validModels.includes(config.model) && !config.model.startsWith('gpt-')) {
        warnings.push({
          field: 'model',
          message: 'Using non-standard model name',
          suggestion: 'Consider using gpt-4o-realtime-preview for best compatibility'
        });
      }
    }
    
    // Temperature validation
    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        errors.push({
          field: 'temperature',
          message: 'Temperature must be a number between 0 and 2',
          code: 'INVALID_RANGE',
          value: config.temperature
        });
      }
    }
    
    // Max tokens validation
    if (config.maxTokens !== undefined) {
      if (typeof config.maxTokens !== 'number' || config.maxTokens < 1 || config.maxTokens > 128000) {
        errors.push({
          field: 'maxTokens',
          message: 'Max tokens must be a number between 1 and 128000',
          code: 'INVALID_RANGE',
          value: config.maxTokens
        });
      }
    }
    
    // Voice validation
    if (config.voice) {
      const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
      if (!validVoices.includes(config.voice)) {
        errors.push({
          field: 'voice',
          message: `Voice must be one of: ${validVoices.join(', ')}`,
          code: 'INVALID_ENUM',
          value: config.voice
        });
      }
    }
    
    // Instructions validation
    if (config.instructions !== undefined) {
      if (typeof config.instructions !== 'string') {
        errors.push({
          field: 'instructions',
          message: 'Instructions must be a string',
          code: 'INVALID_TYPE',
          value: config.instructions
        });
      } else if (config.instructions.length > 10000) {
        warnings.push({
          field: 'instructions',
          message: 'Instructions are very long and may impact performance',
          suggestion: 'Consider keeping instructions under 2000 characters'
        });
      }
    }
    
    // Session config validation
    if (config.sessionConfig) {
      const sessionConfig = config.sessionConfig;
      
      if (sessionConfig.transport && !['websocket', 'webrtc'].includes(sessionConfig.transport)) {
        errors.push({
          field: 'sessionConfig.transport',
          message: 'Transport must be "websocket" or "webrtc"',
          code: 'INVALID_ENUM',
          value: sessionConfig.transport
        });
      }
      
      if (sessionConfig.audioFormat && !['pcm16', 'g711_ulaw', 'g711_alaw'].includes(sessionConfig.audioFormat)) {
        errors.push({
          field: 'sessionConfig.audioFormat',
          message: 'Audio format must be "pcm16", "g711_ulaw", or "g711_alaw"',
          code: 'INVALID_ENUM',
          value: sessionConfig.audioFormat
        });
      }
      
      if (sessionConfig.turnDetection) {
        const turnDetection = sessionConfig.turnDetection;
        
        if (turnDetection.type && !['server_vad', 'none'].includes(turnDetection.type)) {
          errors.push({
            field: 'sessionConfig.turnDetection.type',
            message: 'Turn detection type must be "server_vad" or "none"',
            code: 'INVALID_ENUM',
            value: turnDetection.type
          });
        }
        
        if (turnDetection.threshold !== undefined) {
          if (typeof turnDetection.threshold !== 'number' || turnDetection.threshold < 0 || turnDetection.threshold > 1) {
            errors.push({
              field: 'sessionConfig.turnDetection.threshold',
              message: 'Threshold must be a number between 0 and 1',
              code: 'INVALID_RANGE',
              value: turnDetection.threshold
            });
          }
        }
      }
    }
    
    // Tools validation
    if (config.tools) {
      if (!Array.isArray(config.tools)) {
        errors.push({
          field: 'tools',
          message: 'Tools must be an array',
          code: 'INVALID_TYPE',
          value: config.tools
        });
      } else {
        config.tools.forEach((tool, index) => {
          if (!tool.type || tool.type !== 'function') {
            errors.push({
              field: `tools[${index}].type`,
              message: 'Tool type must be "function"',
              code: 'INVALID_ENUM',
              value: tool.type
            });
          }
          
          if (!tool.name) {
            errors.push({
              field: `tools[${index}].name`,
              message: 'Tool function name is required',
              code: 'REQUIRED_FIELD',
              value: tool.name
            });
          }
          
          if (!tool.description) {
            errors.push({
              field: `tools[${index}].description`,
              message: 'Tool function description is required',
              code: 'REQUIRED_FIELD',
              value: tool.description
            });
          }
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
  
  getDefaultConfig(): OpenAIRealtimeConfig {
    return {
      provider: 'openai',
      enabled: true,
      displayName: 'OpenAI Realtime Assistant',
      description: 'Real-time voice conversation using OpenAI GPT-4 Realtime API',
      version: '1.0.0',
      
      model: 'gpt-4o-realtime-preview',
      temperature: 0.7,
      maxTokens: 4096,
      
      voice: 'alloy',
      
      name: 'Portfolio Assistant',
      instructions: 'You are a helpful assistant for a portfolio website. You can answer questions about the portfolio owner\'s background, projects, and experience. Be professional, friendly, and informative.',
      
      sessionConfig: {
        transport: 'webrtc',
        audioFormat: 'pcm16',
        turnDetection: {
          type: 'server_vad',
          threshold: 0.5,
          prefixPaddingMs: 300,
          silenceDurationMs: 500
        },
        outputGuardrails: {
          debounceTextLength: 200,
          maxResponseLength: 2000
        }
      },
      
      tools: [],
      
      advanced: {
        enableInterruption: true,
        enableToolCalling: true,
        enableTranscriptLogging: true,
        maxRetries: 3,
        connectionTimeout: 10000,
        reconnectDelay: 2000
      }
    };
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
          enum: ['gpt-4o-realtime-preview', 'gpt-4o-realtime-preview-2024-10-01'],
          default: 'gpt-4o-realtime-preview'
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
          enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
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