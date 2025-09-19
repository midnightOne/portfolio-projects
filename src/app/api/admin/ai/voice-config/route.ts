import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VoiceProviderConfig } from '@/types/voice-config';
import { getSerializerForProvider } from '@/lib/voice/config-serializers';

// GET /api/admin/ai/voice-config - List all voice configurations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const configurations = await prisma.voiceProviderConfig.findMany({
      orderBy: [
        { provider: 'asc' },
        { isDefault: 'desc' },
        { updatedAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: configurations
    });

  } catch (error) {
    console.error('Failed to fetch voice configurations:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to fetch voice configurations',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/ai/voice-config - Create new voice configuration
export async function POST(request: NextRequest) {
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

    // Check if this is the first configuration for this provider
    const existingConfigs = await prisma.voiceProviderConfig.findMany({
      where: { provider: config.provider }
    });

    const isFirstConfig = existingConfigs.length === 0;

    // Serialize configuration for storage
    const configJson = serializer.serialize(config);

    // If setting as default or this is the first config, unset other defaults for this provider
    if (isDefault || isFirstConfig) {
      await prisma.voiceProviderConfig.updateMany({
        where: { 
          provider: config.provider,
          isDefault: true 
        },
        data: { isDefault: false }
      });
    }

    // Create new configuration
    const newConfig = await prisma.voiceProviderConfig.create({
      data: {
        provider: config.provider,
        name: config.displayName,
        isDefault: isDefault || isFirstConfig,
        configJson
      }
    });

    return NextResponse.json({
      success: true,
      data: newConfig
    });

  } catch (error) {
    console.error('Failed to create voice configuration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to create voice configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}