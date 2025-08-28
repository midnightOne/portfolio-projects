/**
 * Admin Project Indexing API - /api/admin/ai/project-indexing
 * Main admin endpoint for project indexing operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { projectIndexer } from '@/lib/services/project-indexer';
import { indexAllPublicProjects } from '@/lib/utils/project-indexing-integration';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

interface BatchIndexRequest {
  projectIds?: string[];
  forceReindex?: boolean;
  batchSize?: number;
}

async function indexingHandler(request: NextRequest) {
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

    if (request.method === 'POST') {
      const body: BatchIndexRequest = await request.json();
      const { projectIds, forceReindex = false, batchSize = 5 } = body;

      if (projectIds && projectIds.length > 0) {
        // Index specific projects
        const results: Array<{ projectId: string; success: boolean; error?: string }> = [];

        // Clear cache if force reindex
        if (forceReindex) {
          projectIds.forEach(id => projectIndexer.clearProjectCache(id));
        }

        // Process in batches
        for (let i = 0; i < projectIds.length; i += batchSize) {
          const batch = projectIds.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (projectId) => {
            try {
              await projectIndexer.indexProject(projectId);
              return { projectId, success: true };
            } catch (error) {
              return { 
                projectId, 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        const response = NextResponse.json(createApiSuccess({
          results,
          summary: {
            total: projectIds.length,
            successful: successCount,
            failed: failureCount,
            batchSize
          }
        }));
        return addCorsHeaders(response);

      } else {
        // Index all public projects
        const result = await indexAllPublicProjects({
          forceReindex,
          batchSize
        });

        const response = NextResponse.json(createApiSuccess(result));
        return addCorsHeaders(response);
      }
    }

    if (request.method === 'GET') {
      // Get indexing overview
      const cacheStats = projectIndexer.getCacheStats();
      
      const response = NextResponse.json(createApiSuccess({
        cache: cacheStats,
        endpoints: {
          stats: '/api/admin/ai/project-indexing/stats',
          cache: '/api/admin/ai/project-indexing/cache',
          summary: '/api/admin/ai/project-indexing/summary'
        }
      }));
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

export const POST = withPerformanceTracking(indexingHandler);
export const GET = withPerformanceTracking(indexingHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}