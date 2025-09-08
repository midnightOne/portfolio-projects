/**
 * ElevenLabs Conversational AI Adapter
 * 
 * PRODUCTION implementation using @elevenlabs/client library for native client-side tool support.
 * This adapter uses the Conversation.startSession() approach for real-time conversations with
 * proper WebRTC connection management and native tool execution.
 */

import { v4 as uuidv4 } from 'uuid';
import { Conversation, type PartialOptions } from '@elevenlabs/client';
import {
  VoiceProvider,
  AdapterInitOptions,
  TranscriptItem,
  ToolCall,
  ToolResult,
  ProviderMetadata,
  VoiceAgentError,
  ConnectionError,
  AudioError,
  ToolError,
  ElevenLabsConversationConfig
} from '@/types/voice-agent';
import { BaseConversationalAgentAdapter } from './IConversationalAgentAdapter';
import { getClientAIModelManager } from './ClientAIModelManager';
import { ElevenLabsConfig } from '@/types/voice-config';

interface ElevenLabsTokenResponse {
  conversation_token?: string;
  agent_id?: string;
  signed_url?: string;
  expires_at?: string;
  // New format for @elevenlabs/client
  agentId?: string;
  conversationToken?: string;
  signedUrl?: string;
}

export class ElevenLabsAdapter extends BaseConversationalAgentAdapter {
  private _conversationInstance: Conversation | null = null;
  private _config: ElevenLabsConfig | null = null;
  private _reconnectTimer: NodeJS.Timeout | null = null;
  private _reconnectAttempts: number = 0;
  private _maxReconnectAttempts: number = 3;
  private _conversationId: string | null = null;
  private _isRecording: boolean = false;

  constructor() {
    // Initialize with default metadata - will be updated when config is loaded
    const metadata: ProviderMetadata = {
      provider: 'elevenlabs',
      model: 'conversational-ai',
      version: '1.0.0',
      capabilities: [
        'real-time-conversation',
        'agent-management',
        'signed-url-conversations',
        'tool-calling',
        'real-time-audio'
      ],
      latency: 300, // ~300ms typical latency
      quality: 'high'
    };

    super('elevenlabs', metadata);
    // Don't load configuration in constructor - defer to init() method
  }

