import { NextRequest, NextResponse } from 'next/server';
import { publicAccessManager, AccessLevel } from '@/lib/services/ai/public-access-manager';
import { z } from 'zod';

const AccessLevelSchema = z.enum(['no_access', 'basic', 'limited', 'premium']);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessLevelParam = searchParams.get('accessLevel');

    if (!accessLevelParam) {
      return NextResponse.json(
        { error: 'Access level is required' },
        { status: 400 }
      );
    }

    const accessLevel = AccessLevelSchema.parse(accessLevelParam) as AccessLevel;
    const featureAvailability = await publicAccessManager.getFeatureAvailability(accessLevel);

    return NextResponse.json(featureAvailability);
  } catch (error) {
    console.error('Feature availability error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid access level', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get feature availability' },
      { status: 500 }
    );
  }
}