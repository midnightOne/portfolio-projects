import { NextRequest, NextResponse } from 'next/server';
import { initializeAIConfiguration } from '@/lib/ai/database-setup';

/**
 * POST /api/admin/ai/initialize
 * 
 * Initializes the AI configuration with default models and settings.
 * This endpoint sets up the database with default model configurations
 * for OpenAI and Anthropic providers.
 * 
 * This is typically called once during setup or when models are not configured.
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize AI configuration with defaults
    await initializeAIConfiguration();
    
    return NextResponse.json({
      success: true,
      message: 'AI configuration initialized successfully',
      data: {
        initializedAt: new Date().toISOString(),
        defaultModels: {
          openai: 'gpt-4o,gpt-4o-mini,gpt-3.5-turbo',
          anthropic: 'claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022'
        }
      }
    });
    
  } catch (error) {
    console.error('Error initializing AI configuration:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to initialize AI configuration',
        code: 'INITIALIZATION_FAILED',
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
      details: 'Use POST method to initialize AI configuration.'
    }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to initialize AI configuration.'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to initialize AI configuration.'
    }
  }, { status: 405 });
}