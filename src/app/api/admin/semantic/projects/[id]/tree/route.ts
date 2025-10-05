/**
 * Semantic Tree View API
 * 
 * Provides hierarchical tree structure for project semantic chunks
 * with tier-based organization (T0 → T1 → T2 → T3)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

interface TreeNode {
  chunkId: string;
  tier: number;
  title: string;
  contentPreview: string;
  tokenCount: number;
  importance: number;
  hasEmbedding: boolean;
  embeddingModel: string | null;
  embeddingGeneratedAt: Date | null;
  manuallyEdited: boolean;
  generationMode: string;
  modifiedBy: string;
  lastModified: Date;
  sectionGroup: string | null;
  parentChunkId: string | null;
  metadata: any;
  children: TreeNode[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // Get project to find its slug
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Find content entity for this project
    const contentEntity = await prisma.contentEntity.findFirst({
      where: {
        entityType: 'PROJECT',
        slug: project.slug
      }
    });

    if (!contentEntity) {
      return NextResponse.json({
        chunkId: 'empty',
        tier: -1,
        title: 'No semantic content',
        contentPreview: 'This project has no semantic chunks yet.',
        tokenCount: 0,
        importance: 0,
        hasEmbedding: false,
        embeddingModel: null,
        embeddingGeneratedAt: null,
        manuallyEdited: false,
        generationMode: 'system',
        modifiedBy: 'system',
        lastModified: new Date(),
        sectionGroup: null,
        parentChunkId: null,
        metadata: {},
        children: []
      });
    }

    // Fetch all chunks for this project using entityId
    const chunks = await prisma.contextChunk.findMany({
      where: { entityId: contentEntity.id },
      orderBy: [
        { tier: 'asc' },
        { sectionStartLine: 'asc' },
        { chunkIndexInSection: 'asc' }
      ],
      select: {
        id: true,
        chunkId: true,
        tier: true,
        title: true,
        content: true,
        tokenCount: true,
        importance: true,
        embeddingGeneratedAt: true,
        embeddingModel: true,
        manuallyEdited: true,
        generationMode: true,
        modifiedBy: true,
        lastModified: true,
        sectionGroup: true,
        parentChunkId: true,
        metadata: true
      }
    });

    if (chunks.length === 0) {
      return NextResponse.json({
        chunkId: 'empty',
        tier: -1,
        title: 'No semantic content',
        contentPreview: 'This project has no semantic chunks yet.',
        tokenCount: 0,
        importance: 0,
        hasEmbedding: false,
        embeddingModel: null,
        embeddingGeneratedAt: null,
        manuallyEdited: false,
        generationMode: 'system',
        modifiedBy: 'system',
        lastModified: new Date(),
        sectionGroup: null,
        parentChunkId: null,
        metadata: {},
        children: []
      });
    }

    // Build tree structure
    const chunkMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // First pass: create all nodes
    for (const chunk of chunks) {
      const node: TreeNode = {
        chunkId: chunk.id,
        tier: chunk.tier,
        title: chunk.title || `T${chunk.tier} Chunk`,
        contentPreview: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
        tokenCount: chunk.tokenCount,
        importance: chunk.importance,
        hasEmbedding: chunk.embeddingGeneratedAt !== null,
        embeddingModel: chunk.embeddingModel,
        embeddingGeneratedAt: chunk.embeddingGeneratedAt,
        manuallyEdited: chunk.manuallyEdited,
        generationMode: chunk.generationMode,
        modifiedBy: chunk.modifiedBy,
        lastModified: chunk.lastModified,
        sectionGroup: chunk.sectionGroup,
        parentChunkId: chunk.parentChunkId,
        metadata: chunk.metadata,
        children: []
      };
      chunkMap.set(chunk.id, node);
    }

    // Second pass: build hierarchy
    for (const chunk of chunks) {
      const node = chunkMap.get(chunk.id);
      if (!node) continue;

      if (chunk.parentChunkId) {
        const parent = chunkMap.get(chunk.parentChunkId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, add to root
          rootNodes.push(node);
        }
      } else {
        // No parent, this is a root node (T0)
        rootNodes.push(node);
      }
    }

    // Sort children by tier and then by section order
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        // For same tier, sort by section group or chunk ID
        if (a.sectionGroup && b.sectionGroup) {
          return a.sectionGroup.localeCompare(b.sectionGroup);
        }
        return a.chunkId.localeCompare(b.chunkId);
      });
      nodes.forEach(node => sortChildren(node.children));
    };

    sortChildren(rootNodes);

    // Return the first root node (should be T0) or all roots if multiple
    const treeRoot = rootNodes.length === 1 ? rootNodes[0] : {
      chunkId: 'root',
      tier: -1,
      title: 'Project Root',
      contentPreview: 'Multiple root nodes found',
      tokenCount: 0,
      importance: 0,
      hasEmbedding: false,
      embeddingModel: null,
      embeddingGeneratedAt: null,
      manuallyEdited: false,
      generationMode: 'system',
      modifiedBy: 'system',
      lastModified: new Date(),
      sectionGroup: null,
      parentChunkId: null,
      metadata: {},
      children: rootNodes
    };

    return NextResponse.json(treeRoot);
  } catch (error) {
    console.error('Error fetching semantic tree:', error);
    return NextResponse.json(
      { error: 'Failed to fetch semantic tree' },
      { status: 500 }
    );
  }
}
