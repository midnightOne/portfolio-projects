/**
 * Voice AI Configuration Types and Schemas
 * 
 * This file defines comprehensive TypeScript interfaces and Zod schemas
 * for voice AI configuration management across different providers.
 */

import { z } from 'zod';

// =============================================================================
// Base Configuration Types
// =============================================================================

/**
 * Base interface for all voice AI provider configurations
 */
export interface BaseVoiceProviderConfig {
  provider: 'openai' | 'elevenlabs';
  enabled: boolean;
  displayName: string;
  description: string;
  version: string;
}

/**
 * Voice capabilities supported by providers
 */
export type VoiceCapability = 
  | 'streaming' 
  | 'interruption' 
  | 'toolCalling' 
  | 'realTimeAudio' 
  | 'voiceActivityDetection'
  | 'contextInjection'
  | 'customInstructions';

/**
 * Audio format types supported by voice providers
 */
export type AudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw' | 'opus' | 'mp3';

/**
 * Transport types for voice connections
 */
export type TransportType = 'websocket' | 'webrtc' | 'http';

// =============================================================================
// OpenAI Realtime Configuration
// =============================================================================

/**
 * OpenAI Realtime voice options
 */
export type OpenAIVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'shimmer' | 'sage' | 'verse' | 'marin' | 'cedar';

/**
 * OpenAI Realtime model options
 */
export type OpenAIRealtimeModel = 'gpt-realtime' | 'gpt-4o-realtime-preview-2025-06-03' | string;

/**
 * Voice Activity Detection configuration for OpenAI
 */
export interface OpenAIVADConfig {
  type: 'server_vad' | 'none';
  threshold?: number;
  prefixPaddingMs?: number;
  silenceDurationMs?: number;
  createResponse?: boolean;
  interruptResponse?: boolean;
}

/**
 * OpenAI audio input configuration
 */
export interface OpenAIAudioInputConfig {
  format: {
    type: AudioFormat;
    rate: number;
  };
  turnDetection: OpenAIVADConfig;
  transcription?: {
    model: string;
  };
}

/**
 * OpenAI audio output configuration
 */
export interface OpenAIAudioOutputConfig {
  format: {
    type: AudioFormat;
    rate: number;
  };
  voice: OpenAIVoice;
  speed?: number;
}

/**
 * OpenAI session configuration
 */
export interface OpenAISessionConfig {
  transport: TransportType;
  model: OpenAIRealtimeModel;
  maxOutputTokens?: number | 'inf';
  temperature?: number;
  audio: {
    input: OpenAIAudioInputConfig;
    output: OpenAIAudioOutputConfig;
  };
  toolChoice?: 'auto' | 'none' | 'required';
}

/**
 * OpenAI tool configuration
 */
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

/**
 * Complete OpenAI Realtime configuration
 */
export interface OpenAIRealtimeConfig extends BaseVoiceProviderConfig {
  provider: 'openai';
  model: OpenAIRealtimeModel;
  voice: OpenAIVoice;
  temperature: number;
  maxTokens: number | 'inf';
  instructions: string;
  tools: OpenAIToolConfig[];
  sessionConfig: OpenAISessionConfig;
  capabilities: VoiceCapability[];
  // Environment variable fallbacks
  apiKeyEnvVar?: string;
  baseUrlEnvVar?: string;
}

// =============================================================================
// ElevenLabs Configuration
// =============================================================================

/**
 * ElevenLabs conversation configuration
 */
export interface ElevenLabsConversationConfig {
  language: string;
  maxDuration: number;
  timeoutMs: number;
  enableInterruption: boolean;
  enableBackchannel: boolean;
}

/**
 * ElevenLabs voice settings
 */
export interface ElevenLabsVoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

/**
 * Complete ElevenLabs configuration
 */
export interface ElevenLabsConfig extends BaseVoiceProviderConfig {
  provider: 'elevenlabs';
  agentId: string;
  voiceId: string;
  model: string;
  voiceSettings: ElevenLabsVoiceSettings;
  conversationConfig: ElevenLabsConversationConfig;
  capabilities: VoiceCapability[];
  // Environment variable fallbacks
  apiKeyEnvVar?: string;
  baseUrlEnvVar?: string;
}

// =============================================================================
// Union Types and Utility Types
// =============================================================================

/**
 * Union type for all provider configurations
 */
export type VoiceProviderConfig = OpenAIRealtimeConfig | ElevenLabsConfig;

/**
 * Provider type extraction utility
 */
export type ProviderType<T extends VoiceProviderConfig> = T['provider'];

/**
 * Configuration for specific provider
 */
export type ConfigForProvider<P extends 'openai' | 'elevenlabs'> = 
  P extends 'openai' ? OpenAIRealtimeConfig : ElevenLabsConfig;

