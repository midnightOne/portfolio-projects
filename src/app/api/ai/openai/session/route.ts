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

Communication guidelines:
- Always respond in English unless specifically asked to use another language
- Keep responses concise and conversational
- Be helpful, professional, and accurate
- If you don't know something, say so rather than guessing
- Use a friendly, approachable tone suitable for a professional portfolio

Audio interaction:
- Speak clearly and at a moderate pace
- Use natural speech patterns
- Acknowledge when you hear the user speaking
- Wait for the user to finish before responding`;

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
      },
      {
        type: 'function',
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
      },
      {
        type: 'function',
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
      },
      {
        type: 'function',
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
    ];

    // Create OpenAI Realtime session using sessions API with context injection
    
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
          model: 'gpt-realtime',
          // Server-side context injection - instructions are injected here and not visible to client
          instructions: systemInstructions,
          // Server-side tool definitions injection
          tools: navigationTools,
          // Audio configuration with proper structure
          audio: {
            input: {
              format: {
                type: 'audio/pcm',
                rate: 24000
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 200,
                create_response: true,
                interrupt_response: true
              },
              transcription: {
                model: 'whisper-1'
              }
            },
            output: {
              format: {
                type: 'audio/pcm',
                rate: 24000
              },
              voice: 'alloy'
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
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate expiration (OpenAI sessions typically expire in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // TODO: Store session metadata in database for analytics
    // TODO: Track usage for cost monitoring

    const response: OpenAISessionResponse = {
      client_secret: sessionData.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: 'gpt-realtime',
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
    ];
    
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
          model: 'gpt-realtime',
          // Server-side context injection - instructions are injected here and not visible to client
          instructions: instructions,
          // Server-side tool definitions injection
          tools: tools,
          // Audio configuration with proper structure
          audio: {
            input: {
              format: {
                type: 'audio/pcm',
                rate: 24000
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 200,
                create_response: true,
                interrupt_response: true
              },
              transcription: {
                model: 'whisper-1'
              }
            },
            output: {
              format: {
                type: 'audio/pcm',
                rate: 24000
              },
              voice: 'alloy'
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
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const response: OpenAISessionResponse = {
      client_secret: sessionData.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: 'gpt-4o-realtime-preview',
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