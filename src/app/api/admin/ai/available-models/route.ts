import { NextRequest, NextResponse } from 'next/server';
import { AIServiceManager } from '@/lib/ai/service-manager';

/**
 * GET /api/admin/ai/available-models
 * 
 * Retrieves all available AI models grouped by provider:
 * - Lists models from all configured providers
 * - Groups models by provider (OpenAI, Anthropic)
 * - Includes availability status for each provider
 * - Filters out models from providers without valid API keys
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 5.4
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize AI service manager
    const aiService = new AIServiceManager();
    
    // Get provider statuses to determine which providers are available
    const providerStatuses = await aiService.getAvailableProviders();
    
    // Get all available models across providers
    const allModels = await aiService.getAllAvailableModels();
    
    // Get configured models for dropdown format
    const dropdownModels = await aiService.getModelsForDropdown();
    
    // Group models by provider
    const modelsByProvider: Record<string, {
      provider: string;
      configured: boolean;
      connected: boolean;
      error?: string;
      availableModels: string[];
      configuredModels: string[];
    }> = {};
    
    // Initialize provider groups
    for (const status of providerStatuses) {
      const providerModels = allModels
        .filter(m => m.provider === status.name)
        .map(m => m.model);
      
      const configuredModels = dropdownModels
        .filter(m => m.provider === status.name)
        .map(m => m.model);
      
      modelsByProvider[status.name] = {
        provider: status.name,
        configured: status.configured,
        connected: status.connected,
        error: status.error,
        availableModels: providerModels,
        configuredModels: configuredModels
      };
    }
    
    // Create unified model list for dropdowns (only from connected providers)
    const unifiedModels = dropdownModels
      .filter(model => model.available)
      .map(model => ({
        id: model.model,
        name: model.model,
        provider: model.provider,
        available: model.available
      }));
    
    // Sort unified models by provider, then by name
    unifiedModels.sort((a, b) => {
      if (a.provider !== b.provider) {
        // OpenAI first, then Anthropic
        if (a.provider === 'openai') return -1;
        if (b.provider === 'openai') return 1;
        return a.provider.localeCompare(b.provider);
      }
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json({
      success: true,
      data: {
        // Grouped by provider for admin interface
        byProvider: modelsByProvider,
        
        // Unified list for dropdowns
        unified: unifiedModels,
        
        // Summary statistics
        summary: {
          totalProviders: providerStatuses.length,
          configuredProviders: providerStatuses.filter(p => p.configured).length,
          connectedProviders: providerStatuses.filter(p => p.connected).length,
          totalAvailableModels: allModels.length,
          totalConfiguredModels: dropdownModels.length,
          availableForUse: unifiedModels.length
        },
        
        retrievedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error retrieving available models:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to retrieve available models',
        code: 'RETRIEVAL_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }, { status: 500 });
  }
}

// Only allow GET requests
export async function POST() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use GET method to retrieve available models.'
    }
  }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use GET method to retrieve available models.'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use GET method to retrieve available models.'
    }
  }, { status: 405 });
}