  /**
   * Load configuration with environment-aware approach
   */
  private async _loadConfiguration(): Promise<void> {
    try {
      // Check if we're on the server side or client side
      if (typeof window === 'undefined') {
        // Server side - use ClientAIModelManager directly
        const modelManager = getClientAIModelManager();
        const configWithMetadata = await modelManager.getProviderConfig('elevenlabs');
        this._config = configWithMetadata.config as ElevenLabsConfig;
        
        console.log(`ElevenLabs configuration loaded from database: ${configWithMetadata.name}`);
      } else {
        // Client side - use default configuration from serializer
        const { getSerializerForProvider } = await import('./config-serializers');
        const elevenLabsSerializer = getSerializerForProvider('elevenlabs');
        this._config = elevenLabsSerializer.getDefaultConfig() as ElevenLabsConfig;
        
        console.log('ElevenLabs configuration loaded from defaults (client-side)');
      }
      
      // Update metadata with loaded configuration
      this._metadata = {
        provider: 'elevenlabs',
        model: this._config.model,
        capabilities: this._config.capabilities,
        quality: 'high'
      };
    } catch (error) {
      console.error('Failed to load ElevenLabs configuration, using fallback defaults:', error);
      
      // Fallback to hardcoded defaults if everything fails
      this._config = {
        provider: 'elevenlabs',
        enabled: true,
        displayName: 'ElevenLabs Conversational AI',
        description: 'Natural voice conversations powered by ElevenLabs',
        version: '1.0.0',
        agentId: 'default-agent',
        voiceId: 'default-voice',
        model: 'eleven_turbo_v2_5',
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.8,
          style: 0.0,
          useSpeakerBoost: true,
        },
        conversationConfig: {
          language: 'en',
          maxDuration: 300000,
          timeoutMs: 30000,
          enableInterruption: true,
          enableBackchannel: false,
        },
        capabilities: ['streaming', 'interruption', 'realTimeAudio', 'voiceActivityDetection'],
        apiKeyEnvVar: 'ELEVENLABS_API_KEY',
        baseUrlEnvVar: 'ELEVENLABS_BASE_URL',
      } as ElevenLabsConfig;
    }
  }

  async init(options: AdapterInitOptions): Promise<void> {
    try {
      this._options = options;
      this._audioElement = options.audioElement;
      
      // Ensure configuration is loaded
      if (!this._config) {
        await this._loadConfiguration();
      }
      
      // Apply provider-specific configuration overrides if provided
      if (options.providerConfig?.elevenlabs && this._config) {
        this._config = {
          ...this._config,
          ...options.providerConfig.elevenlabs
        } as ElevenLabsConfig;
      }

      // Register standard tools (same as OpenAI adapter for unified experience)
      this._registerStandardTools();

      // Register additional tools from options
      if (options.tools) {
        options.tools.forEach(tool => this.registerTool(tool));
      }

      // Set up audio element
      if (this._audioElement) {
        this._audioElement.volume = this._volume;
        this._audioElement.muted = this._isMuted;
      }

      this._conversationId = uuidv4();

      this._handleConnectionEvent({
        type: 'connected',
        provider: 'elevenlabs',
        timestamp: new Date()
      });

    } catch (error) {
      const connectionError = new ConnectionError(
        `Failed to initialize ElevenLabs adapter: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs',
        { error }
      );
      this._setError(connectionError);
      throw connectionError;
    }
  }

  async connect(): Promise<void> {
    try {
      this._setConnectionStatus('connecting');
      
      // Request microphone permission before starting session (required by @elevenlabs/client)
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      // Get conversation configuration from our server
      const tokenResponse = await this._getConversationToken();
      
      // Create conversation options for @elevenlabs/client
      // Determine configuration type based on available tokens
      const hasSignedUrl = tokenResponse.signedUrl || tokenResponse.signed_url;
      const hasConversationToken = tokenResponse.conversationToken || tokenResponse.conversation_token;
      const hasAgentId = tokenResponse.agentId || tokenResponse.agent_id;

      let conversationOptions: PartialOptions;

      if (hasSignedUrl) {
        // Private WebSocket session configuration
        conversationOptions = {
          signedUrl: tokenResponse.signedUrl || tokenResponse.signed_url!,
          connectionType: 'websocket',
          // Audio configuration
          format: 'pcm',
          sampleRate: 16000,
          
          // Client tools for unified tool execution
          clientTools: this._createClientToolsForElevenLabs(),
        };
      } else if (hasConversationToken) {
        // Private WebRTC session configuration
        conversationOptions = {
          conversationToken: tokenResponse.conversationToken || tokenResponse.conversation_token!,
          connectionType: 'webrtc',
          
          // Audio configuration
          format: 'pcm',
          sampleRate: 16000,
          
          // Client tools for unified tool execution
          clientTools: this._createClientToolsForElevenLabs(),
        };
      } else if (hasAgentId) {
        // Public session configuration
        conversationOptions = {
          agentId: tokenResponse.agentId || tokenResponse.agent_id!,
          connectionType: 'webrtc',
          
          // Audio configuration
          format: 'pcm',
          sampleRate: 16000,
          
          // Client tools for unified tool execution
          clientTools: this._createClientToolsForElevenLabs(),
        };
      } else {
        throw new Error('Invalid token response: missing required authentication parameters');
      }

      // Add common event callbacks to the configuration
      conversationOptions = {
        ...conversationOptions,
        
        // Event callbacks
        onConnect: ({ conversationId }) => {
          this._conversationId = conversationId;
          this._setConnectionStatus('connected');
          this._reconnectAttempts = 0;
          
          this._handleConnectionEvent({
            type: 'connected',
            provider: 'elevenlabs',
            timestamp: new Date()
          });
        },
        
        onDisconnect: (details) => {
          this._setConnectionStatus('disconnected');
          this._handleConnectionEvent({
            type: 'disconnected',
            provider: 'elevenlabs',
            timestamp: new Date()
          });
          
          // Attempt reconnection if unexpected disconnect
          if (details.reason === 'error' && this._reconnectAttempts < this._maxReconnectAttempts) {
            this._scheduleReconnect();
          }
        },
        
        onError: (message, context) => {
          const connectionError = new ConnectionError(
            `ElevenLabs connection error: ${message}`,
            'elevenlabs',
            { context }
          );
          this._setError(connectionError);
          
          this._handleConnectionEvent({
            type: 'error',
            provider: 'elevenlabs',
            error: connectionError.message,
            timestamp: new Date()
          });
        },
        
        onMessage: ({ message, source }) => {
          const transcriptItem: TranscriptItem = {
            id: uuidv4(),
            type: source === 'user' ? 'user_speech' : 'ai_response',
            content: message,
            timestamp: new Date(),
            provider: 'elevenlabs',
            metadata: {
              confidence: 1.0
            }
          };
          
          this._addTranscriptItem(transcriptItem);
          this._handleTranscriptEvent({
            type: 'transcript_update',
            item: transcriptItem,
            timestamp: new Date()
          });
        },
        
        onModeChange: ({ mode }) => {
          this._setSessionStatus(mode === 'listening' ? 'listening' : 
                               mode === 'speaking' ? 'speaking' : 'idle');
        },
        
        onStatusChange: ({ status }) => {
          if (status === 'connecting') {
            this._setConnectionStatus('connecting');
          } else if (status === 'connected') {
            this._setConnectionStatus('connected');
          } else if (status === 'disconnected') {
            this._setConnectionStatus('disconnected');
          }
        }
      };

      // Start the conversation session
      this._conversationInstance = await Conversation.startSession(conversationOptions);

    } catch (error) {
      this._setConnectionStatus('error');
      const connectionError = new ConnectionError(
        `Failed to connect to ElevenLabs Conversational AI: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs',
        { error }
      );
      this._setError(connectionError);
      
      this._handleConnectionEvent({
        type: 'error',
        provider: 'elevenlabs',
        error: connectionError.message,
        timestamp: new Date()
      });

      // Attempt reconnection if within limits
      if (this._reconnectAttempts < this._maxReconnectAttempts) {
        this._scheduleReconnect();
      }

      throw connectionError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this._setConnectionStatus('disconnected');
      
      // Stop audio input
      await this.stopAudioInput();
      
      // Clear reconnect timer
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }

      // End conversation session
      if (this._conversationInstance) {
        await this._conversationInstance.endSession();
        this._conversationInstance = null;
      }

      this._handleConnectionEvent({
        type: 'disconnected',
        provider: 'elevenlabs',
        timestamp: new Date()
      });

    } catch (error) {
      const connectionError = new ConnectionError(
        `Error during disconnect: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs',
        { error }
      );
      this._setError(connectionError);
      throw connectionError;
    }
  }

  async cleanup(): Promise<void> {
    await this.disconnect();
    this._transcript = [];
    this._tools.clear();
    this._lastError = null;
  }

  async startAudioInput(): Promise<void> {
    try {
      if (this._isRecording) {
        return;
      }

      if (!this._conversationInstance || !this._conversationInstance.isOpen()) {
        throw new AudioError('No active conversation instance for audio input', 'elevenlabs');
      }

      // Unmute microphone using conversation instance
      this._conversationInstance.setMicMuted(false);
      this._isRecording = true;
      this._setSessionStatus('listening');

      this._handleAudioEvent({
        type: 'audio_start',
        timestamp: new Date()
      });

    } catch (error) {
      const audioError = new AudioError(
        `Failed to start audio input: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs',
        { error }
      );
      this._setError(audioError);
      
      this._handleAudioEvent({
        type: 'audio_error',
        error: audioError.message,
        timestamp: new Date()
      });

      throw audioError;
    }
  }

  async stopAudioInput(): Promise<void> {
    try {
      if (!this._isRecording) {
        return;
      }

      if (this._conversationInstance && this._conversationInstance.isOpen()) {
        // Mute microphone using conversation instance
        this._conversationInstance.setMicMuted(true);
      }

      this._isRecording = false;
      this._setSessionStatus('idle');

      this._handleAudioEvent({
        type: 'audio_end',
        timestamp: new Date()
      });

    } catch (error) {
      const audioError = new AudioError(
        `Failed to stop audio input: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs',
        { error }
      );
      this._setError(audioError);
      throw audioError;
    }
  }

  async sendMessage(message: string): Promise<void> {
    try {
      if (!this._conversationInstance || !this._conversationInstance.isOpen()) {
        throw new VoiceAgentError('No active conversation instance', 'elevenlabs');
      }

      // Add user message to transcript
      const transcriptItem: TranscriptItem = {
        id: uuidv4(),
        type: 'user_speech',
        content: message,
        timestamp: new Date(),
        provider: 'elevenlabs',
        metadata: {
          confidence: 1.0 // Text input has perfect confidence
        }
      };

      this._addTranscriptItem(transcriptItem);
      this._handleTranscriptEvent({
        type: 'transcript_update',
        item: transcriptItem,
        timestamp: new Date()
      });

      // Send message using conversation instance
      this._conversationInstance.sendUserMessage(message);

    } catch (error) {
      const voiceError = new VoiceAgentError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs'
      );
      this._setError(voiceError);
      throw voiceError;
    }
  }

  async sendAudioData(audioData: ArrayBuffer): Promise<void> {
    try {
      if (!this._conversationInstance || !this._conversationInstance.isOpen()) {
        throw new AudioError('No active conversation instance for audio data', 'elevenlabs');
      }

      // Note: @elevenlabs/client handles audio streaming automatically through microphone
      // This method is kept for interface compatibility but audio is handled by the conversation instance
      console.warn('sendAudioData called but @elevenlabs/client handles audio streaming automatically');

    } catch (error) {
      const audioError = new AudioError(
        `Failed to send audio data: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs',
        { error }
      );
      this._setError(audioError);
      throw audioError;
    }
  }

  async interrupt(): Promise<void> {
    try {
      if (!this._conversationInstance || !this._conversationInstance.isOpen()) {
        return;
      }

      // Send user activity to interrupt the AI
      this._conversationInstance.sendUserActivity();
      this._setSessionStatus('interrupted');

      // Add interruption to transcript
      const transcriptItem: TranscriptItem = {
        id: uuidv4(),
        type: 'system_message',
        content: '[Conversation interrupted by user]',
        timestamp: new Date(),
        provider: 'elevenlabs',
        metadata: {
          interrupted: true
        }
      };

      this._addTranscriptItem(transcriptItem);
      this._handleTranscriptEvent({
        type: 'transcript_update',
        item: transcriptItem,
        timestamp: new Date()
      });

    } catch (error) {
      const voiceError = new VoiceAgentError(
        `Failed to interrupt: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs'
      );
      this._setError(voiceError);
      throw voiceError;
    }
  }

  async updateConfig(config: Partial<AdapterInitOptions>): Promise<void> {
    try {
      this._options = { ...this._options!, ...config };
      
      if (config.providerConfig?.elevenlabs) {
        this._config = {
          ...this._config,
          ...config.providerConfig.elevenlabs
        };
      }

      // If connected, send contextual update to the conversation
      if (this._conversationInstance && this._conversationInstance.isOpen()) {
        // Send contextual update about configuration changes
        this._conversationInstance.sendContextualUpdate('Configuration updated');
      }

    } catch (error) {
      const voiceError = new VoiceAgentError(
        `Failed to update config: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs'
      );
      this._setError(voiceError);
      throw voiceError;
    }
  }

  // Private methods

  /**
   * Register standard tools (same as OpenAI adapter for unified experience)
   * Ensures both adapters have the same tool capabilities for seamless switching
   */
  private _registerStandardTools(): void {
    // UI Navigation Tools (client-side execution using shared UINavigationTools)
    const uiNavigationTools = [
      {
        name: 'navigateTo',
        description: 'Navigate to a specific page or URL in the portfolio',
        parameters: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'The path or URL to navigate to' },
            newTab: { type: 'boolean', description: 'Whether to open in a new tab' }
          },
          required: ['path']
        },
        handler: async (args: any) => ({ success: true, message: 'Navigation executed', data: args })
      },
      {
        name: 'showProjectDetails',
        description: 'Show details for a specific project, optionally highlighting sections',
        parameters: {
          type: 'object' as const,
          properties: {
            projectId: { type: 'string', description: 'The ID or slug of the project to show' },
            highlightSections: { type: 'array', items: { type: 'string' }, description: 'Array of section IDs to highlight' }
          },
          required: ['projectId']
        },
        handler: async (args: any) => ({ success: true, message: 'Project details shown', data: args })
      },
      {
        name: 'scrollIntoView',
        description: 'Scroll to bring a specific element into view',
        parameters: {
          type: 'object' as const,
          properties: {
            selector: { type: 'string', description: 'CSS selector for the element to scroll to' },
            behavior: { type: 'string', enum: ['auto', 'smooth'], description: 'Scroll behavior' }
          },
          required: ['selector']
        },
        handler: async (args: any) => ({ success: true, message: 'Scrolled to element', data: args })
      },
      {
        name: 'highlightText',
        description: 'Highlight specific text or elements on the page',
        parameters: {
          type: 'object' as const,
          properties: {
            selector: { type: 'string', description: 'CSS selector for elements to search within' },
            text: { type: 'string', description: 'Specific text to highlight (optional)' },
            className: { type: 'string', description: 'CSS class name for highlighting' }
          },
          required: ['selector']
        },
        handler: async (args: any) => ({ success: true, message: 'Text highlighted', data: args })
      },
      {
        name: 'clearHighlights',
        description: 'Clear all highlights from the page',
        parameters: {
          type: 'object' as const,
          properties: {
            className: { type: 'string', description: 'CSS class name to remove' }
          }
        },
        handler: async (args: any) => ({ success: true, message: 'Highlights cleared', data: args })
      },
      {
        name: 'focusElement',
        description: 'Focus on a specific element and bring it into view',
        parameters: {
          type: 'object' as const,
          properties: {
            selector: { type: 'string', description: 'CSS selector for the element to focus' }
          },
          required: ['selector']
        },
        handler: async (args: any) => ({ success: true, message: 'Element focused', data: args })
      }
    ];

    // Server API Tools (make fetch calls to server endpoints)
    const serverApiTools = [
      {
        name: 'loadContext',
        description: 'Load additional context from the server based on query or topic',
        parameters: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'The query or topic to load context for' },
            contextType: { type: 'string', enum: ['projects', 'profile', 'skills', 'experience'], description: 'Type of context to load' }
          },
          required: ['query']
        },
        handler: async (args: any) => ({ success: true, message: 'Context loaded', data: args })
      },
      {
        name: 'analyzeJobSpec',
        description: 'Analyze a job specification against the portfolio owner\'s background',
        parameters: {
          type: 'object' as const,
          properties: {
            jobDescription: { type: 'string', description: 'The job description or requirements to analyze' },
            focusAreas: { type: 'array', items: { type: 'string' }, description: 'Specific areas to focus the analysis on' }
          },
          required: ['jobDescription']
        },
        handler: async (args: any) => ({ success: true, message: 'Job analysis completed', data: args })
      },
      {
        name: 'submitContactForm',
        description: 'Submit a contact form on behalf of the user with their provided information',
        parameters: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'User\'s name' },
            email: { type: 'string', description: 'User\'s email address' },
            message: { type: 'string', description: 'The message to send' },
            subject: { type: 'string', description: 'Optional subject line' }
          },
          required: ['name', 'email', 'message']
        },
        handler: async (args: any) => ({ success: true, message: 'Contact form submitted', data: args })
      }
    ];

    // Register all standard tools
    [...uiNavigationTools, ...serverApiTools].forEach(tool => {
      this.registerTool(tool);
    });
  }

  private async _getConversationToken(): Promise<ElevenLabsTokenResponse> {
    const response = await fetch('/api/ai/elevenlabs/token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get conversation token: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create client tools for ElevenLabs conversation
   * Converts server-provided tool definitions into executable client-side functions
   * Uses unified ToolCall and ToolResult interfaces (same format as OpenAI adapter)
   * Implements tool execution for UI navigation tools using shared UINavigationTools
   * Implements tool execution for server API calls (loadContext, analyzeJobSpec, submitContactForm)
   */
  private _createClientToolsForElevenLabs(): Record<string, (parameters: any) => Promise<string | number | void> | string | number | void> {
    const clientTools: Record<string, (parameters: any) => Promise<string | number | void> | string | number | void> = {};
    
    // Import UI navigation tools (only in browser environment)
    let uiNavigationTools: any = null;
    if (typeof window !== 'undefined') {
      try {
        const { uiNavigationTools: tools } = require('./UINavigationTools');
        uiNavigationTools = tools;
      } catch (error) {
        console.warn('UINavigationTools not available:', error);
      }
    }

    // Define UI navigation tools with shared UINavigationTools execution (same as OpenAI)
    const uiNavigationToolNames = [
      'navigateTo',
      'showProjectDetails', 
      'scrollIntoView',
      'highlightText',
      'clearHighlights',
      'focusElement'
    ];

    // Define server API tools that make fetch calls to server endpoints
    const serverApiToolNames = [
      'loadContext',
      'analyzeJobSpec', 
      'submitContactForm'
    ];

    for (const [toolName, toolDef] of Array.from(this._tools.entries())) {
      clientTools[toolName] = async (parameters: any) => {
        const toolCall: ToolCall = {
          id: uuidv4(),
          name: toolName,
          arguments: parameters,
          timestamp: new Date()
        };

        // Log tool call start for unified transcript system (admin debug page compatibility)
        this._handleToolEvent({
          type: 'tool_call',
          toolCall,
          timestamp: new Date()
        });

        try {
          let toolResult: ToolResult;

          // Execute UI navigation tools using shared UINavigationTools (same as OpenAI)
          if (uiNavigationToolNames.includes(toolName)) {
            if (!uiNavigationTools) {
              throw new Error('UI navigation tools not available in this environment');
            }

            let navigationResult;
            switch (toolName) {
              case 'navigateTo':
                navigationResult = await uiNavigationTools.navigateTo(parameters);
                break;
              case 'showProjectDetails':
                navigationResult = await uiNavigationTools.showProjectDetails(parameters);
                break;
              case 'scrollIntoView':
                navigationResult = await uiNavigationTools.scrollIntoView(parameters);
                break;
              case 'highlightText':
                navigationResult = await uiNavigationTools.highlightText(parameters);
                break;
              case 'clearHighlights':
                navigationResult = await uiNavigationTools.clearHighlights(parameters);
                break;
              case 'focusElement':
                navigationResult = await uiNavigationTools.focusElement(parameters);
                break;
              default:
                throw new Error(`Unknown UI navigation tool: ${toolName}`);
            }

            toolResult = {
              id: toolCall.id,
              result: navigationResult.success ? navigationResult.message : null,
              error: navigationResult.success ? undefined : navigationResult.error,
              timestamp: new Date(),
              executionTime: 0 // UINavigationTools handles timing internally
            };

          // Execute server API calls (loadContext, analyzeJobSpec, submitContactForm)
          } else if (serverApiToolNames.includes(toolName)) {
            const startTime = Date.now();
            
            try {
              let response: Response;
              
              switch (toolName) {
                case 'loadContext':
                  response = await fetch('/api/ai/context', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      query: parameters.query,
                      contextType: parameters.contextType
                    })
                  });
                  break;
                  
                case 'analyzeJobSpec':
                  response = await fetch('/api/ai/analyze-job', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jobDescription: parameters.jobDescription,
                      focusAreas: parameters.focusAreas || []
                    })
                  });
                  break;
                  
                case 'submitContactForm':
                  response = await fetch('/api/public/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: parameters.name,
                      email: parameters.email,
                      message: parameters.message,
                      subject: parameters.subject
                    })
                  });
                  break;
                  
                default:
                  throw new Error(`Unknown server API tool: ${toolName}`);
              }

              if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
              }

              const responseData = await response.json();
              const executionTime = Date.now() - startTime;

              toolResult = {
                id: toolCall.id,
                result: responseData,
                timestamp: new Date(),
                executionTime
              };

            } catch (error) {
              const executionTime = Date.now() - startTime;
              toolResult = {
                id: toolCall.id,
                result: null,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
                executionTime
              };
            }

          // Execute other tools using the base adapter's tool execution method
          } else {
            toolResult = await this._executeTool(toolCall);
          }

          // Log tool result for unified transcript system (admin debug page compatibility)
          this._handleToolEvent({
            type: 'tool_result',
            toolResult,
            timestamp: new Date()
          });

          // Add to unified transcript system for admin debug page compatibility
          const transcriptItem: TranscriptItem = {
            id: uuidv4(),
            type: 'tool_call',
            content: `Called ${toolCall.name} with ${JSON.stringify(toolCall.arguments)}`,
            timestamp: new Date(),
            provider: 'elevenlabs',
            metadata: {
              toolName: toolCall.name,
              toolArgs: toolCall.arguments,
              toolResult: toolResult.result
            }
          };

          this._addTranscriptItem(transcriptItem);
          this._handleTranscriptEvent({
            type: 'transcript_update',
            item: transcriptItem,
            timestamp: new Date()
          });

          // Return result to ElevenLabs agent for conversation continuity
          if (toolResult.error) {
            return `Error: ${toolResult.error}`;
          }

          // Format result for ElevenLabs based on tool type
          if (uiNavigationToolNames.includes(toolName)) {
            return toolResult.result || 'Navigation action completed';
          } else if (serverApiToolNames.includes(toolName)) {
            // Provide meaningful summary for server API results
            switch (toolName) {
              case 'loadContext':
                return `Loaded context for "${parameters.query}": ${JSON.stringify(toolResult.result).substring(0, 100)}...`;
              case 'analyzeJobSpec':
                const analysis = toolResult.result as any;
                return `Job analysis completed with ${analysis.analysis?.overallMatch || 'unknown'} match score`;
              case 'submitContactForm':
                return 'Contact form submitted successfully';
              default:
                return JSON.stringify(toolResult.result).substring(0, 200);
            }
          } else {
            return toolResult.result;
          }

        } catch (error) {
          // Proper error handling and result reporting using shared tool execution pipeline
          const toolError = new ToolError(
            `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            'elevenlabs',
            toolName,
            { error, parameters }
          );
          this._setError(toolError);

          this._handleToolEvent({
            type: 'tool_error',
            error: toolError.message,
            timestamp: new Date()
          });

          // Add error to unified transcript system
          const errorTranscriptItem: TranscriptItem = {
            id: uuidv4(),
            type: 'error',
            content: `Tool ${toolName} failed: ${toolError.message}`,
            timestamp: new Date(),
            provider: 'elevenlabs',
            metadata: {
              toolName: toolCall.name,
              toolArgs: toolCall.arguments
            }
          };

          this._addTranscriptItem(errorTranscriptItem);
          this._handleTranscriptEvent({
            type: 'transcript_update',
            item: errorTranscriptItem,
            timestamp: new Date()
          });

          return `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
        }
      };
    }
    
    return clientTools;
  }



  private _scheduleReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
    }

    this._reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 30000); // Exponential backoff, max 30s

    this._setConnectionStatus('reconnecting');
    this._handleConnectionEvent({
      type: 'reconnecting',
      provider: 'elevenlabs',
      timestamp: new Date()
    });

    this._reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        // Connection will handle further reconnection attempts
      }
    }, delay);
  }
}