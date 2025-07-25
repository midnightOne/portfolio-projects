/**
 * Projects API - GET /api/projects
 * Handles listing projects with pagination, filtering, and search
 * PROPERLY OPTIMIZED VERSION - Single query with smart joins
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { SearchProjectsSchema, createApiError, createApiSuccess, createPaginatedResponse } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking, profileQuery } from '@/lib/utils/performance';

// Simple in-memory cache for projects (in production, use Redis)
const projectsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function projectsHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Parse and validate query parameters
  const queryParams = {
    query: searchParams.get('query') || undefined,
    tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
    status: searchParams.get('status') || undefined,
    visibility: searchParams.get('visibility') || undefined,
    sortBy: searchParams.get('sortBy') || 'relevance',
    sortOrder: searchParams.get('sortOrder') || 'desc',
    page: parseInt(searchParams.get('page') || '1'),
    limit: Math.min(parseInt(searchParams.get('limit') || '20'), 50), // Cap at 50 for performance
  };

  // Create cache key
  const cacheKey = JSON.stringify(queryParams);
  const cached = projectsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('🚀 Cache hit for projects query');
    return NextResponse.json(createApiSuccess(cached.data));
  }

  const validation = SearchProjectsSchema.safeParse(queryParams);
  if (!validation.success) {
    return NextResponse.json(
      createApiError(
        'VALIDATION_ERROR',
        'Invalid query parameters',
        validation.error.issues,
        request.url
      ),
      { status: 400 }
    );
  }

  const params = validation.data;
  const skip = (params.page - 1) * params.limit;

  // Build where clause
  const where: any = {
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
  };

  // Add search query
  if (params.query) {
    const searchTerms = params.query.trim();
    where.OR = [
      {
        title: {
          contains: searchTerms,
          mode: 'insensitive'
        }
      },
      {
        description: {
          contains: searchTerms,
          mode: 'insensitive'
        }
      },
      {
        briefOverview: {
          contains: searchTerms,
          mode: 'insensitive'
        }
      }
    ];
  }

  // Add tag filtering
  if (params.tags && params.tags.length > 0) {
    where.tags = {
      some: {
        name: {
          in: params.tags,
        },
      },
    };
  }

  // Build order by clause
  let orderBy: any = {};
  switch (params.sortBy) {
    case 'date':
      orderBy = { workDate: params.sortOrder };
      break;
    case 'title':
      orderBy = { title: params.sortOrder };
      break;
    case 'popularity':
      orderBy = { viewCount: params.sortOrder };
      break;
    case 'relevance':
    default:
      orderBy = { createdAt: 'desc' };
      break;
  }

  // OPTIMIZED: Single query with smart includes - only essential data
  const [projects, totalCount] = await Promise.all([
    profileQuery(
      () => prisma.project.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          briefOverview: true,
          workDate: true,
          status: true,
          visibility: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          // Only include tags - most important for filtering/display
          tags: {
            select: {
              id: true,
              name: true,
              color: true
            },
            take: 5 // Limit tags per project
          },
          // Only thumbnail image - most important for display
          thumbnailImage: {
            select: {
              id: true,
              url: true,
              thumbnailUrl: true,
              altText: true,
              width: true,
              height: true
            }
          },
          // Fallback to first media item if no thumbnail
          mediaItems: {
            select: {
              id: true,
              url: true,
              thumbnailUrl: true,
              altText: true
            },
            take: 1,
            orderBy: { displayOrder: 'asc' },
            where: {
              type: 'IMAGE' // Only images for thumbnails
            }
          },
          // Get essential external links and downloadable files
          externalLinks: {
            select: {
              id: true,
              url: true,
              label: true
            },
            take: 2, // Just a few for the card display
            orderBy: { order: 'asc' }
          },
          downloadableFiles: {
            select: {
              id: true,
              filename: true,
              fileSize: true
            },
            take: 2, // Just a few for the card display
            orderBy: { uploadDate: 'desc' }
          },
          // Get counts efficiently without fetching data
          _count: {
            select: {
              mediaItems: true,
              downloadableFiles: true,
              externalLinks: true
            }
          }
        },
        orderBy,
        skip,
        take: params.limit,
      }),
      'projects.findManyOptimized',
      { where, skip, take: params.limit }
    ),
    profileQuery(
      () => prisma.project.count({ where }),
      'projects.count',
      { where }
    ),
  ]);

  // Transform data for response - add fallback thumbnails
  const enrichedProjects = projects.map(project => ({
    ...project,
    // Use thumbnail or fallback to first media item
    thumbnailImage: project.thumbnailImage || (project.mediaItems?.[0] ? {
      id: project.mediaItems[0].id,
      url: project.mediaItems[0].url,
      thumbnailUrl: project.mediaItems[0].thumbnailUrl,
      altText: project.mediaItems[0].altText,
      width: null,
      height: null
    } : null),
    // Keep mediaItems as empty array instead of undefined to prevent frontend errors
    mediaItems: project.mediaItems || []
  }));

  // Create paginated response
  const paginatedResponse = createPaginatedResponse(
    enrichedProjects,
    totalCount,
    params.page,
    params.limit
  );

  // Cache the result
  projectsCache.set(cacheKey, {
    data: paginatedResponse,
    timestamp: Date.now()
  });

  // Clean up old cache entries (simple cleanup)
  if (projectsCache.size > 100) {
    const entries = Array.from(projectsCache.entries());
    entries.slice(0, 50).forEach(([key]) => projectsCache.delete(key));
  }

  const response = NextResponse.json(createApiSuccess(paginatedResponse));
  return addCorsHeaders(response);
}

export const GET = withPerformanceTracking(projectsHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}