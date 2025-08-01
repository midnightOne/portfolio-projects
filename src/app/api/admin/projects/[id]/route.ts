import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tags: true,
        mediaItems: true,
        articleContent: true,
        externalLinks: true,
        downloadableFiles: true,
        interactiveExamples: true,
        carousels: { include: { images: { include: { mediaItem: true } } } },
        thumbnailImage: true,
        metadataImage: true
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Handle BigInt serialization for fileSize fields
    const serializedProject = JSON.parse(JSON.stringify(project, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));

    return NextResponse.json(serializedProject);
  } catch (error) {
    console.error('Error fetching project:', error);
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
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const updates = await request.json();
    const { title, description, briefOverview, articleContent, thumbnailImageId } = updates;

    // Update project basic info
    const project = await prisma.project.update({
      where: { id },
      data: {
        title,
        description,
        briefOverview,
        thumbnailImageId: thumbnailImageId !== undefined ? thumbnailImageId : undefined,
        updatedAt: new Date()
      }
    });

    // Update article content if provided
    if (articleContent !== undefined) {
      await prisma.articleContent.upsert({
        where: { projectId: id },
        update: {
          content: articleContent,
          updatedAt: new Date()
        },
        create: {
          projectId: id,
          content: articleContent
        }
      });
    }

    // Fetch updated project with relations
    const updatedProject = await prisma.project.findUnique({
      where: { id },
      include: {
        tags: true,
        mediaItems: true,
        articleContent: true,
        externalLinks: true,
        downloadableFiles: true,
        interactiveExamples: true,
        carousels: { include: { images: { include: { mediaItem: true } } } },
        thumbnailImage: true,
        metadataImage: true
      }
    });

    // Handle BigInt serialization for fileSize fields
    const serializedUpdatedProject = JSON.parse(JSON.stringify(updatedProject, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));

    return NextResponse.json(serializedUpdatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}