/**
 * Admin API endpoints for reflink management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import { createApiSuccess, createApiError, validateApiRequest } from '@/lib/types/api';
import { CreateReflinkSchema } from '@/lib/types/rate-limiting';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const isActive = searchParams.get('active');
    const includeExpired = searchParams.get('includeExpired') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const options = {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      includeExpired,
      limit: Math.min(limit, 100), // Cap at 100
      offset,
    };

    const result = await reflinkManager.listReflinks(options);

    return NextResponse.json(createApiSuccess({
      reflinks: result.reflinks,
      totalCount: result.totalCount,
      hasMore: result.reflinks.length === options.limit,
      pagination: {
        limit: options.limit,
        offset: options.offset,
      },
    }));

  } catch (error) {
    console.error('Failed to list reflinks:', error);
    return NextResponse.json(
      createApiError(
        'REFLINK_LIST_ERROR',
        'Failed to retrieve reflinks',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const body = await req.json();
    console.log('POST /api/admin/ai/reflinks - Request body:', JSON.stringify(body, null, 2));
    
    const validation = validateApiRequest(CreateReflinkSchema, body);
    console.log('Validation result:', {
      success: validation.success,
      errors: validation.errors,
      data: validation.success ? validation.data : null
    });

    if (!validation.success) {
      console.error('Validation failed for reflink creation:', {
        body,
        errors: validation.errors
      });
      
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Invalid reflink data',
          { 
            errors: validation.errors,
            receivedData: body,
            detailedMessage: `Validation failed: ${validation.errors?.join('; ')}`
          }
        ),
        { status: 400 }
      );
    }

    const reflink = await reflinkManager.createReflink(
      {
        ...validation.data!,
        rateLimitTier: validation.data!.rateLimitTier ?? 'STANDARD',
        enableVoiceAI: validation.data!.enableVoiceAI ?? true,
        enableJobAnalysis: validation.data!.enableJobAnalysis ?? true,
        enableAdvancedNavigation: validation.data!.enableAdvancedNavigation ?? true,
      },
      (user as any).email || (user as any).id
    );

    return NextResponse.json(createApiSuccess(reflink), { status: 201 });

  } catch (error: any) {
    console.error('Failed to create reflink:', error);
    
    if (error.name === 'ReflinkError') {
      return NextResponse.json(
        createApiError(
          'REFLINK_ERROR',
          error.message,
          { code: error.code, reason: error.reason }
        ),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError(
        'REFLINK_CREATE_ERROR',
        'Failed to create reflink',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}