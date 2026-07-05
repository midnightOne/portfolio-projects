/**
 * Batch Job Results Processing API
 * 
 * POST /api/admin/semantic/batch/[batchId]/process
 * Process completed batch job results and update database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBatchEmbeddingService } from '@/lib/content/BatchEmbeddingService';
import { PrismaClient } from '@prisma/client';
import VectorOperations from '@/lib/content/VectorOperations';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';

const prisma = new PrismaClient();

async function handlePOST(
  request: NextRequest,
  _ctx: GatewayContext,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { batchId } = await params;

    // Process batch results
    const batchService = getBatchEmbeddingService();
    const results = await batchService.processBatchResults(batchId);

    // Update database with embeddings
    const vectorOps = new VectorOperations(prisma);
    let updatedCount = 0;
    let failedCount = 0;

    for (const result of results.embeddings) {
      try {
        // Find the chunk to update
        const chunk = await prisma.contextChunk.findFirst({
          where: {
            chunkId: result.chunkId,
            tier: result.tier
          }
        });

        if (chunk) {
          // Update with embedding
          await vectorOps.upsertContextChunkWithVector({
            entityId: chunk.entityId,
            projectIndexId: chunk.projectIndexId || undefined,
            tier: chunk.tier,
            chunkId: chunk.chunkId,
            title: chunk.title || undefined,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            embedding: result.embedding,
            metadata: chunk.metadata as any,
            parentChunkId: chunk.parentChunkId || undefined,
            rootChunkId: chunk.rootChunkId || undefined,
            sectionGroup: chunk.sectionGroup || undefined,
            derivationPath: (chunk.metadata as any)?.derivationPath
          });
          updatedCount++;
        }
      } catch (error) {
        console.error(`Failed to update chunk ${result.chunkId}:`, error);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        totalEmbeddings: results.embeddings.length,
        updatedCount,
        failedCount,
        actualCost: results.actualCost,
        actualSavings: results.actualSavings
      },
      message: `Processed ${updatedCount} embeddings successfully. Saved $${results.actualSavings.toFixed(4)}`
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process batch results',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Cost-incurring semantic operation start: gateway-wrapped (D33), admin-tier via route auth.
export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
