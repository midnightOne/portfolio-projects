/**
 * Server-side text-to-speech through the `default-tts` alias (D4 — no literal
 * model IDs in feature code). Consumers: the D53 synthesized-audio fake-mic
 * driver (verification task 4.4), the D45 cascade TTS route (ai-assistant 9),
 * and D50 pre-recorded voice clips (ai-assistant 9b).
 *
 * Providers: openai speech, elevenlabs TTS (D22 amendment — ElevenLabs as a
 * TTS engine, selected by pointing the model at an ElevenLabs model id).
 * Speech endpoints return raw audio with no usage block, so callers meter with
 * estimated tokens (chars/4 both directions — rough, conservative, and pennies
 * at TTS scale).
 */

import { resolveAliasOrModelId } from './model-registry';
import { estimateTokensFromChars } from './pricing';

export interface SynthesizeSpeechOptions {
  text: string;
  /** OpenAI voice name (defaults to 'alloy') or ElevenLabs voice id — must match the model's provider. */
  voice?: string;
  /** Audio container. 'wav' decodes everywhere (AudioContext.decodeAudioData); 'mp3' is smaller. */
  format?: 'wav' | 'mp3';
  /** Alias-or-model-id override; defaults to 'default-tts'. */
  model?: string;
}

export interface SynthesizedSpeech {
  audio: Buffer;
  contentType: string;
  provider: string;
  modelId: string;
  /** Estimated token counts for ledger metering (speech API returns no usage). */
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

export async function synthesizeSpeech(options: SynthesizeSpeechOptions): Promise<SynthesizedSpeech> {
  const { text, voice = 'alloy', format = 'wav' } = options;
  if (!text.trim()) {
    throw new Error('synthesizeSpeech: text is empty');
  }

  const resolved = await resolveAliasOrModelId(options.model ?? 'default-tts');

  let audio: Buffer;
  let contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';

  if (resolved.provider === 'openai') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.audio.speech.create({
      model: resolved.modelId,
      voice,
      input: text,
      response_format: format,
    });
    audio = Buffer.from(await response.arrayBuffer());
  } else if (resolved.provider === 'elevenlabs') {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('synthesizeSpeech: ELEVENLABS_API_KEY is not set');
    }
    // ElevenLabs keys speech by voice id in the path; wav is served as PCM
    // only on higher plans, so mp3 is the safe container for both formats.
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: resolved.modelId }),
      }
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`synthesizeSpeech: ElevenLabs TTS failed (${response.status}) ${detail.slice(0, 300)}`);
    }
    audio = Buffer.from(await response.arrayBuffer());
    contentType = 'audio/mpeg';
  } else {
    throw new Error(`synthesizeSpeech: provider '${resolved.provider}' not supported (tts alias '${options.model ?? 'default-tts'}')`);
  }

  const estimated = estimateTokensFromChars(text.length);
  return {
    audio,
    contentType,
    provider: resolved.provider,
    modelId: resolved.modelId,
    estimatedInputTokens: estimated,
    estimatedOutputTokens: estimated,
  };
}
