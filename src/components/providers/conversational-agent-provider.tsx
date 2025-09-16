"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { 
  VoiceProvider, 
  VoiceAgentState, 
  AdapterInitOptions, 
  TranscriptItem, 
  ToolCall, 
  ToolResult,
  ConnectionEvent,
  TranscriptEvent,
  AudioEvent,
  ToolEvent
} from '@/types/voice-agent';
import { IConversationalAgentAdapter, AdapterRegistry } from '@/lib/voice/IConversationalAgentAdapter';
import { OpenAIRealtimeAdapter } from '@/lib/voice/OpenAIRealtimeAdapter';
import { ElevenLabsAdapter } from '@/lib/voice/ElevenLabsAdapter';
import { useReflinkSession } from './reflink-session-provider';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';

interface ConversationalAgentContextType {
  // State
  state: VoiceAgentState;
  isInitialized: boolean;
  
  // Provider management
  activeProvider: VoiceProvider | null;
  availableProviders: VoiceProvider[];
  switchProvider: (provider: VoiceProvider) => Promise<void>;
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: boolean;
  
  // Audio management
  startAudioInput: () => Promise<void>;
  stopAudioInput: () => Promise<void>;
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
  setVolume: (volume: number) => void;
  volume: number;
  
  // Conversation management
  sendMessage: (message: string) => Promise<void>;
  interrupt: () => Promise<void>;
  
  // Transcript and history
  transcript: TranscriptItem[];
  clearTranscript: () => void;
  exportTranscript: () => Promise<string>;
  
  // Tool management
  availableTools: string[];
  
  // Error handling
  lastError: string | null;
  clearErrors: () => void;
  
  // Configuration
  updateConfig: (config: Partial<AdapterInitOptions>) => Promise<void>;
}

const ConversationalAgentContext = createContext<ConversationalAgentContextType | undefined>(undefined);

interface ConversationalAgentProviderProps {
  children: ReactNode;
  defaultProvider?: VoiceProvider;
  audioElement?: HTMLAudioElement;
}

