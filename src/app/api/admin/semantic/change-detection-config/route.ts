/**
 * Change Detection Configuration API
 * 
 * Manages change detection configuration settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ChangeDetectionConfigService from '@/lib/content/ChangeDetectionConfigService';
import ChangeDetectionIntegration from '@/lib/content/ChangeDetectionIntegration';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

/**
 * GET /api/admin/semantic/change-detection-config
 * Get all change detection configurations
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

    const configService = ChangeDetectionConfigService.getInstance();

    if (configName) {
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
    console.error('Change detection config API error:', error);
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
 * POST /api/admin/semantic/change-detection-config
 * Create new change detection configuration
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
    const {
      name,
      sectionChangePercent,
      minorChangeThreshold,
      characterChangeThreshold,
      headingMatchThreshold,
      costPerToken,
      enableAutoDetection,
      enableCostEstimation,
      enableAuditTrail,
      isDefault
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Configuration name is required' },
        { status: 400 }
      );
    }

    const configService = ChangeDetectionConfigService.getInstance();
    
    const config = await configService.createConfig({
      name,
      sectionChangePercent: sectionChangePercent ?? 0.2,
      minorChangeThreshold: minorChangeThreshold ?? 2,
      characterChangeThreshold: characterChangeThreshold ?? 0.05,
      headingMatchThreshold: headingMatchThreshold ?? 0.7,
      costPerToken: costPerToken ?? 0.00015,
      enableAutoDetection: enableAutoDetection ?? true,
      enableCostEstimation: enableCostEstimation ?? true,
      enableAuditTrail: enableAuditTrail ?? true,
      isDefault: isDefault ?? false
    });

    return NextResponse.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Change detection config creation error:', error);
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
 * PUT /api/admin/semantic/change-detection-config
 * Update change detection configuration
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

    const integration = ChangeDetectionIntegration.getInstance();
    await integration.updateConfiguration(name, updates);

    const configService = ChangeDetectionConfigService.getInstance();
    const updatedConfig = await configService.getConfig(name);

    return NextResponse.json({
      success: true,
      config: updatedConfig
    });

  } catch (error) {
    console.error('Change detection config update error:', error);
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
 * DELETE /api/admin/semantic/change-detection-config?name=xxx
 * Delete change detection configuration
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

    const configService = ChangeDetectionConfigService.getInstance();
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
    console.error('Change detection config deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}