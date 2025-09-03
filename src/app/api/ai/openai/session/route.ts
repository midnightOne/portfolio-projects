/**
 * OpenAI Realtime Session API Route
 * 
 * Generates ephemeral OpenAI client_secret tokens for WebRTC connections.
 * Implements secure server-side token generation with context injection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

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
    
    // Validate OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured');
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

    // Build system instructions with context
    let systemInstructions = `You are a helpful AI assistant for a portfolio website. 
You can help visitors learn about the portfolio owner's background, projects, and experience.
You have access to navigation tools to show relevant content and guide users through the portfolio.

Key capabilities:
- Answer questions about projects and experience
- Navigate users to relevant portfolio sections
- Highlight important content
- Provide technical explanations
- Analyze job requirements against the portfolio owner's background

Always be helpful, professional, and accurate. If you don't know something, say so rather than guessing.`;

    // TODO: Inject actual context from ContextProviderService based on contextId and reflinkId
    if (contextId) {
      systemInstructions += `\n\nContext ID: ${contextId}`;
    }
    
    if (reflinkId) {
      systemInstructions += `\n\nThis user has special access via reflink: ${reflinkId}`;
      // TODO: Add personalized context based on reflink
    }

    // Define navigation tools for OpenAI
    const navigationTools = [
      {
        type: 'function',
        function: {
          name: 'navigateTo',
          description: 'Navigate to a specific page or URL',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The path or URL to navigate to'
              },
              newTab: {
                type: 'boolean',
                description: 'Whether to open in a new tab',
                default: false
              }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'showProjectDetails',
          description: 'Show details for a specific project, optionally highlighting sections',
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'The ID or slug of the project to show'
              },
              highlightSections: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of section IDs to highlight',
                default: []
              }
            },
            required: ['projectId']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'highlightText',
          description: 'Highlight specific text or elements on the page',
          parameters: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for elements to search within'
              },
              text: {
                type: 'string',
                description: 'Specific text to highlight (optional)'
              }
            },
            required: ['selector']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'scrollIntoView',
          description: 'Scroll to bring a specific element into view',
          parameters: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element to scroll to'
              }
            },
            required: ['selector']
          }
        }
      }
    ];

    // Create OpenAI Realtime session
    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2025-06-03',
        voice: 'alloy',
        instructions: systemInstructions,
        tools: navigationTools,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
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
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate expiration (OpenAI sessions typically expire in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // TODO: Store session metadata in database for analytics
    // TODO: Track usage for cost monitoring

    const response: OpenAISessionResponse = {
      client_secret: sessionData.client_secret.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: 'gpt-4o-realtime-preview-2025-06-03',
      voice: 'alloy'
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
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build custom instructions
    let instructions = body.instructions || `You are a helpful AI assistant for a portfolio website.`;
    
    if (body.contextId) {
      // TODO: Load context from ContextProviderService
      instructions += `\n\nContext ID: ${body.contextId}`;
    }

    // Use custom tools or default navigation tools
    const tools = body.tools || [
      {
        type: 'function',
        function: {
          name: 'navigateTo',
          description: 'Navigate to a specific page or URL',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'The path or URL to navigate to' }
            },
            required: ['path']
          }
        }
      }
    ];

    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2025-06-03',
        voice: 'alloy',
        instructions,
        tools,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
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
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const response: OpenAISessionResponse = {
      client_secret: sessionData.client_secret.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: 'gpt-4o-realtime-preview-2025-06-03',
      voice: 'alloy'
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