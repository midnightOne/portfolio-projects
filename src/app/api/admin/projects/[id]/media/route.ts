import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication for admin-only operations
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id: projectId } = await params;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch media items for the project
    const mediaItems = await prisma.mediaItem.findMany({
      where: { 
        projectId: projectId 
      },
      orderBy: { 
        createdAt: 'desc' 
      }
    });

    // Handle BigInt serialization for fileSize fields
    const serializedMediaItems = JSON.parse(JSON.stringify(mediaItems, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));

    return NextResponse.json({ 
      success: true,
      mediaItems: serializedMediaItems,
      count: serializedMediaItems.length
    });
  } catch (error) {
    console.error('Get project media error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch project media' 
      },
      { status: 500 }
    );
  }
}