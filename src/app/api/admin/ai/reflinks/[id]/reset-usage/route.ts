/**
 * Admin API endpoint for resetting reflink usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import { createApiSuccess, createApiError } from '@/lib/types/api';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const { id } = await params;
    const reflink = await reflinkManager.resetReflinkUsage(id);

    return NextResponse.json(createApiSuccess({
      reflink,
      message: 'Reflink usage reset successfully'
    }));

  } catch (error: any) {
    console.error('Failed to reset reflink usage:', error);
    
    if (error.name === 'ReflinkError') {
      return NextResponse.json(
        createApiError(
          'REFLINK_ERROR',
          error.message,
          { code: error.code, reason: error.reason }
        ),
        { status: error.reason === 'not_found' ? 404 : 400 }
      );
    }

    return NextResponse.json(
      createApiError(
        'REFLINK_RESET_ERROR',
        'Failed to reset reflink usage',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}