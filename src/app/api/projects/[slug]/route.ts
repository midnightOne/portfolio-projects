/**
 * Individual Project API - GET /api/projects/[slug]
 * Handles fetching a single project by slug with full details
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { getRelatedProjects } from '@/lib/utils/project-utils';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';

interface RouteParams {
  params: {
    slug: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = params;

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

    // Fetch the project with all related data
    const project = await prisma.project.findUnique({
      where: {
        slug,
        // Only show published and public projects for public API
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      },
      include: {
        tags: true,
        thumbnailImage: true,
        metadataImage: true,
        mediaItems: {
          orderBy: { displayOrder: 'asc' },
        },
        articleContent: {
          include: {
            embeddedMedia: {
              include: {
                mediaItem: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        },
        interactiveExamples: {
          orderBy: { displayOrder: 'asc' },
        },
        externalLinks: {
          orderBy: { order: 'asc' },
        },
        downloadableFiles: {
          orderBy: { uploadDate: 'desc' },
        },
        carousels: {
          include: {
            images: {
              include: {
                mediaItem: true,
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: {
            mediaItems: true,
            downloadableFiles: true,
            externalLinks: true,
            analytics: true,
          },
        },
      },
    });

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

    // Increment view count asynchronously (don't wait for it)
    prisma.project.update({
      where: { id: project.id },
      data: { viewCount: { increment: 1 } },
    }).catch(error => {
      console.error('Failed to increment view count:', error);
    });

    // Track analytics event asynchronously
    prisma.projectAnalytics.create({
      data: {
        projectId: project.id,
        event: 'VIEW',
        timestamp: new Date(),
        userAgent: request.headers.get('user-agent') || undefined,
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   undefined,
      },
    }).catch(error => {
      console.error('Failed to track analytics:', error);
    });

    // Get related projects based on shared tags
    const allProjects = await prisma.project.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        id: { not: project.id }, // Exclude current project
      },
      include: {
        tags: true,
        thumbnailImage: true,
        _count: {
          select: {
            mediaItems: true,
            downloadableFiles: true,
            externalLinks: true,
            analytics: true,
          },
        },
      },
    });

    const relatedProjects = getRelatedProjects(project, allProjects, 5);

    const response = {
      project,
      relatedProjects,
    };

    const apiResponse = NextResponse.json(createApiSuccess(response));
    return addCorsHeaders(apiResponse);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}