/**
 * OpenAI Realtime Adapter
 * 
 * PRODUCTION implementation using actual @openai/agents SDK with real WebRTC connections.
 * This adapter establishes direct client-to-OpenAI WebRTC connections for real-time
 * speech-to-speech interactions with tool calling capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
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
  OpenAIRealtimeConfig
} from '@/types/voice-agent';
import { BaseConversationalAgentAdapter } from './IConversationalAgentAdapter';

// OpenAI Realtime SDK imports - REAL IMPLEMENTATION REQUIRED
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

interface OpenAISessionResponse {
  client_secret: string;
  session_id: string;
  expires_at: string;
}

interface OpenAIRealtimeEvent {
  type: string;
  [key: string]: any;
}

export class OpenAIAdapter extends BaseConversationalAgentAdapter {
  private _agent: RealtimeAgent | null = null;
  private _session: RealtimeSession | null = null;
  private _sessionToken: string | null = null;
  private _sessionId: string | null = null;
  private _mediaStream: MediaStream | null = null;
  private _isRecording: boolean = false;
  private _config: OpenAIRealtimeConfig;
  private _reconnectTimer: NodeJS.Timeout | null = null;
  private _reconnectAttempts: number = 0;
  private _maxReconnectAttempts: number = 3;

  constructor() {
    const metadata: ProviderMetadata = {
      provider: 'openai',
      model: 'gpt-4o-realtime-preview-2025-06-03',
      version: '1.0.0',
      capabilities: [
        'real-time-stt',
        'real-time-tts',
        'tool-calling',
        'interruption-handling',
        'voice-activity-detection',
        'webrtc-transport'
      ],
      latency: 200, // ~200ms typical latency
      quality: 'high'
    };

    super('openai', metadata);

    this._config = {
      model: 'gpt-4o-realtime-preview-2025-06-03',
      temperature: 0.7,
      maxTokens: 4096,
      voice: 'alloy',
      instructions: '',
      tools: []
    };
  }

  async init(options: AdapterInitOptions): Promise<void> {
    try {
      this._options = options;
      this._audioElement = options.audioElement;
      
      // Apply provider-specific configuration
      if (options.providerConfig?.openai) {
        this._config = {
          ...this._config,
          ...options.providerConfig.openai
        };
      }

      // Register tools
      if (options.tools) {
        options.tools.forEach(tool => this.registerTool(tool));
      }

      // Set up audio element
      if (this._audioElement) {
        this._audioElement.volume = this._volume;
        this._audioElement.muted = this._isMuted;
      }

      this._handleConnectionEvent({
        type: 'connected',
        provider: 'openai',
        timestamp: new Date()
      });

    } catch (error) {
      const connectionError = new ConnectionError(
        `Failed to initialize OpenAI adapter: ${error instanceof Error ? error.message : String(error)}`,
        'openai',
        { error }
      );
      this._setError(connectionError);
      throw connectionError;
    }
  }

  async connect(): Promise<void> {
    try {
      this._setConnectionStatus('connecting');
      
      // Get ephemeral session token from our server
      const sessionResponse = await this._getSessionToken();
      this._sessionToken = sessionResponse.client_secret;
      this._sessionId = sessionResponse.session_id;

      // Initialize RealtimeAgent
      this._agent = new RealtimeAgent({
        name: 'portfolio-assistant',
        instructions: this._config.instructions,
        tools: this._convertToolsToOpenAIFormat()
      });

      // Create RealtimeSession
      this._session = new RealtimeSession(this._agent, {
        apiKey: () => this._sessionToken!,
        transport: 'webrtc',
        model: this._config.model
      });

      // Set up event listeners before connecting
      this._setupEventListeners();

      // Connect to OpenAI Realtime API
      await this._session.connect({});
      
      this._setConnectionStatus('connected');
      this._reconnectAttempts = 0;

      this._handleConnectionEvent({
        type: 'connected',
        provider: 'openai',
        timestamp: new Date()
      });

    } catch (error) {
      this._setConnectionStatus('error');
      const connectionError = new ConnectionError(
        `Failed to connect to OpenAI Realtime API: ${error instanceof Error ? error.message : String(error)}`,
        'openai',
        { error, sessionId: this._sessionId }
      );
      this._setError(connectionError);
      
      this._handleConnectionEvent({
        type: 'error',
        provider: 'openai',
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

      // Disconnect session
      if (this._session) {
        this._session.close();
        this._session = null;
      }

      // Clean up agent
      if (this._agent) {
        this._agent = null;
      }

      this._sessionToken = null;
      this._sessionId = null;

      this._handleConnectionEvent({
        type: 'disconnected',
        provider: 'openai',
        timestamp: new Date()
      });

    } catch (error) {
      const connectionError = new ConnectionError(
        `Error during disconnect: ${error instanceof Error ? error.message : String(error)}`,
        'openai',
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

      if (!this._session) {
        throw new AudioError('No active session for audio input', 'openai');
      }

      // Request microphone access
      this._mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
          channelCount: 1
        }
      });

      // Mute/unmute to control audio input
      this._session.mute(false);
      this._isRecording = true;
      this._setSessionStatus('listening');

      this._handleAudioEvent({
        type: 'audio_start',
        timestamp: new Date()
      });

    } catch (error) {
      const audioError = new AudioError(
        `Failed to start audio input: ${error instanceof Error ? error.message : String(error)}`,
        'openai',
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

      if (this._session) {
        this._session.mute(true);
      }

      if (this._mediaStream) {
        this._mediaStream.getTracks().forEach(track => track.stop());
        this._mediaStream = null;
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
        'openai',
        { error }
      );
      this._setError(audioError);
      throw audioError;
    }
  }

  async sendMessage(message: string): Promise<void> {
    try {
      if (!this._session) {
        throw new VoiceAgentError('No active session', 'openai');
      }

      // Add user message to transcript
      const transcriptItem: TranscriptItem = {
        id: uuidv4(),
        type: 'user_speech',
        content: message,
        timestamp: new Date(),
        provider: 'openai',
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

      // Send message to OpenAI
      this._session.sendMessage(message);

    } catch (error) {
      const voiceError = new VoiceAgentError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        'openai'
      );
      this._setError(voiceError);
      throw voiceError;
    }
  }

  async sendAudioData(audioData: ArrayBuffer): Promise<void> {
    try {
      if (!this._session) {
        throw new AudioError('No active session for audio data', 'openai');
      }

      // Send audio data to OpenAI
      this._session.sendAudio(audioData);

    } catch (error) {
      const audioError = new AudioError(
        `Failed to send audio data: ${error instanceof Error ? error.message : String(error)}`,
        'openai',
        { error }
      );
      this._setError(audioError);
      throw audioError;
    }
  }

  async interrupt(): Promise<void> {
    try {
      if (!this._session) {
        return;
      }

      this._session.interrupt();
      this._setSessionStatus('interrupted');

      // Add interruption to transcript
      const transcriptItem: TranscriptItem = {
        id: uuidv4(),
        type: 'system_message',
        content: '[Conversation interrupted by user]',
        timestamp: new Date(),
        provider: 'openai',
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
        'openai'
      );
      this._setError(voiceError);
      throw voiceError;
    }
  }

  async updateConfig(config: Partial<AdapterInitOptions>): Promise<void> {
    try {
      this._options = { ...this._options!, ...config };
      
      if (config.providerConfig?.openai) {
        this._config = {
          ...this._config,
          ...config.providerConfig.openai
        };
      }

      // If connected, update agent configuration
      if (this._session && this._config.instructions) {
        const updatedAgent = new RealtimeAgent({
          name: 'portfolio-assistant',
          instructions: this._config.instructions,
          tools: this._convertToolsToOpenAIFormat()
        });
        await this._session.updateAgent(updatedAgent);
      }

    } catch (error) {
      const voiceError = new VoiceAgentError(
        `Failed to update config: ${error instanceof Error ? error.message : String(error)}`,
        'openai'
      );
      this._setError(voiceError);
      throw voiceError;
    }
  }

  // Private methods

  private async _getSessionToken(): Promise<OpenAISessionResponse> {
    const response = await fetch('/api/ai/openai/session', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get session token: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private _setupEventListeners(): void {
    if (!this._session) return;

    // Error events
    this._session.on('error', (error: any) => {
      this._setConnectionStatus('error');
      const connectionError = new ConnectionError(
        `OpenAI Realtime error: ${error.error?.message || String(error)}`,
        'openai',
        { error }
      );
      this._setError(connectionError);
      
      this._handleConnectionEvent({
        type: 'error',
        provider: 'openai',
        error: connectionError.message,
        timestamp: new Date()
      });
    });

    // History events for transcript
    this._session.on('history_added', (item: any) => {
      const transcriptItem: TranscriptItem = {
        id: uuidv4(),
        type: item.role === 'user' ? 'user_speech' : 'ai_response',
        content: item.content || item.transcript || '',
        timestamp: new Date(),
        provider: 'openai',
        metadata: {
          confidence: item.confidence,
          duration: item.duration,
          interrupted: item.interrupted
        }
      };

      this._addTranscriptItem(transcriptItem);
      this._handleTranscriptEvent({
        type: 'transcript_update',
        item: transcriptItem,
        timestamp: new Date()
      });
    });

    // Audio events
    this._session.on('audio_start', () => {
      this._setSessionStatus('speaking');
      this._handleAudioEvent({
        type: 'audio_start',
        timestamp: new Date()
      });
    });

    this._session.on('audio_stopped', () => {
      this._setSessionStatus('idle');
      this._handleAudioEvent({
        type: 'audio_end',
        timestamp: new Date()
      });
    });

    // Tool calling events
    this._session.on('agent_tool_start', async (context: any, agent: any, tool: any, details: any) => {
      try {
        const toolCall: ToolCall = {
          id: details.toolCall.call_id || uuidv4(),
          name: details.toolCall.name,
          arguments: JSON.parse(details.toolCall.arguments || '{}'),
          timestamp: new Date()
        };

        this._handleToolEvent({
          type: 'tool_call',
          toolCall,
          timestamp: new Date()
        });

        // Execute tool locally
        const toolResult = await this._executeTool(toolCall);
        
        // The result will be automatically sent back to OpenAI by the session
        this._handleToolEvent({
          type: 'tool_result',
          toolResult,
          timestamp: new Date()
        });

        // Add to transcript
        const transcriptItem: TranscriptItem = {
          id: uuidv4(),
          type: 'tool_call',
          content: `Called ${toolCall.name} with ${JSON.stringify(toolCall.arguments)}`,
          timestamp: new Date(),
          provider: 'openai',
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

      } catch (error) {
        const toolError = new ToolError(
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          'openai',
          details.toolCall.name,
          { error, toolCall: details.toolCall }
        );
        this._setError(toolError);

        this._handleToolEvent({
          type: 'tool_error',
          error: toolError.message,
          timestamp: new Date()
        });
      }
    });

    // Connection status tracking via transport events
    this._session.on('transport_event', (event: any) => {
      if (event.type === 'session.created') {
        this._setConnectionStatus('connected');
        this._handleConnectionEvent({
          type: 'connected',
          provider: 'openai',
          timestamp: new Date()
        });
      } else if (event.type === 'session.ended') {
        this._setConnectionStatus('disconnected');
        this._handleConnectionEvent({
          type: 'disconnected',
          provider: 'openai',
          timestamp: new Date()
        });
      }
    });
  }

  private _convertToolsToOpenAIFormat(): any[] {
    return Array.from(this._tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
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
      provider: 'openai',
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