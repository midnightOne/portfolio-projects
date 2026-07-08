/**
 * D50 pre-recorded voice clips (ai-assistant task 9b) — server side.
 *
 * Phrases (admin-managed script, several randomized variants per category)
 * render to clips keyed (voiceId, phraseId) through the provider TTS in
 * lib/ai/tts.ts. Voice matching is strict (owner, 2026-07-08): a session only
 * ever plays clips rendered in ITS configured voice — a Gemini session gets
 * Gemini-TTS-rendered Puck clips or none at all, never a different voice.
 *
 * Storage: audio bytes live in Postgres — a deliberate choice (owner-visible,
 * ledger-noted): clips are tiny regenerable derived assets, the (voice,
 * phrase) key stays atomic with the bytes, and any serverless instance can
 * serve them (D43). The media pipeline (Cloudinary — keys ARE live) remains
 * an option; this module is the single storage seam if that swap is wanted.
 */

import { prisma } from '@/lib/prisma';
import { synthesizeSpeech } from './tts';
import { getClientAIModelManager } from '@/lib/voice/ClientAIModelManager';
import type { CascadeConfig, GoogleLiveConfig, OpenAIRealtimeConfig } from '@/types/voice-config';
import { resolveAliasOrModelId } from './model-registry';

export interface ClipPhrase {
  id: string;
  text: string;
  tag: string;
  enabled: boolean;
  sortOrder: number;
}

/** A (session provider → TTS voice+model) pairing clips are rendered for. */
export interface ClipTarget {
  /** The session provider whose configured voice this is. */
  sessionProvider: 'openai' | 'google' | 'cascade';
  /** Voice identifier as the TTS engine knows it (alloy / Puck / ElevenLabs id). */
  voiceId: string;
  /** Alias-or-model-id of the TTS that renders this voice. */
  ttsModel: string;
}

export interface ClipManifestEntry {
  phraseId: string;
  tag: string;
  text: string;
  url: string;
  updatedAt: string;
}

export interface ClipManifest {
  provider: string;
  voiceId: string | null;
  clips: ClipManifestEntry[];
}

/**
 * Resolve every configured session provider to its clip voice + TTS engine.
 * All from admin/dev-time config (VoiceProviderConfig rows + D4 aliases) —
 * nothing hardcoded:
 *  - openai  → realtime config voice; OpenAI TTS shares realtime voice names.
 *  - google  → Gemini Live prebuilt voice; rendered by the Gemini TTS model
 *              behind the 'default-tts-google' alias (same voice names).
 *              Skipped (no clips, never a wrong voice) when unconfigured.
 *  - cascade → the cascade config's own ttsVoice/ttsModel.
 */
export async function getClipTargets(): Promise<ClipTarget[]> {
  const manager = getClientAIModelManager();
  const targets: ClipTarget[] = [];

  try {
    const openai = (await manager.getProviderConfig('openai')).config as unknown as OpenAIRealtimeConfig;
    if (openai?.voice) {
      targets.push({ sessionProvider: 'openai', voiceId: openai.voice, ttsModel: 'default-tts' });
    }
  } catch (error) {
    console.warn('[voice-clips] openai target unresolved:', error);
  }

  try {
    const google = (await manager.getProviderConfig('google')).config as unknown as GoogleLiveConfig;
    if (google?.voice) {
      // Only offer the target when the Gemini TTS alias resolves to a google
      // model — otherwise google sessions get no clips (strict voice match).
      const resolved = await resolveAliasOrModelId('default-tts-google').catch(() => null);
      if (resolved && resolved.provider === 'google') {
        targets.push({ sessionProvider: 'google', voiceId: google.voice, ttsModel: 'default-tts-google' });
      }
    }
  } catch (error) {
    console.warn('[voice-clips] google target unresolved:', error);
  }

  try {
    const cascade = (await manager.getProviderConfig('cascade')).config as unknown as CascadeConfig;
    if (cascade?.ttsVoice) {
      targets.push({ sessionProvider: 'cascade', voiceId: cascade.ttsVoice, ttsModel: cascade.ttsModel });
    }
  } catch (error) {
    console.warn('[voice-clips] cascade target unresolved:', error);
  }

  return targets;
}

export async function listPhrases(): Promise<ClipPhrase[]> {
  const rows = await prisma.voiceClipPhrase.findMany({
    orderBy: [{ tag: 'asc' }, { sortOrder: 'asc' }],
  });
  return rows.map((r) => ({ id: r.id, text: r.text, tag: r.tag, enabled: r.enabled, sortOrder: r.sortOrder }));
}

