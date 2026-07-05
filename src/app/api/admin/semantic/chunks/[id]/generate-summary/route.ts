/**
 * Generate Summary for Individual Chunk API
 * 
 * Generates AI summary for T1 or T2 chunks with configurable model and prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSummaryGenerationService } from '@/lib/content/SummaryGenerationService';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';

async function handlePOST(
  request: NextRequest,
  _ctx: GatewayContext,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: chunkId } = await params;
    const body = await request.json();
    const { model, systemPrompt, configId } = body;

    console.log(`[GenerateSummary] Starting for chunk: ${chunkId}`, { model, configId });

    // Get chunk details
    const chunk = await prisma.contextChunk.findFirst({
      where: { id: chunkId },
      include: {
        entity: true
      }
    });

    if (!chunk) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    if (chunk.tier !== 1 && chunk.tier !== 2) {
      return NextResponse.json(
        { error: 'Summary generation is only available for T1 and T2 chunks' },
        { status: 400 }
      );
    }

    // Get project using entity slug
    const project = await prisma.project.findFirst({
      where: { slug: chunk.entity.slug },
      select: { id: true }
    });

    // Get source content for summary generation
    let sourceContent = '';
    
    if (chunk.tier === 1) {
      // T1: Aggregate all T3 chunks for this entity
      console.log(`[GenerateSummary] T1 chunk - fetching all T3 chunks for entity: ${chunk.entityId}`);
      const t3Chunks = await prisma.contextChunk.findMany({
        where: {
          entityId: chunk.entityId,
          tier: 3
        },
        select: { content: true },
        orderBy: { createdAt: 'asc' }
      });
      
      sourceContent = t3Chunks.map(c => c.content).join('\n\n');
      console.log(`[GenerateSummary] T1: Using ${t3Chunks.length} T3 chunks (${sourceContent.length} chars)`);
      
    } else if (chunk.tier === 2) {
      // T2: Get all T3 chunks in the same section group
      const sectionGroup = chunk.sectionGroup || chunk.chunkId;
      console.log(`[GenerateSummary] T2 chunk - fetching T3 chunks for section: ${sectionGroup}`);
      
      const sectionT3Chunks = await prisma.contextChunk.findMany({
        where: {
          entityId: chunk.entityId,
          tier: 3,
          sectionGroup
        },
        select: { content: true },
        orderBy: { createdAt: 'asc' }
      });
      
      sourceContent = sectionT3Chunks.map(c => c.content).join('\n\n');
      console.log(`[GenerateSummary] T2: Using ${sectionT3Chunks.length} T3 chunks (${sourceContent.length} chars)`);
    }

    if (!sourceContent || sourceContent.length < 50) {
      return NextResponse.json(
        { error: 'Insufficient source content for summary generation' },
        { status: 400 }
      );
    }

    // Generate summary using SummaryGenerationService
    const summaryService = getSummaryGenerationService();
    
    const result = await summaryService.generateSummary({
      content: sourceContent,
      type: chunk.tier === 1 ? 'T1' : 'T2',
      projectId: project?.id || chunk.projectIndexId || undefined,
      sectionTitle: chunk.title || undefined,
      configId,
      metadata: {
        chunkId: chunk.id,
        originalContent: chunk.content,
        customModel: model,
        customPrompt: systemPrompt
      }
    }, model, systemPrompt);

    console.log(`[GenerateSummary] Summary generated successfully:`, {
      chunkId: chunk.id,
      summaryLength: result.summary.length,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      model: result.modelUsed
    });

    return NextResponse.json({
      success: true,
      summary: result.summary,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      confidenceScore: result.confidenceScore,
      qualityMetrics: result.qualityMetrics,
      modelUsed: result.modelUsed,
      configUsed: result.configUsed
    });

  } catch (error) {
    console.error('[GenerateSummary] Error:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('[GenerateSummary] Error name:', error.name);
      console.error('[GenerateSummary] Error message:', error.message);
      console.error('[GenerateSummary] Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate summary',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}


// Cost-incurring semantic operation start: gateway-wrapped (D33), admin-tier via route auth.
export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
