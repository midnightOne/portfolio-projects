/**
 * OpenAI Realtime Session API Route
 * 
 * Generates ephemeral OpenAI client_secret tokens for WebRTC connections.
 * Implements secure server-side token generation with context injection.
 * Uses the ClientAIModelManager for consistent OpenAI configuration management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getClientAIModelManager } from '../../../../../lib/voice/ClientAIModelManager';
import { OpenAIRealtimeConfig } from '../../../../../types/voice-config';
import { unifiedToolRegistry } from '../../../../../lib/ai/tools/UnifiedToolRegistry';

interface OpenAISessionRequest {
  contextId?: string;
  reflinkId?: string;
  instructions?: string;
  tools?: any[];
}

interface OpenAISessionResponse {
  client_secret: string;
  session_id: string;
  expires_at: string;
  model: string;
  voice: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get request parameters
    const { searchParams } = new URL(request.url);
    const contextId = searchParams.get('contextId');
    const reflinkId = searchParams.get('reflinkId');

    // Validate OpenAI API key using centralized environment validation
    const { getEnvironmentVariable } = await import('../../../../../types/voice-config');
    let openaiApiKey: string;
    
    try {
      openaiApiKey = getEnvironmentVariable('OPENAI_API_KEY', true)!;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Get client IP for rate limiting (basic implementation)
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for') ||
      headersList.get('x-real-ip') ||
      'unknown';

    // TODO: Implement rate limiting based on IP and reflink
    // TODO: Validate reflink and get access level
    // TODO: Load context from ContextProviderService

    // Get OpenAI configuration using ClientAIModelManager
    const modelManager = getClientAIModelManager();
    let defaultConfig: OpenAIRealtimeConfig;
    
    try {
      const configWithMetadata = await modelManager.getProviderConfig('openai');
      
      if (configWithMetadata) {
        defaultConfig = configWithMetadata.config as OpenAIRealtimeConfig;
        console.log(`Using database OpenAI config: ${configWithMetadata.name}`);
      } else {
        // Fallback to default config if no database config found
        const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
        const openaiSerializer = getSerializerForProvider('openai');
        defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
        console.log('Using fallback OpenAI config (no database config found)');
      }
    } catch (error) {
      console.warn('Failed to load OpenAI config from ClientAIModelManager, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to default config
      const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
      const openaiSerializer = getSerializerForProvider('openai');
      defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
    }

    // CRITICAL FIX: Synchronize voice settings between top-level and sessionConfig
    // The top-level 'voice' property should always match sessionConfig.audio.output.voice
    if (defaultConfig.voice !== defaultConfig.sessionConfig.audio.output.voice) {
      console.log(`Voice synchronization: Updating sessionConfig.audio.output.voice from '${defaultConfig.sessionConfig.audio.output.voice}' to '${defaultConfig.voice}'`);
      defaultConfig.sessionConfig.audio.output.voice = defaultConfig.voice;
    }

    // Build system instructions with context (using config as base)
    let systemInstructions = defaultConfig.instructions;
    
    // Add specific guidance for project navigation
    systemInstructions += `\n\nIMPORTANT TOOL USAGE GUIDELINES:
- When users ask to "open", "navigate to", "show me", or "go to" any project, ALWAYS use the "openProject" tool first
- Do NOT use "searchProjects" followed by "navigateTo" - use "openProject" instead as it handles both steps
- The "openProject" tool will search for the project and provide the correct navigation URL
- Only use "navigateTo" with exact URLs that you already know are correct
- Examples: "open e-commerce project" → use openProject("e-commerce project")`;

    // TODO: Inject actual context from ContextProviderService based on contextId and reflinkId
    if (contextId) {
      systemInstructions += `\n\nContext ID: ${contextId}`;
    }

    if (reflinkId) {
      systemInstructions += `\n\nThis user has special access via reflink: ${reflinkId}`;
      // TODO: Add personalized context based on reflink
    }

    console.log('System instructions:', systemInstructions);

    // Get all tools from unified tool registry (no duplicates)
    const allTools = unifiedToolRegistry.getOpenAIToolsArray();
    console.log('All tools:', allTools);
    //defaultConfig.sessionConfig.audio.output.voice = 'cedar';
    console.log('Voice:',  defaultConfig.sessionConfig.audio.output.voice);

    // Create OpenAI Realtime session using config system
    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: defaultConfig.model,
          // Server-side context injection - instructions are injected here and not visible to client
          instructions: systemInstructions,
          // Server-side tool definitions injection
          tools: allTools,
          // Audio configuration from config system
          audio: {
            input: {
              format: {
                type: 'audio/pcm',
                rate: defaultConfig.sessionConfig.audio.input.format.rate
              },
              turn_detection: {
                type: defaultConfig.sessionConfig.audio.input.turnDetection.type,
                threshold: defaultConfig.sessionConfig.audio.input.turnDetection.threshold,
                prefix_padding_ms: defaultConfig.sessionConfig.audio.input.turnDetection.prefixPaddingMs,
                silence_duration_ms: defaultConfig.sessionConfig.audio.input.turnDetection.silenceDurationMs,
                create_response: defaultConfig.sessionConfig.audio.input.turnDetection.createResponse,
                interrupt_response: defaultConfig.sessionConfig.audio.input.turnDetection.interruptResponse
              },
              transcription: {
                model: defaultConfig.sessionConfig.audio.input.transcription?.model || 'whisper-1'
              }
            },
            output: {
              format: {
                type: 'audio/pcm',
                rate: defaultConfig.sessionConfig.audio.output.format.rate
              },
              voice: defaultConfig.sessionConfig.audio.output.voice
            }
          }
        }
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('OpenAI session creation failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to create OpenAI session' },
        { status: sessionResponse.status }
      );
    }

    const sessionData = await sessionResponse.json();

    // Generate session ID for tracking
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Calculate expiration (OpenAI sessions typically expire in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // TODO: Store session metadata in database for analytics
    // TODO: Track usage for cost monitoring

    const response: OpenAISessionResponse = {
      client_secret: sessionData.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: defaultConfig.model,
      voice: defaultConfig.sessionConfig.audio.output.voice
    };

    // Log session creation (without sensitive data)
    console.log(`OpenAI session created: ${sessionId} for IP: ${clientIP}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: OpenAISessionRequest = await request.json();

    // Handle POST requests with custom configuration
    // This allows for more complex session setup with custom instructions and tools

    // Validate OpenAI API key using centralized environment validation
    const { getEnvironmentVariable } = await import('../../../../../types/voice-config');
    let openaiApiKey: string;
    
    try {
      openaiApiKey = getEnvironmentVariable('OPENAI_API_KEY', true)!;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Get OpenAI configuration using ClientAIModelManager
    const modelManager = getClientAIModelManager();
    let defaultConfig: OpenAIRealtimeConfig;
    
    try {
      const configWithMetadata = await modelManager.getProviderConfig('openai');
      
      if (configWithMetadata) {
        defaultConfig = configWithMetadata.config as OpenAIRealtimeConfig;
        console.log(`Using database OpenAI config: ${configWithMetadata.name}`);
      } else {
        // Fallback to default config if no database config found
        const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
        const openaiSerializer = getSerializerForProvider('openai');
        defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
        console.log('Using fallback OpenAI config (no database config found)');
      }
    } catch (error) {
      console.warn('Failed to load OpenAI config from ClientAIModelManager, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to default config
      const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
      const openaiSerializer = getSerializerForProvider('openai');
      defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
    }

    // CRITICAL FIX: Synchronize voice settings between top-level and sessionConfig
    // The top-level 'voice' property should always match sessionConfig.audio.output.voice
    if (defaultConfig.voice !== defaultConfig.sessionConfig.audio.output.voice) {
      console.log(`Voice synchronization (POST): Updating sessionConfig.audio.output.voice from '${defaultConfig.sessionConfig.audio.output.voice}' to '${defaultConfig.voice}'`);
      defaultConfig.sessionConfig.audio.output.voice = defaultConfig.voice;
    }

    // Build custom instructions (use config default if not provided)
    let instructions = body.instructions || defaultConfig.instructions;

    if (body.contextId) {
      // TODO: Load context from ContextProviderService
      instructions += `\n\nContext ID: ${body.contextId}`;
    }

    // Use custom tools or default from unified registry
    const tools = body.tools || unifiedToolRegistry.getOpenAIToolsArray();

    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: defaultConfig.model,
          // Server-side context injection - instructions are injected here and not visible to client
          instructions: instructions,
          // Server-side tool definitions injection
          tools: tools,
          // Audio configuration from config system
          audio: {
            input: {
              format: {
                type: 'audio/pcm',
                rate: defaultConfig.sessionConfig.audio.input.format.rate
              },
              turn_detection: {
                type: defaultConfig.sessionConfig.audio.input.turnDetection.type,
                threshold: defaultConfig.sessionConfig.audio.input.turnDetection.threshold,
                prefix_padding_ms: defaultConfig.sessionConfig.audio.input.turnDetection.prefixPaddingMs,
                silence_duration_ms: defaultConfig.sessionConfig.audio.input.turnDetection.silenceDurationMs,
                create_response: defaultConfig.sessionConfig.audio.input.turnDetection.createResponse,
                interrupt_response: defaultConfig.sessionConfig.audio.input.turnDetection.interruptResponse
              },
              transcription: {
                model: defaultConfig.sessionConfig.audio.input.transcription?.model || 'whisper-1'
              }
            },
            output: {
              format: {
                type: 'audio/pcm',
                rate: defaultConfig.sessionConfig.audio.output.format.rate
              },
              voice: defaultConfig.sessionConfig.audio.output.voice
            }
          }
        }
      }),
    });

    console.log('2Voice:',  defaultConfig.sessionConfig.audio.output.voice);

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('OpenAI session creation failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to create OpenAI session' },
        { status: sessionResponse.status }
      );
    }

    const sessionData = await sessionResponse.json();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const response: OpenAISessionResponse = {
      client_secret: sessionData.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: defaultConfig.model,
      voice: defaultConfig.sessionConfig.audio.output.voice
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}