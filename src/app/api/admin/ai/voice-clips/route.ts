/**
 * D50 clip phrase management (ai-assistant 9b.2) — admin CRUD over the
 * phrase script. Clip GENERATION spends TTS tokens and lives in the
 * gateway-wrapped sibling route ./regenerate.
 *
 * GET    → { phrases, clips: per-voice status }
 * PUT    { id, text, tag, enabled?, sortOrder? } → upsert a phrase
 * DELETE ?id= → remove a phrase (cascades to its clips)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listPhrases, getClipTargets, deletePhraseClipAssets } from '@/lib/ai/voice-clips';

/** Categories wired to client triggers today; custom categories are allowed
 *  (owner, 2026-07-08) and become playable when a trigger (e.g. a D47 node
 *  filler set) references them. */
const TRIGGER_TAGS = ['filler', 'disruption', 'resume_failed', 'greeting'] as const;
const TAG_PATTERN = /^[a-z0-9_]{3,40}$/;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const [phrases, clips, targets] = await Promise.all([
      listPhrases(),
      prisma.voiceClip.findMany({
        select: { voiceId: true, phraseId: true, provider: true, modelId: true, updatedAt: true, text: true },
        orderBy: { updatedAt: 'desc' },
      }),
      getClipTargets(),
    ]);
    return NextResponse.json({
      success: true,
      phrases,
      targets,
      clips: clips.map((c) => ({
        voiceId: c.voiceId,
        phraseId: c.phraseId,
        provider: c.provider,
        modelId: c.modelId,
        updatedAt: c.updatedAt,
        /** True when the phrase text changed since this clip was rendered. */
        stale: phrases.find((p) => p.id === c.phraseId)?.text !== c.text,
      })),
    });
  } catch (error) {
    console.error('[admin/voice-clips] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load clip phrases' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const tag = typeof body.tag === 'string' ? body.tag : '';
    if (!/^[a-z0-9_-]{3,60}$/.test(id)) {
      return NextResponse.json({ success: false, error: 'id must be a 3–60 char slug (a-z0-9_-)' }, { status: 400 });
    }
    if (!text || text.length > 300) {
      return NextResponse.json({ success: false, error: 'text is required (max 300 chars)' }, { status: 400 });
    }
    if (!TAG_PATTERN.test(tag)) {
      return NextResponse.json(
        { success: false, error: `tag must be a 3–40 char slug (a-z0-9_); trigger-wired tags: ${TRIGGER_TAGS.join(', ')}` },
        { status: 400 }
      );
    }
    const phrase = await prisma.voiceClipPhrase.upsert({
      where: { id },
      update: { text, tag, enabled: body.enabled !== false, sortOrder: Number(body.sortOrder) || 0 },
      create: { id, text, tag, enabled: body.enabled !== false, sortOrder: Number(body.sortOrder) || 0 },
    });
    return NextResponse.json({ success: true, phrase });
  } catch (error) {
    console.error('[admin/voice-clips] PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save phrase' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    // Clean the CDN assets first (best-effort), then the rows (clips cascade).
    await deletePhraseClipAssets(id);
    await prisma.voiceClipPhrase.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/voice-clips] DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete phrase' }, { status: 500 });
  }
}
