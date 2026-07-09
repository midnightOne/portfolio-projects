/**
 * Admin: public access settings knobs (access-and-cost Req 8, D31).
 * GET/PUT the single AIPublicAccessSettings row (tier, Turnstile toggle, limits).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { __clearPublicAccessCache } from '@/lib/ai/public-access';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const row = await prisma.aIPublicAccessSettings.findUnique({ where: { id: 'public' } });
  if (!row) return NextResponse.json({ error: 'AIPublicAccessSettings row missing — run the seed' }, { status: 500 });
  return NextResponse.json(row);
}

const INT_FIELDS = [
  'sessionTtlMinutes',
  'sessionsPerIpPerHour',
  'messagesPerMinute',
  'messagesPerDay',
  'tokensPerDay',
  'maxHistoryMessages',
  'mcpRequestsPerMinute',
  'mcpRequestsPerDay',
] as const;

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.publicTier === 'disabled' || body.publicTier === 'text_chat') data.publicTier = body.publicTier;
  if (typeof body.turnstileEnabled === 'boolean') data.turnstileEnabled = body.turnstileEnabled;
  if (typeof body.mcpEnabled === 'boolean') data.mcpEnabled = body.mcpEnabled;
  if (['openai', 'google', 'cascade'].includes(body.defaultVoiceProvider)) {
    data.defaultVoiceProvider = body.defaultVoiceProvider;
  }
  for (const f of INT_FIELDS) {
    if (typeof body[f] === 'number' && Number.isInteger(body[f]) && body[f] > 0) data[f] = body[f];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const row = await prisma.aIPublicAccessSettings.update({ where: { id: 'public' }, data });
  __clearPublicAccessCache();
  return NextResponse.json(row);
}
