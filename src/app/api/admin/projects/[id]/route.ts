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
    const { 
      title, 
      description, 
      briefOverview, 
      articleContent, 
      articleContentJson,
      contentType,
      thumbnailImageId,
      tags,
      status,
      visibility,
      workDate
    } = updates;

    // Update project basic info
    const project = await prisma.project.update({
      where: { id },
      data: {
        title,
        description,
        briefOverview,
        status: status || undefined,
        visibility: visibility || undefined,
        workDate: workDate ? new Date(workDate) : undefined,
        thumbnailImageId: thumbnailImageId !== undefined ? thumbnailImageId : undefined,
        updatedAt: new Date(),
        // Update tags if provided
        ...(tags && {
          tags: {
            set: [], // Clear existing tags
            connectOrCreate: tags.map((tagName: string) => ({
              where: { name: tagName },
              create: { name: tagName }
            }))
          }
        })
      }
    });

    // Update article content if provided
    if (articleContent !== undefined || articleContentJson !== undefined) {
      await prisma.articleContent.upsert({
        where: { projectId: id },
        update: {
          content: articleContent || '',
          jsonContent: articleContentJson || null,
          contentType: contentType || 'json',
          updatedAt: new Date()
        },
        create: {
          projectId: id,
          content: articleContent || '',
          jsonContent: articleContentJson || null,
          contentType: contentType || 'json'
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, title: true, slug: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Clean up semantic and vector indexes before deleting the project
    console.log(`Cleaning up indexes for project: ${project.title} (${id})`);
    
    // 1. Delete context chunks (semantic search data)
    const deletedChunks = await prisma.$executeRaw`
      DELETE FROM context_chunks 
      WHERE entity_id = ${id} OR project_index_id = ${id}
    `;
    
    // 2. Delete from content_entities if it exists
    const deletedEntities = await prisma.$executeRaw`
      DELETE FROM content_entities 
      WHERE id = ${id} OR slug = ${project.slug}
    `;
    
    // 3. Delete project AI index (this should cascade automatically, but let's be explicit)
    const deletedAIIndex = await prisma.$executeRaw`
      DELETE FROM project_ai_index 
      WHERE "projectId" = ${id}
    `;

    console.log(`Cleanup results - Chunks: ${deletedChunks}, Entities: ${deletedEntities}, AI Index: ${deletedAIIndex}`);

    // Delete project and all related data (cascade delete)
    // Prisma will handle the cascade deletion based on the schema relationships
    await prisma.project.delete({
      where: { id }
    });

    return NextResponse.json({ 
      message: 'Project and all indexes deleted successfully',
      deletedProject: {
        id: project.id,
        title: project.title,
        slug: project.slug
      },
      indexCleanup: {
        contextChunks: deletedChunks,
        contentEntities: deletedEntities,
        aiIndex: deletedAIIndex
      }
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    
    // Check if it's a foreign key constraint error
    if (error instanceof Error && error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        { error: 'Cannot delete project: it has associated data that must be removed first' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}