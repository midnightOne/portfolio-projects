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
    const logicalIdMap = new Map<string, string>(); // Map logical chunkId to database UUID
    const rootNodes: TreeNode[] = [];

    // First pass: create all nodes and build logical ID map
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
      // Store logical chunkId mapping for legacy parent resolution
      logicalIdMap.set(chunk.chunkId, chunk.id);
    }

    // Second pass: build hierarchy (with legacy logical ID support)
    for (const chunk of chunks) {
      const node = chunkMap.get(chunk.id);
      if (!node) continue;

      if (chunk.parentChunkId) {
        // Try to find parent by database UUID first, then by logical chunkId (for legacy data)
        let parent = chunkMap.get(chunk.parentChunkId);
        
        if (!parent && logicalIdMap.has(chunk.parentChunkId)) {
          // Legacy: parentChunkId is a logical ID (like 'metadata'), resolve to database UUID
          const parentDbId = logicalIdMap.get(chunk.parentChunkId);
          if (parentDbId) {
            parent = chunkMap.get(parentDbId);
            console.log(`[Tree API] Resolved legacy parent "${chunk.parentChunkId}" to database UUID for chunk ${chunk.chunkId}`);
          }
        }
        
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, add to root (orphaned chunk)
          console.warn(`[Tree API] Orphaned chunk ${chunk.chunkId} (tier ${chunk.tier}), parent "${chunk.parentChunkId}" not found`);
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

    // Return T0 as root, or create a wrapper if we have orphaned chunks
    if (rootNodes.length === 0) {
      // No chunks at all
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
    } else if (rootNodes.length === 1) {
      // Single root (T0) - correct hierarchy
      return NextResponse.json(rootNodes[0]);
    } else {
      // Multiple root nodes - likely data corruption or orphaned chunks
      // Create a temporary wrapper for display
      console.warn(`[Tree API] Found ${rootNodes.length} root nodes, expected 1. This indicates orphaned chunks.`);
      return NextResponse.json({
        chunkId: 'root',
        tier: -1,
        title: 'Project Root (Multiple Roots Detected)',
        contentPreview: `⚠️ Found ${rootNodes.length} root nodes. This may indicate data corruption or orphaned chunks that need parent resolution.`,
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
        metadata: { warning: 'multiple_roots', rootCount: rootNodes.length },
        children: rootNodes
      });
    }
  } catch (error) {
    console.error('Error fetching semantic tree:', error);
    return NextResponse.json(
      { error: 'Failed to fetch semantic tree' },
      { status: 500 }
    );
  }
}
