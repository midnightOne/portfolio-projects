/**
 * Cascade voice family configuration serializer (D45, ai-assistant task 9).
 * Same contract as the other serializers. Every model field is an
 * alias-or-model-id resolved through the D4 registry server-side — the config
 * carries roles ('default-stt', 'default-tts'), never literal IDs by default.
 */

import { VoiceProvider } from '../../../types/voice-agent';
import { CascadeConfig } from '../../../types/voice-config';
import {
  VoiceConfigSerializer,
  ValidationResult,
  ValidationError,
  ConfigSchema,
  ConfigSerializationError,
} from './index';

export class CascadeSerializer implements VoiceConfigSerializer<CascadeConfig> {
  serialize(config: CascadeConfig): string {
    try {
      return JSON.stringify(config, null, 2);
    } catch (error) {
      throw new ConfigSerializationError(
        `Failed to serialize cascade config: ${error instanceof Error ? error.message : String(error)}`,
        'cascade',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  deserialize(json: string): CascadeConfig {
    try {
      const parsed = JSON.parse(json);
      const defaults = this.getDefaultConfig();
      // Merge over defaults so rows written before a field existed stay valid.
      return { ...defaults, ...parsed, vad: { ...defaults.vad, ...(parsed.vad ?? {}) } };
    } catch (error) {
      throw new ConfigSerializationError(
        `Failed to deserialize cascade config: ${error instanceof Error ? error.message : String(error)}`,
        'cascade',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  validate(config: Partial<CascadeConfig>): ValidationResult {
    const errors: ValidationError[] = [];

    if (config.provider !== 'cascade') {
      errors.push({ field: 'provider', message: "Provider must be 'cascade'", code: 'INVALID_PROVIDER', value: config.provider });
    }
    if (!config.sttModel || typeof config.sttModel !== 'string') {
      errors.push({ field: 'sttModel', message: "An STT alias-or-model-id is required (e.g. 'default-stt')", code: 'REQUIRED' });
    }
    if (!config.ttsModel || typeof config.ttsModel !== 'string') {
      errors.push({ field: 'ttsModel', message: "A TTS alias-or-model-id is required (e.g. 'default-tts')", code: 'REQUIRED' });
    }
    if (!config.ttsVoice || typeof config.ttsVoice !== 'string') {
      errors.push({ field: 'ttsVoice', message: 'A TTS voice (OpenAI voice name or ElevenLabs voice id) is required', code: 'REQUIRED' });
    }
    const vad = config.vad;
    if (vad) {
      if (vad.threshold !== undefined && (vad.threshold <= 0 || vad.threshold > 0.5)) {
        errors.push({ field: 'vad.threshold', message: 'vad.threshold must be in (0, 0.5]', code: 'OUT_OF_RANGE', value: vad.threshold });
      }
      if (vad.silenceMs !== undefined && (vad.silenceMs < 200 || vad.silenceMs > 5000)) {
        errors.push({ field: 'vad.silenceMs', message: 'vad.silenceMs must be 200–5000', code: 'OUT_OF_RANGE', value: vad.silenceMs });
      }
      if (vad.maxUtteranceMs !== undefined && (vad.maxUtteranceMs < 2000 || vad.maxUtteranceMs > 60000)) {
        errors.push({ field: 'vad.maxUtteranceMs', message: 'vad.maxUtteranceMs must be 2000–60000', code: 'OUT_OF_RANGE', value: vad.maxUtteranceMs });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  getDefaultConfig(): CascadeConfig {
    return {
      provider: 'cascade',
      enabled: true,
      displayName: 'Cascade (STT → LLM → TTS)',
      description:
        'D45 cascade family: mic → server STT → the same grounded text pipeline as text chat → server TTS. Robust tool calling; ~1–1.5s to first audio.',
      version: '1.0.0',
      maxSessionSeconds: 900,
      sttModel: 'default-stt',
      ttsModel: 'default-tts',
      // OpenAI voice name for the default-tts alias; switch to an ElevenLabs
      // voice id when ttsModel points at an ElevenLabs model.
      ttsVoice: 'alloy',
      vad: {
        threshold: 0.015,
        silenceMs: 900,
        minSpeechMs: 300,
        maxUtteranceMs: 30000,
      },
      capabilities: ['toolCalling', 'voiceActivityDetection', 'customInstructions'],
    };
  }

  getConfigSchema(): ConfigSchema {
    return {
      type: 'object',
      title: 'Cascade Voice Configuration',
      description: 'STT → reasoning LLM → TTS pipeline (D45). Model fields accept a registry alias or a pinned model id.',
      required: ['provider', 'sttModel', 'ttsModel', 'ttsVoice'],
      properties: {
        sttModel: {
          type: 'string',
          title: 'STT model (alias or id)',
          description: "Speech-to-text model — 'default-stt' resolves via the model registry",
          default: 'default-stt',
        },
        ttsModel: {
          type: 'string',
          title: 'TTS model (alias or id)',
          description: "Text-to-speech model — 'default-tts' resolves via the model registry; ElevenLabs model ids select ElevenLabs TTS",
          default: 'default-tts',
        },
        ttsVoice: {
          type: 'string',
          title: 'TTS voice',
          description: 'OpenAI voice name (alloy, marin, …) or ElevenLabs voice id, matching the TTS model provider',
          default: 'alloy',
        },
        maxSessionSeconds: {
          type: 'number',
          title: 'Max session seconds',
          description: 'Duration cap (task 8 / Req 2.4) — the adapter auto-disconnects at the cap',
          default: 900,
          minimum: 30,
          maximum: 3600,
        },
        vad: {
          type: 'object',
          title: 'Voice activity detection',
          description: 'Conservative energy VAD — endpoint on silence (v1; barge-in is v2)',
          properties: {
            threshold: { type: 'number', title: 'Speech RMS threshold', description: 'RMS above this counts as speech', default: 0.015, minimum: 0.001, maximum: 0.5 },
            silenceMs: { type: 'number', title: 'Endpoint silence (ms)', description: 'Silence closing an utterance', default: 900, minimum: 200, maximum: 5000 },
            minSpeechMs: { type: 'number', title: 'Min speech (ms)', description: 'Shorter utterances are discarded as noise', default: 300, minimum: 0, maximum: 5000 },
            maxUtteranceMs: { type: 'number', title: 'Max utterance (ms)', description: 'Hard per-utterance cap', default: 30000, minimum: 2000, maximum: 60000 },
          },
        },
      },
    };
  }

  getProviderType(): VoiceProvider {
    return 'cascade';
  }
}
