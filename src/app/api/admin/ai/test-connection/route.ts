import { NextRequest, NextResponse } from 'next/server';
import { AIServiceManager } from '@/lib/ai/service-manager';
import { AIProviderType } from '@/lib/ai/types';

/**
 * POST /api/admin/ai/test-connection
 * 
 * Tests real API connection for specified AI provider and returns:
 * - Connection status with detailed error reporting
 * - Available models list when connection succeeds
 * - Actionable error messages for troubleshooting
 * 
 * Requirements: 4.1, 4.2, 4.3, 9.1, 9.2
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider } = body;
    
    // Validate provider parameter
    if (!provider) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Provider parameter is required',
          code: 'MISSING_PROVIDER',
          details: 'Request body must include "provider" field with value "openai" or "anthropic"'
        }
      }, { status: 400 });
    }
    
    if (!['openai', 'anthropic'].includes(provider)) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Invalid provider specified',
          code: 'INVALID_PROVIDER',
          details: `Provider "${provider}" is not supported. Use "openai" or "anthropic"`
        }
      }, { status: 400 });
    }
    
    // Initialize AI service manager
    const aiService = new AIServiceManager();
    
    // Test connection to the specified provider
    const testResult = await aiService.testConnection(provider as AIProviderType);
    
    if (testResult.success) {
      // Connection successful - return success with available models
      return NextResponse.json({
        success: true,
        data: {
          provider,
          connected: true,
          message: testResult.message,
          availableModels: testResult.availableModels || [],
          modelCount: testResult.availableModels?.length || 0,
          testedAt: new Date().toISOString()
        }
      });
    } else {
      // Connection failed - return detailed error information
      return NextResponse.json({
        success: false,
        data: {
          provider,
          connected: false,
          message: testResult.message,
          error: testResult.error ? {
            code: testResult.error.code,
            details: testResult.error.details,
            actionable: testResult.error.actionable,
            // Add specific guidance based on error type
            guidance: getErrorGuidance(testResult.error.code, provider)
          } : undefined,
          testedAt: new Date().toISOString()
        }
      }, { status: 200 }); // Return 200 even for connection failures - it's a successful test
    }
    
  } catch (error) {
    console.error('Error testing AI provider connection:', error);
    
    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
          details: 'Request body must be valid JSON with "provider" field'
        }
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Internal server error during connection test',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }, { status: 500 });
  }
}

/**
 * Provide actionable guidance based on error codes
 */
function getErrorGuidance(errorCode: string, provider: string): {
  message: string;
  action: string;
  documentation?: string;
} {
  switch (errorCode) {
    case 'NOT_CONFIGURED':
      return {
        message: `${provider.toUpperCase()}_API_KEY environment variable is not set`,
        action: `Set the ${provider.toUpperCase()}_API_KEY environment variable with your API key`,
        documentation: provider === 'openai' 
          ? 'https://platform.openai.com/api-keys'
          : 'https://console.anthropic.com/settings/keys'
      };
      
    case 'INVALID_API_KEY':
      return {
        message: `The provided API key for ${provider} is invalid or expired`,
        action: `Check your ${provider.toUpperCase()}_API_KEY and ensure it's correct and active`,
        documentation: provider === 'openai'
          ? 'https://platform.openai.com/api-keys'
          : 'https://console.anthropic.com/settings/keys'
      };
      
    case 'RATE_LIMIT_EXCEEDED':
      return {
        message: `Rate limit exceeded for ${provider}`,
        action: 'Wait a few minutes before testing again, or check your usage limits',
        documentation: provider === 'openai'
          ? 'https://platform.openai.com/docs/guides/rate-limits'
          : 'https://docs.anthropic.com/claude/reference/rate-limits'
      };
      
    case 'NETWORK_ERROR':
      return {
        message: 'Network connectivity issue',
        action: 'Check your internet connection and firewall settings',
      };
      
    case 'BAD_REQUEST':
      return {
        message: 'Invalid request sent to provider API',
        action: 'This may indicate a configuration issue - try updating your API key',
      };
      
    default:
      return {
        message: 'Unknown connection error',
        action: 'Check your API key and network connection, then try again',
      };
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to test connections. Include "provider" in request body.'
    }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to test connections. Include "provider" in request body.'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use POST method to test connections. Include "provider" in request body.'
    }
  }, { status: 405 });
}