/**
 * Admin Individual Project Indexing API - /api/admin/ai/project-indexing/[projectId]
 * Admin endpoint for individual project indexing operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { projectIndexer } from '@/lib/services/project-indexer';
import { checkProjectNeedsReindexing } from '@/lib/utils/project-indexing-integration';
import { prisma } from '@/lib/database/connection';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

interface RouteParams {
  params: {
    projectId: string;
  };
}

async function projectIndexingHandler(request: NextRequest, { params }: RouteParams) {
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

    const { projectId } = params;

    // Verify project exists and is accessible
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        visibility: true,
        updatedAt: true
      }
    });

    if (!project) {
      return NextResponse.json(
        createApiError(
          'NOT_FOUND',
          'Project not found',
          null,
          request.url
        ),
        { status: 404 }
      );
    }

    if (request.method === 'POST') {
      // Index/reindex the project
      const { forceReindex = false } = await request.json();

      if (forceReindex) {
        projectIndexer.clearProjectCache(projectId);
      }

      const startTime = Date.now();
      const projectIndex = await projectIndexer.indexProject(projectId);
      const indexingTime = Date.now() - startTime;

      const response = NextResponse.json(createApiSuccess({
        projectId,
        title: project.title,
        slug: project.slug,
        indexingTime,
        lastUpdated: projectIndex.lastUpdated,
        contentHash: projectIndex.contentHash,
        summary: {
          sectionsCount: projectIndex.sections.length,
          mediaCount: projectIndex.mediaContext.length,
          keywordsCount: projectIndex.keywords.length,
          topicsCount: projectIndex.topics.length,
          technologiesCount: projectIndex.technologies.length
        },
        keywords: projectIndex.keywords.slice(0, 10), // Top 10 keywords
        topics: projectIndex.topics,
        technologies: projectIndex.technologies
      }));
      return addCorsHeaders(response);
    }

    if (request.method === 'GET') {
      // Get project indexing status
      const needsReindexing = await checkProjectNeedsReindexing(projectId);
      const cacheStats = projectIndexer.getCacheStats();
      const isCached = cacheStats.projects.includes(projectId);

      // Try to get existing index data
      let indexData = null;
      try {
        const existingIndex = await prisma.$queryRaw<Array<{
          summary: string;
          keywords: string;
          topics: string;
          technologies: string;
          sections_count: number;
          media_count: number;
          content_hash: string;
          updated_at: Date;
        }>>`
          SELECT summary, keywords, topics, technologies, sections_count, media_count, content_hash, updated_at
          FROM project_ai_index 
          WHERE project_id = ${projectId}
        `;

        if (existingIndex.length > 0) {
          const index = existingIndex[0];
          indexData = {
            lastUpdated: index.updated_at.toISOString(),
            sectionsCount: index.sections_count,
            mediaCount: index.media_count,
            keywordsCount: JSON.parse(index.keywords || '[]').length,
            topicsCount: JSON.parse(index.topics || '[]').length,
            technologiesCount: JSON.parse(index.technologies || '[]').length,
            contentHash: index.content_hash,
            keywords: JSON.parse(index.keywords || '[]').slice(0, 10),
            topics: JSON.parse(index.topics || '[]'),
            technologies: JSON.parse(index.technologies || '[]')
          };
        }
      } catch (error) {
        console.warn('Failed to fetch existing index data:', error);
      }

      const response = NextResponse.json(createApiSuccess({
        projectId,
        title: project.title,
        slug: project.slug,
        status: project.status,
        visibility: project.visibility,
        lastModified: project.updatedAt.toISOString(),
        indexing: {
          needsReindexing,
          isCached,
          hasIndex: indexData !== null,
          indexData
        }
      }));
      return addCorsHeaders(response);
    }

    if (request.method === 'DELETE') {
      // Clear project from cache and optionally from database
      const { clearDatabase = false } = await request.json();

      projectIndexer.clearProjectCache(projectId);

      let databaseCleared = false;
      if (clearDatabase) {
        try {
          await prisma.$executeRaw`
            DELETE FROM project_ai_index WHERE project_id = ${projectId}
          `;
          databaseCleared = true;
        } catch (error) {
          console.warn('Failed to clear database index:', error);
        }
      }

      const response = NextResponse.json(createApiSuccess({
        projectId,
        cacheCleared: true,
        databaseCleared
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

export const POST = withPerformanceTracking(projectIndexingHandler);
export const GET = withPerformanceTracking(projectIndexingHandler);
export const DELETE = withPerformanceTracking(projectIndexingHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}