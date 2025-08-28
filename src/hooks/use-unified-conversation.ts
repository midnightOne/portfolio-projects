/**
 * Unified Conversation Hook
 * React hook for interacting with the unified conversation system
 * Provides mode-agnostic conversation interface for components
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  type ConversationInput,
  type ConversationResponse,
  type ConversationOptions,
  type ConversationMessage,
  type ConversationState,
  unifiedConversationManager
} from '@/lib/services/ai/unified-conversation-manager';
import {
  type ConversationTransport,
  type TransportError,
  type TransportState,
  HTTPConversationTransport,
  ConversationTransportManager
} from '@/lib/services/ai/conversation-transport';

export interface UseUnifiedConversationOptions {
  sessionId?: string;
  initialMode?: 'text' | 'voice' | 'hybrid';
  autoConnect?: boolean;
  defaultTransport?: 'http' | 'websocket' | 'webrtc';
  conversationOptions?: ConversationOptions;
  defaultModel?: string;
}

export interface UseUnifiedConversationReturn {
  // Conversation state
  messages: ConversationMessage[];
  isProcessing: boolean;
  currentMode: 'text' | 'voice' | 'hybrid';
  sessionId: string;
  currentModel: string;
  
  // Transport state
  isConnected: boolean;
  transportState: TransportState | null;
  activeTransport: string | undefined;
  
  // Actions
  sendMessage: (content: string, mode?: 'text' | 'voice' | 'hybrid', model?: string) => Promise<ConversationResponse>;
  switchMode: (mode: 'text' | 'voice' | 'hybrid') => Promise<void>;
  switchTransport: (transport: 'http' | 'websocket' | 'webrtc') => Promise<void>;
  switchModel: (model: string) => void;
  clearHistory: () => Promise<void>;
  
  // Event handlers
  onMessage: (callback: (response: ConversationResponse) => void) => void;
  onError: (callback: (error: TransportError) => void) => void;
  onStateChange: (callback: (state: TransportState) => void) => void;
  
  // Utilities
  getConversationState: () => Promise<ConversationState | null>;
  refreshMessages: () => Promise<void>;
  
  // Error state
  error: TransportError | null;
  clearError: () => void;
}

/**
 * Hook for unified conversation management
 */
