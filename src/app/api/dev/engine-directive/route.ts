/**
 * Dev-only synthetic engine-directive staging (conversation-engine task A4
 * verification seam; D46/D56 — the drill exercises the PRODUCTION /log
 * directive return path, only the directive's origin is synthetic).
 *
 * 404s in production unconditionally (same gate as /api/dev/fake-mic/tts);
 * outside production requires an admin session or DEV_VERIFICATION=true.
 *
 * POST   { sessionId, directive }  → stage a directive for the session
 * GET    ?sessionId=…              → inspect what is staged
 * DELETE { sessionId }             → clear
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { EngineDirectiveSchema } from '@/lib/ai/engine/types';
import {
  setSyntheticDirective,
  peekSyntheticDirective,
  clearSyntheticDirective,
} from '@/lib/ai/dev/synthetic-engine-directive';

async function devGateOpen(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.DEV_VERIFICATION === 'true') return true;
  const session = await getServerSession(authOptions);
  return (session?.user as { role?: string } | undefined)?.role === 'admin';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await devGateOpen())) {
    return NextResponse.json({ error: 'Admin session or DEV_VERIFICATION=true required' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (typeof sessionId !== 'string' || !sessionId) {
    return NextResponse.json({ error: 'sessionId (string) is required' }, { status: 400 });
  }
  const parsed = EngineDirectiveSchema.safeParse(body?.directive);
  if (!parsed.success) {
    return NextResponse.json({ error: `Invalid directive: ${parsed.error.message}` }, { status: 400 });
  }

  setSyntheticDirective(sessionId, parsed.data);
  return NextResponse.json({ success: true, sessionId, seq: parsed.data.seq });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await devGateOpen())) {
    return NextResponse.json({ error: 'Admin session or DEV_VERIFICATION=true required' }, { status: 403 });
  }
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param required' }, { status: 400 });
  }
  return NextResponse.json({ success: true, directive: peekSyntheticDirective(sessionId) ?? null });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!(await devGateOpen())) {
    return NextResponse.json({ error: 'Admin session or DEV_VERIFICATION=true required' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (typeof sessionId !== 'string' || !sessionId) {
    return NextResponse.json({ error: 'sessionId (string) is required' }, { status: 400 });
  }
  clearSyntheticDirective(sessionId);
  return NextResponse.json({ success: true });
}
