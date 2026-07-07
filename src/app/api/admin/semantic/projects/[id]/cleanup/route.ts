/**
 * API Route: Semantic Content Cleanup
 * DELETE /api/admin/semantic/projects/[id]/cleanup
 * 
 * Completely removes all semantic content for a project to allow fresh start.
 * This is a destructive operation that cannot be undone.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    console.log(`[SemanticCleanup] Starting cleanup for project: ${projectId}`);

    // Get project to find the slug
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true, title: true }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log(`[SemanticCleanup] Found project: ${project.title} (${project.slug})`);

    // Find the content entity for this project
    const contentEntity = await prisma.contentEntity.findUnique({
      where: {
        entityType_slug: {
          entityType: 'PROJECT',
          slug: project.slug
        }
      },
      select: { id: true }
    });

    if (!contentEntity) {
      console.log(`[SemanticCleanup] No content entity found for project ${projectId}`);
      return NextResponse.json({
        message: 'No semantic content found for this project',
        deletedChunks: 0,
        deletedEntities: 0
      });
    }

    console.log(`[SemanticCleanup] Found content entity: ${contentEntity.id}`);

    // Count chunks before deletion
    const chunkCount = await prisma.contextChunk.count({
      where: { entityId: contentEntity.id }
    });

    console.log(`[SemanticCleanup] Found ${chunkCount} chunks to delete`);

    // Delete all context chunks for this entity
    const deletedChunks = await prisma.contextChunk.deleteMany({
      where: { entityId: contentEntity.id }
    });

    console.log(`[SemanticCleanup] Deleted ${deletedChunks.count} chunks`);

    // Delete the content entity
    const deletedEntity = await prisma.contentEntity.delete({
      where: { id: contentEntity.id }
    });

    console.log(`[SemanticCleanup] Deleted content entity: ${deletedEntity.id}`);

    // Clean up any semantic operations for this project
    const operationsDeleted = await prisma.semanticOperation.deleteMany({
      where: { projectId }
    });

    console.log(`[SemanticCleanup] Deleted ${operationsDeleted.count} semantic operations`);

    const result = {
      message: 'Semantic content cleaned up successfully',
      projectId,
      projectSlug: project.slug,
      deletedChunks: deletedChunks.count,
      deletedEntities: 1,
      deletedOperations: operationsDeleted.count
    };

    console.log(`[SemanticCleanup] Cleanup completed:`, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error cleaning up semantic content:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup semantic content',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}