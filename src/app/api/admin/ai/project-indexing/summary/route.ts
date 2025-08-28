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

    // Get project indexes summary
    const projectIndexes = await prisma.$queryRaw<Array<{
      project_id: string;
      summary: string;
      keywords: string[] | string;
      topics: string[] | string;
      technologies: string[] | string;
      sections_count: number;
      media_count: number;
      content_hash: string;
      updated_at: Date;
      title: string;
      slug: string;
    }>>`
      SELECT 
        pai.project_id,
        pai.summary,
        pai.keywords,
        pai.topics,
        pai.technologies,
        pai.sections_count,
        pai.media_count,
        pai.content_hash,
        pai.updated_at,
        p.title,
        p.slug
      FROM project_ai_index pai
      JOIN projects p ON pai.project_id = p.id
      WHERE p.status = 'PUBLISHED' AND p.visibility = 'PUBLIC'
      ORDER BY pai.updated_at DESC
      LIMIT 50
    `;

    // Transform the data
    const summary = projectIndexes.map(index => ({
      projectId: index.project_id,
      title: (index as any).title,
      slug: (index as any).slug,
      lastUpdated: index.updated_at.toISOString(),
      sectionsCount: index.sections_count,
      mediaCount: index.media_count,
      keywords: Array.isArray(index.keywords) ? index.keywords : JSON.parse(index.keywords || '[]'),
      topics: Array.isArray(index.topics) ? index.topics : JSON.parse(index.topics || '[]'),
      technologies: Array.isArray(index.technologies) ? index.technologies : JSON.parse(index.technologies || '[]'),
      contentHash: index.content_hash
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