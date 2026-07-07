/**
 * Server-side text-to-speech through the `default-tts` alias (D4 — no literal
 * model IDs in feature code). Consumers: the D53 synthesized-audio fake-mic
 * driver (verification task 4.4) and D50 pre-recorded voice clips (ai-assistant 9b).
 *
 * The OpenAI speech endpoint returns raw audio with no usage block, so callers
 * meter with estimated tokens (chars/4 both directions — rough, conservative,
 * and pennies at TTS scale).
 */

import { resolveModelAlias } from './model-registry';
import { estimateTokensFromChars } from './pricing';

export interface SynthesizeSpeechOptions {
  text: string;
  /** Provider voice name; defaults to 'alloy' (shared with realtime voice names). */
  voice?: string;
  /** Audio container. 'wav' decodes everywhere (AudioContext.decodeAudioData); 'mp3' is smaller. */
  format?: 'wav' | 'mp3';
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

  const resolved = await resolveModelAlias('default-tts');
  if (resolved.provider !== 'openai') {
    throw new Error(`synthesizeSpeech: provider '${resolved.provider}' not supported (default-tts alias)`);
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.audio.speech.create({
    model: resolved.modelId,
    voice,
    input: text,
    response_format: format,
  });
  const audio = Buffer.from(await response.arrayBuffer());

  const estimated = estimateTokensFromChars(text.length);
  return {
    audio,
    contentType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
    provider: resolved.provider,
    modelId: resolved.modelId,
    estimatedInputTokens: estimated,
    estimatedOutputTokens: estimated,
  };
}
