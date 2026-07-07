/**
 * Google Gemini Live configuration serializer (D22, ai-assistant task 6).
 * Same contract as the OpenAI/ElevenLabs serializers: typed (de)serialization,
 * validation with actionable messages, defaults, and a JSON schema for the
 * dynamic admin config UI. Provider config validation lives HERE — the old
 * standalone config-validation.ts shim was deleted with this task.
 */

import { VoiceProvider } from '../../../types/voice-agent';
import { GoogleLiveConfig } from '../../../types/voice-config';
import {
  VoiceConfigSerializer,
  ValidationResult,
  ValidationError,
  ConfigSchema,
  ConfigSerializationError,
} from './index';

export class GoogleLiveSerializer implements VoiceConfigSerializer<GoogleLiveConfig> {
  serialize(config: GoogleLiveConfig): string {
    try {
      return JSON.stringify(config, null, 2);
    } catch (error) {
      throw new ConfigSerializationError(
        `Failed to serialize Google Live config: ${error instanceof Error ? error.message : String(error)}`,
        'google',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  deserialize(json: string): GoogleLiveConfig {
    try {
      const parsed = JSON.parse(json);
      // Merge over defaults so rows written before a field existed stay valid.
      return { ...this.getDefaultConfig(), ...parsed };
    } catch (error) {
      throw new ConfigSerializationError(
        `Failed to deserialize Google Live config: ${error instanceof Error ? error.message : String(error)}`,
        'google',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  validate(config: Partial<GoogleLiveConfig>): ValidationResult {
    const errors: ValidationError[] = [];

    if (config.provider !== 'google') {
      errors.push({ field: 'provider', message: "Provider must be 'google'", code: 'INVALID_PROVIDER', value: config.provider });
    }
    if (!config.model || typeof config.model !== 'string') {
      errors.push({ field: 'model', message: 'A Live-capable model id is required (e.g. gemini-2.5-flash-native-audio-latest)', code: 'REQUIRED' });
    }
    if (!config.voice || typeof config.voice !== 'string') {
      errors.push({ field: 'voice', message: 'A prebuilt voice name is required (e.g. Puck, Kore)', code: 'REQUIRED' });
    }
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push({ field: 'temperature', message: 'Temperature must be between 0 and 2', code: 'OUT_OF_RANGE', value: config.temperature });
    }
    if (config.responseModality !== undefined && !['AUDIO', 'TEXT'].includes(config.responseModality)) {
      errors.push({ field: 'responseModality', message: "responseModality must be 'AUDIO' or 'TEXT'", code: 'INVALID_VALUE', value: config.responseModality });
    }
    if (config.maxSessionSeconds !== undefined && (config.maxSessionSeconds < 30 || config.maxSessionSeconds > 3600)) {
      errors.push({ field: 'maxSessionSeconds', message: 'maxSessionSeconds must be 30–3600', code: 'OUT_OF_RANGE', value: config.maxSessionSeconds });
    }

    return { valid: errors.length === 0, errors };
  }

  getDefaultConfig(): GoogleLiveConfig {
    return {
      provider: 'google',
      enabled: true,
      displayName: 'Gemini Live',
      description: 'Google Gemini Live native speech-to-speech (WebSocket, ephemeral token mint)',
      version: '1.0.0',
      model: 'gemini-2.5-flash-native-audio-latest',
      voice: 'Puck',
      temperature: 0.8,
      instructions: 'You are a concise, friendly AI narrator for a software portfolio. Ground every content answer in the content_search/content_get tools. ALWAYS answer in English unless the visitor explicitly asks to switch languages.',
      responseModality: 'AUDIO',
      transcription: { input: true, output: true },
      maxSessionSeconds: 600,
      capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio', 'voiceActivityDetection', 'customInstructions'],
      apiKeyEnvVar: 'GOOGLE_API_KEY',
    };
  }

  getConfigSchema(): ConfigSchema {
    return {
      type: 'object',
      title: 'Google Gemini Live Configuration',
      description: 'Native speech-to-speech via the Gemini Live API (WebSocket + ephemeral tokens)',
      required: ['provider', 'model', 'voice'],
      properties: {
        model: {
          type: 'string',
          title: 'Model',
          description: 'Live-capable model id',
          default: 'gemini-2.5-flash-native-audio-latest',
        },
        voice: {
          type: 'string',
          title: 'Voice',
          description: 'Prebuilt voice name',
          default: 'Puck',
          enum: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'],
        },
        temperature: {
          type: 'number',
          title: 'Temperature',
          description: 'Sampling temperature',
          default: 0.8,
          minimum: 0,
          maximum: 2,
        },
        instructions: {
          type: 'string',
          title: 'Instructions',
          description: 'Base system instructions (the mint route appends navigation/tool guidance)',
        },
        responseModality: {
          type: 'string',
          title: 'Response modality',
          description: 'AUDIO speaks; TEXT is a silent debug fallback',
          default: 'AUDIO',
          enum: ['AUDIO', 'TEXT'],
        },
        maxSessionSeconds: {
          type: 'number',
          title: 'Max session seconds',
          description: 'Duration cap enforced via ephemeral-token expiry at mint',
          default: 600,
          minimum: 30,
          maximum: 3600,
        },
      },
    };
  }

  getProviderType(): VoiceProvider {
    return 'google';
  }
}
