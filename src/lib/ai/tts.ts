/**
 * Server-side text-to-speech through the `default-tts` alias (D4 — no literal
 * model IDs in feature code). Consumers: the D53 synthesized-audio fake-mic
 * driver (verification task 4.4), the D45 cascade TTS route (ai-assistant 9),
 * and D50 pre-recorded voice clips (ai-assistant 9b).
 *
 * Providers: openai speech, elevenlabs TTS (D22 amendment — ElevenLabs as a
 * TTS engine, selected by pointing the model at an ElevenLabs model id), and
 * google Gemini TTS (same prebuilt voice names as Gemini Live — used by the
 * D50 clips so Gemini sessions get clips in THEIR voice; returns raw PCM,
 * wrapped in a WAV header here so AudioContext.decodeAudioData accepts it).
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
  } else if (resolved.provider === 'google') {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('synthesizeSpeech: GOOGLE_API_KEY/GEMINI_API_KEY is not set');
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolved.modelId)}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      }
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`synthesizeSpeech: Gemini TTS failed (${response.status}) ${detail.slice(0, 300)}`);
    }
    const data = await response.json();
    const inline = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data
    )?.inlineData;
    if (!inline?.data) {
      throw new Error('synthesizeSpeech: Gemini TTS returned no audio part');
    }
    // Gemini TTS emits raw 16-bit PCM (mimeType like 'audio/L16;codec=pcm;rate=24000');
    // browsers can't decode headerless PCM, so wrap it as WAV.
    const pcm = Buffer.from(inline.data, 'base64');
    const rate = Number(/rate=(\d+)/.exec(inline.mimeType ?? '')?.[1] ?? 24000);
    audio = wavFromPcm16(pcm, rate);
    contentType = 'audio/wav';
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

/** Minimal RIFF/WAVE header around mono 16-bit PCM. */
function wavFromPcm16(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
