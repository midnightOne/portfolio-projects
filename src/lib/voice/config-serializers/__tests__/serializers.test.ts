/**
 * Tests for Voice Configuration Serializers
 */

import { describe, it, expect } from '@jest/globals';
import { 
  OpenAIRealtimeSerializer, 
  ElevenLabsSerializer,
  getSerializerForProvider,
  ConfigValidationError,
  ConfigSerializationError
} from '../index';

describe('OpenAI Realtime Serializer', () => {
  const serializer = new OpenAIRealtimeSerializer();

  it('should create default configuration', () => {
    const config = serializer.getDefaultConfig();
    expect(config.provider).toBe('openai');
    expect(config.enabled).toBe(true);
    expect(config.model).toBe('gpt-realtime');
    expect(config.voice).toBe('alloy');
  });

  it('should serialize and deserialize configuration', () => {
    const config = serializer.getDefaultConfig();
    const serialized = serializer.serialize(config);
    const deserialized = serializer.deserialize(serialized);
    
    expect(deserialized).toEqual(config);
  });

  it('should validate configuration correctly', () => {
    const config = serializer.getDefaultConfig();
    const validation = serializer.validate(config);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect invalid temperature', () => {
    const config = { ...serializer.getDefaultConfig(), temperature: 3 };
    const validation = serializer.validate(config);
    
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.field === 'temperature')).toBe(true);
  });

  it('should detect invalid voice', () => {
    const config = { ...serializer.getDefaultConfig(), voice: 'invalid' as any };
    const validation = serializer.validate(config);
    
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.field === 'voice')).toBe(true);
  });

  it('should generate JSON schema', () => {
    const schema = serializer.getConfigSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties.provider).toBeDefined();
    expect(schema.properties.model).toBeDefined();
    expect(schema.properties.voice).toBeDefined();
  });
});

describe('ElevenLabs Serializer', () => {
  const serializer = new ElevenLabsSerializer();

  it('should create default configuration', () => {
    const config = serializer.getDefaultConfig();
    expect(config.provider).toBe('elevenlabs');
    expect(config.enabled).toBe(true);
    expect(config.model).toBe('eleven_turbo_v2_5');
  });

  it('should serialize and deserialize configuration', () => {
    const config = {
      ...serializer.getDefaultConfig(),
      agentId: 'test-agent',
      voiceId: 'test-voice'
    };
    const serialized = serializer.serialize(config);
    const deserialized = serializer.deserialize(serialized);
    
    expect(deserialized).toEqual(config);
  });

  it('should validate configuration correctly', () => {
    const config = {
      ...serializer.getDefaultConfig(),
      agentId: 'test-agent',
      voiceId: 'test-voice'
    };
    const validation = serializer.validate(config);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect missing agent ID', () => {
    const config = { ...serializer.getDefaultConfig(), agentId: '' };
    const validation = serializer.validate(config);
    
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.field === 'agentId')).toBe(true);
  });

  it('should detect invalid stability value', () => {
    const config = {
      ...serializer.getDefaultConfig(),
      agentId: 'test-agent',
      voiceId: 'test-voice',
      voiceSettings: {
        ...serializer.getDefaultConfig().voiceSettings,
        stability: 2
      }
    };
    const validation = serializer.validate(config);
    
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.field === 'voiceSettings.stability')).toBe(true);
  });

  it('should generate JSON schema', () => {
    const schema = serializer.getConfigSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties.provider).toBeDefined();
    expect(schema.properties.agentId).toBeDefined();
    expect(schema.properties.voiceSettings).toBeDefined();
  });
});

describe('Serializer Factory', () => {
  it('should return OpenAI serializer for openai provider', () => {
    const serializer = getSerializerForProvider('openai');
    expect(serializer).toBeInstanceOf(OpenAIRealtimeSerializer);
  });

  it('should return ElevenLabs serializer for elevenlabs provider', () => {
    const serializer = getSerializerForProvider('elevenlabs');
    expect(serializer).toBeInstanceOf(ElevenLabsSerializer);
  });

  it('should throw error for unknown provider', () => {
    expect(() => getSerializerForProvider('unknown' as any)).toThrow();
  });
});

describe('Error Handling', () => {
  it('should throw ConfigValidationError for invalid config during serialization', () => {
    const serializer = new OpenAIRealtimeSerializer();
    const invalidConfig = { provider: 'invalid' } as any;
    
    expect(() => serializer.serialize(invalidConfig)).toThrow(ConfigValidationError);
  });

  it('should throw ConfigSerializationError for invalid JSON during deserialization', () => {
    const serializer = new OpenAIRealtimeSerializer();
    const invalidJson = '{ invalid json }';
    
    expect(() => serializer.deserialize(invalidJson)).toThrow(ConfigSerializationError);
  });
});