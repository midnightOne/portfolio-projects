import { NextRequest, NextResponse } from 'next/server';
import { AIServiceManager } from '@/lib/ai/service-manager';
import { AIErrorHandler, AIErrorType } from '@/lib/ai/error-handler';

/**
 * POST /api/admin/ai/process-prompt
 * 
 * Handles AI-powered custom prompt processing for content editing.
 * This endpoint processes single prompts without maintaining chat history,
 * providing a Claude Artifacts-style experience.
 * 
 * Requirements: 6.3, 6.4, 6.8, 9.6
 */
export async function POST(request: NextRequest) {
  let body: any;
  
  try {
    body = await request.json();
    
    // Validate required fields
    const { model, prompt, content, context } = body;
    
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
    
    if (!prompt) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Prompt parameter is required',
          code: 'MISSING_PROMPT',
          details: 'Request body must include "prompt" field with the user\'s custom prompt'
        }
      }, { status: 400 });
    }
    
    if (!content) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Content parameter is required',
          code: 'MISSING_CONTENT',
          details: 'Request body must include "content" field with the text to process'
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
    
    // Initialize AI service manager
    const aiService = new AIServiceManager();
    
    // Process the custom prompt
    const result = await aiService.processCustomPrompt({
      model,
      prompt,
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
    });
    
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
        cost: result.cost,
        processedAt: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        changes: result.changes,
        reasoning: result.reasoning,
        confidence: result.confidence,
        warnings: result.warnings,
        userFeedback: result.userFeedback,
        model: result.model,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        processedAt: new Date().toISOString()
      }, { status: 500 });
    }
    
  } catch (error) {
    const aiError = AIErrorHandler.parseError(error, {
      operation: 'processCustomPrompt',
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
      changes: {},
      reasoning: aiError.message,
      confidence: 0,
      warnings: aiError.suggestions,
      userFeedback: null,
      model: body?.model || 'unknown',
      tokensUsed: 0,
      cost: 0,
      processedAt: new Date().toISOString(),
      error: {
        message: aiError.message,
        code: aiError.type,
        details: aiError.details,
        actionable: aiError.actionable,
        suggestions: aiError.suggestions
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
      details: 'Use POST method to process prompts. Include model, prompt, content, and context in request body.'
    }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to process prompts. Include model, prompt, content, and context in request body.'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to process prompts. Include model, prompt, content, and context in request body.'
    }
  }, { status: 405 });
}