export interface RegenerateResult {
  targets: Array<{
    sessionProvider: string;
    voiceId: string;
    generated: Array<{ phraseId: string; bytes: number }>;
    failed: Array<{ phraseId: string; error: string }>;
  }>;
  /** Per-TTS-model estimated token totals for the caller's ledger meters. */
  usage: Array<{ provider: string; modelId: string; estimatedInputTokens: number; estimatedOutputTokens: number }>;
}

/**
 * Render every ENABLED phrase for the given targets (default: all configured
 * providers' voices) and upsert the clips. A phrase whose text changed since
 * its clip was rendered is always re-rendered (upsert overwrites).
 */
export async function regenerateClips(opts?: { sessionProvider?: string }): Promise<RegenerateResult> {
  let targets = await getClipTargets();
  if (opts?.sessionProvider) {
    targets = targets.filter((t) => t.sessionProvider === opts.sessionProvider);
  }

  const phrases = await prisma.voiceClipPhrase.findMany({ where: { enabled: true } });
  const result: RegenerateResult = { targets: [], usage: [] };
  const usageByModel = new Map<string, { provider: string; modelId: string; estimatedInputTokens: number; estimatedOutputTokens: number }>();

  for (const target of targets) {
    const generated: Array<{ phraseId: string; bytes: number }> = [];
    const failed: Array<{ phraseId: string; error: string }> = [];

    for (const phrase of phrases) {
      try {
        const speech = await synthesizeSpeech({ text: phrase.text, voice: target.voiceId, model: target.ttsModel, format: 'mp3' });
        const key = `${speech.provider}/${speech.modelId}`;
        const bucket = usageByModel.get(key) ?? { provider: speech.provider, modelId: speech.modelId, estimatedInputTokens: 0, estimatedOutputTokens: 0 };
        bucket.estimatedInputTokens += speech.estimatedInputTokens;
        bucket.estimatedOutputTokens += speech.estimatedOutputTokens;
        usageByModel.set(key, bucket);

        await prisma.voiceClip.upsert({
          where: { voiceId_phraseId: { voiceId: target.voiceId, phraseId: phrase.id } },
          update: { text: phrase.text, audio: speech.audio, contentType: speech.contentType, provider: speech.provider, modelId: speech.modelId },
          create: {
            voiceId: target.voiceId,
            phraseId: phrase.id,
            text: phrase.text,
            audio: speech.audio,
            contentType: speech.contentType,
            provider: speech.provider,
            modelId: speech.modelId,
          },
        });
        generated.push({ phraseId: phrase.id, bytes: speech.audio.length });
      } catch (error) {
        failed.push({ phraseId: phrase.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    result.targets.push({ sessionProvider: target.sessionProvider, voiceId: target.voiceId, generated, failed });
  }

  result.usage = [...usageByModel.values()];
  return result;
}

/**
 * Manifest for the client player: enabled phrases that HAVE a clip in the
 * ACTIVE voice of the given session provider. Strict voice match — when the
 * provider's voice has no clips (voice changed, regeneration pending, or no
 * matching TTS), the manifest is EMPTY rather than another voice's clips.
 */
export async function getClipManifest(sessionProvider: string): Promise<ClipManifest> {
  const targets = await getClipTargets();
  const target = targets.find((t) => t.sessionProvider === sessionProvider);
  if (!target) return { provider: sessionProvider, voiceId: null, clips: [] };

  const clips = await prisma.voiceClip.findMany({
    where: { voiceId: target.voiceId, phrase: { enabled: true } },
    select: { phraseId: true, text: true, updatedAt: true, phrase: { select: { tag: true, sortOrder: true } } },
  });

  clips.sort((a, b) => a.phrase.tag.localeCompare(b.phrase.tag) || a.phrase.sortOrder - b.phrase.sortOrder);
  return {
    provider: sessionProvider,
    voiceId: target.voiceId,
    clips: clips.map((c) => ({
      phraseId: c.phraseId,
      tag: c.phrase.tag,
      text: c.text,
      url: `/api/ai/voice-clips/audio?voiceId=${encodeURIComponent(target.voiceId)}&phraseId=${encodeURIComponent(c.phraseId)}&v=${c.updatedAt.getTime()}`,
      updatedAt: c.updatedAt.toISOString(),
    })),
  };
}

export async function getClipAudio(
  voiceId: string,
  phraseId: string
): Promise<{ audio: Buffer; contentType: string; updatedAt: Date } | null> {
  const clip = await prisma.voiceClip.findUnique({
    where: { voiceId_phraseId: { voiceId, phraseId } },
    select: { audio: true, contentType: true, updatedAt: true },
  });
  if (!clip) return null;
  return { audio: Buffer.from(clip.audio), contentType: clip.contentType, updatedAt: clip.updatedAt };
}
