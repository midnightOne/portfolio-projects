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

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status');
    const visibility = url.searchParams.get('visibility');

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    if (visibility) where.visibility = visibility;

    // Get projects with media count
    const projects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        visibility: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        tags: true,
        _count: {
          select: {
            mediaItems: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    // Get total count for pagination
    const totalCount = await prisma.project.count({ where });

    // Transform projects data
    const projectsWithMediaCount = projects.map(project => ({
      id: project.id,
      title: project.title,
      slug: project.slug,
      status: project.status,
      visibility: project.visibility,
      viewCount: project.viewCount,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      mediaCount: project._count.mediaItems,
      tags: project.tags
    }));

    return NextResponse.json({
      projects: projectsWithMediaCount,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    console.error('Admin projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      briefOverview,
      tags,
      status = 'DRAFT',
      visibility = 'PRIVATE',
      workDate,
      articleContent,
      articleContentJson,
      contentType = 'json'
    } = body;

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug already exists
    const existingProject = await prisma.project.findUnique({
      where: { slug }
    });

    if (existingProject) {
      return NextResponse.json(
        { error: 'A project with this title already exists' },
        { status: 409 }
      );
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        title,
        slug,
        description,
        briefOverview: briefOverview || description.substring(0, 150) + '...',
        status,
        visibility,
        workDate: workDate ? new Date(workDate) : new Date(),
        viewCount: 0,
        tags: {
          connectOrCreate: tags?.map((tagName: string) => ({
            where: { name: tagName },
            create: { name: tagName }
          })) || []
        }
      },
      include: {
        tags: true,
        _count: {
          select: {
            mediaItems: true
          }
        }
      }
    });

    // Create article content if provided
    if (articleContent !== undefined || articleContentJson !== undefined) {
      await prisma.articleContent.create({
        data: {
          projectId: project.id,
          content: articleContent || '',
          jsonContent: articleContentJson || null,
          contentType: contentType
        }
      });
    }

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        slug: project.slug,
        status: project.status,
        visibility: project.visibility,
        viewCount: project.viewCount,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        mediaCount: project._count.mediaItems,
        tags: project.tags
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
} 