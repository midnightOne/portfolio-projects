import { NextRequest, NextResponse } from 'next/server';
import { AIServiceManager, AIContentEditRequest } from '@/lib/ai/service-manager';
import { AIErrorHandler, AIErrorType } from '@/lib/ai/error-handler';

/**
 * POST /api/admin/ai/edit-content
 * 
 * Handles AI-powered content editing operations including:
 * - Rewriting content for clarity and flow
 * - Making content more professional or casual
 * - Expanding or summarizing text
 * - General content improvement
 * 
 * Requirements: 6.1, 6.2, 6.3, 8.1, 8.2
 */
export async function POST(request: NextRequest) {
  let body: any;
  
  try {
    body = await request.json();
    
    // Validate required fields
    const { model, operation, content, context } = body;
    
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
    
    if (!operation) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Operation parameter is required',
          code: 'MISSING_OPERATION',
          details: 'Request body must include "operation" field with value: rewrite, improve, expand, summarize, make_professional, or make_casual'
        }
      }, { status: 400 });
    }
    
    const validOperations = ['rewrite', 'improve', 'expand', 'summarize', 'make_professional', 'make_casual'];
    if (!validOperations.includes(operation)) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Invalid operation specified',
          code: 'INVALID_OPERATION',
          details: `Operation "${operation}" is not supported. Use one of: ${validOperations.join(', ')}`
        }
      }, { status: 400 });
    }
    
    if (!content) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Content parameter is required',
          code: 'MISSING_CONTENT',
          details: 'Request body must include "content" field with the text to edit'
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
    
    // Build the content edit request
    const editRequest: AIContentEditRequest = {
      model,
      operation,
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
    
    // Perform content editing
    const result = await aiService.editContent(editRequest);
    
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
            operation,
            processedAt: new Date().toISOString()
          }
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Content editing failed',
          code: 'EDIT_FAILED',
          details: result.reasoning
        },
        data: {
          warnings: result.warnings,
          metadata: {
            model: result.model,
            tokensUsed: result.tokensUsed,
            cost: result.cost,
            operation,
            processedAt: new Date().toISOString()
          }
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    const aiError = AIErrorHandler.parseError(error, {
      operation: 'editContent',
      model: body?.model,
      provider: body?.model ? undefined : 'unknown'
    });
    
    AIErrorHandler.logError(aiError);
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (error instanceof SyntaxError || 
        aiError.type === AIErrorType.BAD_REQUEST ||
        aiError.type === AIErrorType.MISSING_MODEL ||
        aiError.type === AIErrorType.NOT_CONFIGURED) {
      statusCode = 400;
    }
    
    return NextResponse.json({
      success: false,
      error: {
        message: aiError.message,
        code: aiError.type,
        details: aiError.details,
        actionable: aiError.actionable,
        suggestions: aiError.suggestions
      },
      data: {
        warnings: aiError.suggestions,
        metadata: {
          model: body?.model || 'unknown',
          operation: body?.operation || 'unknown',
          processedAt: new Date().toISOString()
        }
      }
    }, { status: statusCode });
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to edit content. Include model, operation, content, and context in request body.'
    }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to edit content. Include model, operation, content, and context in request body.'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to edit content. Include model, operation, content, and context in request body.'
    }
  }, { status: 405 });
}