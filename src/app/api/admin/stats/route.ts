import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project statistics
    const [
      totalProjects,
      publishedProjects,
      draftProjects,
      totalMediaFiles,
      totalViewsResult
    ] = await Promise.all([
      // Total projects count
      prisma.project.count(),
      
      // Published projects count
      prisma.project.count({
        where: { status: 'PUBLISHED' }
      }),
      
      // Draft projects count
      prisma.project.count({
        where: { status: 'DRAFT' }
      }),
      
      // Total media files count
      prisma.mediaItem.count(),
      
      // Total views sum
      prisma.project.aggregate({
        _sum: {
          viewCount: true
        }
      })
    ]);

    const stats = {
      totalProjects,
      publishedProjects,
      draftProjects,
      totalMediaFiles,
      totalViews: totalViewsResult._sum.viewCount || 0
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
} 