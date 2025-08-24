import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (projectId && projectId !== 'all') {
      where.projectId = projectId;
    }
    if (type && type !== 'all') {
      where.type = type.toUpperCase();
    }

    // Get media items with pagination
    const [mediaItems, totalCount] = await Promise.all([
      prisma.mediaItem.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.mediaItem.count({ where })
    ]);

    console.log(`Found ${mediaItems.length} media items, total count: ${totalCount}`);

    // Convert BigInt to string for JSON serialization and handle null values
    const serializedMediaItems = mediaItems.map(item => ({
      ...item,
      fileSize: item.fileSize ? item.fileSize.toString() : '0',
      width: item.width || null,
      height: item.height || null,
      altText: item.altText || 'Untitled',
      description: item.description || null,
      thumbnailUrl: item.thumbnailUrl || item.url
    }));

    return NextResponse.json({
      success: true,
      data: {
        mediaItems: serializedMediaItems,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get media items error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'FETCH_FAILED', 
          message: 'Failed to fetch media items',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}