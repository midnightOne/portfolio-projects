import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AIServiceManager } from '@/lib/ai/service-manager';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';

/**
 * POST /api/admin/semantic/chunks/[id]/ai-edit
 * AI-assisted chunk editing with custom prompts
 *
 * This endpoint reuses the same AI processing logic as the project editor
 * but adds chunk-specific context and validation.
 */
async function handlePOST(
  request: NextRequest,
  _ctx: GatewayContext,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: chunkId } = await params;
    const body = await request.json();

    const {
      model,
      prompt,
      content,
      selectedText,
      context
    } = body;

    // Validate required fields
    if (!model || !prompt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Model and prompt are required',
            code: 'MISSING_PARAMETERS'
          }
        },
        { status: 400 }
      );
    }

    // Fetch chunk to verify it exists and get context
    const chunk = await prisma.contextChunk.findUnique({
      where: { id: chunkId },
      select: {
        id: true,
        tier: true,
        title: true,
        content: true,
        projectIndexId: true
      }
    });

    if (!chunk) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Chunk not found',
            code: 'CHUNK_NOT_FOUND'
          }
        },
        { status: 404 }
      );
    }

    // Initialize AI service manager
    const aiService = new AIServiceManager();
    await aiService.initializeModelConfigurations();

    // Enhance context with chunk-specific information
    const enhancedContext = {
      projectTitle: context?.projectTitle || `Chunk T${chunk.tier}`,
      projectDescription: context?.projectDescription || `Editing semantic chunk: ${chunk.title || 'Untitled'}`,
      existingTags: context?.existingTags || [],
      fullContent: content || chunk.content,
      // Add chunk-specific context
      chunkTier: chunk.tier,
      chunkTitle: chunk.title
    };

    // Process the custom prompt using the same service as project editor
    const result = await aiService.processCustomPrompt({
      model,
      prompt,
      content: content || chunk.content,
      selectedText: selectedText ? {
        text: selectedText.text,
        start: selectedText.start,
        end: selectedText.end
      } : undefined,
      context: enhancedContext,
      temperature: body.temperature || 0.3
    });

    // Return the result in the same format as process-prompt endpoint
    if (result.success) {
      return NextResponse.json({
        success: true,
        changes: result.changes,
        reasoning: result.reasoning,
        confidence: result.confidence,
        warnings: result.warnings,
        userFeedback: result.userFeedback,
        model: result.model,
        tokensUsed: result.tokensUsed,
        cost: result.cost
      });
    } else {
      return NextResponse.json({
        success: false,
        changes: result.changes || {},
        reasoning: result.reasoning,
        confidence: result.confidence || 0,
        warnings: result.warnings,
        userFeedback: result.userFeedback,
        model: result.model,
        tokensUsed: result.tokensUsed || 0,
        cost: result.cost || 0
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in AI-assisted chunk editing:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to process AI edit request',
          code: 'INTERNAL_ERROR'
        },
        reasoning: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Cost-incurring semantic operation start: gateway-wrapped (D33), admin-tier via route auth.
export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
