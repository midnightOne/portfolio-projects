import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VoiceProviderConfig } from '@/types/voice-config';
import { getSerializerForProvider } from '@/lib/voice/config-serializers';

interface ImportData {
  version: string;
  exportedAt: string;
  provider?: 'openai' | 'elevenlabs';
  configurations: Array<{
    provider: 'openai' | 'elevenlabs';
    name: string;
    isDefault: boolean;
    config: VoiceProviderConfig;
  }>;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

// POST /api/admin/ai/voice-config/import - Import voice configurations
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const importData: ImportData = await request.json();

    // Validate import data structure
    if (!importData.configurations || !Array.isArray(importData.configurations)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Invalid import data',
            details: 'Missing or invalid configurations array'
          } 
        },
        { status: 400 }
      );
    }

    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: [],
      warnings: []
    };

    // Process each configuration
    for (let i = 0; i < importData.configurations.length; i++) {
      const configData = importData.configurations[i];
      
      try {
        // Validate configuration structure
        if (!configData.config || !configData.provider) {
          result.errors.push(`Configuration ${i + 1}: Missing config or provider`);
          continue;
        }

        // Validate using appropriate serializer
        const serializer = getSerializerForProvider(configData.provider);
        const validation = serializer.validate(configData.config);
        
        if (!validation.valid) {
          result.errors.push(
            `Configuration ${i + 1}: Validation failed - ${validation.errors.map(e => e.message).join(', ')}`
          );
          continue;
        }

        // Check if configuration with same name already exists
        const existingConfig = await prisma.voiceProviderConfig.findFirst({
          where: {
            provider: configData.provider,
            name: configData.config.displayName
          }
        });

        if (existingConfig) {
          result.skipped++;
          result.warnings.push(
            `Configuration "${configData.config.displayName}" already exists and was skipped`
          );
          continue;
        }

        // Serialize configuration for storage
        const configJson = serializer.serialize(configData.config);

        // Check if this should be set as default
        let shouldBeDefault = configData.isDefault;
        
        // If importing as default, check if there's already a default for this provider
        if (shouldBeDefault) {
          const existingDefault = await prisma.voiceProviderConfig.findFirst({
            where: {
              provider: configData.provider,
              isDefault: true
            }
          });

          if (existingDefault) {
            shouldBeDefault = false;
            result.warnings.push(
              `Configuration "${configData.config.displayName}" was not set as default because one already exists`
            );
          }
        }

        // If setting as default, unset other defaults for this provider
        if (shouldBeDefault) {
          await prisma.voiceProviderConfig.updateMany({
            where: { 
              provider: configData.provider,
              isDefault: true 
            },
            data: { isDefault: false }
          });
        }

        // Create configuration
        await prisma.voiceProviderConfig.create({
          data: {
            provider: configData.provider,
            name: configData.config.displayName,
            isDefault: shouldBeDefault,
            configJson
          }
        });

        result.imported++;

      } catch (error) {
        result.errors.push(
          `Configuration ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Determine overall success
    result.success = result.errors.length === 0 || result.imported > 0;

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Failed to import voice configurations:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to import voice configurations',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}