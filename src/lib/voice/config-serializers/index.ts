/**
 * Voice Configuration Serializers
 * 
 * This module provides provider-specific configuration serialization and validation
 * for voice AI systems. Each provider has its own serializer that handles:
 * - Type-safe serialization/deserialization
 * - Configuration validation with helpful error messages
 * - JSON Schema generation for dynamic admin UI
 * - Default configuration management
 */

import { VoiceProvider } from '../../../types/voice-agent';
import { 
  BaseVoiceProviderConfig,
  VoiceProviderConfig,
  ConfigValidationResult,
  OpenAIRealtimeConfig,
  ElevenLabsConfig
} from '../../../types/voice-config';

// Base interface for all voice configuration serializers
export interface VoiceConfigSerializer<T extends BaseVoiceProviderConfig> {
  /**
   * Serialize configuration to JSON string for database storage
   */
  serialize(config: T): string;
  
  /**
   * Deserialize JSON string back to typed configuration
   */
  deserialize(json: string): T;
  
  /**
   * Validate configuration and return helpful error messages
   */
  validate(config: Partial<T>): ValidationResult;
  
  /**
   * Get default configuration for this provider
   */
  getDefaultConfig(): T;
  
  /**
   * Generate JSON Schema for dynamic admin UI generation
   */
  getConfigSchema(): ConfigSchema;
  
  /**
   * Get provider type this serializer handles
   */
  getProviderType(): VoiceProvider;
}

// Re-export types from voice-config for backward compatibility
export type { BaseVoiceProviderConfig, VoiceProviderConfig } from '../../../types/voice-config';

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// JSON Schema interfaces for admin UI generation
export interface ConfigSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required: string[];
  title: string;
  description: string;
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  title: string;
  description: string;
  default?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
}

// Serialization error types
export class ConfigSerializationError extends Error {
  constructor(
    message: string,
    public provider: VoiceProvider,
    public field?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ConfigSerializationError';
  }
}

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public provider: VoiceProvider,
    public errors: ValidationError[]
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

// Import serializers for factory function
import { OpenAIRealtimeSerializer } from './OpenAIRealtimeSerializer';
import { ElevenLabsSerializer } from './ElevenLabsSerializer';

// Factory function to get appropriate serializer
export function getSerializerForProvider(provider: VoiceProvider): VoiceConfigSerializer<any> {
  switch (provider) {
    case 'openai':
      return new OpenAIRealtimeSerializer();
    case 'elevenlabs':
      return new ElevenLabsSerializer();
    default:
      throw new Error(`No serializer available for provider: ${provider}`);
  }
}

// Re-export serializers
export { OpenAIRealtimeSerializer } from './OpenAIRealtimeSerializer';
export { ElevenLabsSerializer } from './ElevenLabsSerializer';

// Re-export provider-specific config types from voice-config
export type { OpenAIRealtimeConfig, ElevenLabsConfig } from '../../../types/voice-config';