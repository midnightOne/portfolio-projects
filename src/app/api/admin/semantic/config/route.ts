/**
 * Chunking Configuration API
 * 
 * Manages chunking configuration settings for semantic content management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ChunkingConfigService from '@/lib/content/ChunkingConfigService';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

/**
 * GET /api/admin/semantic/config
 * Get chunking configurations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const configName = searchParams.get('name');
    const getDefault = searchParams.get('default') === 'true';

    const configService = ChunkingConfigService.getInstance();

    if (getDefault) {
      // Get default configuration
      const config = await configService.getDefaultConfig();
      return NextResponse.json({
        success: true,
        config
      });
    } else if (configName) {
      // Get specific configuration
      const config = await configService.getConfig(configName);
      if (!config) {
        return NextResponse.json(
          { error: 'Configuration not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        config
      });
    } else {
      // Get all configurations
      const configs = await configService.listConfigs();
      return NextResponse.json({
        success: true,
        configs
      });
    }

  } catch (error) {
    console.error('Chunking config API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/semantic/config
 * Create new chunking configuration or calculate cost impact
 */
export async function POST(request: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, ...configData } = body;

    const configService = ChunkingConfigService.getInstance();

    // Handle cost impact calculation
    if (action === 'calculate-cost-impact') {
      const { currentConfigName, updates } = body;
      
      let currentConfig;
      if (currentConfigName) {
        currentConfig = await configService.getConfig(currentConfigName);
      } else {
        currentConfig = await configService.getDefaultConfig();
      }

      if (!currentConfig) {
        return NextResponse.json(
          { error: 'Current configuration not found' },
          { status: 404 }
        );
      }

      const costImpact = await configService.calculateCostImpact(currentConfig, updates);
      
      return NextResponse.json({
        success: true,
        costImpact
      });
    }

    // Handle configuration creation
    const {
      name,
      respectHeadingBoundaries,
      targetChunkSize,
      maxSectionSize,
      minSectionSize,
      sectionBoundaryOverlap,
      splitStrategy,
      embeddingModel,
      t1MaxLength,
      t2MaxLength,
      sectionChangePercent,
      minorChangeThreshold,
      defaultBehavior,
      draftModeSkipIndexing,
      batchModeEnabled,
      batchModeMinChunks,
      batchModeAutoSchedule,
      batchModeDefaultForRegeneration,
      batchModeDefaultForBulkOps,
      batchModeDefaultForInitialIndexing,
      isDefault
    } = configData;

    if (!name) {
      return NextResponse.json(
        { error: 'Configuration name is required' },
        { status: 400 }
      );
    }

    const config = await configService.createConfig({
      name,
      respectHeadingBoundaries: respectHeadingBoundaries ?? true,
      targetChunkSize: targetChunkSize ?? 300,
      maxSectionSize: maxSectionSize ?? 500,
      minSectionSize: minSectionSize ?? 50,
      sectionBoundaryOverlap: sectionBoundaryOverlap ?? 25,
      splitStrategy: splitStrategy ?? 'paragraph',
      embeddingModel: embeddingModel ?? 'text-embedding-3-small',
      t1MaxLength: t1MaxLength ?? 200,
      t2MaxLength: t2MaxLength ?? 150,
      sectionChangePercent: sectionChangePercent ?? 0.2,
      minorChangeThreshold: minorChangeThreshold ?? 2,
      defaultBehavior: defaultBehavior ?? 'prompt',
      draftModeSkipIndexing: draftModeSkipIndexing ?? true,
      batchModeEnabled: batchModeEnabled ?? true,
      batchModeMinChunks: batchModeMinChunks ?? 100,
      batchModeAutoSchedule: batchModeAutoSchedule ?? false,
      batchModeDefaultForRegeneration: batchModeDefaultForRegeneration ?? false,
      batchModeDefaultForBulkOps: batchModeDefaultForBulkOps ?? true,
      batchModeDefaultForInitialIndexing: batchModeDefaultForInitialIndexing ?? true,
      isDefault: isDefault ?? false
    });

    return NextResponse.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Chunking config creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/semantic/config
 * Update chunking configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, ...updates } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Configuration name is required' },
        { status: 400 }
      );
    }

    const configService = ChunkingConfigService.getInstance();
    const updatedConfig = await configService.updateConfig(name, updates);

    if (!updatedConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      config: updatedConfig
    });

  } catch (error) {
    console.error('Chunking config update error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/semantic/config?name=xxx
 * Delete chunking configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'Configuration name is required' },
        { status: 400 }
      );
    }

    const configService = ChunkingConfigService.getInstance();
    const deleted = await configService.deleteConfig(name);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    });

  } catch (error) {
    console.error('Chunking config deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
