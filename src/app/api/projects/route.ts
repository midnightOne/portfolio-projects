/**
 * Projects API - GET /api/projects
 * Handles listing projects with pagination, filtering, and search
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { SearchProjectsSchema, createApiError, createApiSuccess, createPaginatedResponse } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';

export async function GET(request: NextRequest) {
  try {
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
      limit: parseInt(searchParams.get('limit') || '20'),
    };

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
      // Only show published projects for public API (admin endpoints will override this)
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    };

    // Add search query
    if (params.query) {
      where.OR = [
        { title: { contains: params.query, mode: 'insensitive' } },
        { description: { contains: params.query, mode: 'insensitive' } },
        { briefOverview: { contains: params.query, mode: 'insensitive' } },
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
        // For relevance, we'll use creation date as fallback
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Execute queries
    const [projects, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          tags: true,
          thumbnailImage: true,
          metadataImage: true,
          mediaItems: {
            take: 3, // Limit media items for list view
            orderBy: { displayOrder: 'asc' },
          },
          externalLinks: {
            orderBy: { order: 'asc' },
          },
          downloadableFiles: true,
          _count: {
            select: {
              mediaItems: true,
              downloadableFiles: true,
              externalLinks: true,
              analytics: true,
            },
          },
        },
        orderBy,
        skip,
        take: params.limit,
      }),
      prisma.project.count({ where }),
    ]);

    // Create paginated response
    const paginatedResponse = createPaginatedResponse(
      projects,
      totalCount,
      params.page,
      params.limit
    );

    const response = NextResponse.json(createApiSuccess(paginatedResponse));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}