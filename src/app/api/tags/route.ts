/**
 * Tags API - GET /api/tags
 * Provides all available tags for filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

// Simple cache for tags (they don't change often)
let tagsCache: any = null;
let tagsCacheTime = 0;
const TAGS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function tagsHandler(request: NextRequest) {
  try {
    // Check cache first
    if (tagsCache && Date.now() - tagsCacheTime < TAGS_CACHE_TTL) {
      return NextResponse.json(createApiSuccess(tagsCache));
    }

    // Fetch tags with project counts
    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        _count: {
          select: {
            projects: {
              where: {
                status: 'PUBLISHED',
                visibility: 'PUBLIC'
              }
            }
          }
        }
      },
      orderBy: [
        { name: 'asc' }
      ]
    });

    // Filter out tags with no published projects
    const activeTags = tags
      .filter(tag => tag._count.projects > 0)
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        projectCount: tag._count.projects
      }));

    // Cache the result
    tagsCache = activeTags;
    tagsCacheTime = Date.now();

    const response = NextResponse.json(createApiSuccess(activeTags));
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return handleApiError(error, request);
  }
}

export const GET = withPerformanceTracking(tagsHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}