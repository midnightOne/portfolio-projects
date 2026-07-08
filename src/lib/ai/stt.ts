/**
 * Server-side speech-to-text for the D45 cascade family (ai-assistant task 9.1).
 *
 * The model comes from an alias-or-model-id resolved through the D4 registry
 * (default 'default-stt') — no literal IDs in feature code. Providers:
 *   openai      — audio.transcriptions (whisper / gpt-4o-*-transcribe)
 *   elevenlabs  — Scribe (POST /v1/speech-to-text)
 * Keys are env-only (D3); audio never touches the DB.
 *
 * Transcription responses carry no usage block on either provider, so callers
 * meter estimated tokens from the transcript length — the same conservative
 * convention as tts.ts (pennies at portfolio scale).
 */

import { resolveAliasOrModelId } from './model-registry';
import { estimateTokensFromChars } from './pricing';

export interface TranscribeAudioOptions {
  audio: Buffer;
  /** Container MIME type of the captured audio (e.g. 'audio/webm'). */
  mimeType: string;
  /** Alias-or-model-id override; defaults to 'default-stt'. */
  model?: string;
}

export interface TranscribedAudio {
  text: string;
  provider: string;
  modelId: string;
  /** Estimated token counts for ledger metering (no usage block from either provider). */
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

export async function transcribeAudio(options: TranscribeAudioOptions): Promise<TranscribedAudio> {
  const { audio, mimeType } = options;
  if (!audio.length) {
    throw new Error('transcribeAudio: audio is empty');
  }

  const resolved = await resolveAliasOrModelId(options.model ?? 'default-stt');

  let text: string;
  if (resolved.provider === 'openai') {
    const { default: OpenAI, toFile } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const result = await client.audio.transcriptions.create({
      model: resolved.modelId,
      file: await toFile(audio, `utterance.${ext}`, { type: mimeType }),
    });
    text = result.text ?? '';
  } else if (resolved.provider === 'elevenlabs') {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('transcribeAudio: ELEVENLABS_API_KEY is not set');
    }
    const form = new FormData();
    form.append('model_id', resolved.modelId);
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), 'utterance.webm');
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`transcribeAudio: ElevenLabs STT failed (${response.status}) ${detail.slice(0, 300)}`);
    }
    const data = (await response.json()) as { text?: string };
    text = data.text ?? '';
  } else {
    throw new Error(`transcribeAudio: provider '${resolved.provider}' not supported (stt alias '${options.model ?? 'default-stt'}')`);
  }

  const estimated = estimateTokensFromChars(text.length);
  return {
    text: text.trim(),
    provider: resolved.provider,
    modelId: resolved.modelId,
    estimatedInputTokens: estimated,
    estimatedOutputTokens: estimated,
  };
}
