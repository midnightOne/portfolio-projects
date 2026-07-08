/**
 * D50 pre-recorded voice clips (ai-assistant task 9b) — server side.
 *
 * Phrases (admin-managed script, several randomized variants per category)
 * render to clips keyed (voiceId, phraseId) through the provider TTS in
 * lib/ai/tts.ts. Voice matching is strict (owner, 2026-07-08): a session only
 * ever plays clips rendered in ITS configured voice — a Gemini session gets
 * Gemini-TTS-rendered Puck clips or none at all, never a different voice.
 *
 * Storage: audio lives in the MEDIA PIPELINE (owner, 2026-07-08 — Cloudinary
 * serves audio through its `video` resource type; keys verified live). Rows
 * here hold the CDN url + public id; regeneration overwrites the same public
 * id (the versioned delivery URL changes, which is the cache-bust). This is
 * the same upload path future full-conversation debug recordings will use.
 */

import { prisma } from '@/lib/prisma';
import { synthesizeSpeech } from './tts';
import { getClientAIModelManager } from '@/lib/voice/ClientAIModelManager';
import { getMediaProvider } from '@/lib/media';
import type { CascadeConfig, GoogleLiveConfig, OpenAIRealtimeConfig } from '@/types/voice-config';
import { resolveAliasOrModelId } from './model-registry';

/** Media-pipeline folder for clip assets. */
const CLIP_FOLDER = 'voice-clips';

/** Deterministic public id per (voice, phrase) — regeneration overwrites in place. */
function clipPublicId(voiceId: string, phraseId: string): string {
  const safeVoice = voiceId.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${CLIP_FOLDER}/${safeVoice}__${phraseId}`;
}

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

        // Media pipeline upload (audio rides Cloudinary's `video` resource
        // type via resource_type:'auto'). Deterministic public id → the asset
        // is overwritten in place; the versioned CDN URL changes (cache-bust).
        const asset = await getMediaProvider().upload(speech.audio, {
          publicId: clipPublicId(target.voiceId, phrase.id),
          tags: ['voice-clip', phrase.tag, target.sessionProvider],
        });

        await prisma.voiceClip.upsert({
          where: { voiceId_phraseId: { voiceId: target.voiceId, phraseId: phrase.id } },
          update: {
            text: phrase.text,
            url: asset.secureUrl,
            publicId: asset.publicId,
            contentType: speech.contentType,
            provider: speech.provider,
            modelId: speech.modelId,
            durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
          },
          create: {
            voiceId: target.voiceId,
            phraseId: phrase.id,
            text: phrase.text,
            url: asset.secureUrl,
            publicId: asset.publicId,
            contentType: speech.contentType,
            provider: speech.provider,
            modelId: speech.modelId,
            durationMs: asset.duration ? Math.round(asset.duration * 1000) : undefined,
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
    select: { phraseId: true, text: true, url: true, updatedAt: true, phrase: { select: { tag: true, sortOrder: true } } },
  });

  clips.sort((a, b) => a.phrase.tag.localeCompare(b.phrase.tag) || a.phrase.sortOrder - b.phrase.sortOrder);
  return {
    provider: sessionProvider,
    voiceId: target.voiceId,
    clips: clips.map((c) => ({
      phraseId: c.phraseId,
      tag: c.phrase.tag,
      text: c.text,
      // CDN URL, versioned by the media provider — changes on regeneration.
      url: c.url,
      updatedAt: c.updatedAt.toISOString(),
    })),
  };
}

/** Stored CDN URL for one clip (the /audio route 302s to it). */
export async function getClipUrl(voiceId: string, phraseId: string): Promise<string | null> {
  const clip = await prisma.voiceClip.findUnique({
    where: { voiceId_phraseId: { voiceId, phraseId } },
    select: { url: true },
  });
  return clip?.url ?? null;
}

/** Best-effort media-pipeline cleanup for a phrase's rendered clips. */
export async function deletePhraseClipAssets(phraseId: string): Promise<void> {
  const clips = await prisma.voiceClip.findMany({ where: { phraseId }, select: { publicId: true } });
  const provider = getMediaProvider();
  for (const clip of clips) {
    try {
      // Audio assets are Cloudinary's 'video' resource type.
      await provider.delete(clip.publicId, { resourceType: 'video' });
    } catch (error) {
      console.warn(`[voice-clips] asset cleanup failed for ${clip.publicId} (continuing):`, error);
    }
  }
}
