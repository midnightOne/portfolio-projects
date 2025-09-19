/**
 * ConversationalAgentProvider Context
 * 
 * React Context Provider for global voice agent state management.
 * Provides unified interface for managing OpenAI Realtime and ElevenLabs Conversational AI
 * with provider switching, conversation continuity, and unified transcripts.
 */

'use client'; 

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  VoiceProvider,
  VoiceAgentState,
  ConnectionStatus,
  SessionStatus,
  TranscriptItem,
  ToolDefinition,
  VoiceAgentError,
  AdapterInitOptions,
  AudioConfig
} from '@/types/voice-agent';
import { IConversationalAgentAdapter, AdapterRegistry } from '@/lib/voice/IConversationalAgentAdapter';
import { OpenAIRealtimeAdapter } from '@/lib/voice/OpenAIRealtimeAdapter';
import { ElevenLabsAdapter } from '@/lib/voice/ElevenLabsAdapter';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';

// Action types for state management
type ConversationalAgentAction =
  | { type: 'SET_ACTIVE_PROVIDER'; provider: VoiceProvider | null }
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus }
  | { type: 'SET_SESSION_STATUS'; status: SessionStatus }
  | { type: 'ADD_TRANSCRIPT_ITEM'; item: TranscriptItem }
  | { type: 'CLEAR_TRANSCRIPT' }
  | { type: 'SET_ERROR'; error: VoiceAgentError | null }
  | { type: 'SET_AUDIO_STATE'; audioState: Partial<VoiceAgentState['audioState']> }
  | { type: 'SET_CONTEXT_ID'; contextId: string }
  | { type: 'SET_REFLINK_ID'; reflinkId: string }
  | { type: 'SET_ACCESS_LEVEL'; accessLevel: 'basic' | 'limited' | 'premium' }
  | { type: 'ADD_TOOL'; tool: ToolDefinition }
  | { type: 'REMOVE_TOOL'; toolName: string }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: VoiceAgentState = {
  activeProvider: null,
  availableProviders: ['openai', 'elevenlabs'],
  connectionState: {
    status: 'disconnected',
    reconnectAttempts: 0,
    maxReconnectAttempts: 3
  },
  sessionState: {
    status: 'idle',
    isAudioEnabled: false,
    isMuted: false
  },
  audioState: {
    isRecording: false,
    isPlaying: false,
    volume: 1.0,
    config: {
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  transcript: [],
  conversationMetadata: null,
  availableTools: [],
  pendingToolCalls: [],
  errorCount: 0
};

// State reducer
function conversationalAgentReducer(
  state: VoiceAgentState,
  action: ConversationalAgentAction
): VoiceAgentState {
  switch (action.type) {
    case 'SET_ACTIVE_PROVIDER':
      return {
        ...state,
        activeProvider: action.provider
      };

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connectionState: {
          ...state.connectionState,
          status: action.status,
          lastConnected: action.status === 'connected' ? new Date() : state.connectionState.lastConnected
        }
      };

    case 'SET_SESSION_STATUS':
      return {
        ...state,
        sessionState: {
          ...state.sessionState,
          status: action.status,
          lastActivity: new Date()
        }
      };

    case 'ADD_TRANSCRIPT_ITEM':
      return {
        ...state,
        transcript: [...state.transcript, action.item]
      };

    case 'CLEAR_TRANSCRIPT':
      return {
        ...state,
        transcript: []
      };

    case 'SET_ERROR':
      let errorMessage: string | undefined;
      if (action.error) {
        if (typeof action.error === 'string') {
          errorMessage = action.error;
        } else if (action.error instanceof Error) {
          errorMessage = action.error.message;
        } else if (typeof action.error === 'object' && action.error !== null && 'message' in action.error) {
          errorMessage = String((action.error as any).message);
        } else {
          errorMessage = 'An error occurred';
        }
      }

      return {
        ...state,
        lastError: errorMessage,
        errorCount: action.error ? state.errorCount + 1 : state.errorCount
      };

    case 'SET_AUDIO_STATE':
      return {
        ...state,
        audioState: {
          ...state.audioState,
          ...action.audioState
        }
      };

    case 'SET_CONTEXT_ID':
      return {
        ...state,
        contextId: action.contextId
      };

    case 'SET_REFLINK_ID':
      return {
        ...state,
        reflinkId: action.reflinkId
      };

    case 'SET_ACCESS_LEVEL':
      return {
        ...state,
        accessLevel: action.accessLevel
      };

    case 'ADD_TOOL':
      return {
        ...state,
        availableTools: [...state.availableTools.filter(t => t.name !== action.tool.name), action.tool]
      };

    case 'REMOVE_TOOL':
      return {
        ...state,
        availableTools: state.availableTools.filter(t => t.name !== action.toolName)
      };

    case 'RESET_STATE':
      return {
        ...initialState,
        availableProviders: state.availableProviders
      };

    default:
      return state;
  }
}

// Context interface
interface ConversationalAgentContextType {
  // State
  state: VoiceAgentState;

  // Provider management
  switchProvider: (provider: VoiceProvider) => Promise<void>;
  getAvailableProviders: () => VoiceProvider[];

  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;

  // Audio controls
  startVoiceInput: () => Promise<void>;
  stopVoiceInput: () => Promise<void>;
  mute: () => void;
  unmute: () => void;
  setVolume: (volume: number) => void;

  // Communication
  sendMessage: (message: string) => Promise<void>;
  interrupt: () => Promise<void>;

  // Tool management
  registerTool: (tool: ToolDefinition) => void;
  unregisterTool: (toolName: string) => void;

  // Transcript management
  clearTranscript: () => void;
  exportTranscript: () => Promise<string>;

  // Configuration
  setContextId: (contextId: string) => void;
  setReflinkId: (reflinkId: string) => void;
  setAccessLevel: (level: 'basic' | 'limited' | 'premium') => void;

  // Utilities
  isConnected: () => boolean;
  isRecording: () => boolean;
  getLastError: () => string | undefined;
  clearErrors: () => void;
}

// Create context
const ConversationalAgentContext = createContext<ConversationalAgentContextType | null>(null);

// Provider component props
interface ConversationalAgentProviderProps {
  children: React.ReactNode;
  defaultProvider?: VoiceProvider;
  autoConnect?: boolean;
  contextId?: string;
  reflinkId?: string;
  accessLevel?: 'basic' | 'limited' | 'premium';
  tools?: ToolDefinition[];
}

// Provider component
export function ConversationalAgentProvider({
  children,
  defaultProvider = 'openai',
  autoConnect = false,
  contextId,
  reflinkId,
  accessLevel = 'basic',
  tools = []
}: ConversationalAgentProviderProps) {
  const [state, dispatch] = useReducer(conversationalAgentReducer, initialState);
  const currentAdapterRef = useRef<IConversationalAgentAdapter | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize audio element
  useEffect(() => {
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
      audioElementRef.current.autoplay = true;
    }

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
      }
    };
  }, []);

  // Register adapter factories
  useEffect(() => {
    if (!isInitializedRef.current) {
      AdapterRegistry.register('openai', async () => new OpenAIRealtimeAdapter());
      AdapterRegistry.register('elevenlabs', async () => new ElevenLabsAdapter());
      isInitializedRef.current = true;
    }
  }, []);

  // Initialize context settings
  useEffect(() => {
    if (contextId) {
      dispatch({ type: 'SET_CONTEXT_ID', contextId });
    }
  }, [contextId]);

  useEffect(() => {
    if (reflinkId) {
      dispatch({ type: 'SET_REFLINK_ID', reflinkId });
    }
  }, [reflinkId]);

  useEffect(() => {
    if (accessLevel) {
      dispatch({ type: 'SET_ACCESS_LEVEL', accessLevel });
    }
  }, [accessLevel]);

  // Register initial tools
  useEffect(() => {
    tools.forEach(tool => {
      dispatch({ type: 'ADD_TOOL', tool });
    });
  }, [tools]);

  // Initialize default provider (separate from other effects to avoid circular dependencies)
  useEffect(() => {
    let isMounted = true;

    const initializeProvider = async () => {
      if (defaultProvider && !state.activeProvider && isInitializedRef.current) {
        try {
          // Set the provider but don't auto-connect to avoid false "connected" state
          dispatch({ type: 'SET_ACTIVE_PROVIDER', provider: defaultProvider });

          // Create adapter but don't connect yet
          const newAdapter = await AdapterRegistry.create(defaultProvider);
          await newAdapter.init(createAdapterOptions());
          currentAdapterRef.current = newAdapter;

          // Only connect if explicitly requested
          if (autoConnect && isMounted) {
            await connect();
          }
        } catch (error) {
          console.error('Failed to initialize provider:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          dispatch({ type: 'SET_ERROR', error: new VoiceAgentError(errorMessage, defaultProvider) });
        }
      }
    };

    // Only initialize after adapters are registered
    if (isInitializedRef.current) {
      initializeProvider();
    }

    return () => {
      isMounted = false;
    };
  }, [defaultProvider, state.activeProvider, autoConnect]); // Removed switchProvider and connect from dependencies

  // Create adapter init options
  const createAdapterOptions = useCallback((): AdapterInitOptions => {
    if (!audioElementRef.current) {
      throw new Error('Audio element not initialized');
    }

    return {
      audioElement: audioElementRef.current,
      onConnectionEvent: (event) => {
        dispatch({
          type: 'SET_CONNECTION_STATUS', status:
            event.type === 'connected' ? 'connected' :
              event.type === 'disconnected' ? 'disconnected' :
                event.type === 'reconnecting' ? 'reconnecting' : 'error'
        });

        if (event.error) {
          // Log error for debugging (can be removed in production)
          console.error(`${event.provider} connection error:`, event.error);

          // event.error is typed as string in ConnectionEvent
          const errorMessage = event.error;
          
          dispatch({ type: 'SET_ERROR', error: new VoiceAgentError(errorMessage, event.provider) });
        }
      },
      onTranscriptEvent: (event) => {
        dispatch({ type: 'ADD_TRANSCRIPT_ITEM', item: event.item });

        // Emit debug event for transcript update
        debugEventEmitter.emitTranscriptUpdate(event.item);

        // Log transcript to server asynchronously
        logTranscriptToServer(event.item).catch(console.error);
      },
      onAudioEvent: (event) => {
        if (event.type === 'audio_start') {
          dispatch({ type: 'SET_AUDIO_STATE', audioState: { isRecording: true } });
          dispatch({ type: 'SET_SESSION_STATUS', status: 'listening' });
        } else if (event.type === 'audio_end') {
          dispatch({ type: 'SET_AUDIO_STATE', audioState: { isRecording: false } });
          dispatch({ type: 'SET_SESSION_STATUS', status: 'idle' });
        } else if (event.error) {
          // Enhanced error logging for audio events
          console.error('ConversationalAgentContext - Audio Error Details:', {
            eventType: event.type,
            errorType: typeof event.error,
            errorValue: event.error,
            errorLength: event.error?.length
          });

          // event.error is typed as string in AudioEvent
          const errorMessage = event.error;
          
          console.error('ConversationalAgentContext - Processed Audio Error Message:', errorMessage);
          dispatch({ type: 'SET_ERROR', error: new VoiceAgentError(errorMessage, state.activeProvider || 'openai') });
        }
      },
      onToolEvent: (event) => {
        // Tool events are handled by adapters
        // Could add additional state management here
      },
      contextId: state.contextId,
      reflinkId: state.reflinkId,
      accessLevel: state.accessLevel,
      tools: state.availableTools,
      debug: process.env.NODE_ENV === 'development',
      logLevel: 'info'
    };
  }, [state.contextId, state.reflinkId, state.accessLevel, state.availableTools, state.activeProvider]);

  // Log transcript to server
  const logTranscriptToServer = useCallback(async (item: TranscriptItem) => {
    try {
      const ensuredSessionId = state.conversationMetadata?.sessionId || (state.connectionState.lastConnected?.getTime ? `sess_${state.connectionState.lastConnected.getTime()}` : uuidv4());
      const ensuredProvider = state.activeProvider || 'openai';
      const ensuredTimestamp = new Date().toISOString();
      await fetch('/api/ai/conversation/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptItem: item,
          sessionId: ensuredSessionId,
          contextId: state.contextId,
          reflinkId: state.reflinkId,
          provider: ensuredProvider,
          timestamp: ensuredTimestamp
        }),
      });
    } catch (error) {
      console.error('Failed to log transcript to server:', error);
    }
  }, [state.conversationMetadata?.sessionId, state.contextId, state.reflinkId, state.activeProvider]);

  // Provider management
  const switchProvider = useCallback(async (provider: VoiceProvider) => {
    try {
      // Disconnect current adapter
      if (currentAdapterRef.current) {
        await currentAdapterRef.current.disconnect();
        await currentAdapterRef.current.cleanup();
        currentAdapterRef.current = null;
      }

      // Reset connection state when switching providers
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      dispatch({ type: 'SET_SESSION_STATUS', status: 'idle' });
      dispatch({ type: 'SET_AUDIO_STATE', audioState: { isRecording: false, isPlaying: false } });

      // Create new adapter
      const newAdapter = await AdapterRegistry.create(provider);
      await newAdapter.init(createAdapterOptions());

      currentAdapterRef.current = newAdapter;
      dispatch({ type: 'SET_ACTIVE_PROVIDER', provider });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const voiceError = new VoiceAgentError(
        `Failed to switch to provider ${provider}: ${errorMessage}`,
        provider
      );
      dispatch({ type: 'SET_ERROR', error: voiceError });
      throw voiceError;
    }
  }, [createAdapterOptions]);

  const getAvailableProviders = useCallback((): VoiceProvider[] => {
    return AdapterRegistry.getAvailableProviders();
  }, []);

  // Connection management
  const connect = useCallback(async () => {
    if (!currentAdapterRef.current) {
      const errorMessage = 'No active adapter available. Please select a provider first.';
      const error = new VoiceAgentError(errorMessage, state.activeProvider || 'openai');
      dispatch({ type: 'SET_ERROR', error });
      throw error;
    }

    try {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connecting' });
      
      // Generate session ID for this connection
      const sessionId = state.conversationMetadata?.sessionId || `sess_${Date.now()}_${state.activeProvider}`;
      
      // Emit debug event for voice session start
      debugEventEmitter.emitVoiceSessionStart(state.activeProvider || 'openai', sessionId);
      
      await currentAdapterRef.current.connect();
      // Connection status will be updated by the adapter's onConnectionEvent callback
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const voiceError = new VoiceAgentError(`Connection failed: ${errorMessage}`, state.activeProvider || 'openai');
      dispatch({ type: 'SET_ERROR', error: voiceError });
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'error' });
      throw voiceError;
    }
  }, [state.activeProvider, state.conversationMetadata?.sessionId]);

  const disconnect = useCallback(async () => {
    try {
      if (currentAdapterRef.current) {
        await currentAdapterRef.current.disconnect();
      }
      
      // Emit debug event for voice session end
      if (state.conversationMetadata?.sessionId && state.conversationMetadata?.startTime) {
        const duration = Date.now() - state.conversationMetadata.startTime.getTime();
        debugEventEmitter.emitVoiceSessionEnd(
          state.activeProvider || 'openai', 
          state.conversationMetadata.sessionId, 
          duration
        );
      }
      
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      dispatch({ type: 'SET_SESSION_STATUS', status: 'idle' });
      dispatch({ type: 'SET_AUDIO_STATE', audioState: { isRecording: false, isPlaying: false } });
    } catch (error) {
      console.error('Error during disconnect:', error);
      // Still set to disconnected even if there was an error
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
    }
  }, [state.conversationMetadata, state.activeProvider]);

  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [disconnect, connect]);

  // Audio controls
  const startVoiceInput = useCallback(async () => {
    if (!currentAdapterRef.current) {
      throw new VoiceAgentError('No active adapter', state.activeProvider || 'openai');
    }

    await currentAdapterRef.current.startAudioInput();
  }, [state.activeProvider]);

  const stopVoiceInput = useCallback(async () => {
    if (currentAdapterRef.current) {
      await currentAdapterRef.current.stopAudioInput();
    }
  }, []);

  const mute = useCallback(() => {
    if (currentAdapterRef.current) {
      currentAdapterRef.current.mute();
      dispatch({ type: 'SET_AUDIO_STATE', audioState: { isRecording: false } });
    }
  }, []);

  const unmute = useCallback(() => {
    if (currentAdapterRef.current) {
      currentAdapterRef.current.unmute();
      dispatch({ type: 'SET_AUDIO_STATE', audioState: { isRecording: false } });
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (currentAdapterRef.current) {
      currentAdapterRef.current.setVolume(volume);
      dispatch({ type: 'SET_AUDIO_STATE', audioState: { volume } });
    }
  }, []);

  // Communication
  const sendMessage = useCallback(async (message: string) => {
    if (!currentAdapterRef.current) {
      throw new VoiceAgentError('No active adapter', state.activeProvider || 'openai');
    }

    await currentAdapterRef.current.sendMessage(message);
  }, [state.activeProvider]);

  const interrupt = useCallback(async () => {
    if (currentAdapterRef.current) {
      await currentAdapterRef.current.interrupt();
    }
  }, []);

  // Tool management
  const registerTool = useCallback((tool: ToolDefinition) => {
    dispatch({ type: 'ADD_TOOL', tool });

    if (currentAdapterRef.current) {
      currentAdapterRef.current.registerTool(tool);
    }
  }, []);

  const unregisterTool = useCallback((toolName: string) => {
    dispatch({ type: 'REMOVE_TOOL', toolName });

    if (currentAdapterRef.current) {
      currentAdapterRef.current.unregisterTool(toolName);
    }
  }, []);

  // Transcript management
  const clearTranscript = useCallback(() => {
    dispatch({ type: 'CLEAR_TRANSCRIPT' });

    if (currentAdapterRef.current) {
      currentAdapterRef.current.clearTranscript();
    }
  }, []);

  const exportTranscript = useCallback(async (): Promise<string> => {
    if (currentAdapterRef.current) {
      return currentAdapterRef.current.exportTranscript();
    }

    return JSON.stringify(state.transcript, null, 2);
  }, [state.transcript]);

  // Configuration
  const setContextId = useCallback((contextId: string) => {
    dispatch({ type: 'SET_CONTEXT_ID', contextId });
  }, []);

  const setReflinkId = useCallback((reflinkId: string) => {
    dispatch({ type: 'SET_REFLINK_ID', reflinkId });
  }, []);

  const setAccessLevel = useCallback((level: 'basic' | 'limited' | 'premium') => {
    dispatch({ type: 'SET_ACCESS_LEVEL', accessLevel: level });
  }, []);

  // Utilities
  const isConnected = useCallback((): boolean => {
    return state.connectionState.status === 'connected';
  }, [state.connectionState.status]);

  const isRecording = useCallback((): boolean => {
    return state.audioState.isRecording;
  }, [state.audioState.isRecording]);

  const getLastError = useCallback((): string | undefined => {
    return state.lastError;
  }, [state.lastError]);

  const clearErrors = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentAdapterRef.current) {
        currentAdapterRef.current.cleanup().catch(console.error);
      }
    };
  }, []);

  const contextValue: ConversationalAgentContextType = {
    state,
    switchProvider,
    getAvailableProviders,
    connect,
    disconnect,
    reconnect,
    startVoiceInput,
    stopVoiceInput,
    mute,
    unmute,
    setVolume,
    sendMessage,
    interrupt,
    registerTool,
    unregisterTool,
    clearTranscript,
    exportTranscript,
    setContextId,
    setReflinkId,
    setAccessLevel,
    isConnected,
    isRecording,
    getLastError,
    clearErrors
  };

  return (
    <ConversationalAgentContext.Provider value={contextValue}>
      {children}
    </ConversationalAgentContext.Provider>
  );
}

// Hook to use the context
export function useConversationalAgent(): ConversationalAgentContextType {
  const context = useContext(ConversationalAgentContext);
  if (!context) {
    throw new Error('useConversationalAgent must be used within a ConversationalAgentProvider');
  }
  return context;
}