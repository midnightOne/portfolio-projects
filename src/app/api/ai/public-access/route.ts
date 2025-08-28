import { NextRequest, NextResponse } from 'next/server';
import { publicAccessManager } from '@/lib/services/ai/public-access-manager';

export async function GET(request: NextRequest) {
  try {
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