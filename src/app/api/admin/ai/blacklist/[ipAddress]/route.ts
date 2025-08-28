/**
 * Admin API endpoints for individual IP blacklist management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { blacklistManager } from '@/lib/services/ai/blacklist-manager';
import { createApiSuccess, createApiError } from '@/lib/types/api';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { ipAddress: string } }
) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    // Decode IP address (in case it was URL encoded)
    const ipAddress = decodeURIComponent(params.ipAddress);

    const result = await blacklistManager.isBlacklisted(ipAddress);

    if (!result.entry) {
      return NextResponse.json(
        createApiError('NOT_FOUND', 'IP address not found in blacklist'),
        { status: 404 }
      );
    }

    return NextResponse.json(createApiSuccess({
      entry: result.entry,
      blacklisted: result.blacklisted,
      reason: result.reason,
    }));

  } catch (error) {
    console.error('Failed to get blacklist entry:', error);
    return NextResponse.json(
      createApiError(
        'BLACKLIST_GET_ERROR',
        'Failed to retrieve blacklist entry',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { ipAddress: string } }
) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, reason } = body;

    // Decode IP address (in case it was URL encoded)
    const ipAddress = decodeURIComponent(params.ipAddress);

    if (action === 'reinstate') {
      const entry = await blacklistManager.reinstateIP(
        ipAddress,
        (user as any).email || (user as any).id,
        reason
      );

      return NextResponse.json(createApiSuccess({
        entry,
        action: 'reinstated',
      }));
    }

    return NextResponse.json(
      createApiError('INVALID_ACTION', 'Invalid action specified'),
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Failed to update blacklist entry:', error);
    
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
        { status: error.reason === 'not_found' ? 404 : 400 }
      );
    }

    return NextResponse.json(
      createApiError(
        'BLACKLIST_UPDATE_ERROR',
        'Failed to update blacklist entry',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { ipAddress: string } }
) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    // Decode IP address (in case it was URL encoded)
    const ipAddress = decodeURIComponent(params.ipAddress);

    await blacklistManager.removeFromBlacklist(ipAddress);

    return NextResponse.json(createApiSuccess({ 
      deleted: true,
      ipAddress,
    }));

  } catch (error: any) {
    console.error('Failed to remove from blacklist:', error);
    
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
        { status: error.reason === 'not_found' ? 404 : 400 }
      );
    }

    return NextResponse.json(
      createApiError(
        'BLACKLIST_DELETE_ERROR',
        'Failed to remove from blacklist',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}