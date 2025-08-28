/**
 * Project Indexing Statistics API - GET /api/admin/ai/project-indexing/stats
 * Provides indexing statistics for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getIndexingStatistics } from '@/lib/utils/project-indexing-integration';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

async function statsHandler(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        createApiError(
          'UNAUTHORIZED',
          'Admin access required',
          null,
          request.url
        ),
        { status: 401 }
      );
    }

    // Get indexing statistics
    const stats = await getIndexingStatistics();

    const response = NextResponse.json(createApiSuccess(stats));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const GET = withPerformanceTracking(statsHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}