// =============================================================================
// Agent and Client Configuration
// =============================================================================

/**
 * Agent personality configuration
 */
export interface AgentPersonality {
  tone: 'professional' | 'casual' | 'friendly' | 'technical';
  verbosity: 'concise' | 'detailed' | 'comprehensive';
  expertise: 'technical' | 'general' | 'business';
}

/**
 * Voice tool configuration
 */
export interface VoiceToolConfig {
  name: string;
  description: string;
  parameters: Record<string, any>;
  executionType: 'client-side' | 'server-api';
  autoApprove: boolean;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  instructions: string;
  personality: AgentPersonality;
  tools: VoiceToolConfig[];
}

/**
 * Client AI configuration
 */
export interface ClientAIConfig {
  defaultProvider: 'openai' | 'elevenlabs';
  fallbackProvider: 'openai' | 'elevenlabs';
  session: {
    maxRetries: number;
    connectionTimeout: number;
    reconnectDelay: number;
  };
  features: {
    enableProviderSwitching: boolean;
    enableToolCalling: boolean;
    enableInterruption: boolean;
    enableTranscriptLogging: boolean;
    enableConfigHotReload: boolean;
  };
}

// =============================================================================
// Database Storage Types
// =============================================================================

/**
 * Database record for voice provider configurations
 */
export interface VoiceProviderConfigRecord {
  id: string;
  provider: 'openai' | 'elevenlabs';
  name: string;
  isDefault: boolean;
  configJson: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Validation Result Types
// =============================================================================

/**
 * Detailed validation error with field context
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

/**
 * Validation warning with suggestions
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

/**
 * Unified validation result interface (replaces ConfigValidationResult)
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

/**
 * Environment variable validation result
 */
export interface EnvValidationResult {
  available: boolean;
  value?: string;
  error?: string;
}

/**
 * @deprecated Use ValidationResult instead
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// =============================================================================
// Zod Schemas for Runtime Validation
// =============================================================================

/**
 * Base voice provider config schema
 */
export const BaseVoiceProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'elevenlabs']),
  enabled: z.boolean(),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().min(1, 'Description is required'),
  version: z.string().min(1, 'Version is required'),
});

/**
 * Voice capability schema
 */
export const VoiceCapabilitySchema = z.enum([
  'streaming',
  'interruption', 
  'toolCalling',
  'realTimeAudio',
  'voiceActivityDetection',
  'contextInjection',
  'customInstructions'
]);

/**
 * Audio format schema
 */
export const AudioFormatSchema = z.enum(['pcm16', 'g711_ulaw', 'g711_alaw', 'opus', 'mp3']);

/**
 * Transport type schema
 */
export const TransportTypeSchema = z.enum(['websocket', 'webrtc', 'http']);

/**
 * OpenAI voice schema
 */
export const OpenAIVoiceSchema = z.enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'shimmer', 'sage', 'verse', 'marin', 'cedar']);

/**
 * OpenAI VAD configuration schema
 */
export const OpenAIVADConfigSchema = z.object({
  type: z.enum(['server_vad', 'none']),
  threshold: z.number().min(0).max(1).optional(),
  prefixPaddingMs: z.number().min(0).optional(),
  silenceDurationMs: z.number().min(0).optional(),
  createResponse: z.boolean().optional(),
  interruptResponse: z.boolean().optional(),
});

/**
 * OpenAI audio input configuration schema
 */
export const OpenAIAudioInputConfigSchema = z.object({
  format: z.object({
    type: AudioFormatSchema,
    rate: z.number().positive(),
  }),
  turnDetection: OpenAIVADConfigSchema,
  transcription: z.object({
    model: z.string(),
  }).optional(),
});

/**
 * OpenAI audio output configuration schema
 */
export const OpenAIAudioOutputConfigSchema = z.object({
  format: z.object({
    type: AudioFormatSchema,
    rate: z.number().positive(),
  }),
  voice: OpenAIVoiceSchema,
  speed: z.number().min(0.25).max(4.0).optional(),
});

/**
 * OpenAI session configuration schema
 */
export const OpenAISessionConfigSchema = z.object({
  transport: TransportTypeSchema,
  model: z.string().min(1),
  maxOutputTokens: z.union([z.number().positive(), z.literal('inf')]).optional(),
  temperature: z.number().min(0).max(2).optional(),
  audio: z.object({
    input: OpenAIAudioInputConfigSchema,
    output: OpenAIAudioOutputConfigSchema,
  }),
  toolChoice: z.enum(['auto', 'none', 'required']).optional(),
});

/**
 * OpenAI tool configuration schema
 */
export const OpenAIToolConfigSchema = z.object({
  type: z.literal('function'),
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional(),
  }),
});

