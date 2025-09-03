/**
 * ElevenLabs Conversational AI Adapter
 * 
 * PRODUCTION implementation using ElevenLabs Conversational AI platform with real conversation tokens.
 * This adapter uses the signed URL approach for real-time conversations with agent management
 * and tool calling through structured command parsing.
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
  ElevenLabsConversationConfig
} from '@/types/voice-agent';
import { BaseConversationalAgentAdapter } from './IConversationalAgentAdapter';

interface ElevenLabsTokenResponse {
  conversation_token: string;
  agent_id: string;
  signed_url: string;
  expires_at: string;
}

interface ElevenLabsConversationEvent {
  type: string;
  message?: string;
  audio_data?: ArrayBuffer;
  transcript?: string;
  tool_calls?: any[];
  [key: string]: any;
}

export class ElevenLabsAdapter extends BaseConversationalAgentAdapter {
  private _conversationToken: string | null = null;
  private _agentId: string | null = null;
  private _signedUrl: string | null = null;
  private _websocket: WebSocket | null = null;
  private _mediaStream: MediaStream | null = null;
  private _isRecording: boolean = false;
  private _config: ElevenLabsConversationConfig;
  private _reconnectTimer: NodeJS.Timeout | null = null;
  private _reconnectAttempts: number = 0;
  private _maxReconnectAttempts: number = 3;
  private _conversationId: string | null = null;

  constructor() {
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

    this._config = {
      agentId: '',
      voiceId: 'default',
      stability: 0.5,
      similarityBoost: 0.8,
      conversationConfig: {
        turnDetection: {
          type: 'server_vad',
          threshold: 0.5,
          prefixPaddingMs: 300,
          silenceDurationMs: 1000
        }
      }
    };
  }

  async init(options: AdapterInitOptions): Promise<void> {
    try {
      this._options = options;
      this._audioElement = options.audioElement;
      
      // Apply provider-specific configuration
      if (options.providerConfig?.elevenlabs) {
        this._config = {
          ...this._config,
          ...options.providerConfig.elevenlabs
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
      
      // Get conversation token from our server
      const tokenResponse = await this._getConversationToken();
      this._conversationToken = tokenResponse.conversation_token;
      this._agentId = tokenResponse.agent_id;
      this._signedUrl = tokenResponse.signed_url;

      // Establish WebSocket connection to ElevenLabs
      await this._connectWebSocket();
      
      this._setConnectionStatus('connected');
      this._reconnectAttempts = 0;

      this._handleConnectionEvent({
        type: 'connected',
        provider: 'elevenlabs',
        timestamp: new Date()
      });

    } catch (error) {
      this._setConnectionStatus('error');
      const connectionError = new ConnectionError(
        `Failed to connect to ElevenLabs Conversational AI: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs',
        { error, agentId: this._agentId }
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

      // Close WebSocket connection
      if (this._websocket) {
        this._websocket.close();
        this._websocket = null;
      }

      this._conversationToken = null;
      this._agentId = null;
      this._signedUrl = null;

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

      if (!this._websocket || this._websocket.readyState !== WebSocket.OPEN) {
        throw new AudioError('No active WebSocket connection for audio input', 'elevenlabs');
      }

      // Request microphone access
      this._mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // ElevenLabs prefers 16kHz
          channelCount: 1
        }
      });

      // Set up audio processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(this._mediaStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (this._websocket && this._websocket.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer.getChannelData(0);
          const audioData = new Float32Array(inputBuffer);
          
          // Send audio data to ElevenLabs
          this._websocket.send(JSON.stringify({
            type: 'audio_input',
            audio_data: Array.from(audioData),
            timestamp: Date.now()
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

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

      if (this._mediaStream) {
        this._mediaStream.getTracks().forEach(track => track.stop());
        this._mediaStream = null;
      }

      this._isRecording = false;
      this._setSessionStatus('idle');

      // Notify ElevenLabs that audio input has stopped
      if (this._websocket && this._websocket.readyState === WebSocket.OPEN) {
        this._websocket.send(JSON.stringify({
          type: 'audio_input_end',
          timestamp: Date.now()
        }));
      }

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
      if (!this._websocket || this._websocket.readyState !== WebSocket.OPEN) {
        throw new VoiceAgentError('No active WebSocket connection', 'elevenlabs');
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

      // Send message to ElevenLabs
      this._websocket.send(JSON.stringify({
        type: 'text_message',
        message: message,
        timestamp: Date.now()
      }));

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
      if (!this._websocket || this._websocket.readyState !== WebSocket.OPEN) {
        throw new AudioError('No active WebSocket connection for audio data', 'elevenlabs');
      }

      // Convert ArrayBuffer to Float32Array for ElevenLabs
      const audioArray = new Float32Array(audioData);
      
      this._websocket.send(JSON.stringify({
        type: 'audio_input',
        audio_data: Array.from(audioArray),
        timestamp: Date.now()
      }));

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
      if (!this._websocket || this._websocket.readyState !== WebSocket.OPEN) {
        return;
      }

      this._websocket.send(JSON.stringify({
        type: 'interrupt',
        timestamp: Date.now()
      }));

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

      // If connected, update agent configuration
      if (this._websocket && this._websocket.readyState === WebSocket.OPEN) {
        this._websocket.send(JSON.stringify({
          type: 'update_config',
          config: this._config,
          timestamp: Date.now()
        }));
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

  private async _connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._signedUrl) {
        reject(new Error('No signed URL available for WebSocket connection'));
        return;
      }

      this._websocket = new WebSocket(this._signedUrl);

      this._websocket.onopen = () => {
        // Send initial configuration
        if (this._websocket) {
          this._websocket.send(JSON.stringify({
            type: 'init',
            conversation_token: this._conversationToken,
            agent_id: this._agentId,
            config: this._config,
            tools: this._convertToolsToElevenLabsFormat(),
            timestamp: Date.now()
          }));
        }
        resolve();
      };

      this._websocket.onerror = (error) => {
        reject(new Error(`WebSocket connection error: ${error}`));
      };

      this._websocket.onclose = (event) => {
        this._setConnectionStatus('disconnected');
        this._handleConnectionEvent({
          type: 'disconnected',
          provider: 'elevenlabs',
          timestamp: new Date()
        });

        // Attempt reconnection if unexpected close
        if (event.code !== 1000 && this._reconnectAttempts < this._maxReconnectAttempts) {
          this._scheduleReconnect();
        }
      };

      this._websocket.onmessage = (event) => {
        this._handleWebSocketMessage(event);
      };
    });
  }

  private _handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data: ElevenLabsConversationEvent = JSON.parse(event.data);

      switch (data.type) {
        case 'transcript':
          this._handleTranscriptMessage(data);
          break;
        case 'audio_response':
          this._handleAudioResponse(data);
          break;
        case 'tool_call':
          this._handleToolCall(data);
          break;
        case 'error':
          this._handleError(data);
          break;
        case 'status':
          this._handleStatusUpdate(data);
          break;
        default:
          console.log('Unknown ElevenLabs message type:', data.type);
      }
    } catch (error) {
      console.error('Failed to parse ElevenLabs WebSocket message:', error);
    }
  }

  private _handleTranscriptMessage(data: ElevenLabsConversationEvent): void {
    if (!data.transcript) return;

    const transcriptItem: TranscriptItem = {
      id: uuidv4(),
      type: data.message_type === 'user' ? 'user_speech' : 'ai_response',
      content: data.transcript,
      timestamp: new Date(),
      provider: 'elevenlabs',
      metadata: {
        confidence: data.confidence,
        duration: data.duration
      }
    };

    this._addTranscriptItem(transcriptItem);
    this._handleTranscriptEvent({
      type: 'transcript_update',
      item: transcriptItem,
      timestamp: new Date()
    });
  }

  private _handleAudioResponse(data: ElevenLabsConversationEvent): void {
    if (!data.audio_data || !this._audioElement) return;

    try {
      // Convert audio data to playable format
      const audioBlob = new Blob([data.audio_data], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this._audioElement.src = audioUrl;
      this._audioElement.play();

      this._setSessionStatus('speaking');
      this._handleAudioEvent({
        type: 'audio_start',
        timestamp: new Date()
      });

      // Clean up URL when audio ends
      this._audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this._setSessionStatus('idle');
        this._handleAudioEvent({
          type: 'audio_end',
          timestamp: new Date()
        });
      };

    } catch (error) {
      const audioError = new AudioError(
        `Failed to play audio response: ${error instanceof Error ? error.message : String(error)}`,
        'elevenlabs',
        { error }
      );
      this._setError(audioError);
    }
  }

  private async _handleToolCall(data: ElevenLabsConversationEvent): Promise<void> {
    if (!data.tool_calls || !Array.isArray(data.tool_calls)) return;

    for (const toolCallData of data.tool_calls) {
      try {
        const toolCall: ToolCall = {
          id: toolCallData.id || uuidv4(),
          name: toolCallData.name,
          arguments: toolCallData.arguments,
          timestamp: new Date()
        };

        this._handleToolEvent({
          type: 'tool_call',
          toolCall,
          timestamp: new Date()
        });

        // Execute tool
        const toolResult = await this._executeTool(toolCall);
        
        // Send result back to ElevenLabs
        if (this._websocket && this._websocket.readyState === WebSocket.OPEN) {
          this._websocket.send(JSON.stringify({
            type: 'tool_result',
            tool_call_id: toolCall.id,
            result: toolResult.result,
            error: toolResult.error,
            timestamp: Date.now()
          }));
        }

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

      } catch (error) {
        const toolError = new ToolError(
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          'elevenlabs',
          toolCallData.name,
          { error, toolCall: toolCallData }
        );
        this._setError(toolError);

        this._handleToolEvent({
          type: 'tool_error',
          error: toolError.message,
          timestamp: new Date()
        });
      }
    }
  }

  private _handleError(data: ElevenLabsConversationEvent): void {
    const error = new VoiceAgentError(
      data.message || 'Unknown ElevenLabs error',
      'elevenlabs',
      data.error_code,
      data
    );
    this._setError(error);

    this._handleConnectionEvent({
      type: 'error',
      provider: 'elevenlabs',
      error: error.message,
      timestamp: new Date()
    });
  }

  private _handleStatusUpdate(data: ElevenLabsConversationEvent): void {
    if (data.status === 'speaking') {
      this._setSessionStatus('speaking');
    } else if (data.status === 'listening') {
      this._setSessionStatus('listening');
    } else if (data.status === 'processing') {
      this._setSessionStatus('processing');
    } else {
      this._setSessionStatus('idle');
    }
  }

  private _convertToolsToElevenLabsFormat(): any[] {
    return Array.from(this._tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
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