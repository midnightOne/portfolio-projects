/**
 * Admin API endpoints for abuse detection configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { abuseDetector } from '@/lib/services/ai/abuse-detector';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { z } from 'zod';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

const AbuseDetectionConfigSchema = z.object({
  enableAIAnalysis: z.boolean(),
  spamThreshold: z.number().int().min(1).max(10),
  inappropriateThreshold: z.number().int().min(1).max(10),
  maxContentLength: z.number().int().min(1000).max(100000),
  enablePatternMatching: z.boolean(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const config = abuseDetector.getConfig();

    return NextResponse.json(createApiSuccess(config));

  } catch (error) {
    console.error('Failed to get abuse detection config:', error);
    return NextResponse.json(
      createApiError(
        'CONFIG_GET_ERROR',
        'Failed to retrieve abuse detection configuration',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = AbuseDetectionConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Invalid configuration data',
          { errors: validation.error.errors }
        ),
        { status: 400 }
      );
    }

    // Update the abuse detector configuration
    abuseDetector.updateConfig(validation.data);

    // In a real implementation, you might want to persist this to database
    // For now, the configuration is stored in memory

    return NextResponse.json(createApiSuccess({
      updated: true,
      config: abuseDetector.getConfig(),
    }));

  } catch (error) {
    console.error('Failed to update abuse detection config:', error);
    return NextResponse.json(
      createApiError(
        'CONFIG_UPDATE_ERROR',
        'Failed to update abuse detection configuration',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}