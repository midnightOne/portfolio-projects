/**
 * D50 clip audio (ai-assistant 9b) — stable per-(voice, phrase) address that
 * 302s to the current CDN asset (media pipeline; audio rides Cloudinary's
 * `video` resource type). The manifest hands clients the CDN URL directly;
 * this route exists for stable links (admin preview, external references)
 * that shouldn't couple to the provider's URL shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClipUrl } from '@/lib/ai/voice-clips';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const voiceId = searchParams.get('voiceId');
  const phraseId = searchParams.get('phraseId');
  if (!voiceId || !phraseId) {
    return NextResponse.json({ success: false, error: 'voiceId and phraseId are required' }, { status: 400 });
  }

  try {
    const url = await getClipUrl(voiceId, phraseId);
    if (!url) {
      return NextResponse.json({ success: false, error: 'Clip not found' }, { status: 404 });
    }
    return NextResponse.redirect(url, {
      status: 302,
      // The redirect target is versioned; cache the mapping only briefly.
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) {
    console.error('[voice-clips/audio] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve clip' }, { status: 500 });
  }
}
