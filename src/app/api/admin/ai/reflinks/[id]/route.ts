/**
 * Admin API endpoints for individual reflink management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import { createApiSuccess, createApiError, validateApiRequest } from '@/lib/types/api';
import { UpdateReflinkSchema } from '@/lib/types/rate-limiting';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

export async function GET(
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
    const reflink = await reflinkManager.getReflinkById(id);

    if (!reflink) {
      return NextResponse.json(
        createApiError('NOT_FOUND', 'Reflink not found'),
        { status: 404 }
      );
    }

    // Get usage statistics
    const usage = await reflinkManager.getReflinkUsage(id, 30); // Last 30 days

    return NextResponse.json(createApiSuccess({
      reflink,
      usage,
    }));

  } catch (error) {
    console.error('Failed to get reflink:', error);
    return NextResponse.json(
      createApiError(
        'REFLINK_GET_ERROR',
        'Failed to retrieve reflink',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const body = await req.json();
    const validation = validateApiRequest(UpdateReflinkSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Invalid reflink data',
          { errors: validation.errors }
        ),
        { status: 400 }
      );
    }

    const { id } = await params;
    const reflink = await reflinkManager.updateReflink(id, validation.data!);

    return NextResponse.json(createApiSuccess(reflink));

  } catch (error: any) {
    console.error('Failed to update reflink:', error);
    
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
        'REFLINK_UPDATE_ERROR',
        'Failed to update reflink',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    await reflinkManager.deleteReflink(id);

    return NextResponse.json(createApiSuccess({ deleted: true }));

  } catch (error: any) {
    console.error('Failed to delete reflink:', error);
    
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
        'REFLINK_DELETE_ERROR',
        'Failed to delete reflink',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}