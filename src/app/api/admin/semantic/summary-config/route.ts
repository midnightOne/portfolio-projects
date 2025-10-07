/**
 * Summary Generation Configuration API
 * 
 * Get and manage summary generation configurations (models, prompts, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSummaryGenerationService } from '@/lib/content/SummaryGenerationService';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

/**
 * GET /api/admin/semantic/summary-config
 * Get summary generation configuration
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
    const tier = searchParams.get('tier'); // 'T1' or 'T2'
    const configId = searchParams.get('configId') || 'default-balanced';

    const summaryService = getSummaryGenerationService();
    const config = summaryService.getConfigById(configId);

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Return specific tier prompt or full config
    if (tier) {
      const prompt = tier === 'T1' ? config.t1SystemPrompt : config.t2SystemPrompt;
      return NextResponse.json({
        success: true,
        tier,
        prompt,
        model: config.model,
        temperature: config.temperature,
        maxLength: tier === 'T1' ? config.t1MaxLength : config.t2MaxLength,
        configId: config.id,
        configName: config.name
      });
    }

    // Return full config
    return NextResponse.json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Summary config API error:', error);
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
 * GET /api/admin/semantic/summary-config/list
 * Get all available summary generation configurations
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

    const summaryService = getSummaryGenerationService();
    const configs = summaryService.getAllConfigs();

    return NextResponse.json({
      success: true,
      configs
    });

  } catch (error) {
    console.error('Summary config list API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to list configurations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

