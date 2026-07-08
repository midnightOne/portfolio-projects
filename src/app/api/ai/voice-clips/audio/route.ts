/**
 * D50 clip audio (ai-assistant 9b) — public read of a pre-rendered clip.
 * No cost (bytes come from the DB, generated earlier via the admin
 * regenerate action). Cacheable: the manifest busts via the `v` timestamp.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClipAudio } from '@/lib/ai/voice-clips';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get('voiceId');
  const phraseId = searchParams.get('phraseId');
  if (!voiceId || !phraseId) {
    return NextResponse.json({ success: false, error: 'voiceId and phraseId are required' }, { status: 400 });
  }

  try {
    const clip = await getClipAudio(voiceId, phraseId);
    if (!clip) {
      return NextResponse.json({ success: false, error: 'Clip not found' }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(clip.audio), {
      status: 200,
      headers: {
        'Content-Type': clip.contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Last-Modified': clip.updatedAt.toUTCString(),
      },
    });
  } catch (error) {
    console.error('[voice-clips/audio] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load clip' }, { status: 500 });
  }
}
