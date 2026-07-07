import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { publicAccessManager } from '@/lib/services/ai/public-access-manager';

export async function GET(request: NextRequest) {
  try {
    // Admin sessions get the full feature set (2026-07-07, D56): the owner
    // debugging voice on /admin/ai/voice-debug runs the SAME provider code as
    // visitors — the tier decision is made here, server-side, not by a
    // parallel debug path. Matches the gateway, which already treats an admin
    // session as the privileged tier.
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as { role?: string }).role === 'admin') {
      return NextResponse.json({
        accessLevel: 'premium',
        accessMessage: {
          title: 'Admin session',
          message: 'Full AI feature set enabled for the admin session.',
          type: 'info',
        },
      });
    }

    // Get public access level and message
    const accessLevel = await publicAccessManager.determinePublicAccessLevel();
    const accessMessage = await publicAccessManager.getAccessLevelMessage(accessLevel);

    return NextResponse.json({
      accessLevel,
      accessMessage,
    });
  } catch (error) {
    console.error('Public access error:', error);

    return NextResponse.json(
      { error: 'Failed to get public access settings' },
      { status: 500 }
    );
  }
}
