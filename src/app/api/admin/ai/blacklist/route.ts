/**
 * Admin API endpoints for IP blacklist management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { blacklistManager } from '@/lib/services/ai/blacklist-manager';
import { createApiSuccess, createApiError, validateApiRequest } from '@/lib/types/api';
import { BlacklistIPSchema } from '@/lib/types/rate-limiting';

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
    const includeReinstated = searchParams.get('includeReinstated') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const options = {
      includeReinstated,
      limit: Math.min(limit, 100), // Cap at 100
      offset,
    };

    const result = await blacklistManager.getBlacklistedIPs(options);

    return NextResponse.json(createApiSuccess({
      entries: result.entries,
      totalCount: result.totalCount,
      hasMore: result.entries.length === options.limit,
      pagination: {
        limit: options.limit,
        offset: options.offset,
      },
    }));

  } catch (error) {
    console.error('Failed to list blacklisted IPs:', error);
    return NextResponse.json(
      createApiError(
        'BLACKLIST_LIST_ERROR',
        'Failed to retrieve blacklisted IPs',
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
    const validation = validateApiRequest(BlacklistIPSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Invalid blacklist data',
          { errors: validation.errors }
        ),
        { status: 400 }
      );
    }

    const entry = await blacklistManager.blacklistIP({
      ...validation.data!,
      violationCount: validation.data!.violationCount ?? 1
    });

    return NextResponse.json(createApiSuccess(entry), { status: 201 });

  } catch (error: any) {
    console.error('Failed to blacklist IP:', error);
    
    if (error.name === 'SecurityViolationError') {
      return NextResponse.json(
        createApiError(
          'SECURITY_VIOLATION_ERROR',
          error.message,
          { 
            reason: error.reason,
            ipAddress: error.ipAddress,
            violationCount: error.violationCount,
          }
        ),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError(
        'BLACKLIST_CREATE_ERROR',
        'Failed to blacklist IP',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}