export function ConversationalAgentProvider({ 
  children, 
  defaultProvider = 'openai',
  audioElement 
}: ConversationalAgentProviderProps) {
  const { session, accessLevel, isFeatureEnabled, budgetStatus } = useReflinkSession();
  
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeProvider, setActiveProvider] = useState<VoiceProvider | null>(null);
  const [currentAdapter, setCurrentAdapter] = useState<IConversationalAgentAdapter | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1.0);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  
  // Voice agent state
  const [voiceAgentState, setVoiceAgentState] = useState<VoiceAgentState>({
    activeProvider: null,
    availableProviders: ['openai', 'elevenlabs'],
    connectionState: {
      status: 'disconnected',
      lastConnected: undefined,
      reconnectAttempts: 0,
      maxReconnectAttempts: 3
    },
    sessionState: {
      status: 'idle',
      isAudioEnabled: true,
      isMuted: false,
      lastActivity: undefined
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
  });

  // Refs for cleanup
  const initializationRef = useRef<Promise<void> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Register adapters on mount
  useEffect(() => {
    // Register adapter factories
    AdapterRegistry.register('openai', async () => new OpenAIRealtimeAdapter());
    AdapterRegistry.register('elevenlabs', async () => new ElevenLabsAdapter());
  }, []);

  // Initialize provider when reflink session is ready
  useEffect(() => {
    console.log('ConversationalAgentProvider initialization check:', {
      isInitialized,
      session: session !== null,
      voiceAIEnabled: isFeatureEnabled('voice_ai'),
      accessLevel,
      defaultProvider
    });
    
    if (!isInitialized && session !== null && isFeatureEnabled('voice_ai')) {
      console.log('Initializing voice provider:', defaultProvider);
      initializeProvider(defaultProvider);
    }
  }, [session, isFeatureEnabled, defaultProvider, isInitialized, accessLevel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  /**
   * Initialize voice provider
   */
  const initializeProvider = async (provider: VoiceProvider) => {
    console.log('initializeProvider called with:', provider);
    
    // Prevent multiple simultaneous initializations
    if (initializationRef.current) {
      console.log('Already initializing, waiting...');
      await initializationRef.current;
      return;
    }

    const initPromise = (async () => {
      try {
        console.log('Starting voice provider initialization...');
        setLastError(null);
        
        // Check if voice AI is enabled for current access level
        if (!isFeatureEnabled('voice_ai')) {
          console.log('Voice AI not enabled for access level:', accessLevel);
          throw new Error('Voice AI is not available for your access level');
        }

        // Cleanup existing adapter
        if (currentAdapter) {
          await currentAdapter.cleanup();
        }

        // Create new adapter
        const adapter = await AdapterRegistry.create(provider);
        
        // Prepare initialization options
        const initOptions: AdapterInitOptions = {
          contextId: session?.reflink?.id || `public_${Date.now()}`,
          reflinkId: session?.reflink?.id,
          audioElement: audioElement,
          
          // Event handlers
          onConnectionEvent: handleConnectionEvent,
          onTranscriptEvent: handleTranscriptEvent,
          onAudioEvent: handleAudioEvent,
          onToolEvent: handleToolEvent,
          
          // Provider-specific configuration
          providerConfig: {
            [provider]: await getProviderConfig(provider)
          }
        };

        // Initialize adapter
        await adapter.init(initOptions);
        
        // Update state
        setCurrentAdapter(adapter);
        setActiveProvider(provider);
        setAvailableTools(adapter.getAvailableTools());
        setIsInitialized(true);
        
        // Update voice agent state
        setVoiceAgentState(prev => ({
          ...prev,
          activeProvider: provider,
          connectionState: {
            ...prev.connectionState,
            status: 'disconnected'
          },
          availableTools: adapter.getAvailableTools().map(toolName => ({
            name: toolName,
            description: `Tool: ${toolName}`,
            parameters: { type: 'object', properties: {} },
            handler: async () => {}
          }))
        }));

        // Set up cleanup function
        cleanupRef.current = async () => {
          if (adapter) {
            await adapter.cleanup();
          }
        };

        console.log(`ConversationalAgentProvider: Initialized with ${provider} provider`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
        setLastError(errorMessage);
        setIsInitialized(false);
        console.error('Failed to initialize conversational agent:', error);
        
        // Update error state
        setVoiceAgentState(prev => ({
          ...prev,
          lastError: errorMessage,
          errorCount: prev.errorCount + 1
        }));
      }
    })();

    initializationRef.current = initPromise;
    await initPromise;
    initializationRef.current = null;
  };

  /**
   * Get provider-specific configuration
   */
  const getProviderConfig = async (provider: VoiceProvider) => {
    // This would typically load from ClientAIModelManager
    // For now, return empty config to use defaults
    return {};
  };

  /**
   * Handle connection events
   */
  const handleConnectionEvent = useCallback((event: ConnectionEvent) => {
    setIsConnected(event.type === 'connected');
    
    if (event.error) {
      setLastError(event.error);
    }
    
    // Update voice agent state
    setVoiceAgentState(prev => ({
      ...prev,
      connectionState: {
        ...prev.connectionState,
        status: event.type === 'connected' ? 'connected' : 
               event.type === 'disconnected' ? 'disconnected' :
               event.type === 'reconnecting' ? 'connecting' : 'error',
        lastConnected: event.type === 'connected' ? new Date() : prev.connectionState.lastConnected,
        reconnectAttempts: event.type === 'reconnecting' ? 
          prev.connectionState.reconnectAttempts + 1 : 
          prev.connectionState.reconnectAttempts
      }
    }));

    // Emit debug event
    debugEventEmitter.emit('connection_event', {
      type: event.type,
      provider: event.provider,
      error: event.error,
      timestamp: event.timestamp.toISOString()
    }, 'conversational-agent-provider');
  }, []);

  /**
   * Handle transcript events
   */
  const handleTranscriptEvent = useCallback((event: TranscriptEvent) => {
    setTranscript(prev => {
      // Avoid duplicates
      const exists = prev.some(item => item.id === event.item.id);
      if (exists) {
        return prev.map(item => item.id === event.item.id ? event.item : item);
      }
      return [...prev, event.item];
    });
    
    // Update conversation state
    setVoiceAgentState(prev => ({
      ...prev,
      transcript: prev.transcript.some(item => item.id === event.item.id) 
        ? prev.transcript.map(item => item.id === event.item.id ? event.item : item)
        : [...prev.transcript, event.item],
      conversationMetadata: prev.conversationMetadata ? {
        ...prev.conversationMetadata,
        messageCount: prev.conversationMetadata.messageCount + 1
      } : null
    }));

    // Emit debug event
    debugEventEmitter.emit('transcript_event', {
      itemId: event.item.id,
      type: event.item.type,
      content: event.item.content.substring(0, 100), // Truncate for logging
      provider: event.item.provider,
      timestamp: event.timestamp.toISOString()
    }, 'conversational-agent-provider');
  }, []);

  /**
   * Handle audio events
   */
  const handleAudioEvent = useCallback((event: AudioEvent) => {
    // Update audio state based on event
    setVoiceAgentState(prev => ({
      ...prev,
      audioState: {
        ...prev.audioState,
        isRecording: event.type === 'audio_start' ? true : 
                    event.type === 'audio_end' ? false : 
                    prev.audioState.isRecording
      }
    }));

    // Emit debug event
    debugEventEmitter.emit('audio_event', {
      type: event.type,
      error: event.error,
      timestamp: event.timestamp.toISOString()
    }, 'conversational-agent-provider');
  }, []);

  /**
   * Handle tool events
   */
  const handleToolEvent = useCallback((event: ToolEvent) => {
    // Update tool state
    setVoiceAgentState(prev => ({
      ...prev,
      conversationMetadata: prev.conversationMetadata ? {
        ...prev.conversationMetadata,
        toolCallCount: prev.conversationMetadata.toolCallCount + 1
      } : null
    }));

    // Emit debug event
    debugEventEmitter.emit('tool_event', {
      type: event.type,
      toolName: event.toolCall?.name,
      success: true, // Will be updated based on actual event structure
      timestamp: event.timestamp.toISOString()
    }, 'conversational-agent-provider');
  }, []);

  /**
   * Switch provider
   */
  const switchProvider = async (provider: VoiceProvider) => {
    if (provider === activeProvider) return;
    
    // Disconnect current provider
    if (currentAdapter && isConnected) {
      await currentAdapter.disconnect();
    }
    
    // Initialize new provider
    await initializeProvider(provider);
  };

  /**
   * Connect to voice provider
   */
  const connect = async () => {
    if (!currentAdapter) {
      throw new Error('No adapter initialized');
    }
    
    if (!isFeatureEnabled('voice_ai')) {
      throw new Error('Voice AI is not available for your access level');
    }
    
    await currentAdapter.connect();
  };

  /**
   * Disconnect from voice provider
   */
  const disconnect = async () => {
    if (!currentAdapter) return;
    
    await currentAdapter.disconnect();
  };

  /**
   * Start audio input
   */
  const startAudioInput = async () => {
    if (!currentAdapter) {
      throw new Error('No adapter initialized');
    }
    
    await currentAdapter.startAudioInput();
  };

  /**
   * Stop audio input
   */
  const stopAudioInput = async () => {
    if (!currentAdapter) return;
    
    await currentAdapter.stopAudioInput();
  };

  /**
   * Mute audio
   */
  const mute = () => {
    if (!currentAdapter) return;
    
    currentAdapter.mute();
    setIsMuted(true);
  };

  /**
   * Unmute audio
   */
  const unmute = () => {
    if (!currentAdapter) return;
    
    currentAdapter.unmute();
    setIsMuted(false);
  };

  /**
   * Set volume
   */
  const setVolume = (newVolume: number) => {
    if (!currentAdapter) return;
    
    currentAdapter.setVolume(newVolume);
    setVolumeState(newVolume);
  };

  /**
   * Send text message
   */
  const sendMessage = async (message: string) => {
    if (!currentAdapter) {
      throw new Error('No adapter initialized');
    }
    
    await currentAdapter.sendMessage(message);
  };

  /**
   * Interrupt current conversation
   */
  const interrupt = async () => {
    if (!currentAdapter) return;
    
    await currentAdapter.interrupt();
  };

  /**
   * Clear transcript
   */
  const clearTranscript = () => {
    if (currentAdapter) {
      currentAdapter.clearTranscript();
    }
    setTranscript([]);
  };

  /**
   * Export transcript
   */
  const exportTranscript = async (): Promise<string> => {
    if (!currentAdapter) {
      return JSON.stringify(transcript, null, 2);
    }
    
    return currentAdapter.exportTranscript();
  };

  /**
   * Clear errors
   */
  const clearErrors = () => {
    setLastError(null);
    if (currentAdapter) {
      currentAdapter.clearErrors();
    }
    
    setVoiceAgentState(prev => ({
      ...prev,
      lastError: undefined,
      errorCount: 0
    }));
  };

  /**
   * Update configuration
   */
  const updateConfig = async (config: Partial<AdapterInitOptions>) => {
    if (!currentAdapter) {
      throw new Error('No adapter initialized');
    }
    
    await currentAdapter.updateConfig(config);
  };

  const contextValue: ConversationalAgentContextType = {
    // State
    state: voiceAgentState,
    isInitialized,
    
    // Provider management
    activeProvider,
    availableProviders: ['openai', 'elevenlabs'],
    switchProvider,
    
    // Connection management
    connect,
    disconnect,
    isConnected,
    
    // Audio management
    startAudioInput,
    stopAudioInput,
    mute,
    unmute,
    isMuted,
    setVolume,
    volume,
    
    // Conversation management
    sendMessage,
    interrupt,
    
    // Transcript and history
    transcript,
    clearTranscript,
    exportTranscript,
    
    // Tool management
    availableTools,
    
    // Error handling
    lastError,
    clearErrors,
    
    // Configuration
    updateConfig
  };

  return (
    <ConversationalAgentContext.Provider value={contextValue}>
      {children}
    </ConversationalAgentContext.Provider>
  );
}

/**
 * Hook to use conversational agent context
 */
export function useConversationalAgent() {
  const context = useContext(ConversationalAgentContext);
  if (context === undefined) {
    throw new Error('useConversationalAgent must be used within a ConversationalAgentProvider');
  }
  return context;
}