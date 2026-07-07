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
      
      // Public projects count (D7: visibility is the only publication axis)
      prisma.project.count({
        where: { visibility: 'PUBLIC' }
      }),
      
      // Private projects count
      prisma.project.count({
        where: { visibility: 'PRIVATE' }
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