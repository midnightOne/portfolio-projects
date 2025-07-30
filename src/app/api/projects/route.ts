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

  // Add search query with full-text search
  if (params.query) {
    const searchTerms = params.query.trim();
    
    // Use PostgreSQL full-text search if available, fallback to ILIKE
    if (searchTerms.length > 0) {
      // Use fuzzy matching for better UX (full-text search will be handled separately)
      where.OR = [
        {
          title: {
            contains: searchTerms,
            mode: 'insensitive' as const
          }
        },
        {
          description: {
            contains: searchTerms,
            mode: 'insensitive' as const
          }
        },
        {
          briefOverview: {
            contains: searchTerms,
            mode: 'insensitive' as const
          }
        },
        // Search in tags as well
        {
          tags: {
            some: {
              name: {
                contains: searchTerms,
                mode: 'insensitive' as const
              }
            }
          }
        }
      ];
    }
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
      // Sort by workDate first, then createdAt as fallback
      orderBy = [
        { workDate: params.sortOrder },
        { createdAt: params.sortOrder }
      ];
      break;
    case 'title':
      orderBy = { title: params.sortOrder };
      break;
    case 'popularity':
      // Sort by viewCount first, then createdAt as tiebreaker
      orderBy = [
        { viewCount: params.sortOrder },
        { createdAt: 'desc' }
      ];
      break;
    case 'relevance':
    default:
      // For relevance, use createdAt when not searching
      orderBy = { createdAt: 'desc' };
      break;
  }

  // OPTIMIZED: Back to single efficient query with selective includes using our new indexes
  let projects: any[];
  let totalCount: number;

  // Use full-text search if we have a search query, otherwise use regular query
  if (params.query && params.query.trim().length > 0) {
    const searchTerms = params.query.trim();
    const searchQuery = searchTerms
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => `${term}:*`)
      .join(' & ');

    // Build additional WHERE conditions for tags and other filters
    let additionalWhere = '';
    const queryParams: any[] = [searchQuery];
    let paramIndex = 2;

    if (params.tags && params.tags.length > 0) {
      const tagPlaceholders = params.tags.map(() => `$${paramIndex++}`).join(',');
      additionalWhere += ` AND EXISTS (
        SELECT 1 FROM "_ProjectTags" pt 
        JOIN "tags" t ON pt."B" = t.id 
        WHERE pt."A" = p.id AND t.name IN (${tagPlaceholders})
      )`;
      queryParams.push(...params.tags);
    }

    // Raw SQL query for full-text search with proper ordering
    const searchSql = `
      SELECT p.id, p.title, p.slug, p.description, p."briefOverview", p."workDate", 
             p.status, p.visibility, p."viewCount", p."createdAt", p."updatedAt",
             p."thumbnailImageId", p."metadataImageId",
             ts_rank(p.search_vector, to_tsquery('english', $1)) as search_rank
      FROM projects p
      WHERE p.status = 'PUBLISHED' 
        AND p.visibility = 'PUBLIC'
        AND p.search_vector @@ to_tsquery('english', $1)
        ${additionalWhere}
      ORDER BY search_rank DESC, p."createdAt" DESC
      LIMIT ${params.limit} OFFSET ${skip}
    `;

    const countSql = `
      SELECT COUNT(*) as count
      FROM projects p
      WHERE p.status = 'PUBLISHED' 
        AND p.visibility = 'PUBLIC'
        AND p.search_vector @@ to_tsquery('english', $1)
        ${additionalWhere}
    `;

    const [searchResults, countResult] = await Promise.all([
      profileQuery(
        () => prisma.$queryRawUnsafe(searchSql, ...queryParams),
        'projects.fullTextSearch',
        { query: searchQuery, additionalWhere }
      ),
      profileQuery(
        () => prisma.$queryRawUnsafe(countSql, ...queryParams),
        'projects.fullTextSearchCount',
        { query: searchQuery, additionalWhere }
      )
    ]);

    // Get the project IDs from search results
    const projectIds = (searchResults as any[]).map(p => p.id);
    
    if (projectIds.length > 0) {
      // Fetch full project data for the search results
      projects = await profileQuery(
        () => prisma.project.findMany({
          where: { id: { in: projectIds } },
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
            tags: {
              select: {
                id: true,
                name: true,
                color: true
              },
              take: 5
            },
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
            mediaItems: {
              select: {
                id: true,
                url: true,
                thumbnailUrl: true,
                altText: true
              },
              take: 1,
              orderBy: { displayOrder: 'asc' },
              where: { type: 'IMAGE' }
            },
            externalLinks: {
              select: {
                id: true,
                url: true,
                label: true
              },
              take: 2,
              orderBy: { order: 'asc' }
            },
            downloadableFiles: {
              select: {
                id: true,
                filename: true,
                fileSize: true
              },
              take: 2,
              orderBy: { uploadDate: 'desc' }
            },
            _count: {
              select: {
                mediaItems: true,
                downloadableFiles: true,
                externalLinks: true
              }
            }
          }
        }),
        'projects.findManyByIds',
        { projectIds }
      );

      // Preserve search ranking order
      const projectMap = new Map(projects.map(p => [p.id, p]));
      projects = projectIds.map(id => projectMap.get(id)).filter(Boolean);
    } else {
      projects = [];
    }

    totalCount = parseInt((countResult as any[])[0]?.count || '0');
  } else {
    // Regular query without full-text search
    [projects, totalCount] = await Promise.all([
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
            tags: {
              select: {
                id: true,
                name: true,
                color: true
              },
              take: 5
            },
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
            mediaItems: {
              select: {
                id: true,
                url: true,
                thumbnailUrl: true,
                altText: true
              },
              take: 1,
              orderBy: { displayOrder: 'asc' },
              where: { type: 'IMAGE' }
            },
            externalLinks: {
              select: {
                id: true,
                url: true,
                label: true
              },
              take: 2,
              orderBy: { order: 'asc' }
            },
            downloadableFiles: {
              select: {
                id: true,
                filename: true,
                fileSize: true
              },
              take: 2,
              orderBy: { uploadDate: 'desc' }
            },
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
  }

  // Simple data transformation for response
  const enrichedProjects = (projects as any[]).map((project: any) => ({
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
    // Ensure arrays are never undefined
    mediaItems: project.mediaItems || [],
    externalLinks: project.externalLinks || [],
    downloadableFiles: project.downloadableFiles || []
  }));

  // Create paginated response
  const paginatedResponse = createPaginatedResponse(
    enrichedProjects,
    totalCount as number,
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