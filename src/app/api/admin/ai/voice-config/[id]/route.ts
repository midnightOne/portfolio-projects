import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VoiceProviderConfig } from '@/types/voice-config';
import { getSerializerForProvider } from '@/lib/voice/config-serializers';

// GET /api/admin/ai/voice-config/[id] - Get specific voice configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const configuration = await prisma.voiceProviderConfig.findUnique({
      where: { id }
    });

    if (!configuration) {
      return NextResponse.json(
        { success: false, error: { message: 'Configuration not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: configuration
    });

  } catch (error) {
    console.error('Failed to fetch voice configuration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to fetch voice configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

// PUT /api/admin/ai/voice-config/[id] - Update voice configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const requestData = await request.json();
    const config: VoiceProviderConfig = requestData;
    const isDefault = requestData.isDefault || false;
    const { id } = await params;

    // Check if configuration exists
    const existingConfig = await prisma.voiceProviderConfig.findUnique({
      where: { id }
    });

    if (!existingConfig) {
      return NextResponse.json(
        { success: false, error: { message: 'Configuration not found' } },
        { status: 404 }
      );
    }

    // Validate configuration using appropriate serializer
    const serializer = getSerializerForProvider(config.provider);
    const validation = serializer.validate(config);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Configuration validation failed',
            details: validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')
          } 
        },
        { status: 400 }
      );
    }

    // Serialize configuration for storage
    const configJson = serializer.serialize(config);

    // If setting as default, unset other defaults for this provider
    /*if (isDefault) {
      await prisma.voiceProviderConfig.updateMany({
        where: { 
          provider: config.provider,
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }*/

    // Update configuration
    const updatedConfig = await prisma.voiceProviderConfig.update({
      where: { id },
      data: {
        name: config.displayName,
        //isDefault: isDefault, // Don't update isDefault here, it's handled in the default route
        configJson
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedConfig
    });

  } catch (error) {
    console.error('Failed to update voice configuration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to update voice configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ai/voice-config/[id] - Delete voice configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if configuration exists
    const existingConfig = await prisma.voiceProviderConfig.findUnique({
      where: { id }
    });

    if (!existingConfig) {
      return NextResponse.json(
        { success: false, error: { message: 'Configuration not found' } },
        { status: 404 }
      );
    }

    // Prevent deletion of default configurations
    if (existingConfig.isDefault) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Cannot delete default configuration',
            details: 'Set another configuration as default before deleting this one'
          } 
        },
        { status: 400 }
      );
    }

    // Delete configuration
    await prisma.voiceProviderConfig.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Configuration deleted successfully' }
    });

  } catch (error) {
    console.error('Failed to delete voice configuration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to delete voice configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}