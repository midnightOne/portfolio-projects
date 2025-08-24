import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Fetch project summaries
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 50 // Limit to 50 most recent projects for sidebar
    });

    return NextResponse.json({
      success: true,
      data: projects
    });

  } catch (error) {
    console.error('Error fetching project summaries:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to fetch project summaries',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}