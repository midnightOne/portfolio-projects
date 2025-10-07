import { NextRequest, NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check semantic search configuration
 * GET /api/admin/semantic/search-diagnostic
 */
export async function GET(request: NextRequest) {
  try {
    const diagnostics = {
      openaiApiKey: {
        exists: !!process.env.OPENAI_API_KEY,
        length: process.env.OPENAI_API_KEY?.length || 0,
        prefix: process.env.OPENAI_API_KEY?.substring(0, 7) || 'N/A'
      },
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      diagnostics,
      message: diagnostics.openaiApiKey.exists 
        ? '✅ OpenAI API key is configured' 
        : '❌ OpenAI API key is missing - semantic search will not work'
    });

  } catch (error) {
    console.error('[SearchDiagnostic] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run diagnostics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

