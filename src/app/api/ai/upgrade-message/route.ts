import { NextRequest, NextResponse } from 'next/server';
import { publicAccessManager, AIFeature } from '@/lib/services/ai/public-access-manager';
import { z } from 'zod';

const UpgradeMessageSchema = z.object({
  feature: z.enum(['chat_interface', 'voice_ai', 'job_analysis', 'advanced_navigation', 'file_upload']),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feature } = UpgradeMessageSchema.parse(body);

    const upgradeMessage = await publicAccessManager.getUpgradeMessage(feature as AIFeature);

    return NextResponse.json(upgradeMessage);
  } catch (error) {
    console.error('Upgrade message error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get upgrade message' },
      { status: 500 }
    );
  }
}