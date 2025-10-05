/**
 * Semantic Chunks API - For PassiveFIDManager F-I-D Context
 * 
 * Provides semantic chunks for a specific project to support F-I-D context generation.
 * This endpoint is consumed by PassiveFIDManager to get semantic content for client-side AI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const includeTiers = searchParams.get('tiers')?.split(',').map(Number) || [1, 2, 3];
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeEmbeddings = searchParams.get('embeddings') === 'true';

    // Find the project entity
    const entity = await prisma.contentEntity.findFirst({
      where: {
        entityType: 'PROJECT',
        OR: [
          { slug: projectId },
          { id: projectId }
        ]
      }
    });

    if (!entity) {
      return NextResponse.json({
        success: false,
        error: `Project not found: ${projectId}`,
        data: []
      }, { status: 404 });
    }

    // Fetch semantic chunks for the project
    const chunks = await prisma.contextChunk.findMany({
      where: {
        entityId: entity.id,
        tier: { in: includeTiers }
      },
      select: {
        id: true,
        chunkId: true,
        tier: true,
        title: true,
        content: true,
        tokenCount: true,
        importance: true,
        importanceSource: true,
        manuallyEdited: true,
        parentChunkId: true,
        rootChunkId: true,
        sectionGroup: true,
        derivation_path: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        // Conditionally include embedding vector
        ...(includeEmbeddings && { embedding_vector: true })
      },
      orderBy: [
        { tier: 'asc' },
        { importance: 'desc' },
        { chunkId: 'asc' }
      ],
      take: limit
    });

    // Transform chunks for F-I-D context consumption
    const semanticChunks = chunks.map(chunk => ({
      id: chunk.id,
      chunkId: chunk.chunkId,
      tier: chunk.tier,
      title: chunk.title,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      importance: chunk.importance || 0.5,
      importanceSource: chunk.importanceSource || 'ai',
      manuallyEdited: chunk.manuallyEdited || false,
      
      // Hierarchical relationships
      parentChunkId: chunk.parentChunkId,
      rootChunkId: chunk.rootChunkId,
      sectionGroup: chunk.sectionGroup,
      derivationPath: chunk.derivation_path,
      
      // Metadata
      metadata: chunk.metadata,
      
      // Timestamps
      createdAt: chunk.createdAt,
      updatedAt: chunk.updatedAt,
      
      // Optional embedding vector
      ...(includeEmbeddings && chunk.embedding_vector ? {
        embedding: Array.from(chunk.embedding_vector as number[])
      } : {})
    }));

    // Calculate tier distribution for metadata
    const tierDistribution = semanticChunks.reduce((acc, chunk) => {
      acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Calculate importance statistics
    const importanceScores = semanticChunks.map(c => c.importance);
    const avgImportance = importanceScores.length > 0 
      ? importanceScores.reduce((sum, score) => sum + score, 0) / importanceScores.length 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        projectId: entity.slug,
        entityId: entity.id,
        chunks: semanticChunks,
        metadata: {
          totalChunks: semanticChunks.length,
          tierDistribution,
          averageImportance: Math.round(avgImportance * 1000) / 1000,
          manuallyEditedCount: semanticChunks.filter(c => c.manuallyEdited).length,
          embeddingsIncluded: includeEmbeddings,
          lastUpdated: chunks.length > 0 ? Math.max(...chunks.map(c => c.updatedAt.getTime())) : null
        }
      }
    });

  } catch (error) {
    console.error('Semantic chunks API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    
    // This endpoint could be used for updating chunk importance scores
    // or triggering regeneration for specific chunks
    const { action, chunkIds, importance } = body;

    if (action === 'updateImportance' && chunkIds && importance !== undefined) {
      // Update importance scores for specified chunks
      const updateResult = await prisma.contextChunk.updateMany({
        where: {
          id: { in: chunkIds },
          entity: {
            entityType: 'PROJECT',
            OR: [
              { slug: projectId },
              { id: projectId }
            ]
          }
        },
        data: {
          importance: Math.max(0, Math.min(1, importance)), // Clamp to 0-1
          importanceSource: 'manual',
          manuallyEdited: true,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          action: 'updateImportance',
          updatedCount: updateResult.count,
          chunkIds,
          newImportance: importance
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action or missing parameters'
    }, { status: 400 });

  } catch (error) {
    console.error('Semantic chunks POST API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}