export function useUnifiedConversation(options: UseUnifiedConversationOptions = {}): UseUnifiedConversationReturn {
  const {
    sessionId: providedSessionId,
    initialMode = 'text',
    autoConnect = true,
    defaultTransport = 'http',
    conversationOptions = {},
    defaultModel = 'gpt-4o'
  } = options;

  // Generate session ID if not provided - only on client side to avoid hydration mismatch
  const [sessionId, setSessionId] = useState<string>(providedSessionId || '');
  
  // Initialize session ID on client side only
  useEffect(() => {
    if (!providedSessionId && !sessionId) {
      setSessionId(`session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`);
    }
  }, [providedSessionId, sessionId]);

  // State
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMode, setCurrentMode] = useState<'text' | 'voice' | 'hybrid'>(initialMode);
  const [currentModel, setCurrentModel] = useState<string>(defaultModel);
  const [isConnected, setIsConnected] = useState(false);
  const [transportState, setTransportState] = useState<TransportState | null>(null);
  const [activeTransport, setActiveTransport] = useState<string | undefined>();
  const [error, setError] = useState<TransportError | null>(null);

  // Transport manager
  const transportManager = useRef<ConversationTransportManager | undefined>(undefined);
  const messageCallbacks = useRef<Array<(response: ConversationResponse) => void>>([]);
  const errorCallbacks = useRef<Array<(error: TransportError) => void>>([]);
  const stateCallbacks = useRef<Array<(state: TransportState) => void>>([]);

  // Initialize transport manager
  useEffect(() => {
    if (!transportManager.current) {
      transportManager.current = new ConversationTransportManager();
      
      // Register default HTTP transport
      const httpTransport = new HTTPConversationTransport();
      transportManager.current.registerTransport(httpTransport);
      
      // Set up event handlers
      transportManager.current.onMessage((response) => {
        messageCallbacks.current.forEach(callback => callback(response));
        
        // Update messages state
        setMessages(prev => [...prev, response.message]);
        setIsProcessing(false);
      });
      
      transportManager.current.onError((error) => {
        errorCallbacks.current.forEach(callback => callback(error));
        setError(error);
        setIsProcessing(false);
      });
      
      transportManager.current.onStateChange((state) => {
        stateCallbacks.current.forEach(callback => callback(state));
        setTransportState(state);
        setIsConnected(state.connected);
        setActiveTransport(state.transport);
      });
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && transportManager.current) {
      transportManager.current.setActiveTransport(defaultTransport).catch(error => {
        console.error('Failed to connect to default transport:', error);
      });
    }
  }, [autoConnect, defaultTransport]);

  // Load existing conversation history
  useEffect(() => {
    if (!sessionId) return; // Wait for session ID to be initialized
    
    const loadHistory = async () => {
      try {
        const history = await unifiedConversationManager.getConversationHistory(sessionId);
        setMessages(history);
      } catch (error) {
        console.error('Failed to load conversation history:', error);
      }
    };

    loadHistory();
  }, [sessionId]);

  // Send message function
  const sendMessage = useCallback(async (
    content: string, 
    mode: 'text' | 'voice' | 'hybrid' = currentMode,
    model: string = currentModel
  ): Promise<ConversationResponse> => {
    if (!transportManager.current) {
      throw new Error('Transport manager not initialized');
    }
    
    if (!sessionId) {
      throw new Error('Session not initialized');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const input: ConversationInput = {
        content,
        mode,
        sessionId,
        metadata: {
          userPreferences: {
            tone: 'professional', // Default tone
            responseLength: 'detailed',
            includeNavigation: true
          }
        }
      };

      // Add model to conversation options
      const optionsWithModel = {
        ...conversationOptions,
        model
      };

      // Add user message to state immediately for better UX
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        role: 'user',
        content,
        timestamp: new Date(),
        inputMode: mode
      };
      
      setMessages(prev => [...prev, userMessage]);

      // Send through transport
      const response = await transportManager.current.sendMessage(input, optionsWithModel);
      
      return response;

    } catch (error) {
      setIsProcessing(false);
      const transportError: TransportError = {
        code: 'SEND_MESSAGE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to send message',
        recoverable: true,
        transport: activeTransport || 'unknown',
        timestamp: new Date()
      };
      setError(transportError);
      throw transportError;
    }
  }, [currentMode, currentModel, sessionId, conversationOptions, activeTransport]);

  // Switch conversation mode
  const switchMode = useCallback(async (mode: 'text' | 'voice' | 'hybrid'): Promise<void> => {
    if (!sessionId) {
      throw new Error('Session not initialized');
    }
    
    try {
      await unifiedConversationManager.updateConversationMode(sessionId, mode);
      setCurrentMode(mode);
    } catch (error) {
      console.error('Failed to switch conversation mode:', error);
      throw error;
    }
  }, [sessionId]);

  // Switch transport
  const switchTransport = useCallback(async (transport: 'http' | 'websocket' | 'webrtc'): Promise<void> => {
    if (!transportManager.current) {
      throw new Error('Transport manager not initialized');
    }

    try {
      await transportManager.current.setActiveTransport(transport);
    } catch (error) {
      console.error('Failed to switch transport:', error);
      throw error;
    }
  }, []);

  // Switch model
  const switchModel = useCallback((model: string): void => {
    setCurrentModel(model);
  }, []);

  // Clear conversation history
  const clearHistory = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      throw new Error('Session not initialized');
    }
    
    try {
      await unifiedConversationManager.clearConversationHistory(sessionId);
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear conversation history:', error);
      throw error;
    }
  }, [sessionId]);

  // Event handler registration
  const onMessage = useCallback((callback: (response: ConversationResponse) => void): void => {
    messageCallbacks.current.push(callback);
  }, []);

  const onError = useCallback((callback: (error: TransportError) => void): void => {
    errorCallbacks.current.push(callback);
  }, []);

  const onStateChange = useCallback((callback: (state: TransportState) => void): void => {
    stateCallbacks.current.push(callback);
  }, []);

  // Get conversation state
  const getConversationState = useCallback(async (): Promise<ConversationState | null> => {
    if (!sessionId) {
      return null;
    }
    return unifiedConversationManager.getConversationState(sessionId);
  }, [sessionId]);

  // Refresh messages from conversation manager
  const refreshMessages = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      return;
    }
    
    try {
      const history = await unifiedConversationManager.getConversationHistory(sessionId);
      setMessages(history);
    } catch (error) {
      console.error('Failed to refresh messages:', error);
    }
  }, [sessionId]);

  // Clear error
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // Check if currently processing
  useEffect(() => {
    if (!sessionId) return; // Wait for session ID to be initialized
    
    const checkProcessing = () => {
      const processing = unifiedConversationManager.isProcessing(sessionId);
      setIsProcessing(processing);
    };

    // Check immediately
    checkProcessing();

    // Set up interval to check processing state
    const interval = setInterval(checkProcessing, 100);

    return () => clearInterval(interval);
  }, [sessionId]);

  return {
    // State
    messages,
    isProcessing,
    currentMode,
    currentModel,
    sessionId,
    isConnected,
    transportState,
    activeTransport,
    error,
    
    // Actions
    sendMessage,
    switchMode,
    switchTransport,
    switchModel,
    clearHistory,
    
    // Event handlers
    onMessage,
    onError,
    onStateChange,
    
    // Utilities
    getConversationState,
    refreshMessages,
    clearError
  };
}

