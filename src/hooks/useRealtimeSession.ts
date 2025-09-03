/**
 * useRealtimeSession Hook
 * 
 * React hook for managing OpenAI Realtime sessions with WebRTC connections.
 * Provides session lifecycle management, connection state, and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { OpenAIAdapter } from '@/lib/voice/OpenAIAdapter';
import {
  ConnectionStatus,
  SessionStatus,
  TranscriptItem,
  VoiceAgentError,
  AdapterInitOptions
} from '@/types/voice-agent';

interface UseRealtimeSessionOptions {
  autoConnect?: boolean;
  reconnectOnError?: boolean;
  maxReconnectAttempts?: number;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onSessionChange?: (status: SessionStatus) => void;
  onTranscriptUpdate?: (transcript: TranscriptItem[]) => void;
  onError?: (error: VoiceAgentError) => void;
}

interface UseRealtimeSessionReturn {
  // Connection state
  connectionStatus: ConnectionStatus;
  sessionStatus: SessionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  
  // Session management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  
  // Audio controls
  startAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  isRecording: boolean;
  
  // Communication
  sendMessage: (message: string) => Promise<void>;
  interrupt: () => Promise<void>;
  
  // State
  transcript: TranscriptItem[];
  lastError: VoiceAgentError | null;
  
  // Audio controls
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
  setVolume: (volume: number) => void;
  volume: number;
  
  // Adapter access
  adapter: OpenAIAdapter | null;
}

export function useRealtimeSession(
  options: UseRealtimeSessionOptions = {}
): UseRealtimeSessionReturn {
  const {
    autoConnect = false,
    reconnectOnError = true,
    maxReconnectAttempts = 3,
    onConnectionChange,
    onSessionChange,
    onTranscriptUpdate,
    onError
  } = options;

  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [lastError, setLastError] = useState<VoiceAgentError | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1.0);

  // Refs
  const adapterRef = useRef<OpenAIAdapter | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const reconnectAttemptsRef = useRef(0);
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

  // Initialize adapter
  const initializeAdapter = useCallback(async () => {
    if (isInitializedRef.current || !audioElementRef.current) {
      return;
    }

    try {
      const adapter = new OpenAIAdapter();
      
      const initOptions: AdapterInitOptions = {
        audioElement: audioElementRef.current,
        onConnectionEvent: (event) => {
          setConnectionStatus(event.type === 'connected' ? 'connected' : 
                            event.type === 'disconnected' ? 'disconnected' :
                            event.type === 'reconnecting' ? 'reconnecting' : 'error');
          
          if (event.error) {
            const error = new VoiceAgentError(event.error, 'openai');
            setLastError(error);
            onError?.(error);
          } else {
            setLastError(null);
          }
          
          onConnectionChange?.(event.type === 'connected' ? 'connected' : 
                              event.type === 'disconnected' ? 'disconnected' :
                              event.type === 'reconnecting' ? 'reconnecting' : 'error');
        },
        onTranscriptEvent: (event) => {
          setTranscript(prev => {
            const updated = [...prev, event.item];
            onTranscriptUpdate?.(updated);
            return updated;
          });
        },
        onAudioEvent: (event) => {
          if (event.type === 'audio_start') {
            setIsRecording(true);
          } else if (event.type === 'audio_end') {
            setIsRecording(false);
          } else if (event.error) {
            const error = new VoiceAgentError(event.error, 'openai');
            setLastError(error);
            onError?.(error);
          }
        },
        onToolEvent: (event) => {
          // Tool events are handled by the adapter
          // Could add additional logging or state updates here
        },
        debug: process.env.NODE_ENV === 'development',
        logLevel: 'info'
      };

      await adapter.init(initOptions);
      adapterRef.current = adapter;
      isInitializedRef.current = true;

    } catch (error) {
      const voiceError = new VoiceAgentError(
        `Failed to initialize OpenAI adapter: ${error instanceof Error ? error.message : String(error)}`,
        'openai'
      );
      setLastError(voiceError);
      onError?.(voiceError);
    }
  }, [onConnectionChange, onSessionChange, onTranscriptUpdate, onError]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      initializeAdapter().then(() => {
        if (adapterRef.current) {
          adapterRef.current.connect().catch((error) => {
            const voiceError = new VoiceAgentError(
              `Auto-connect failed: ${error instanceof Error ? error.message : String(error)}`,
              'openai'
            );
            setLastError(voiceError);
            onError?.(voiceError);
          });
        }
      });
    } else {
      initializeAdapter();
    }
  }, [autoConnect, initializeAdapter]);

  // Session management functions
  const connect = useCallback(async () => {
    if (!adapterRef.current) {
      await initializeAdapter();
    }
    
    if (adapterRef.current) {
      try {
        await adapterRef.current.connect();
        reconnectAttemptsRef.current = 0;
      } catch (error) {
        if (reconnectOnError && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          setTimeout(() => connect(), 1000 * reconnectAttemptsRef.current);
        }
        throw error;
      }
    }
  }, [initializeAdapter, reconnectOnError, maxReconnectAttempts]);

  const disconnect = useCallback(async () => {
    if (adapterRef.current) {
      await adapterRef.current.disconnect();
    }
    setIsRecording(false);
  }, []);

  const reconnect = useCallback(async () => {
    await disconnect();
    await connect();
  }, [disconnect, connect]);

  // Audio controls
  const startAudio = useCallback(async () => {
    if (adapterRef.current) {
      await adapterRef.current.startAudioInput();
    }
  }, []);

  const stopAudio = useCallback(async () => {
    if (adapterRef.current) {
      await adapterRef.current.stopAudioInput();
    }
  }, []);

  // Communication
  const sendMessage = useCallback(async (message: string) => {
    if (adapterRef.current) {
      await adapterRef.current.sendMessage(message);
    }
  }, []);

  const interrupt = useCallback(async () => {
    if (adapterRef.current) {
      await adapterRef.current.interrupt();
    }
  }, []);

  // Audio controls
  const mute = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.mute();
      setIsMuted(true);
    }
  }, []);

  const unmute = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.unmute();
      setIsMuted(false);
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    if (adapterRef.current) {
      adapterRef.current.setVolume(newVolume);
      setVolumeState(newVolume);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (adapterRef.current) {
        adapterRef.current.cleanup().catch(console.error);
      }
    };
  }, []);

  // Derived state
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'reconnecting';

  return {
    // Connection state
    connectionStatus,
    sessionStatus,
    isConnected,
    isConnecting,
    
    // Session management
    connect,
    disconnect,
    reconnect,
    
    // Audio controls
    startAudio,
    stopAudio,
    isRecording,
    
    // Communication
    sendMessage,
    interrupt,
    
    // State
    transcript,
    lastError,
    
    // Audio controls
    mute,
    unmute,
    isMuted,
    setVolume,
    volume,
    
    // Adapter access
    adapter: adapterRef.current
  };
}