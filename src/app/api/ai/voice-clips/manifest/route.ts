/**
 * D50 clip manifest (ai-assistant 9b) — public read, no cost, no secrets:
 * the client clip player loads this to know which clips exist for the ACTIVE
 * session provider's configured voice (strict voice match — an empty manifest
 * beats a wrong-voice clip). Same read-only class as /api/ai/voice-config.
 *
 * GET ?provider=openai|google|cascade → { provider, voiceId, clips }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClipManifest } from '@/lib/ai/voice-clips';

const PROVIDERS = ['openai', 'google', 'cascade'] as const;

export async function GET(request: NextRequest) {
  const provider = new URL(request.url).searchParams.get('provider') ?? '';
  if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    return NextResponse.json(
      { success: false, error: `provider must be one of: ${PROVIDERS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const manifest = await getClipManifest(provider);
    return NextResponse.json(
      { success: true, ...manifest },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error) {
    console.error('[voice-clips/manifest] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load clip manifest' }, { status: 500 });
  }
}
