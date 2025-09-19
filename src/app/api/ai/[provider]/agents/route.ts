/**
 * Provider-Specific Agents API Route
 * 
 * Handles agent metadata and management for different voice AI providers.
 * Supports both OpenAI and ElevenLabs agent configurations.
 * Uses the ClientAIModelManager for consistent provider configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientAIModelManager } from '../../../../../lib/voice/ClientAIModelManager';
import { OpenAIRealtimeConfig, ElevenLabsConfig } from '../../../../../lib/voice/config-serializers';

interface AgentMetadata {
  id: string;
  name: string;
  provider: 'openai' | 'elevenlabs';
  model?: string;
  voice?: string;
  capabilities: string[];
  description: string;
  created_at: string;
  updated_at: string;
}

interface AgentsResponse {
  success: boolean;
  agents: AgentMetadata[];
  total: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as 'openai' | 'elevenlabs';

  try {

    if (!['openai', 'elevenlabs'].includes(provider)) {
      return NextResponse.json(
        { success: false, message: 'Invalid provider. Must be "openai" or "elevenlabs"' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    let agents: AgentMetadata[] = [];

    if (provider === 'openai') {
      // Get OpenAI configuration using ClientAIModelManager
      const modelManager = getClientAIModelManager();
      let defaultConfig: OpenAIRealtimeConfig;
      
      try {
        const configWithMetadata = await modelManager.getProviderConfig('openai');
        if (configWithMetadata) {
          defaultConfig = configWithMetadata.config as OpenAIRealtimeConfig;
        } else {
          // Fallback to default config
          const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
          const openaiSerializer = getSerializerForProvider('openai');
          defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
        }
      } catch (error) {
        // Fallback to default config
        const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
        const openaiSerializer = getSerializerForProvider('openai');
        defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
      }
      
      // Generate agent configurations based on available voices
      const availableVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'shimmer', 'sage', 'verse', 'marin', 'cedar'] as const;
      
      agents = availableVoices.map(voice => ({
        id: `gpt-realtime-${voice}`,
        name: `${defaultConfig.displayName} (${voice.charAt(0).toUpperCase() + voice.slice(1)})`,
        provider: 'openai' as const,
        model: defaultConfig.model,
        voice: voice,
        capabilities: [
          'real-time-stt',
          'real-time-tts',
          'tool-calling',
          'interruption-handling',
          'voice-activity-detection',
          'webrtc-transport'
        ],
        description: `${defaultConfig.description} with ${voice.charAt(0).toUpperCase() + voice.slice(1)} voice`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
    } else if (provider === 'elevenlabs') {
      // Get ElevenLabs configuration using ClientAIModelManager
      const modelManager = getClientAIModelManager();
      let defaultConfig: ElevenLabsConfig;
      
      try {
        const configWithMetadata = await modelManager.getProviderConfig('elevenlabs');
        if (configWithMetadata) {
          defaultConfig = configWithMetadata.config as ElevenLabsConfig;
        } else {
          // Fallback to default config
          const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
          const elevenLabsSerializer = getSerializerForProvider('elevenlabs');
          defaultConfig = elevenLabsSerializer.getDefaultConfig() as ElevenLabsConfig;
        }
      } catch (error) {
        // Fallback to default config
        const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
        const elevenLabsSerializer = getSerializerForProvider('elevenlabs');
        defaultConfig = elevenLabsSerializer.getDefaultConfig() as ElevenLabsConfig;
      }
      
      // For ElevenLabs, we would typically fetch actual agents from their API
      const { getEnvironmentVariable } = await import('../../../../../types/voice-config');
      const elevenLabsApiKey = getEnvironmentVariable('ELEVENLABS_API_KEY', false);

      if (elevenLabsApiKey) {
        try {
          const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
            headers: {
              'xi-api-key': elevenLabsApiKey,
            },
          });

          if (response.ok) {
            const data = await response.json();
            agents = data.agents?.map((agent: any) => ({
              id: agent.agent_id,
              name: agent.name || 'Unnamed Agent',
              provider: 'elevenlabs' as const,
              voice: agent.voice_id,
              capabilities: [
                'real-time-conversation',
                'agent-management',
                'signed-url-conversations',
                'tool-calling',
                'real-time-audio'
              ],
              description: agent.prompt || defaultConfig.description,
              created_at: agent.created_at || new Date().toISOString(),
              updated_at: agent.updated_at || new Date().toISOString()
            })) || [];
          } else {
            console.error('Failed to fetch ElevenLabs agents:', response.statusText);
          }
        } catch (error) {
          console.error('Error fetching ElevenLabs agents:', error);
        }
      }

      // If no agents found or API call failed, return default configuration
      if (agents.length === 0) {
        agents = [
          {
            id: 'elevenlabs-default',
            name: defaultConfig.displayName,
            provider: 'elevenlabs',
            voice: defaultConfig.voiceId,
            capabilities: [
              'real-time-conversation',
              'agent-management',
              'signed-url-conversations',
              'tool-calling',
              'real-time-audio'
            ],
            description: defaultConfig.description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      }
    }

    // Apply pagination
    const paginatedAgents = agents.slice(offset, offset + limit);

    const response: AgentsResponse = {
      success: true,
      agents: paginatedAgents,
      total: agents.length
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error(`Error fetching ${provider} agents:`, error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as 'openai' | 'elevenlabs';

  try {

    if (!['openai', 'elevenlabs'].includes(provider)) {
      return NextResponse.json(
        { success: false, message: 'Invalid provider. Must be "openai" or "elevenlabs"' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (provider === 'openai') {
      // Get OpenAI configuration using ClientAIModelManager
      const modelManager = getClientAIModelManager();
      let defaultConfig: OpenAIRealtimeConfig;
      
      try {
        const configWithMetadata = await modelManager.getProviderConfig('openai');
        if (configWithMetadata) {
          defaultConfig = configWithMetadata.config as OpenAIRealtimeConfig;
        } else {
          // Fallback to default config
          const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
          const openaiSerializer = getSerializerForProvider('openai');
          defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
        }
      } catch (error) {
        // Fallback to default config
        const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
        const openaiSerializer = getSerializerForProvider('openai');
        defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
      }
      
      // OpenAI doesn't support creating persistent agents
      // Return the configuration that would be used
      const agentConfig = {
        id: `gpt-realtime-${Date.now()}`,
        name: body.name || defaultConfig.displayName,
        provider: 'openai' as const,
        model: body.model || defaultConfig.model,
        voice: body.voice || defaultConfig.voice,
        capabilities: [
          'real-time-stt',
          'real-time-tts',
          'tool-calling',
          'interruption-handling',
          'voice-activity-detection',
          'webrtc-transport'
        ],
        description: body.description || defaultConfig.description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return NextResponse.json({
        success: true,
        agent: agentConfig,
        message: 'OpenAI agent configuration created (session-based)'
      });

    } else if (provider === 'elevenlabs') {
      // Get ElevenLabs configuration using ClientAIModelManager
      const modelManager = getClientAIModelManager();
      let defaultConfig: ElevenLabsConfig;
      
      try {
        const configWithMetadata = await modelManager.getProviderConfig('elevenlabs');
        if (configWithMetadata) {
          defaultConfig = configWithMetadata.config as ElevenLabsConfig;
        } else {
          // Fallback to default config
          const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
          const elevenLabsSerializer = getSerializerForProvider('elevenlabs');
          defaultConfig = elevenLabsSerializer.getDefaultConfig() as ElevenLabsConfig;
        }
      } catch (error) {
        // Fallback to default config
        const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
        const elevenLabsSerializer = getSerializerForProvider('elevenlabs');
        defaultConfig = elevenLabsSerializer.getDefaultConfig() as ElevenLabsConfig;
      }
      
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

      if (!elevenLabsApiKey) {
        return NextResponse.json(
          { success: false, message: 'ElevenLabs API key not configured' },
          { status: 500 }
        );
      }

      // Create ElevenLabs agent using config defaults
      const agentConfig = {
        name: body.name || defaultConfig.displayName,
        prompt: body.prompt || body.description || defaultConfig.description,
        voice_id: body.voice || body.voiceId || defaultConfig.voiceId,
        language: body.language || defaultConfig.conversationConfig.language,
        conversation_config: body.conversationConfig || defaultConfig.conversationConfig
      };

      const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentConfig),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs agent creation failed:', errorText);
        return NextResponse.json(
          { success: false, message: 'Failed to create ElevenLabs agent' },
          { status: response.status }
        );
      }

      const agentData = await response.json();

      const agent: AgentMetadata = {
        id: agentData.agent_id,
        name: agentData.name,
        provider: 'elevenlabs',
        voice: agentData.voice_id,
        capabilities: [
          'real-time-conversation',
          'agent-management',
          'signed-url-conversations',
          'tool-calling',
          'real-time-audio'
        ],
        description: agentData.prompt,
        created_at: agentData.created_at || new Date().toISOString(),
        updated_at: agentData.updated_at || new Date().toISOString()
      };

      return NextResponse.json({
        success: true,
        agent,
        message: 'ElevenLabs agent created successfully'
      });
    }

  } catch (error) {
    console.error(`Error creating ${provider} agent:`, error);
    return NextResponse.json(
      { success: false, message: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as 'openai' | 'elevenlabs';

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { success: false, message: 'Agent ID is required' },
        { status: 400 }
      );
    }

    if (provider === 'openai') {
      // OpenAI doesn't have persistent agents to delete
      return NextResponse.json({
        success: true,
        message: 'OpenAI agents are session-based and automatically cleaned up'
      });

    } else if (provider === 'elevenlabs') {
      const { getEnvironmentVariable } = await import('../../../../../types/voice-config');
      let elevenLabsApiKey: string;
      
      try {
        elevenLabsApiKey = getEnvironmentVariable('ELEVENLABS_API_KEY', true)!;
      } catch (error) {
        console.error('ElevenLabs API key validation failed:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json(
          { success: false, message: 'ElevenLabs API key not configured' },
          { status: 500 }
        );
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': elevenLabsApiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs agent deletion failed:', errorText);
        return NextResponse.json(
          { success: false, message: 'Failed to delete ElevenLabs agent' },
          { status: response.status }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'ElevenLabs agent deleted successfully'
      });
    }

  } catch (error) {
    console.error(`Error deleting ${provider} agent:`, error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}