import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { VoiceProviderConfig, getEnvironmentVariable } from '@/types/voice-config';
import { getSerializerForProvider } from '@/lib/voice/config-serializers';

// POST /api/admin/ai/voice-config/test - Test voice configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { provider, config }: { provider: 'openai' | 'elevenlabs'; config: VoiceProviderConfig } = await request.json();

    if (!provider || !config) {
      return NextResponse.json(
        { success: false, error: { message: 'Provider and config are required' } },
        { status: 400 }
      );
    }

    // Validate configuration first
    const serializer = getSerializerForProvider(provider);
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

    // Test provider-specific functionality
    if (provider === 'openai') {
      return await testOpenAIConfiguration(config);
    } else if (provider === 'elevenlabs') {
      return await testElevenLabsConfiguration(config);
    } else {
      return NextResponse.json(
        { success: false, error: { message: 'Unsupported provider' } },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Failed to test voice configuration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to test voice configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

async function testOpenAIConfiguration(config: VoiceProviderConfig) {
  try {
    // Get API key from environment
    const apiKey = getEnvironmentVariable(config.apiKeyEnvVar || 'OPENAI_API_KEY', true);
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'OpenAI API key not found',
            details: `Environment variable ${config.apiKeyEnvVar || 'OPENAI_API_KEY'} is not set`
          } 
        },
        { status: 400 }
      );
    }

    // Test basic API connectivity
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'OpenAI API connection failed',
            details: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
          } 
        },
        { status: 400 }
      );
    }

    const models = await response.json();
    const realtimeModels = models.data?.filter((model: any) => 
      model.id.includes('realtime') || model.id.includes('gpt-4o')
    ) || [];

    return NextResponse.json({
      success: true,
      message: `OpenAI connection successful. Found ${realtimeModels.length} compatible models.`,
      data: {
        modelsFound: realtimeModels.length,
        compatibleModels: realtimeModels.map((m: any) => m.id).slice(0, 5)
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'OpenAI configuration test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

async function testElevenLabsConfiguration(config: VoiceProviderConfig) {
  try {
    // Get API key from environment
    const apiKey = getEnvironmentVariable(config.apiKeyEnvVar || 'ELEVENLABS_API_KEY', true);
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'ElevenLabs API key not found',
            details: `Environment variable ${config.apiKeyEnvVar || 'ELEVENLABS_API_KEY'} is not set`
          } 
        },
        { status: 400 }
      );
    }

    // Test basic API connectivity
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'ElevenLabs API connection failed',
            details: errorData.detail?.message || `HTTP ${response.status}: ${response.statusText}`
          } 
        },
        { status: 400 }
      );
    }

    const userData = await response.json();

    // Test voices endpoint
    const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    let voiceCount = 0;
    if (voicesResponse.ok) {
      const voicesData = await voicesResponse.json();
      voiceCount = voicesData.voices?.length || 0;
    }

    return NextResponse.json({
      success: true,
      message: `ElevenLabs connection successful. Account: ${userData.subscription?.tier || 'Free'}. Found ${voiceCount} voices.`,
      data: {
        subscription: userData.subscription?.tier || 'Free',
        voicesFound: voiceCount,
        characterCount: userData.subscription?.character_count || 0,
        characterLimit: userData.subscription?.character_limit || 0
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'ElevenLabs configuration test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}