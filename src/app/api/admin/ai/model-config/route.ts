import { NextRequest, NextResponse } from 'next/server';
import { AIServiceManager } from '@/lib/ai/service-manager';
import { getAIConfiguration } from '@/lib/ai/database-setup';
import { PrismaClient } from '@prisma/client';
import { AIProviderType } from '@/lib/ai/types';

const prisma = new PrismaClient();

/**
 * GET /api/admin/ai/model-config
 * 
 * Retrieves current AI model configuration and general settings:
 * - Model lists for each provider (OpenAI, Anthropic)
 * - General settings (default provider, system prompt, parameters)
 * - Configuration status and validation
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 5.4
 */
export async function GET(request: NextRequest) {
  try {
    // Get current configuration from database
    const config = await getAIConfiguration();
    
    // Initialize AI service manager to get additional context
    const aiService = new AIServiceManager();
    
    // Get provider statuses to show which providers are available
    const providerStatuses = await aiService.getAvailableProviders();
    
    return NextResponse.json({
      success: true,
      data: {
        modelConfig: config.modelConfig,
        generalSettings: config.generalSettings,
        providerStatuses: providerStatuses.map(status => ({
          provider: status.name,
          configured: status.configured,
          connected: status.connected,
          modelCount: status.models.length,
          error: status.error
        })),
        retrievedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error retrieving AI model configuration:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to retrieve AI model configuration',
        code: 'RETRIEVAL_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }, { status: 500 });
  }
}

/**
 * PUT /api/admin/ai/model-config
 * 
 * Saves AI model configuration and general settings:
 * - Updates model lists for providers
 * - Saves general settings (default provider, system prompt, etc.)
 * - Validates model configurations against provider APIs
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.2, 5.4
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request structure
    if (!body.modelConfig && !body.generalSettings) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Either modelConfig or generalSettings must be provided',
          code: 'MISSING_CONFIG',
          details: 'Request body must include "modelConfig" and/or "generalSettings" objects'
        }
      }, { status: 400 });
    }
    
    const aiService = new AIServiceManager();
    const validationResults: Array<{ provider: string; valid: string[]; invalid: string[]; warnings: string[] }> = [];
    
    // Update model configurations if provided
    if (body.modelConfig) {
      for (const [provider, modelsString] of Object.entries(body.modelConfig)) {
        if (!['openai', 'anthropic'].includes(provider)) {
          return NextResponse.json({
            success: false,
            error: {
              message: `Invalid provider: ${provider}`,
              code: 'INVALID_PROVIDER',
              details: 'Provider must be "openai" or "anthropic"'
            }
          }, { status: 400 });
        }
        
        if (typeof modelsString !== 'string') {
          return NextResponse.json({
            success: false,
            error: {
              message: `Models for ${provider} must be a string`,
              code: 'INVALID_MODELS_FORMAT',
              details: 'Models should be provided as comma-separated string'
            }
          }, { status: 400 });
        }
        
        // Parse and validate models
        const models = modelsString.split(',').map(m => m.trim()).filter(Boolean);
        
        if (models.length > 0) {
          // Validate models against provider API
          const validation = await aiService.validateModels(provider as AIProviderType, models);
          validationResults.push({
            provider,
            valid: validation.valid,
            invalid: validation.invalid,
            warnings: validation.warnings
          });
        }
        
        // Save model configuration
        await aiService.saveModelConfiguration(provider as AIProviderType, models);
      }
    }
    
    // Update general settings if provided
    if (body.generalSettings) {
      const { defaultProvider, systemPrompt, temperature, maxTokens } = body.generalSettings;
      
      // Validate general settings
      if (defaultProvider && !['openai', 'anthropic'].includes(defaultProvider)) {
        return NextResponse.json({
          success: false,
          error: {
            message: 'Invalid default provider',
            code: 'INVALID_DEFAULT_PROVIDER',
            details: 'Default provider must be "openai" or "anthropic"'
          }
        }, { status: 400 });
      }
      
      if (temperature !== undefined && (temperature < 0 || temperature > 1)) {
        return NextResponse.json({
          success: false,
          error: {
            message: 'Invalid temperature value',
            code: 'INVALID_TEMPERATURE',
            details: 'Temperature must be between 0 and 1'
          }
        }, { status: 400 });
      }
      
      if (maxTokens !== undefined && (maxTokens < 100 || maxTokens > 8000)) {
        return NextResponse.json({
          success: false,
          error: {
            message: 'Invalid maxTokens value',
            code: 'INVALID_MAX_TOKENS',
            details: 'Max tokens must be between 100 and 8000'
          }
        }, { status: 400 });
      }
      
      // Update general settings in database
      await prisma.aIGeneralSettings.upsert({
        where: { id: 'default' },
        update: {
          ...(defaultProvider && { defaultProvider }),
          ...(systemPrompt !== undefined && { systemPrompt }),
          ...(temperature !== undefined && { temperature }),
          ...(maxTokens !== undefined && { maxTokens })
        },
        create: {
          id: 'default',
          defaultProvider: defaultProvider || 'openai',
          systemPrompt: systemPrompt || '',
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 4000
        }
      });
    }
    
    // Get updated configuration to return
    const updatedConfig = await getAIConfiguration();
    
    return NextResponse.json({
      success: true,
      data: {
        modelConfig: updatedConfig.modelConfig,
        generalSettings: updatedConfig.generalSettings,
        validationResults,
        savedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error saving AI model configuration:', error);
    
    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
          details: 'Request body must be valid JSON'
        }
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to save AI model configuration',
        code: 'SAVE_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }, { status: 500 });
  }
}

// Only allow GET and PUT requests
export async function POST() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use GET to retrieve configuration or PUT to update configuration.'
    }
  }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({
    success: false,
    error: { 
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      details: 'Use GET to retrieve configuration or PUT to update configuration.'
    }
  }, { status: 405 });
}