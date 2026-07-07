/**
 * IP whitelist / exceptions admin API (owner request, 2026-07-07)
 *
 * GET    → list exceptions
 * POST   → { ipAddress, note? } add exception (also lifts any existing block)
 * DELETE → ?ipAddress=… remove exception
 *
 * Whitelisted IPs are never blacklisted and violations against them are
 * ignored (enforced in blacklist-manager, which every blocker consults).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { blacklistManager } from '@/lib/services/ai/blacklist-manager';

const IP_PATTERN = /^[0-9a-fA-F.:]{3,45}$/;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') return null;
  return session.user as { email?: string };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const entries = await blacklistManager.getWhitelist();
  return NextResponse.json({ success: true, data: entries });
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: { ipAddress?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const ipAddress = body.ipAddress?.trim();
  if (!ipAddress || !IP_PATTERN.test(ipAddress)) {
    return NextResponse.json({ success: false, error: 'A valid IP address is required' }, { status: 400 });
  }

  const entry = await blacklistManager.addToWhitelist(
    ipAddress,
    typeof body.note === 'string' ? body.note.slice(0, 500) : undefined,
    user.email
  );
  return NextResponse.json({ success: true, data: entry }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const ipAddress = request.nextUrl.searchParams.get('ipAddress')?.trim();
  if (!ipAddress) {
    return NextResponse.json({ success: false, error: 'ipAddress query param required' }, { status: 400 });
  }

  const removed = await blacklistManager.removeFromWhitelist(ipAddress);
  return NextResponse.json({ success: true, removed });
}
