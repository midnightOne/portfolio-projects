/**
 * ElevenLabs Conversation Token API Route
 * 
 * Generates ElevenLabs conversation tokens for signed URL conversations.
 * Manages agents and provides secure token generation with context injection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

interface ElevenLabsTokenRequest {
  contextId?: string;
  reflinkId?: string;
  agentId?: string;
  voiceId?: string;
}

interface ElevenLabsTokenResponse {
  conversation_token: string;
  agent_id: string;
  signed_url: string;
  expires_at: string;
  voice_id: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get request parameters
    const { searchParams } = new URL(request.url);
    const contextId = searchParams.get('contextId');
    const reflinkId = searchParams.get('reflinkId');
    const requestedAgentId = searchParams.get('agentId');
    const requestedVoiceId = searchParams.get('voiceId') || 'default';
    
    // Validate ElevenLabs API key
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      console.error('ElevenLabs API key not configured');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Get client IP for rate limiting
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for') || 
                    headersList.get('x-real-ip') || 
                    'unknown';

    // TODO: Implement rate limiting based on IP and reflink
    // TODO: Validate reflink and get access level
    // TODO: Load context from ContextProviderService

    // Build agent configuration with context
    let agentConfig = {
      name: 'Portfolio AI Assistant',
      prompt: `You are a helpful AI assistant for a portfolio website. 
You can help visitors learn about the portfolio owner's background, projects, and experience.
You have access to navigation tools to show relevant content and guide users through the portfolio.

Key capabilities:
- Answer questions about projects and experience
- Navigate users to relevant portfolio sections
- Highlight important content
- Provide technical explanations
- Analyze job requirements against the portfolio owner's background

Always be helpful, professional, and accurate. If you don't know something, say so rather than guessing.

When you want to navigate or show content, use the available tools to guide the user through the portfolio.`,
      voice_id: requestedVoiceId,
      language: 'en',
      conversation_config: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        }
      }
    };

    // TODO: Inject actual context from ContextProviderService based on contextId and reflinkId
    if (contextId) {
      agentConfig.prompt += `\n\nContext ID: ${contextId}`;
    }
    
    if (reflinkId) {
      agentConfig.prompt += `\n\nThis user has special access via reflink: ${reflinkId}`;
      // TODO: Add personalized context based on reflink
    }

    let agentId = requestedAgentId;

    // Create or get agent if not provided
    if (!agentId) {
      try {
        const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(agentConfig),
        });

        if (!agentResponse.ok) {
          const errorText = await agentResponse.text();
          console.error('ElevenLabs agent creation failed:', errorText);
          return NextResponse.json(
            { error: 'Failed to create ElevenLabs agent' },
            { status: agentResponse.status }
          );
        }

        const agentData = await agentResponse.json();
        agentId = agentData.agent_id;
        
        console.log(`Created ElevenLabs agent: ${agentId}`);
      } catch (error) {
        console.error('Error creating ElevenLabs agent:', error);
        return NextResponse.json(
          { error: 'Failed to create agent' },
          { status: 500 }
        );
      }
    }

    // Generate conversation token
    try {
      const tokenResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}/token`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Additional configuration can be added here
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('ElevenLabs token generation failed:', errorText);
        return NextResponse.json(
          { error: 'Failed to generate conversation token' },
          { status: tokenResponse.status }
        );
      }

      const tokenData = await tokenResponse.json();
      
      // Calculate expiration (ElevenLabs tokens typically expire in 1 hour)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      // Generate signed URL for WebSocket connection
      const signedUrl = `wss://api.elevenlabs.io/v1/convai/agents/${agentId}/conversation?token=${tokenData.token}`;

      const response: ElevenLabsTokenResponse = {
        conversation_token: tokenData.token,
        agent_id: agentId!,
        signed_url: signedUrl,
        expires_at: expiresAt,
        voice_id: requestedVoiceId
      };

      // TODO: Store session metadata in database for analytics
      // TODO: Track usage for cost monitoring

      // Log token generation (without sensitive data)
      console.log(`ElevenLabs token generated for agent: ${agentId}, IP: ${clientIP}`);

      return NextResponse.json(response);

    } catch (error) {
      console.error('Error generating ElevenLabs token:', error);
      return NextResponse.json(
        { error: 'Failed to generate token' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in ElevenLabs token endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ElevenLabsTokenRequest = await request.json();
    
    // Handle POST requests with custom configuration
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Build custom agent configuration
    let agentConfig = {
      name: 'Portfolio AI Assistant',
      prompt: `You are a helpful AI assistant for a portfolio website.`,
      voice_id: body.voiceId || 'default',
      language: 'en',
      conversation_config: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        }
      }
    };
    
    if (body.contextId) {
      // TODO: Load context from ContextProviderService
      agentConfig.prompt += `\n\nContext ID: ${body.contextId}`;
    }

    let agentId = body.agentId;

    // Create agent if not provided
    if (!agentId) {
      const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentConfig),
      });

      if (!agentResponse.ok) {
        const errorText = await agentResponse.text();
        console.error('ElevenLabs agent creation failed:', errorText);
        return NextResponse.json(
          { error: 'Failed to create ElevenLabs agent' },
          { status: agentResponse.status }
        );
      }

      const agentData = await agentResponse.json();
      agentId = agentData.agent_id;
    }

    // Generate conversation token
    const tokenResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}/token`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('ElevenLabs token generation failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate conversation token' },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const signedUrl = `wss://api.elevenlabs.io/v1/convai/agents/${agentId}/conversation?token=${tokenData.token}`;

    const response: ElevenLabsTokenResponse = {
      conversation_token: tokenData.token,
      agent_id: agentId!,
      signed_url: signedUrl,
      expires_at: expiresAt,
      voice_id: body.voiceId || 'default'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating ElevenLabs token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}