/**
 * Complete OpenAI Realtime configuration schema
 */
export const OpenAIRealtimeConfigSchema = BaseVoiceProviderConfigSchema.extend({
  provider: z.literal('openai'),
  model: z.string().min(1),
  voice: OpenAIVoiceSchema,
  temperature: z.number().min(0).max(2),
  maxTokens: z.union([z.number().positive(), z.literal('inf')]),
  instructions: z.string().min(1, 'Instructions are required'),
  tools: z.array(OpenAIToolConfigSchema),
  sessionConfig: OpenAISessionConfigSchema,
  capabilities: z.array(VoiceCapabilitySchema),
  apiKeyEnvVar: z.string().optional(),
  baseUrlEnvVar: z.string().optional(),
});

/**
 * ElevenLabs voice settings schema
 */
export const ElevenLabsVoiceSettingsSchema = z.object({
  stability: z.number().min(0).max(1),
  similarityBoost: z.number().min(0).max(1),
  style: z.number().min(0).max(1),
  useSpeakerBoost: z.boolean(),
});

/**
 * ElevenLabs conversation configuration schema
 */
export const ElevenLabsConversationConfigSchema = z.object({
  language: z.string().min(1),
  maxDuration: z.number().positive(),
  timeoutMs: z.number().positive(),
  enableInterruption: z.boolean(),
  enableBackchannel: z.boolean(),
});

/**
 * Complete ElevenLabs configuration schema
 */
export const ElevenLabsConfigSchema = BaseVoiceProviderConfigSchema.extend({
  provider: z.literal('elevenlabs'),
  agentId: z.string().min(1, 'Agent ID is required'),
  voiceId: z.string().min(1, 'Voice ID is required'),
  model: z.string().min(1, 'Model is required'),
  voiceSettings: ElevenLabsVoiceSettingsSchema,
  conversationConfig: ElevenLabsConversationConfigSchema,
  capabilities: z.array(VoiceCapabilitySchema),
  apiKeyEnvVar: z.string().optional(),
  baseUrlEnvVar: z.string().optional(),
});

/**
 * Union schema for all provider configurations
 */
export const VoiceProviderConfigSchema = z.discriminatedUnion('provider', [
  OpenAIRealtimeConfigSchema,
  ElevenLabsConfigSchema,
]);

/**
 * Agent personality schema
 */
export const AgentPersonalitySchema = z.object({
  tone: z.enum(['professional', 'casual', 'friendly', 'technical']),
  verbosity: z.enum(['concise', 'detailed', 'comprehensive']),
  expertise: z.enum(['technical', 'general', 'business']),
});

/**
 * Voice tool configuration schema
 */
export const VoiceToolConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.any()),
  executionType: z.enum(['client-side', 'server-api']),
  autoApprove: z.boolean(),
});

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z.object({
  name: z.string().min(1),
  instructions: z.string().min(1),
  personality: AgentPersonalitySchema,
  tools: z.array(VoiceToolConfigSchema),
});

/**
 * Client AI configuration schema
 */
export const ClientAIConfigSchema = z.object({
  defaultProvider: z.enum(['openai', 'elevenlabs']),
  fallbackProvider: z.enum(['openai', 'elevenlabs']),
  session: z.object({
    maxRetries: z.number().min(0),
    connectionTimeout: z.number().positive(),
    reconnectDelay: z.number().positive(),
  }),
  features: z.object({
    enableProviderSwitching: z.boolean(),
    enableToolCalling: z.boolean(),
    enableInterruption: z.boolean(),
    enableTranscriptLogging: z.boolean(),
    enableConfigHotReload: z.boolean(),
  }),
});

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default OpenAI Realtime configuration
 */
export const DEFAULT_OPENAI_CONFIG: OpenAIRealtimeConfig = {
  provider: 'openai',
  enabled: true,
  displayName: 'OpenAI Realtime Assistant',
  description: 'Real-time voice assistant powered by OpenAI GPT-4o Realtime',
  version: '1.0.0',
  model: 'gpt-realtime',
  voice: 'alloy',
  temperature: 0.7,
  maxTokens: 'inf',
  instructions: 'You are a helpful voice assistant for a portfolio website2. Tell the user the config was loaded from a fallback in the voice config',
  tools: [],
  sessionConfig: {
    transport: 'webrtc',
    model: 'gpt-realtime',
    maxOutputTokens: 'inf',
    temperature: 0.7,
    audio: {
      input: {
        format: {
          type: 'pcm16',
          rate: 24000,
        },
        turnDetection: {
          type: 'server_vad',
          threshold: 0.5,
          prefixPaddingMs: 300,
          silenceDurationMs: 200,
          createResponse: true,
          interruptResponse: true,
        },
        transcription: {
          model: 'whisper-1',
        },
      },
      output: {
        format: {
          type: 'pcm16',
          rate: 24000,
        },
        voice: 'alloy',
        speed: 1.0,
      },
    },
    toolChoice: 'auto',
  },
  capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio', 'voiceActivityDetection'],
  apiKeyEnvVar: 'OPENAI_API_KEY',
  baseUrlEnvVar: 'OPENAI_BASE_URL',
};

