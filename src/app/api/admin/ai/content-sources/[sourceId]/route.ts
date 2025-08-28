/**
 * Individual Content Source Management API
 * Admin endpoints for managing specific content sources
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentSourceManager } from '@/lib/services/ai/content-source-manager';

interface RouteParams {
  params: Promise<{
    sourceId: string;
  }>;
}

/**
 * GET /api/admin/ai/content-sources/[sourceId]
 * Get specific content source details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { sourceId } = await params;

    // Get provider
    const provider = contentSourceManager.getProvider(sourceId);
    if (!provider) {
      return NextResponse.json(
        { error: { message: 'Content source not found' } },
        { status: 404 }
      );
    }

    // Get configuration
    const config = contentSourceManager.getSourceConfig(sourceId);
    
    // Get schema
    const schema = await contentSourceManager.getSourceSchema(sourceId);
    
    // Get metadata
    const isAvailable = await provider.isAvailable();
    const metadata = isAvailable ? await provider.getMetadata() : null;

    return NextResponse.json({
      success: true,
      data: {
        provider: {
          id: provider.id,
          type: provider.type,
          name: provider.name,
          description: provider.description,
          version: provider.version
        },
        config: config || {
          id: sourceId,
          providerId: sourceId,
          enabled: true,
          priority: 50,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date()
        },
        schema,
        metadata,
        isAvailable
      }
    });

  } catch (error) {
    const { sourceId } = await params;
    console.error(`Error getting content source ${sourceId}:`, error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to get content source',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/ai/content-sources/[sourceId]
 * Update specific content source configuration
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { sourceId } = await params;
    const body = await request.json();

    // Validate provider exists
    const provider = contentSourceManager.getProvider(sourceId);
    if (!provider) {
      return NextResponse.json(
        { error: { message: 'Content source not found' } },
        { status: 404 }
      );
    }

    // Update configuration
    await contentSourceManager.updateSourceConfig(sourceId, body);

    // Get updated configuration
    const updatedConfig = contentSourceManager.getSourceConfig(sourceId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Content source updated successfully',
        config: updatedConfig
      }
    });

  } catch (error) {
    const { sourceId } = await params;
    console.error(`Error updating content source ${sourceId}:`, error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to update content source',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/ai/content-sources/[sourceId]/toggle
 * Toggle content source enabled/disabled
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { sourceId } = await params;
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: { message: 'enabled must be a boolean' } },
        { status: 400 }
      );
    }

    // Toggle source
    await contentSourceManager.toggleSource(sourceId, enabled);

    // Get updated configuration
    const updatedConfig = contentSourceManager.getSourceConfig(sourceId);

    return NextResponse.json({
      success: true,
      data: {
        message: `Content source ${enabled ? 'enabled' : 'disabled'} successfully`,
        config: updatedConfig
      }
    });

  } catch (error) {
    const { sourceId } = await params;
    console.error(`Error toggling content source ${sourceId}:`, error);
    return NextResponse.json(
      { 
        error: { 
          message: 'Failed to toggle content source',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}