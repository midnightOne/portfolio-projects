/**
 * ElevenLabs Conversation Token API Route
 * 
 * Generates ElevenLabs conversation tokens for signed URL conversations.
 * Manages agents and provides secure token generation with context injection.
 * Updated to use ClientAIModelManager and contextInjector for dynamic configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getClientAIModelManager } from '@/lib/voice/ClientAIModelManager';
import { contextInjector } from '@/lib/services/ai/context-injector';
import { getEnvironmentVariable } from '@/types/voice-config';
import type { ElevenLabsConfig } from '@/types/voice-config';

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
  clientToolsDefinitions: ToolDefinition[];
  overrides: {
    agent_prompt: string;
    first_message: string;
    language: string;
    voice_settings: any;
  };
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Server-safe UI navigation tool definitions (no document access)
function createServerSafeUINavigationToolDefinitions(): ToolDefinition[] {
  return [
    {
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
      name: 'scrollIntoView',
      description: 'Scroll to bring a specific element into view',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to scroll to'
          },
          behavior: {
            type: 'string',
            enum: ['auto', 'smooth'],
            description: 'Scroll behavior',
            default: 'smooth'
          }
        },
        required: ['selector']
      }
    },
    {
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
            description: 'Specific text to highlight (optional - if not provided, highlights entire elements)'
          },
          className: {
            type: 'string',
            description: 'CSS class name for highlighting',
            default: 'voice-highlight'
          }
        },
        required: ['selector']
      }
    },
    {
      name: 'clearHighlights',
      description: 'Clear all highlights from the page',
      parameters: {
        type: 'object',
        properties: {
          className: {
            type: 'string',
            description: 'CSS class name to remove',
            default: 'voice-highlight'
          }
        }
      }
    },
    {
      name: 'focusElement',
      description: 'Focus on a specific element and bring it into view',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to focus'
          }
        },
        required: ['selector']
      }
    }
  ];
}

export async function GET(request: NextRequest) {
  try {
    // Get request parameters
    const { searchParams } = new URL(request.url);
    const contextId = searchParams.get('contextId');
    const reflinkId = searchParams.get('reflinkId');
    const requestedAgentId = searchParams.get('agentId');
    const requestedVoiceId = searchParams.get('voiceId');
    
    // Load configuration from ClientAIModelManager
    const clientAIManager = getClientAIModelManager();
    let config: ElevenLabsConfig;
    
    try {
      const configWithMetadata = await clientAIManager.getProviderConfig('elevenlabs');
      config = configWithMetadata.config as ElevenLabsConfig;
    } catch (error) {
      console.error('Failed to load ElevenLabs configuration:', error);
      return NextResponse.json(
        { error: 'Failed to load voice AI configuration' },
        { status: 500 }
      );
    }

    // Validate ElevenLabs API key from configuration
    const elevenLabsApiKey = getEnvironmentVariable(config.apiKeyEnvVar || 'ELEVENLABS_API_KEY', true);
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

    // Generate session ID for context injection
    const sessionId = contextId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate ElevenLabs prompt with dynamic context injection
    const promptData = await contextInjector.generateElevenLabsPrompt(
      sessionId,
      reflinkId || undefined,
      'Initial conversation setup'
    );

    // Create client tools definitions for dynamic tool registration (server-safe)
    const uiNavigationToolDefs = createServerSafeUINavigationToolDefinitions();
    const clientToolsDefinitions: ToolDefinition[] = [...uiNavigationToolDefs];

    // Add server API tools
    clientToolsDefinitions.push(
      {
        name: 'loadContext',
        description: 'Load additional context from the server based on user query',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The user query to load context for'
            },
            contextType: {
              type: 'string',
              enum: ['projects', 'experience', 'skills', 'general'],
              description: 'Type of context to load'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'analyzeJobSpec',
        description: 'Analyze a job specification against the portfolio owner\'s background',
        parameters: {
          type: 'object',
          properties: {
            jobDescription: {
              type: 'string',
              description: 'The job description or specification to analyze'
            },
            focusAreas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific areas to focus the analysis on'
            }
          },
          required: ['jobDescription']
        }
      },
      {
        name: 'submitContactForm',
        description: 'Submit a contact form with user information',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User\'s name'
            },
            email: {
              type: 'string',
              description: 'User\'s email address'
            },
            message: {
              type: 'string',
              description: 'Message content'
            },
            subject: {
              type: 'string',
              description: 'Subject line'
            }
          },
          required: ['name', 'email', 'message']
        }
      }
    );

    // Build comprehensive overrides object with agent prompt, first message, language, and TTS settings
    const overrides = {
      agent_prompt: promptData.agent_prompt,
      first_message: promptData.first_message,
      language: promptData.language,
      voice_settings: {
        stability: config.voiceSettings.stability,
        similarity_boost: config.voiceSettings.similarityBoost,
        style: config.voiceSettings.style,
        use_speaker_boost: config.voiceSettings.useSpeakerBoost
      }
    };

    // Build agent configuration with server-injected context
    let agentConfig = {
      name: config.displayName || 'Portfolio AI Assistant',
      prompt: promptData.agent_prompt,
      voice_id: requestedVoiceId || config.voiceId,
      language: promptData.language,
      conversation_config: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: config.conversationConfig.enableInterruption ? 300 : 500,
          silence_duration_ms: config.conversationConfig.timeoutMs || 1000
        },
        max_duration: config.conversationConfig.maxDuration,
        enable_interruption: config.conversationConfig.enableInterruption,
        enable_backchannel: config.conversationConfig.enableBackchannel
      }
    };

    let agentId = requestedAgentId;

    // Get or use existing agent if not provided
    if (!agentId) {
      try {
        console.log('Fetching available ElevenLabs agents...');

        // First, try to get existing agents
        const agentsResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
          method: 'GET',
          headers: {
            'xi-api-key': elevenLabsApiKey,
          },
        });

        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json();
          console.log('Available ElevenLabs agents:', agentsData.agents?.length || 0);
          
          // Use the first available agent or the portfolio assistant if it exists
          const portfolioAgent = agentsData.agents?.find((agent: any) => 
            agent.name.toLowerCase().includes('portfolio') || 
            agent.name.toLowerCase().includes('assistant')
          );
          
          if (portfolioAgent) {
            agentId = portfolioAgent.agent_id;
            console.log(`Using existing portfolio agent: ${agentId} (${portfolioAgent.name})`);
          } else if (agentsData.agents?.length > 0) {
            agentId = agentsData.agents[0].agent_id;
            console.log(`Using first available agent: ${agentId} (${agentsData.agents[0].name})`);
          }
        }

        // If no existing agents found, try to create one
        if (!agentId) {
          console.log('No existing agents found, attempting to create new agent...');
          
          const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
            method: 'POST',
            headers: {
              'xi-api-key': elevenLabsApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(agentConfig),
          });

          if (agentResponse.ok) {
            const agentData = await agentResponse.json();
            agentId = agentData.agent_id;
            console.log(`Successfully created ElevenLabs agent: ${agentId}`);
          } else {
            const errorText = await agentResponse.text();
            console.error('ElevenLabs agent creation failed:', {
              status: agentResponse.status,
              statusText: agentResponse.statusText,
              error: errorText
            });
            
            // Fall back to config default if creation fails
            agentId = config.agentId || 'default-agent';
            console.log(`Using fallback agent ID from config: ${agentId}`);
          }
        }
        
      } catch (error) {
        console.error('Error managing ElevenLabs agent:', error);
        
        // Use fallback agent ID from config
        agentId = config.agentId || 'default-agent';
        console.log(`Using fallback agent ID due to error: ${agentId}`);
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
        voice_id: requestedVoiceId || config.voiceId,
        clientToolsDefinitions,
        overrides
      };

      // Store session metadata in database for analytics
      // TODO: Implement session tracking and cost monitoring

      // Log token generation (without sensitive data)
      console.log(`ElevenLabs token generated for agent: ${agentId}, IP: ${clientIP}, session: ${sessionId}`);

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
    
    // Load configuration from ClientAIModelManager
    const clientAIManager = getClientAIModelManager();
    let config: ElevenLabsConfig;
    
    try {
      const configWithMetadata = await clientAIManager.getProviderConfig('elevenlabs');
      config = configWithMetadata.config as ElevenLabsConfig;
    } catch (error) {
      console.error('Failed to load ElevenLabs configuration:', error);
      return NextResponse.json(
        { error: 'Failed to load voice AI configuration' },
        { status: 500 }
      );
    }

    // Validate ElevenLabs API key from configuration
    const elevenLabsApiKey = getEnvironmentVariable(config.apiKeyEnvVar || 'ELEVENLABS_API_KEY', true);
    if (!elevenLabsApiKey) {
      console.error('ElevenLabs API key not configured');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Generate session ID for context injection
    const sessionId = body.contextId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate ElevenLabs prompt with dynamic context injection
    const promptData = await contextInjector.generateElevenLabsPrompt(
      sessionId,
      body.reflinkId || undefined,
      'Custom conversation setup'
    );

    // Create client tools definitions for dynamic tool registration (server-safe)
    const uiNavigationToolDefs = createServerSafeUINavigationToolDefinitions();
    const clientToolsDefinitions: ToolDefinition[] = [...uiNavigationToolDefs];

    // Add server API tools
    clientToolsDefinitions.push(
      {
        name: 'loadContext',
        description: 'Load additional context from the server based on user query',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The user query to load context for'
            },
            contextType: {
              type: 'string',
              enum: ['projects', 'experience', 'skills', 'general'],
              description: 'Type of context to load'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'analyzeJobSpec',
        description: 'Analyze a job specification against the portfolio owner\'s background',
        parameters: {
          type: 'object',
          properties: {
            jobDescription: {
              type: 'string',
              description: 'The job description or specification to analyze'
            },
            focusAreas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific areas to focus the analysis on'
            }
          },
          required: ['jobDescription']
        }
      },
      {
        name: 'submitContactForm',
        description: 'Submit a contact form with user information',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User\'s name'
            },
            email: {
              type: 'string',
              description: 'User\'s email address'
            },
            message: {
              type: 'string',
              description: 'Message content'
            },
            subject: {
              type: 'string',
              description: 'Subject line'
            }
          },
          required: ['name', 'email', 'message']
        }
      }
    );

    // Build comprehensive overrides object
    const overrides = {
      agent_prompt: promptData.agent_prompt,
      first_message: promptData.first_message,
      language: promptData.language,
      voice_settings: {
        stability: config.voiceSettings.stability,
        similarity_boost: config.voiceSettings.similarityBoost,
        style: config.voiceSettings.style,
        use_speaker_boost: config.voiceSettings.useSpeakerBoost
      }
    };

    // Build custom agent configuration with server-injected context
    let agentConfig = {
      name: config.displayName || 'Portfolio AI Assistant',
      prompt: promptData.agent_prompt,
      voice_id: body.voiceId || config.voiceId,
      language: promptData.language,
      conversation_config: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: config.conversationConfig.enableInterruption ? 300 : 500,
          silence_duration_ms: config.conversationConfig.timeoutMs || 1000
        },
        max_duration: config.conversationConfig.maxDuration,
        enable_interruption: config.conversationConfig.enableInterruption,
        enable_backchannel: config.conversationConfig.enableBackchannel
      }
    };

    let agentId = body.agentId;

    // Create agent if not provided
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
        voice_id: body.voiceId || config.voiceId,
        clientToolsDefinitions,
        overrides
      };

      return NextResponse.json(response);

    } catch (error) {
      console.error('Error generating ElevenLabs token:', error);
      return NextResponse.json(
        { error: 'Failed to generate token' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error creating ElevenLabs token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}