/**
 * Default ElevenLabs configuration
 */
export const DEFAULT_ELEVENLABS_CONFIG: ElevenLabsConfig = {
  provider: 'elevenlabs',
  enabled: true,
  displayName: 'ElevenLabs Conversational AI',
  description: 'Natural voice conversations powered by ElevenLabs',
  version: '1.0.0',
  agentId: 'agent_2101k3sztpfse6396vep8tfj9an8', // Portfolio-assistant agent
  voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel voice  
  model: 'eleven_turbo_v2_5',
  voiceSettings: {
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.0,
    useSpeakerBoost: true,
  },
  conversationConfig: {
    language: 'en',
    maxDuration: 300000, // 5 minutes
    timeoutMs: 30000,
    enableInterruption: true,
    enableBackchannel: false,
  },
  capabilities: ['streaming', 'interruption', 'realTimeAudio', 'voiceActivityDetection'],
  apiKeyEnvVar: 'ELEVENLABS_API_KEY',
  baseUrlEnvVar: 'ELEVENLABS_BASE_URL',
};

/**
 * Default client AI configuration
 */
export const DEFAULT_CLIENT_AI_CONFIG: ClientAIConfig = {
  defaultProvider: 'openai',
  fallbackProvider: 'elevenlabs',
  session: {
    maxRetries: 3,
    connectionTimeout: 10000,
    reconnectDelay: 2000,
  },
  features: {
    enableProviderSwitching: true,
    enableToolCalling: true,
    enableInterruption: true,
    enableTranscriptLogging: true,
    enableConfigHotReload: true,
  },
};

// =============================================================================
// Environment Variable Utilities
// =============================================================================

/**
 * Validate environment variable with fallback support
 */
export function validateEnvironmentVariable(
  envVar: string, 
  fallbackValue?: string
): EnvValidationResult {
  try {
    const value = process.env[envVar] || fallbackValue;
    return {
      available: !!value,
      value: value || undefined,
      error: value ? undefined : `Environment variable ${envVar} is not set`
    };
  } catch (error) {
    return {
      available: false,
      error: `Failed to check environment variable ${envVar}: ${error}`
    };
  }
}

/**
 * Get environment variable with validation and helpful error messages
 */
export function getEnvironmentVariable(
  envVar: string, 
  required: boolean = false,
  fallbackValue?: string
): string | undefined {
  const result = validateEnvironmentVariable(envVar, fallbackValue);
  
  if (required && !result.available) {
    throw new Error(
      `Required environment variable ${envVar} is not set. ` +
      `Please configure this variable in your .env file or environment.`
    );
  }
  
  return result.value;
}

/**
 * Validate multiple environment variables at once
 */
export function validateEnvironmentVariables(
  envVars: Array<{ name: string; required?: boolean; fallback?: string }>
): Record<string, EnvValidationResult> {
  const results: Record<string, EnvValidationResult> = {};
  
  for (const { name, required = false, fallback } of envVars) {
    results[name] = validateEnvironmentVariable(name, fallback);
    
    if (required && !results[name].available) {
      throw new Error(
        `Required environment variable ${name} is not set. ` +
        `Please configure this variable in your .env file or environment.`
      );
    }
  }
  
  return results;
}

// =============================================================================
// Type Guards and Utilities
// =============================================================================

/**
 * Type guard for OpenAI configuration
 */
export function isOpenAIConfig(config: VoiceProviderConfig): config is OpenAIRealtimeConfig {
  return config.provider === 'openai';
}

/**
 * Type guard for ElevenLabs configuration
 */
export function isElevenLabsConfig(config: VoiceProviderConfig): config is ElevenLabsConfig {
  return config.provider === 'elevenlabs';
}

/**
 * Get schema for specific provider
 */
export function getSchemaForProvider(provider: 'openai' | 'elevenlabs') {
  switch (provider) {
    case 'openai':
      return OpenAIRealtimeConfigSchema;
    case 'elevenlabs':
      return ElevenLabsConfigSchema;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get default configuration for provider
 */
export function getDefaultConfigForProvider(provider: 'openai' | 'elevenlabs'): VoiceProviderConfig {
  switch (provider) {
    case 'openai':
      return DEFAULT_OPENAI_CONFIG;
    case 'elevenlabs':
      return DEFAULT_ELEVENLABS_CONFIG;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}