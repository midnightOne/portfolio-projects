/**
 * Project Indexing Summary API - GET /api/admin/ai/project-indexing/summary
 * Provides summary of all project indexes for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/database/connection';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

async function summaryHandler(request: NextRequest) {
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

    // Get project indexes summary using Prisma
    const projectIndexes = await prisma.projectAIIndex.findMany({
      where: {
        project: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC'
        }
      },
      include: {
        project: {
          select: {
            title: true,
            slug: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 50
    });

    // Transform the data
    const summary = projectIndexes.map(index => ({
      projectId: index.projectId,
      title: index.project.title,
      slug: index.project.slug,
      lastUpdated: index.updatedAt.toISOString(),
      sectionsCount: index.sectionsCount,
      mediaCount: index.mediaCount,
      keywords: Array.isArray(index.keywords) ? index.keywords : JSON.parse(index.keywords as string || '[]'),
      topics: Array.isArray(index.topics) ? index.topics : JSON.parse(index.topics as string || '[]'),
      technologies: Array.isArray(index.technologies) ? index.technologies : JSON.parse(index.technologies as string || '[]'),
      contentHash: index.contentHash || ''
    }));

    const response = NextResponse.json(createApiSuccess(summary));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const GET = withPerformanceTracking(summaryHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}