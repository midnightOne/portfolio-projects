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

  // OPTIMIZED: Break complex query into parallel simple queries using new indexes
  const [projects, totalCount] = await Promise.all([
    // Main query: Just projects + tags (using new _ProjectTags indexes)
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
          // Include tags using optimized relationship
          tags: {
            select: {
              id: true,
              name: true,
              color: true
            },
            take: 5
          },
          // Include thumbnail image only - lightweight  
          thumbnailImage: {
            select: {
              id: true,
              url: true,
              thumbnailUrl: true,
              altText: true,
              width: true,
              height: true
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
    // Count query: Use optimized index
    profileQuery(
      () => prisma.project.count({ where }),
      'projects.count',
      { where }
    ),
  ]);

  // Get project IDs for efficient batch queries
  const projectIds = (projects as any[]).map((p: any) => p.id);

  // PARALLEL batch queries for related data using new indexes
  const [mediaItems, externalLinks, downloadableFiles, itemCounts] = await Promise.all([
    // Media items for thumbnails (using new index)
    profileQuery(
      () => prisma.mediaItem.findMany({
        where: { 
          projectId: { in: projectIds },
          type: 'IMAGE'
        },
        select: {
          id: true,
          projectId: true,
          url: true,
          thumbnailUrl: true,
          altText: true
        },
        orderBy: { displayOrder: 'asc' }
      }),
      'mediaItems.batchFallback',
      { projectIds }
    ),
    // External links (using new index)  
    profileQuery(
      () => prisma.externalLink.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          id: true,
          projectId: true,
          url: true,
          label: true,
          order: true
        },
        orderBy: { order: 'asc' }
      }),
      'externalLinks.batch',
      { projectIds }
    ),
    // Downloadable files (using new index)
    profileQuery(
      () => prisma.downloadableFile.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          id: true,
          projectId: true,
          filename: true,
          fileSize: true,
          uploadDate: true
        },
        orderBy: { uploadDate: 'desc' }
      }),
      'downloadableFiles.batch',
      { projectIds }
    ),
    // Counts in a single aggregation query
    profileQuery(
      () => prisma.$queryRaw`
        SELECT 
          p.id as "projectId",
          COUNT(DISTINCT m.id) as "mediaCount",
          COUNT(DISTINCT e.id) as "externalLinksCount", 
          COUNT(DISTINCT d.id) as "downloadableFilesCount"
        FROM projects p
        LEFT JOIN media_items m ON p.id = m."projectId"
        LEFT JOIN external_links e ON p.id = e."projectId"
        LEFT JOIN downloadable_files d ON p.id = d."projectId"
        WHERE p.id = ANY(${projectIds})
        GROUP BY p.id
      `,
      'projects.batchCounts',
      { projectIds }
    )
  ]);

  // Group parallel query results by projectId for efficient lookup
  const mediaByProject = new Map();
  const linksByProject = new Map();
  const filesByProject = new Map();
  const countsByProject = new Map();

  (mediaItems as any[]).forEach((item: any) => {
    if (!mediaByProject.has(item.projectId)) {
      mediaByProject.set(item.projectId, []);
    }
    mediaByProject.get(item.projectId).push(item);
  });

  (externalLinks as any[]).forEach((link: any) => {
    if (!linksByProject.has(link.projectId)) {
      linksByProject.set(link.projectId, []);
    }
    linksByProject.get(link.projectId).push(link);
  });

  (downloadableFiles as any[]).forEach((file: any) => {
    if (!filesByProject.has(file.projectId)) {
      filesByProject.set(file.projectId, []);
    }
    filesByProject.get(file.projectId).push(file);
  });

  (itemCounts as any[]).forEach((count: any) => {
    countsByProject.set(count.projectId, {
      mediaItems: parseInt(count.mediaCount) || 0,
      externalLinks: parseInt(count.externalLinksCount) || 0,  
      downloadableFiles: parseInt(count.downloadableFilesCount) || 0
    });
  });

  // Transform data for response - combine parallel query results
  const enrichedProjects = (projects as any[]).map((project: any) => {
    const projectMedia = mediaByProject.get(project.id) || [];
    const projectLinks = linksByProject.get(project.id) || [];
    const projectFiles = filesByProject.get(project.id) || [];
    const projectCounts = countsByProject.get(project.id) || { mediaItems: 0, externalLinks: 0, downloadableFiles: 0 };

    return {
      ...project,
      // Use thumbnail or fallback to first media item
      thumbnailImage: project.thumbnailImage || (projectMedia[0] ? {
        id: projectMedia[0].id,
        url: projectMedia[0].url,
        thumbnailUrl: projectMedia[0].thumbnailUrl,
        altText: projectMedia[0].altText,
        width: null,
        height: null
      } : null),
      // Add related data from parallel queries
      mediaItems: projectMedia.slice(0, 1), // Just first item for fallback
      externalLinks: projectLinks.slice(0, 2), // Limit for card display
      downloadableFiles: projectFiles.slice(0, 2), // Limit for card display
      _count: projectCounts
    };
  });

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