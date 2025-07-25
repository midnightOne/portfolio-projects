import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tags: true,
        mediaItems: true,
        _count: {
          select: {
            mediaItems: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        slug: project.slug,
        description: project.description,
        briefOverview: project.briefOverview,
        status: project.status,
        visibility: project.visibility,
        viewCount: project.viewCount,
        workDate: project.workDate?.toISOString(),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        tags: project.tags,
        mediaItems: project.mediaItems,
        mediaCount: project._count.mediaItems
      }
    });
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id } = await params;

    const body = await request.json();
    const {
      title,
      description,
      briefOverview,
      tags,
      status,
      visibility,
      workDate
    } = body;

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id },
      include: { tags: true }
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate new slug if title changed
    let slug = existingProject.slug;
    if (title !== existingProject.title) {
      const newSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check if new slug conflicts with another project
      const slugConflict = await prisma.project.findFirst({
        where: { 
          slug: newSlug,
          id: { not: id }
        }
      });

      if (slugConflict) {
        return NextResponse.json(
          { error: 'A project with this title already exists' },
          { status: 409 }
        );
      }

      slug = newSlug;
    }

    // Update project with transaction
    const updatedProject = await prisma.$transaction(async (tx) => {
      // Update the project
      const project = await tx.project.update({
        where: { id },
        data: {
          title,
          slug,
          description,
          briefOverview: briefOverview || description.substring(0, 150) + '...',
          status,
          visibility,
          workDate: workDate ? new Date(workDate) : existingProject.workDate,
        }
      });

      // Handle tags - disconnect old ones and connect new ones
      await tx.project.update({
        where: { id },
        data: {
          tags: {
            disconnect: existingProject.tags.map(tag => ({ id: tag.id }))
          }
        }
      });

      await tx.project.update({
        where: { id },
        data: {
          tags: {
            connectOrCreate: tags?.map((tagName: string) => ({
              where: { name: tagName },
              create: { name: tagName }
            })) || []
          }
        }
      });

      return project;
    });

    // Fetch updated project with relations
    const finalProject = await prisma.project.findUnique({
      where: { id },
      include: {
        tags: true,
        _count: {
          select: {
            mediaItems: true
          }
        }
      }
    });

    return NextResponse.json({
      project: {
        id: finalProject!.id,
        title: finalProject!.title,
        slug: finalProject!.slug,
        status: finalProject!.status,
        visibility: finalProject!.visibility,
        viewCount: finalProject!.viewCount,
        createdAt: finalProject!.createdAt.toISOString(),
        updatedAt: finalProject!.updatedAt.toISOString(),
        mediaCount: finalProject!._count.mediaItems,
        tags: finalProject!.tags
      }
    });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params in Next.js 15
    const { id } = await params;

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id }
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete project (this will cascade delete related records)
    await prisma.project.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
} 