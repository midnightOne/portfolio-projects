/**
 * Content Sources Management API
 * Admin endpoints for managing AI content sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentSourceManager } from '@/lib/services/ai/content-source-manager';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/ai/content-sources
 * Get all available content sources with their configurations
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Load configurations from database first
    const dbConfigs = await prisma.aIContentSourceConfig.findMany();
    
    // Auto-discover sources (this will skip loading configurations to avoid circular dependency)
    await contentSourceManager.autoDiscoverSources();
    
    // Load the database configurations into the manager
    for (const dbConfig of dbConfigs) {
      contentSourceManager.setSourceConfig(dbConfig.sourceId, {
        id: dbConfig.sourceId,
        providerId: dbConfig.providerId,
        enabled: dbConfig.enabled,
        priority: dbConfig.priority,
        config: dbConfig.config as Record<string, any>,
        createdAt: dbConfig.createdAt,
        updatedAt: dbConfig.updatedAt
      });
    }

    // Get all sources (for admin interface, show all regardless of availability)
    const sources = await contentSourceManager.getAllSources();

    // Get detailed configurations
    const sourcesWithDetails = await Promise.all(
      sources.map(async (source) => {
        const config = contentSourceManager.getSourceConfig(source.id);
        const schema = await contentSourceManager.getSourceSchema(source.id);
        const provider = contentSourceManager.getProvider(source.id);
        
        // Check availability
        let isAvailable = true;
        try {
          if (provider) {
            isAvailable = await provider.isAvailable();
          }
        } catch (error) {
          console.error(`Error checking availability for ${source.id}:`, error);
          isAvailable = false;
        }

        return {
          ...source,
          isAvailable,
          config: config?.config || {},
          schema,
          provider: {
            id: provider?.id,
            name: provider?.name,
            description: provider?.description,
            version: provider?.version
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        sources: sourcesWithDetails,
        totalCount: sourcesWithDetails.length,
        enabledCount: sourcesWithDetails.filter(s => s.enabled).length
      }
    });

  } catch (error) {
    console.error('Error getting content sources:', error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to get content sources',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/ai/content-sources
 * Save content source configuration
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { config } = body;

    if (!config || !config.id) {
      return NextResponse.json(
        { error: { message: 'Invalid configuration data' } },
        { status: 400 }
      );
    }

    // Save to database
    await prisma.aIContentSourceConfig.upsert({
      where: { sourceId: config.id },
      update: {
        enabled: config.enabled,
        priority: config.priority,
        config: config.config,
        updatedAt: new Date()
      },
      create: {
        sourceId: config.id,
        providerId: config.providerId,
        enabled: config.enabled,
        priority: config.priority,
        config: config.config,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Configuration saved successfully' }
    });

  } catch (error) {
    console.error('Error saving content source configuration:', error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to save configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/ai/content-sources
 * Update multiple content source configurations
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: { message: 'Updates must be an array' } },
        { status: 400 }
      );
    }

    // Process each update
    const results = [];
    for (const update of updates) {
      try {
        await contentSourceManager.updateSourceConfig(update.sourceId, update.changes);
        results.push({ sourceId: update.sourceId, success: true });
      } catch (error) {
        results.push({ 
          sourceId: update.sourceId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: failureCount === 0,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount
        }
      }
    });

  } catch (error) {
    console.error('Error updating content sources:', error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to update content sources',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}