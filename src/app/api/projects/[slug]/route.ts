/**
 * Individual Project API - GET /api/projects/[slug]
 * OPTIMIZED VERSION with smart data fetching and caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking, profileQuery } from '@/lib/utils/performance';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Simple cache for individual projects
const projectDetailCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes for individual projects

function getRelatedProjects(project: any, allProjects: any[], limit: number = 5) {
  if (!project.tags || project.tags.length === 0) {
    return allProjects.slice(0, limit);
  }

  const projectTagNames = project.tags.map((tag: any) => tag.name);
  
  const scored = allProjects.map(p => {
    const sharedTags = p.tags.filter((tag: any) => 
      projectTagNames.includes(tag.name)
    ).length;
    return { project: p, score: sharedTags };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.project);
}

async function projectDetailHandler(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json(
      createApiError(
        'VALIDATION_ERROR',
        'Invalid project slug',
        undefined,
        request.url
      ),
      { status: 400 }
    );
  }

  // Check cache first
  const cached = projectDetailCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`🚀 Cache hit for project: ${slug}`);
    return NextResponse.json(createApiSuccess(cached.data));
  }

  // OPTIMIZED: Fetch project with only essential related data
  const project = await profileQuery(
    () => prisma.project.findUnique({
      where: {
        slug,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      },
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
        
        // Essential relationships with smart limits
        tags: {
          select: {
            id: true,
            name: true,
            color: true
          }
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
        
        metadataImage: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            altText: true,
            width: true,
            height: true
          }
        },

        // Limit media items for performance
        mediaItems: {
          select: {
            id: true,
            type: true,
            url: true,
            thumbnailUrl: true,
            altText: true,
            description: true,
            width: true,
            height: true,
            displayOrder: true
          },
          orderBy: { displayOrder: 'asc' },
          take: 20 // Limit to first 20 media items
        },

        // Article content (but not embedded media for now)
        articleContent: {
          select: {
            id: true,
            content: true,
            jsonContent: true,
            contentType: true,
            createdAt: true,
            updatedAt: true
          }
        },

        // Limit external links
        externalLinks: {
          select: {
            id: true,
            url: true,
            label: true,
            order: true
          },
          orderBy: { order: 'asc' },
          take: 10
        },

        // Limit downloadable files  
        downloadableFiles: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            fileType: true,
            fileSize: true,
            downloadUrl: true,
            description: true,
            uploadDate: true
          },
          orderBy: { uploadDate: 'desc' },
          take: 10
        },

        // Interactive examples (limited)
        interactiveExamples: {
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            url: true,
            embedCode: true,
            fallbackContent: true,
            displayOrder: true
          },
          orderBy: { displayOrder: 'asc' },
          take: 5
        },

        // Count only
        _count: {
          select: {
            mediaItems: true,
            downloadableFiles: true,
            externalLinks: true,
            analytics: true
          }
        }
      },
    }),
    'project.findUnique',
    { slug }
  );

  if (!project) {
    return NextResponse.json(
      createApiError(
        'NOT_FOUND',
        'Project not found',
        undefined,
        request.url
      ),
      { status: 404 }
    );
  }

  // OPTIMIZED: Get related projects with a simpler query (no complex joins)
  const relatedProjects = await profileQuery(
    () => prisma.project.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        id: { not: project.id },
        // Use tag filter for better performance
        ...(project.tags.length > 0 && {
          tags: {
            some: {
              name: {
                in: project.tags.map(tag => tag.name)
              }
            }
          }
        })
      },
      select: {
        id: true,
        title: true,
        slug: true,
        briefOverview: true,
        workDate: true,
        viewCount: true,
        tags: {
          select: {
            id: true,
            name: true,
            color: true
          },
          take: 3
        },
        thumbnailImage: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            altText: true
          }
        },
        _count: {
          select: {
            mediaItems: true
          }
        }
      },
      orderBy: { viewCount: 'desc' }, // Get popular related projects
      take: 8 // Get more than needed, then filter
    }),
    'project.relatedProjects',
    { excludeId: project.id, tagNames: project.tags.map(t => t.name) }
  );

  // Filter and score related projects
  const finalRelatedProjects = getRelatedProjects(project, relatedProjects, 5);

  // OPTIMIZED: Update view count asynchronously (fire and forget)
  prisma.project.update({
    where: { id: project.id },
    data: { viewCount: { increment: 1 } },
  }).catch(error => {
    console.error('Failed to increment view count:', error);
  });

  const responseData = {
    project,
    relatedProjects: finalRelatedProjects,
  };

  // Cache the result
  projectDetailCache.set(slug, {
    data: responseData,
    timestamp: Date.now()
  });

  // Clean up cache if it gets too large
  if (projectDetailCache.size > 50) {
    const entries = Array.from(projectDetailCache.entries());
    entries.slice(0, 25).forEach(([key]) => projectDetailCache.delete(key));
  }

  const apiResponse = NextResponse.json(createApiSuccess(responseData));
  return addCorsHeaders(apiResponse);
}

export const GET = withPerformanceTracking(projectDetailHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}