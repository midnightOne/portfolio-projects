import { NextRequest, NextResponse } from 'next/server';
import { AIServiceManager, AITagSuggestionRequest } from '@/lib/ai/service-manager';

/**
 * POST /api/admin/ai/suggest-tags
 * 
 * Analyzes project content and suggests relevant technology and skill tags:
 * - Suggests new tags based on content analysis
 * - Identifies existing tags that might not fit
 * - Provides reasoning for each suggestion
 * - Focuses on technology stacks, frameworks, and skills
 * 
 * Requirements: 6.1, 6.2, 6.3, 8.1, 8.2
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { model, projectTitle, articleContent } = body;
    
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
    
    if (!projectTitle) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Project title is required',
          code: 'MISSING_PROJECT_TITLE',
          details: 'Request body must include "projectTitle" field'
        }
      }, { status: 400 });
    }
    
    if (!articleContent) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Article content is required',
          code: 'MISSING_ARTICLE_CONTENT',
          details: 'Request body must include "articleContent" field with the project content to analyze'
        }
      }, { status: 400 });
    }
    
    // Build the tag suggestion request
    const tagRequest: AITagSuggestionRequest = {
      model,
      projectTitle,
      projectDescription: body.projectDescription || '',
      articleContent,
      existingTags: body.existingTags || [],
      maxSuggestions: body.maxSuggestions || 5
    };
    
    // Initialize AI service manager
    const aiService = new AIServiceManager();
    
    // Initialize model configurations from database
    await aiService.initializeModelConfigurations();
    
    // Get tag suggestions
    const result = await aiService.suggestTags(tagRequest);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          suggestions: result.suggestions,
          reasoning: result.reasoning,
          metadata: {
            model: result.model,
            tokensUsed: result.tokensUsed,
            cost: result.cost,
            maxSuggestions: tagRequest.maxSuggestions,
            existingTagsCount: tagRequest.existingTags.length,
            processedAt: new Date().toISOString()
          }
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Tag suggestion failed',
          code: 'SUGGESTION_FAILED',
          details: result.reasoning
        },
        data: {
          metadata: {
            model: result.model,
            tokensUsed: result.tokensUsed,
            cost: result.cost,
            processedAt: new Date().toISOString()
          }
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in tag suggestion API:', error);
    
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
        message: 'Internal server error during tag suggestion',
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
      details: 'Use POST method to suggest tags. Include model, projectTitle, and articleContent in request body.'
    }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to suggest tags. Include model, projectTitle, and articleContent in request body.'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to suggest tags. Include model, projectTitle, and articleContent in request body.'
    }
  }, { status: 405 });
}