import { NextRequest, NextResponse } from 'next/server';
import { AIServiceManager, AIContentEditRequest } from '@/lib/ai/service-manager';

/**
 * POST /api/admin/ai/improve-content
 * 
 * Improves project content using AI by:
 * - Enhancing clarity and readability
 * - Fixing grammar and style issues
 * - Making content more engaging
 * - Maintaining the author's voice and intent
 * 
 * This is a specialized version of the edit-content endpoint focused on general improvement.
 * 
 * Requirements: 6.1, 6.2, 6.3, 8.1, 8.2
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { model, content, context } = body;
    
    if (!model) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Model parameter is required',
          code: 'MISSING_MODEL',
          details: 'Request body must include "model" field with a valid model ID'
        }
      }, { status: 400 });
    }
    
    if (!content) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Content parameter is required',
          code: 'MISSING_CONTENT',
          details: 'Request body must include "content" field with the text to improve'
        }
      }, { status: 400 });
    }
    
    if (!context || !context.projectTitle) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Context parameter is required',
          code: 'MISSING_CONTEXT',
          details: 'Request body must include "context" object with at least "projectTitle" field'
        }
      }, { status: 400 });
    }
    
    // Build the content improvement request (always use 'improve' operation)
    const improveRequest: AIContentEditRequest = {
      model,
      operation: 'improve',
      content,
      selectedText: body.selectedText ? {
        text: body.selectedText.text,
        start: body.selectedText.start,
        end: body.selectedText.end
      } : undefined,
      context: {
        projectTitle: context.projectTitle,
        projectDescription: context.projectDescription || '',
        existingTags: context.existingTags || [],
        fullContent: context.fullContent || content
      },
      systemPrompt: body.systemPrompt,
      temperature: body.temperature
    };
    
    // Initialize AI service manager
    const aiService = new AIServiceManager();
    
    // Perform content improvement
    const result = await aiService.improveContent(improveRequest);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          changes: result.changes,
          reasoning: result.reasoning,
          confidence: result.confidence,
          warnings: result.warnings,
          metadata: {
            model: result.model,
            tokensUsed: result.tokensUsed,
            cost: result.cost,
            operation: 'improve',
            processedAt: new Date().toISOString()
          }
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Content improvement failed',
          code: 'IMPROVEMENT_FAILED',
          details: result.reasoning
        },
        data: {
          warnings: result.warnings,
          metadata: {
            model: result.model,
            tokensUsed: result.tokensUsed,
            cost: result.cost,
            operation: 'improve',
            processedAt: new Date().toISOString()
          }
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in content improvement API:', error);
    
    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
          details: 'Request body must be valid JSON with required fields'
        }
      }, { status: 400 });
    }
    
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'AI model not configured',
          code: 'MODEL_NOT_CONFIGURED',
          details: error.message
        }
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Internal server error during content improvement',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }, { status: 500 });
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to improve content. Include model, content, and context in request body.'
    }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to improve content. Include model, content, and context in request body.'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to improve content. Include model, content, and context in request body.'
    }
  }, { status: 405 });
}