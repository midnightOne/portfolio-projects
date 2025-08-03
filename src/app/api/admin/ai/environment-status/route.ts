import { NextRequest, NextResponse } from 'next/server';
import { EnvironmentValidator } from '@/lib/ai/environment';

/**
 * GET /api/admin/ai/environment-status
 * 
 * Returns the status of AI environment configuration including:
 * - API key presence checking and masking
 * - Environment variable validation
 * - Structured status for both OpenAI and Anthropic providers
 * 
 * Requirements: 1.3, 1.4
 */
export async function GET(request: NextRequest) {
  try {
    // Get comprehensive environment status
    const environmentStatus = EnvironmentValidator.getEnvironmentStatus();
    
    // Return structured response with all required information
    return NextResponse.json({
      success: true,
      data: {
        // Individual provider status with masked API keys
        openai: {
          configured: environmentStatus.openai.configured,
          keyPreview: environmentStatus.openai.keyPreview,
          environmentVariable: 'OPENAI_API_KEY'
        },
        anthropic: {
          configured: environmentStatus.anthropic.configured,
          keyPreview: environmentStatus.anthropic.keyPreview,
          environmentVariable: 'ANTHROPIC_API_KEY'
        },
        
        // Overall status summary
        summary: {
          hasAnyProvider: environmentStatus.hasAnyProvider,
          configuredProviders: environmentStatus.configuredProviders,
          isFullyConfigured: environmentStatus.isFullyConfigured,
          totalConfigured: environmentStatus.configuredProviders.length,
          totalAvailable: 2
        },
        
        // Configuration warnings and guidance
        warnings: environmentStatus.warnings,
        
        // Setup instructions for missing providers
        setupInstructions: {
          openai: environmentStatus.openai.configured ? null : {
            message: 'Set OPENAI_API_KEY environment variable',
            documentation: 'https://platform.openai.com/api-keys',
            example: 'OPENAI_API_KEY=sk-...'
          },
          anthropic: environmentStatus.anthropic.configured ? null : {
            message: 'Set ANTHROPIC_API_KEY environment variable', 
            documentation: 'https://console.anthropic.com/settings/keys',
            example: 'ANTHROPIC_API_KEY=sk-ant-...'
          }
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking AI environment status:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to check environment status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

// Only allow GET requests
export async function POST() {
  return NextResponse.json({
    success: false,
    error: { message: 'Method not allowed' }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: { message: 'Method not allowed' }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { message: 'Method not allowed' }
  }, { status: 405 });
}