/**
 * Hook for conversation state only (without transport management)
 * Useful for components that only need to display conversation state
 */
export function useConversationState(sessionId: string) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);

  useEffect(() => {
    const loadState = async () => {
      try {
        const state = await unifiedConversationManager.getConversationState(sessionId);
        setConversationState(state);
        if (state) {
          setMessages(state.messages);
          setIsProcessing(state.isProcessing);
        }
      } catch (error) {
        console.error('Failed to load conversation state:', error);
      }
    };

    loadState();

    // Set up polling for state updates
    const interval = setInterval(loadState, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  return {
    messages,
    isProcessing,
    conversationState
  };
}

/**
 * Hook for transport management only
 * Useful for components that need to manage transport connections
 */
export function useConversationTransport(defaultTransport: 'http' | 'websocket' | 'webrtc' = 'http') {
  const [isConnected, setIsConnected] = useState(false);
  const [transportState, setTransportState] = useState<TransportState | null>(null);
  const [activeTransport, setActiveTransport] = useState<string | undefined>();
  const [error, setError] = useState<TransportError | null>(null);

  const transportManager = useRef<ConversationTransportManager | undefined>(undefined);

  useEffect(() => {
    if (!transportManager.current) {
      transportManager.current = new ConversationTransportManager();
      
      // Register HTTP transport
      const httpTransport = new HTTPConversationTransport();
      transportManager.current.registerTransport(httpTransport);
      
      // Set up event handlers
      transportManager.current.onError(setError);
      transportManager.current.onStateChange((state) => {
        setTransportState(state);
        setIsConnected(state.connected);
        setActiveTransport(state.transport);
      });

      // Connect to default transport
      transportManager.current.setActiveTransport(defaultTransport).catch(error => {
        console.error('Failed to connect to default transport:', error);
      });
    }
  }, [defaultTransport]);

  const switchTransport = useCallback(async (transport: 'http' | 'websocket' | 'webrtc'): Promise<void> => {
    if (!transportManager.current) {
      throw new Error('Transport manager not initialized');
    }

    try {
      await transportManager.current.setActiveTransport(transport);
    } catch (error) {
      console.error('Failed to switch transport:', error);
      throw error;
    }
  }, []);

  return {
    isConnected,
    transportState,
    activeTransport,
    error,
    switchTransport,
    clearError: () => setError(null)
  };
}