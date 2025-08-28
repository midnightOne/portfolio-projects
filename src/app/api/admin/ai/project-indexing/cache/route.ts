/**
 * Project Indexing Cache Management API - DELETE /api/admin/ai/project-indexing/cache
 * Manages project indexing cache for admin operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { projectIndexer } from '@/lib/services/project-indexer';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

async function cacheHandler(request: NextRequest) {
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

    if (request.method === 'DELETE') {
      // Clear all cache
      const statsBefore = projectIndexer.getCacheStats();
      projectIndexer.clearAllCache();
      const statsAfter = projectIndexer.getCacheStats();

      const result = {
        cleared: statsBefore.size,
        remaining: statsAfter.size,
        message: `Cleared ${statsBefore.size} cached indexes`
      };

      const response = NextResponse.json(createApiSuccess(result));
      return addCorsHeaders(response);
    }

    if (request.method === 'GET') {
      // Get cache statistics
      const stats = projectIndexer.getCacheStats();
      const response = NextResponse.json(createApiSuccess(stats));
      return addCorsHeaders(response);
    }

    return NextResponse.json(
      createApiError(
        'METHOD_NOT_ALLOWED',
        'Method not allowed',
        null,
        request.url
      ),
      { status: 405 }
    );

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const DELETE = withPerformanceTracking(cacheHandler);
export const GET = withPerformanceTracking(cacheHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}