"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { 
  VoiceProvider, 
  VoiceAgentState, 
  AdapterInitOptions, 
  TranscriptItem,
  ConnectionEvent,
  TranscriptEvent,
  AudioEvent,
  ToolEvent
} from '@/types/voice-agent';
import { IConversationalAgentAdapter, AdapterRegistry, ConnectOptions, AudioInputMode } from '@/lib/voice/IConversationalAgentAdapter';
import { OpenAIRealtimeAdapter } from '@/lib/voice/OpenAIRealtimeAdapter';
import { GoogleLiveAdapter } from '@/lib/voice/GoogleLiveAdapter';
import { CascadeVoiceAdapter } from '@/lib/voice/CascadeVoiceAdapter';
import { ClipPlayer } from '@/lib/voice/ClipPlayer';
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
  connect: (options?: ConnectOptions) => Promise<void>;
  disconnect: () => Promise<void>;
  /** D49: resume the current conversation on another (or the same) provider. */
  resumeOnProvider: (provider: VoiceProvider, options?: ConnectOptions) => Promise<void>;
  isConnected: boolean;
  audioInputMode: AudioInputMode | null;
  /** DB conversation id (cuid) once persisted — for debug display and lookup. */
  conversationId: string | null;

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
  const { session, accessLevel, isFeatureEnabled, budgetStatus, isLoading: sessionLoading } = useReflinkSession();
  
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeProvider, setActiveProvider] = useState<VoiceProvider | null>(null);
  const [currentAdapter, setCurrentAdapter] = useState<IConversationalAgentAdapter | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [audioInputMode, setAudioInputMode] = useState<AudioInputMode | null>(null);
  /** DB conversation id (cuid) once persisted — surfaced for debug display/lookup. */
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1.0);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  
  // Voice agent state
  const [voiceAgentState, setVoiceAgentState] = useState<VoiceAgentState>({
    activeProvider: null,
    availableProviders: ['openai', 'google', 'cascade'],
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
  const initializationRef = useRef<Promise<IConversationalAgentAdapter | null> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  /** Live adapter for event handlers (state is stale inside useCallback([], …) closures). */
  const adapterRef = useRef<IConversationalAgentAdapter | null>(null);

  // D50 clip player (9b.3) — adapter-independent: connection clips must play
  // precisely when no adapter connection exists. Triggers live in the event
  // handlers below; cutoff is the speech_start handler.
  const clipPlayerRef = useRef<ClipPlayer | null>(null);
  const fillerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelSpeakingRef = useRef(false);
  /** ONE clip per silence gap (owner, 2026-07-08 — staggered back-to-back
   *  clips in multi-tool turns are worse than silence). Reset when the model
   *  actually speaks. */
  const clipPlayedThisGapRef = useRef(false);
  const lastConnStatusRef = useRef<string>('disconnected');

  // Register adapters on mount
  useEffect(() => {
    // Register adapter factories
    AdapterRegistry.register('openai', async () => new OpenAIRealtimeAdapter());
    AdapterRegistry.register('google', async () => new GoogleLiveAdapter());
    AdapterRegistry.register('cascade', async () => new CascadeVoiceAdapter());
    // 'elevenlabs' has no adapter anymore (D22 amendment, task 9.4): the
    // agent-platform adapter is retired; ElevenLabs is a TTS/STT engine
    // inside the cascade, selected via the cascade config's model fields.
  }, []);

  // D50 clip player lifecycle: create once; every playback logs an honest
  // clip_played history event (Req 13.5 — replay must show what the visitor
  // actually heard; a clip is not model speech).
  useEffect(() => {
    const player = new ClipPlayer((info) => {
      const sessionId = adapterRef.current?.getConversationSessionId?.();
      if (!sessionId) return;
      // Played-vs-total in the LABEL (owner, 2026-07-08): turn timestamps are
      // end-of-turn, so the row itself must tell the latency story — how much
      // of the clip the visitor actually heard before the model cut in.
      const played = (info.playedMs / 1000).toFixed(1);
      const total = info.clipLengthMs ? (info.clipLengthMs / 1000).toFixed(1) : '?';
      const timing = info.cutOff ? `played ${played}s of ${total}s, cut off by model speech` : `played in full (${total}s)`;
      void fetch('/api/ai/conversation/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          provider: adapterRef.current?.provider,
          event: {
            type: 'clip_played',
            label: `Clip: "${info.text}" — ${timing}`,
            detail: { phraseId: info.phraseId, tag: info.tag, voiceId: info.voiceId, playedMs: info.playedMs, clipLengthMs: info.clipLengthMs, cutOff: info.cutOff },
          },
          timestamp: new Date().toISOString(),
        }),
      }).catch((err) => console.warn('[clip_played] log failed:', err));
    });
    clipPlayerRef.current = player;
    return () => {
      clipPlayerRef.current = null;
      void player.close();
    };
  }, []);

  // Clips are strictly voice-matched per session provider — (re)load the
  // manifest and start the prioritized background cache on provider change.
  useEffect(() => {
    if (activeProvider) {
      void clipPlayerRef.current?.setProvider(activeProvider);
    }
  }, [activeProvider]);

  // D50 tool-latency filler (Req 13.1, owner-shaped 2026-07-08): ANTICIPATORY.
  // The manifest carries measured per-tool medians and per-clip lengths, so
  // when a tool with a long expected duration starts, a filler clip that FITS
  // the expected gap plays THE INSTANT the call is made — no silence timer.
  // Rules: one clip per silence gap (staggered clips are worse than silence);
  // when no clip fits the gap, a few hundred ms of silence beats a chopped
  // clip; unknown/short tools only get the fallback overrun timer. The debug
  // emitter is the one adapter-independent signal — the base adapter emits
  // tool_call_start for every provider's unified tool path.
  useEffect(() => {
    /** Below this expected gap, silence is acceptable — play nothing. */
    const MIN_GAP_FOR_CLIP_MS = 500;
    /** A clip may outlive the expected gap by this much (small anticipated cutoff). */
    const FIT_TOLERANCE_MS = 400;
    /** Fallback for unknown/underestimated tools: cover a real overrun. */
    const OVERRUN_MS = 1200;

    const armOverrunFallback = () => {
      if (fillerTimerRef.current) return;
      fillerTimerRef.current = setTimeout(() => {
        fillerTimerRef.current = null;
        if (modelSpeakingRef.current || clipPlayedThisGapRef.current) return;
        if (!adapterRef.current?.isConnected() || clipPlayerRef.current?.isPlaying) return;
        clipPlayedThisGapRef.current = true;
        void clipPlayerRef.current?.play('filler');
      }, OVERRUN_MS);
    };

    const onToolStart = (event: { data?: { toolName?: string } }) => {
      if (modelSpeakingRef.current || clipPlayedThisGapRef.current) return;
      if (!adapterRef.current?.isConnected()) return;
      const player = clipPlayerRef.current;
      if (!player || player.isPlaying) return;

      const toolName = event?.data?.toolName;
      const expected = toolName ? player.getExpectedToolMs(toolName) : null;

      if (expected !== null && expected >= MIN_GAP_FOR_CLIP_MS) {
        // Anticipatory path: play NOW, length-fitted to the expected gap.
        clipPlayedThisGapRef.current = true; // claim the gap before the async play
        void player.play('filler', { maxDurationMs: expected + FIT_TOLERANCE_MS }).then((played) => {
          if (!played) {
            // Nothing fits — accept the short silence, but still cover a
            // genuine overrun.
            clipPlayedThisGapRef.current = false;
            armOverrunFallback();
          }
        });
      } else {
        armOverrunFallback();
      }
    };

    debugEventEmitter.on('tool_call_start', onToolStart);
    return () => {
      debugEventEmitter.off('tool_call_start', onToolStart);
      if (fillerTimerRef.current) {
        clearTimeout(fillerTimerRef.current);
        fillerTimerRef.current = null;
      }
    };
  }, []);

  // Initialize provider when reflink session is ready (but don't auto-connect)
  useEffect(() => {
    // Only log initialization check in development mode and less frequently
    if (process.env.NODE_ENV === 'development') {
      console.log('ConversationalAgentProvider initialization check:', {
        isInitialized,
        sessionLoading,
        session: session !== null,
        voiceAIEnabled: isFeatureEnabled('voice_ai'),
        accessLevel,
        defaultProvider,
        hasCurrentAdapter: !!currentAdapter
      });
    }
    
    // Only initialize if we don't already have an adapter and conditions are met.
    // Gate on session RESOLUTION (not presence): admin and anonymous sessions have
    // no reflink object, and requiring one left the adapter uninitialized until a
    // provider toggle forced it (the /admin/ai/voice-debug connect-on-load bug,
    // fixed 2026-07-07).
    if (!isInitialized && !currentAdapter && !sessionLoading && isFeatureEnabled('voice_ai')) {
      console.log('Initializing voice provider (no auto-connect):', defaultProvider);
      initializeProvider(defaultProvider);
    }
  }, [session, sessionLoading, isFeatureEnabled, defaultProvider, isInitialized, currentAdapter]); // Removed accessLevel to reduce re-renders

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // WebRTC connection monitoring and recovery
  useEffect(() => {
    if (!currentAdapter || !isConnected) return;

    let recoveryTimeout: NodeJS.Timeout;
    let isRecovering = false;

    const handleVisibilityChange = () => {
      // When page becomes visible again, check connection status
      if (!document.hidden && isConnected && currentAdapter) {
        // Small delay to allow page to fully restore
        setTimeout(() => {
          if (currentAdapter && typeof currentAdapter.isConnected === 'function') {
            const actuallyConnected = currentAdapter.isConnected();
            if (!actuallyConnected && !isRecovering) {
              console.warn('🔄 WebRTC connection lost, attempting recovery...');
              isRecovering = true;
              
              // Attempt to reconnect
              currentAdapter.connect().catch(error => {
                console.error('❌ WebRTC recovery failed:', error);
                setLastError('Connection lost. Please refresh to restore voice functionality.');
              }).finally(() => {
                isRecovering = false;
              });
            }
          }
        }, 1000);
      }
    };

    const handlePopState = () => {
      // Monitor for popstate events that might disrupt WebRTC
      if (isConnected && currentAdapter) {
        // Small delay to check if connection was affected
        clearTimeout(recoveryTimeout);
        recoveryTimeout = setTimeout(() => {
          if (currentAdapter && typeof currentAdapter.isConnected === 'function') {
            const actuallyConnected = currentAdapter.isConnected();
            if (!actuallyConnected && !isRecovering) {
              console.warn('🔄 WebRTC connection lost after navigation, attempting recovery...');
              isRecovering = true;
              
              currentAdapter.connect().catch(error => {
                console.error('❌ WebRTC recovery after navigation failed:', error);
                setLastError('Connection lost during navigation. Please refresh to restore voice functionality.');
              }).finally(() => {
                isRecovering = false;
              });
            }
          }
        }, 2000); // Give more time for navigation to settle
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(recoveryTimeout);
    };
  }, [currentAdapter, isConnected]);

  /**
   * Initialize voice provider
   */
  const initializeProvider = async (provider: VoiceProvider): Promise<IConversationalAgentAdapter | null> => {
    console.log('initializeProvider called with:', provider);

    // Prevent multiple simultaneous initializations
    if (initializationRef.current) {
      console.log('Already initializing, waiting...');
      return await initializationRef.current;
    }

    const initPromise = (async (): Promise<IConversationalAgentAdapter | null> => {
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
        console.log('Creating adapter for provider:', provider);
        const adapter = await AdapterRegistry.create(provider);
        console.log('Adapter created:', adapter.constructor.name);
        
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
          onConversationPersisted: (cid: string) => setConversationId(cid),

          // Provider-specific configuration
          providerConfig: {
            [provider]: await getProviderConfig(provider)
          }
        };

        console.log('Initializing adapter with options:', initOptions);
        // Initialize adapter
        await adapter.init(initOptions);
        console.log('Adapter initialized successfully');
        
        // Update state
        setCurrentAdapter(adapter);
        adapterRef.current = adapter;
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
        return adapter;
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
        return null;
      }
    })();

    initializationRef.current = initPromise;
    const adapter = await initPromise;
    initializationRef.current = null;
    return adapter;
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
    if (event.type === 'disconnected' || event.type === 'error') {
      setAudioInputMode(null);
    }
    // D49: the adapter can reconnect internally (auto-resume) — refresh the
    // input mode from the live adapter instead of leaving the pre-drop value.
    if (event.type === 'connected' && adapterRef.current) {
      setAudioInputMode(adapterRef.current.getAudioInputMode());
    }

    // D50 connection-state clips (Req 13.2): played entirely client-side while
    // the D49 resume flow runs — exactly when no model exists to speak.
    if (event.type === 'reconnecting') {
      void clipPlayerRef.current?.play('disruption');
    } else if (event.type === 'connected') {
      clipPlayerRef.current?.stop();
      // Fresh connection = fresh silence-gap budget: without this, a session
      // that ended after a clip but before any model speech would mute the
      // next session's first gap (the budget only resets on speech_start).
      clipPlayedThisGapRef.current = false;
      modelSpeakingRef.current = false;
    } else if (event.type === 'error' && lastConnStatusRef.current === 'reconnecting') {
      void clipPlayerRef.current?.play('resume_failed');
    }
    lastConnStatusRef.current = event.type;

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
    // Model speech lifecycle (9b): speech_start is the D50 clip CUTOFF — the
    // instant real model audio arrives, any filler/greeting stops (Req 13.1).
    // Real speech also closes the current silence gap: the one-clip-per-gap
    // budget resets so the NEXT silence window may get its own clip.
    if (event.type === 'speech_start') {
      modelSpeakingRef.current = true;
      clipPlayedThisGapRef.current = false;
      if (fillerTimerRef.current) {
        clearTimeout(fillerTimerRef.current);
        fillerTimerRef.current = null;
      }
      clipPlayerRef.current?.stop();
    } else if (event.type === 'speech_end') {
      modelSpeakingRef.current = false;
    }

    // Update audio state based on event (audio_* = mic capture, speech_* = model speech)
    setVoiceAgentState(prev => ({
      ...prev,
      audioState: {
        ...prev.audioState,
        isRecording: event.type === 'audio_start' ? true :
                    event.type === 'audio_end' ? false :
                    prev.audioState.isRecording,
        isPlaying: event.type === 'speech_start' ? true :
                  event.type === 'speech_end' ? false :
                  prev.audioState.isPlaying
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
  const connect = async (options?: ConnectOptions) => {
    const wantsMic = options?.audioInput !== false;
    console.log('connect called, currentAdapter:', currentAdapter?.constructor.name, 'isConnected:', isConnected, 'audioInput:', wantsMic ? 'microphone' : 'text-only');

    if (!currentAdapter) {
      throw new Error('No adapter initialized');
    }

    // Text-only sessions only need the chat tier; the mic path stays gated on voice_ai
    if (wantsMic && !isFeatureEnabled('voice_ai')) {
      throw new Error('Voice AI is not available for your access level');
    }
    if (!wantsMic && !isFeatureEnabled('chat_interface')) {
      throw new Error('Chat is not available for your access level');
    }

    // Prevent multiple simultaneous connections
    if (isConnected) {
      console.log('Already connected, skipping connection attempt');
      return;
    }

    // A fresh session persists under a new DB conversation — drop the previous
    // id so the debug chip can't show a stale one. Resume keeps it: the legs
    // continue under the same conversation.
    if (!options?.resumeFromSessionId) {
      setConversationId(null);
    }

    // D50 optional cold-start greeting (Req 13.3) — inert unless a greeting
    // clip exists (the seed phrase ships disabled); cut off at 'connected'.
    if (clipPlayerRef.current?.hasClips('greeting')) {
      void clipPlayerRef.current.play('greeting');
    }

    console.log('Calling adapter.connect()...');
    await currentAdapter.connect(options);
    setAudioInputMode(currentAdapter.getAudioInputMode());
    console.log('Adapter.connect() completed');
  };

  /**
   * Disconnect from voice provider
   */
  const disconnect = async () => {
    if (!currentAdapter) return;

    await currentAdapter.disconnect();
  };

  /**
   * D49 5b.4: resume the current logical conversation on another (or the same)
   * provider — the deliberate-switch trigger of the one resume code path. The
   * new leg is briefed by the mint route from the conversation store.
   */
  const resumeOnProvider = async (provider: VoiceProvider, options?: ConnectOptions) => {
    const sessionId = currentAdapter?.getConversationSessionId?.() ?? null;
    if (!sessionId) {
      throw new Error('No active conversation to resume');
    }
    if (currentAdapter && isConnected) {
      await currentAdapter.disconnect();
    }
    const adapter = provider === activeProvider
      ? currentAdapter
      : await initializeProvider(provider);
    if (!adapter) {
      throw new Error(`Failed to initialize ${provider} for resume`);
    }
    await adapter.connect({ ...(options ?? {}), resumeFromSessionId: sessionId });
    setAudioInputMode(adapter.getAudioInputMode());
  };

  /**
   * Start audio input
   */
  const startAudioInput = async () => {
    console.log('startAudioInput called, currentAdapter:', currentAdapter?.constructor.name);
    if (!currentAdapter) {
      throw new Error('No adapter initialized');
    }
    
    console.log('Calling adapter.startAudioInput()...');
    await currentAdapter.startAudioInput();
    // startAudioInput may have upgraded a text-only session to a microphone session
    setAudioInputMode(currentAdapter.getAudioInputMode());
    console.log('Adapter.startAudioInput() completed');
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
    availableProviders: ['openai', 'google', 'cascade'],
    switchProvider,
    
    // Connection management
    connect,
    disconnect,
    resumeOnProvider,
    isConnected,
    audioInputMode,
    conversationId,

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