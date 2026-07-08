/**
 * Public voice-config read surface (found 2026-07-07: the pill's adapters ran
 * on serializer fallback defaults in the browser — the admin's
 * VoiceProviderConfig never reached visitors).
 *
 * GET /api/ai/voice-config?provider=openai|elevenlabs|google|cascade
 * → the provider's DEFAULT config (deserialized), sanitized. Contains no
 * secrets by design (D3: keys live in env only; this strips even the env-var
 * names) AND no prompt material (owner, 2026-07-08): `instructions` and
 * `tools` are server-side concerns — both native providers get them injected
 * at token mint, locked out of client reach (Gemini ephemeral-token setup
 * lock; OpenAI client_secrets session config). The client only needs runtime
 * shape: model/voice names, VAD numbers, transcription toggles, caps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientAIModelManager } from '@/lib/voice/ClientAIModelManager';

const PUBLIC_PROVIDERS = ['openai', 'elevenlabs', 'google', 'cascade'] as const;
type PublicProvider = (typeof PUBLIC_PROVIDERS)[number];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') as PublicProvider | null;

  if (!provider || !PUBLIC_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { success: false, error: `provider must be one of: ${PUBLIC_PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const modelManager = getClientAIModelManager();
    const configWithMetadata = await modelManager.getProviderConfig(provider);

    // Strip env-var pointers AND prompt material — the client needs runtime
    // config, not deployment shape or the persona prompt (injected at mint).
    const { apiKeyEnvVar, baseUrlEnvVar, instructions, tools, ...clientConfig } =
      (configWithMetadata.config as unknown as Record<string, unknown>) ?? {};

    return NextResponse.json({
      success: true,
      provider,
      name: configWithMetadata.name,
      isDefault: configWithMetadata.isDefault,
      config: clientConfig,
    });
  } catch (error) {
    console.error(`[voice-config] failed to load ${provider} config:`, error);
    return NextResponse.json(
      { success: false, error: 'Failed to load voice configuration' },
      { status: 500 }
    );
  }
}
