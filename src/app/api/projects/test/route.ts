/**
 * Test endpoint for projects API
 * GET /api/projects/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { handleApiError } from '@/lib/utils/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Test database connection
    const projectCount = await prisma.project.count();
    
    // Test basic project query
    const projects = await prisma.project.findMany({
      take: 3,
      include: {
        tags: true,
        thumbnailImage: true,
        _count: {
          select: {
            mediaItems: true,
            downloadableFiles: true,
            externalLinks: true,
          },
        },
      },
    });

    const testResults = {
      database: {
        connected: true,
        projectCount,
      },
      endpoints: {
        '/api/projects': 'Available',
        '/api/projects/[slug]': 'Available',
      },
      sampleProjects: projects.map(project => ({
        id: project.id,
        title: project.title,
        slug: project.slug,
        status: project.status,
        visibility: project.visibility,
        tagCount: project.tags.length,
        mediaCount: project._count?.mediaItems || 0,
      })),
    };

    return NextResponse.json(createApiSuccess(testResults));

  } catch (error) {
    return handleApiError(error, request);
  }
}