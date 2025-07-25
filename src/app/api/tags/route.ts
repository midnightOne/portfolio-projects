/**
 * Tags API - GET /api/tags
 * Fast endpoint for fetching all available tags
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';

export async function GET(request: NextRequest) {
  try {
    // Fetch all tags with project count
    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
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
      orderBy: {
        name: 'asc'
      }
    });

    // Filter out tags with no published projects
    const tagsWithProjects = tags.filter(tag => tag._count.projects > 0);

    const response = NextResponse.json(createApiSuccess(tagsWithProjects));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
} 