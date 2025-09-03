/**
 * Core Voice Agent Types and Interfaces
 * 
 * This file defines the unified types for voice agent state, transcript items,
 * and provider metadata for the production voice AI system.
 */

// Provider Types
export type VoiceProvider = 'openai' | 'elevenlabs';

export interface ProviderMetadata {
  provider: VoiceProvider;
  model?: string;
  version?: string;
  capabilities: string[];
  latency?: number;
  quality?: 'low' | 'medium' | 'high';
}

// Connection and Session State
export type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'error';

export type SessionStatus = 
  | 'idle' 
  | 'listening' 
  | 'processing' 
  | 'speaking' 
  | 'interrupted';

export interface ConnectionState {
  status: ConnectionStatus;
  error?: string;
  lastConnected?: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

export interface SessionState {
  status: SessionStatus;
  isAudioEnabled: boolean;
  isMuted: boolean;
  audioLevel?: number;
  lastActivity?: Date;
}

// Transcript and Conversation Types
export type TranscriptItemType = 
  | 'user_speech' 
  | 'ai_response' 
  | 'tool_call' 
  | 'tool_result' 
  | 'system_message'
  | 'error';

export interface TranscriptItem {
  id: string;
  type: TranscriptItemType;
  content: string;
  timestamp: Date;
  provider: VoiceProvider;
  metadata?: {
    duration?: number;
    confidence?: number;
    interrupted?: boolean;
    toolName?: string;
    toolArgs?: any;
    toolResult?: any;
    audioUrl?: string;
  };
}

export interface ConversationMetadata {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  provider: VoiceProvider;
  totalDuration?: number;
  messageCount: number;
  toolCallCount: number;
  interruptionCount: number;
  averageLatency?: number;
  costEstimate?: number;
}

// Audio Management Types
export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface AudioState {
  isRecording: boolean;
  isPlaying: boolean;
  volume: number;
  inputLevel?: number;
  outputLevel?: number;
  config: AudioConfig;
}

// Tool Calling Types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<any> | any;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  timestamp: Date;
}

export interface ToolResult {
  id: string;
  result: any;
  error?: string;
  timestamp: Date;
  executionTime: number;
}

// Voice Agent State
export interface VoiceAgentState {
  // Provider and Connection
  activeProvider: VoiceProvider | null;
  availableProviders: VoiceProvider[];
  connectionState: ConnectionState;
  sessionState: SessionState;
  providerMetadata?: ProviderMetadata;
  
  // Audio
  audioState: AudioState;
  audioElement?: HTMLAudioElement;
  
  // Conversation
  transcript: TranscriptItem[];
  conversationMetadata: ConversationMetadata | null;
  
  // Tools
  availableTools: ToolDefinition[];
  pendingToolCalls: ToolCall[];
  
  // Context and Configuration
  contextId?: string;
  reflinkId?: string;
  accessLevel?: 'basic' | 'limited' | 'premium';
  
  // Error Handling
  lastError?: string;
  errorCount: number;
}

// Event Types for Callbacks
export interface ConnectionEvent {
  type: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  provider: VoiceProvider;
  error?: string;
  timestamp: Date;
}

export interface TranscriptEvent {
  type: 'transcript_update' | 'transcript_complete';
  item: TranscriptItem;
  timestamp: Date;
}

export interface AudioEvent {
  type: 'audio_start' | 'audio_end' | 'audio_level' | 'audio_error';
  level?: number;
  error?: string;
  timestamp: Date;
}

export interface ToolEvent {
  type: 'tool_call' | 'tool_result' | 'tool_error';
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  error?: string;
  timestamp: Date;
}

// Callback Function Types
export type ConnectionEventCallback = (event: ConnectionEvent) => void;
export type TranscriptEventCallback = (event: TranscriptEvent) => void;
export type AudioEventCallback = (event: AudioEvent) => void;
export type ToolEventCallback = (event: ToolEvent) => void;

// Adapter Configuration
export interface AdapterInitOptions {
  // Required callbacks
  onConnectionEvent: ConnectionEventCallback;
  onTranscriptEvent: TranscriptEventCallback;
  onAudioEvent: AudioEventCallback;
  onToolEvent: ToolEventCallback;
  
  // Audio configuration
  audioElement: HTMLAudioElement;
  audioConfig?: Partial<AudioConfig>;
  
  // Provider-specific configuration
  providerConfig?: {
    openai?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
    elevenlabs?: {
      voiceId?: string;
      stability?: number;
      similarityBoost?: number;
    };
  };
  
  // Context and access control
  contextId?: string;
  reflinkId?: string;
  accessLevel?: 'basic' | 'limited' | 'premium';
  
  // Tool configuration
  tools?: ToolDefinition[];
  
  // Debug and logging
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// Provider-specific configuration types
export interface OpenAIRealtimeConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  voice: string;
  instructions?: string;
  tools?: any[];
}

export interface ElevenLabsConversationConfig {
  agentId: string;
  voiceId: string;
  stability: number;
  similarityBoost: number;
  conversationConfig?: {
    turnDetection?: {
      type: 'server_vad';
      threshold?: number;
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
    };
  };
}

// Error Types
export class VoiceAgentError extends Error {
  constructor(
    message: string,
    public provider: VoiceProvider,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'VoiceAgentError';
  }
}

export class ConnectionError extends VoiceAgentError {
  constructor(message: string, provider: VoiceProvider, details?: any) {
    super(message, provider, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class AudioError extends VoiceAgentError {
  constructor(message: string, provider: VoiceProvider, details?: any) {
    super(message, provider, 'AUDIO_ERROR', details);
    this.name = 'AudioError';
  }
}

export class ToolError extends VoiceAgentError {
  constructor(message: string, provider: VoiceProvider, toolName?: string, details?: any) {
    super(message, provider, 'TOOL_ERROR', { toolName, ...details });
    this.name = 'ToolError';
  }
}