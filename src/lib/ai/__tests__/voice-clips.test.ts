/**
 * voice-clips target resolution + manifest (D50, ai-assistant 9b) — the
 * strict-voice-match rules: every configured session provider maps to ITS
 * OWN clip voice, a provider whose TTS can't render that voice gets NO
 * clips (never a wrong voice), and the manifest is empty rather than
 * borrowed when the voice has no rendered clips.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    voiceClip: { findMany: jest.fn(), findUnique: jest.fn() },
    voiceClipPhrase: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

const getProviderConfig = jest.fn();
jest.mock('@/lib/voice/ClientAIModelManager', () => ({
  getClientAIModelManager: () => ({ getProviderConfig }),
}));

const resolveAliasOrModelId = jest.fn();
jest.mock('../model-registry', () => ({
  resolveAliasOrModelId: (...args: unknown[]) => resolveAliasOrModelId(...args),
}));

jest.mock('@/lib/media', () => ({
  getMediaProvider: jest.fn(),
}));

jest.mock('../tts', () => ({
  synthesizeSpeech: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { getClipTargets, getClipManifest } from '../voice-clips';

const mockPrisma = prisma as unknown as {
  voiceClip: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
};

/** Configure the three provider rows the manager would serve. */
function configureProviders(overrides?: {
  openai?: Record<string, unknown> | Error;
  google?: Record<string, unknown> | Error;
  cascade?: Record<string, unknown> | Error;
}) {
  const defaults: Record<string, Record<string, unknown>> = {
    openai: { voice: 'alloy' },
    google: { voice: 'Puck' },
    cascade: { ttsVoice: 'rachel-id', ttsModel: 'eleven_flash_v2_5' },
  };
  getProviderConfig.mockImplementation(async (provider: string) => {
    const value = overrides?.[provider as keyof typeof overrides] ?? defaults[provider];
    if (value instanceof Error) throw value;
    return { config: value };
  });
}

beforeEach(() => {
  getProviderConfig.mockReset();
  resolveAliasOrModelId.mockReset();
  mockPrisma.voiceClip.findMany.mockReset();
  mockPrisma.$queryRaw.mockReset();
  mockPrisma.$queryRaw.mockResolvedValue([]); // tool-latency stats (manifest side-load)
});

describe('getClipTargets', () => {
  it('maps each configured provider to its own voice and TTS engine', async () => {
    configureProviders();
    resolveAliasOrModelId.mockResolvedValue({ provider: 'google', modelId: 'gemini-tts' });

    const targets = await getClipTargets();

    expect(targets).toEqual([
      { sessionProvider: 'openai', voiceId: 'alloy', ttsModel: 'default-tts' },
      { sessionProvider: 'google', voiceId: 'Puck', ttsModel: 'default-tts-google' },
      { sessionProvider: 'cascade', voiceId: 'rachel-id', ttsModel: 'eleven_flash_v2_5' },
    ]);
  });

  it('skips google when the google TTS alias resolves to another provider (strict voice match)', async () => {
    configureProviders();
    resolveAliasOrModelId.mockResolvedValue({ provider: 'openai', modelId: 'tts-1' });

    const targets = await getClipTargets();
    expect(targets.map((t) => t.sessionProvider)).toEqual(['openai', 'cascade']);
  });

  it('skips google when the alias does not resolve at all', async () => {
    configureProviders();
    resolveAliasOrModelId.mockRejectedValue(new Error('no such alias'));

    const targets = await getClipTargets();
    expect(targets.map((t) => t.sessionProvider)).toEqual(['openai', 'cascade']);
  });

  it('skips providers with no configured voice, and survives a config load failure', async () => {
    configureProviders({
      openai: {}, // no voice configured
      google: new Error('config table unreachable'),
    });

    const targets = await getClipTargets();
    expect(targets).toEqual([
      { sessionProvider: 'cascade', voiceId: 'rachel-id', ttsModel: 'eleven_flash_v2_5' },
    ]);
  });
});

describe('getClipManifest', () => {
  it('serves only clips rendered in the session provider\'s ACTIVE voice', async () => {
    configureProviders();
    resolveAliasOrModelId.mockResolvedValue({ provider: 'google', modelId: 'gemini-tts' });
    mockPrisma.voiceClip.findMany.mockResolvedValue([
      {
        phraseId: 'p1',
        text: 'One moment.',
        url: 'https://cdn/clip.mp3',
        durationMs: 900,
        updatedAt: new Date('2026-07-08T00:00:00Z'),
        phrase: { tag: 'filler', sortOrder: 0 },
      },
    ]);

    const manifest = await getClipManifest('google');

    expect(manifest.voiceId).toBe('Puck');
    expect(mockPrisma.voiceClip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ voiceId: 'Puck' }) })
    );
    expect(manifest.clips).toEqual([
      expect.objectContaining({ phraseId: 'p1', tag: 'filler', durationMs: 900 }),
    ]);
  });

  it('returns an EMPTY manifest (never another voice) when the provider has no target', async () => {
    configureProviders({ google: new Error('unconfigured') });
    resolveAliasOrModelId.mockResolvedValue({ provider: 'google', modelId: 'gemini-tts' });

    const manifest = await getClipManifest('google');

    expect(manifest).toMatchObject({ provider: 'google', voiceId: null, clips: [] });
    expect(mockPrisma.voiceClip.findMany).not.toHaveBeenCalled();
  });

  it('still returns clips when tool-latency stats fail (manifest continues)', async () => {
    configureProviders();
    resolveAliasOrModelId.mockResolvedValue({ provider: 'google', modelId: 'gemini-tts' });
    mockPrisma.$queryRaw.mockRejectedValue(new Error('stats table busy'));
    mockPrisma.voiceClip.findMany.mockResolvedValue([]);

    const manifest = await getClipManifest('openai');
    expect(manifest.voiceId).toBe('alloy');
    expect(manifest.toolLatencies).toEqual({});
  });
});
