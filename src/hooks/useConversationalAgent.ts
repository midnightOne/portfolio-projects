/**
 * useConversationalAgent Hook
 * 
 * Primary hook for React components to interact with voice agents.
 * Exposes all state variables and functions from ConversationalAgentProvider
 * with provider selection, agent switching, and conversation management.
 */

import { useCallback } from 'react';
import { useConversationalAgent as useConversationalAgentContext } from '@/contexts/ConversationalAgentContext';
import { useNavigationTools } from './useNavigationTools';
import { useTranscript } from '@/contexts/TranscriptContext';
import {
  VoiceProvider,
  VoiceAgentState,
  ToolDefinition,
  TranscriptItem,
  ConnectionStatus,
  SessionStatus
} from '@/types/voice-agent';

interface ConversationalAgentHookReturn {
  // State from ConversationalAgentProvider
  state: VoiceAgentState;
  
  // Connection state helpers
  isConnected: boolean;
  isConnecting: boolean;
  isRecording: boolean;
  connectionStatus: ConnectionStatus;
  sessionStatus: SessionStatus;
  
  // Provider management
  activeProvider: VoiceProvider | null;
  availableProviders: VoiceProvider[];
  switchProvider: (provider: VoiceProvider) => Promise<void>;
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  
  // Audio controls
  startVoiceInput: () => Promise<void>;
  stopVoiceInput: () => Promise<void>;
  mute: () => void;
  unmute: () => void;
  isMuted: boolean;
  setVolume: (volume: number) => void;
  volume: number;
  
  // Communication
  sendMessage: (message: string) => Promise<void>;
  interrupt: () => Promise<void>;
  
  // Transcript management (integrated with TranscriptContext)
  transcript: TranscriptItem[];
  filteredTranscript: TranscriptItem[];
  clearTranscript: () => void;
  exportTranscript: (format?: 'json' | 'csv' | 'txt') => Promise<string>;
  searchTranscript: (query: string) => void;
  filterTranscript: (filter: any) => void;
  
  // Tool management (integrated with NavigationTools)
  availableTools: ToolDefinition[];
  registerTool: (tool: ToolDefinition) => void;
  unregisterTool: (toolName: string) => void;
  executeTool: (toolName: string, args: any) => Promise<any>;
  
  // Navigation tools (direct access)
  navigateTo: (path: string, newTab?: boolean) => Promise<any>;
  showProjectDetails: (projectId: string, highlightSections?: string[]) => Promise<any>;
  scrollIntoView: (selector: string, behavior?: ScrollBehavior) => Promise<any>;
  highlightText: (selector: string, text?: string, className?: string) => Promise<any>;
  clearHighlights: (className?: string) => Promise<any>;
  focusElement: (selector: string) => Promise<any>;
  
  // Configuration
  setContextId: (contextId: string) => void;
  setReflinkId: (reflinkId: string) => void;
  setAccessLevel: (level: 'basic' | 'limited' | 'premium') => void;
  contextId?: string;
  reflinkId?: string;
  accessLevel?: 'basic' | 'limited' | 'premium';
  
  // Error handling
  lastError?: string;
  clearErrors: () => void;
  
  // Advanced features
  conversationMetadata: VoiceAgentState['conversationMetadata'];
  navigationHistory: Array<{ action: string; params: any; timestamp: Date }>;
  
  // Utility functions
  canUseVoiceFeatures: () => boolean;
  getProviderCapabilities: (provider?: VoiceProvider) => string[];
  getConnectionQuality: () => 'poor' | 'fair' | 'good' | 'excellent';
  
  // Batch operations
  sendMultipleMessages: (messages: string[]) => Promise<void>;
  executeToolSequence: (tools: Array<{ name: string; args: any }>) => Promise<any[]>;
}

export function useConversationalAgent(): ConversationalAgentHookReturn {
  // Get contexts
  const agentContext = useConversationalAgentContext();
  const navigationTools = useNavigationTools({
    autoRegisterTools: true,
    trackHistory: true,
    onToolExecuted: (toolName, result) => {
      // Tools are automatically registered with the agent context
    }
  });
  const transcriptContext = useTranscript();

  // Derived state
  const isConnected = agentContext.isConnected();
  const isConnecting = agentContext.state.connectionState.status === 'connecting' || 
                      agentContext.state.connectionState.status === 'reconnecting';
  const isRecording = agentContext.isRecording();
  const connectionStatus = agentContext.state.connectionState.status;
  const sessionStatus = agentContext.state.sessionState.status;
  const isMuted = agentContext.state.sessionState.isMuted;
  const volume = agentContext.state.audioState.volume;

  // Enhanced tool management that integrates navigation tools
  const registerTool = useCallback((tool: ToolDefinition) => {
    agentContext.registerTool(tool);
    navigationTools.registerCustomTool(tool);
  }, [agentContext, navigationTools]);

  const unregisterTool = useCallback((toolName: string) => {
    agentContext.unregisterTool(toolName);
    navigationTools.unregisterTool(toolName);
  }, [agentContext, navigationTools]);

  const executeTool = useCallback(async (toolName: string, args: any) => {
    // Try navigation tools first, then agent context tools
    if (navigationTools.isToolAvailable(toolName)) {
      const result = await navigationTools.executeTool(toolName, args);
      return result.result;
    }
    
    // For other tools, we'd need to implement execution through the agent context
    // This would typically involve the adapter's tool execution system
    throw new Error(`Tool '${toolName}' not available for direct execution`);
  }, [navigationTools]);

  // Enhanced transcript management
  const searchTranscript = useCallback((query: string) => {
    transcriptContext.setSearchQuery(query);
  }, [transcriptContext]);

  const filterTranscript = useCallback((filter: any) => {
    transcriptContext.setFilter(filter);
  }, [transcriptContext]);

  const exportTranscript = useCallback(async (format: 'json' | 'csv' | 'txt' = 'json'): Promise<string> => {
    // Use transcript context for enhanced export capabilities
    return transcriptContext.exportTranscript(format);
  }, [transcriptContext]);

  // Utility functions
  const canUseVoiceFeatures = useCallback((): boolean => {
    const accessLevel = agentContext.state.accessLevel;
    return accessLevel === 'limited' || accessLevel === 'premium';
  }, [agentContext.state.accessLevel]);

  const getProviderCapabilities = useCallback((provider?: VoiceProvider): string[] => {
    const targetProvider = provider || agentContext.state.activeProvider;
    if (!targetProvider) return [];
    
    // Return capabilities based on provider metadata
    if (targetProvider === 'openai') {
      return [
        'real-time-stt',
        'real-time-tts',
        'tool-calling',
        'interruption-handling',
        'voice-activity-detection',
        'webrtc-transport'
      ];
    } else if (targetProvider === 'elevenlabs') {
      return [
        'real-time-conversation',
        'agent-management',
        'signed-url-conversations',
        'tool-calling',
        'real-time-audio'
      ];
    }
    
    return [];
  }, [agentContext.state.activeProvider]);

  const getConnectionQuality = useCallback((): 'poor' | 'fair' | 'good' | 'excellent' => {
    const { connectionState, sessionState } = agentContext.state;
    
    if (connectionState.status !== 'connected') {
      return 'poor';
    }
    
    // Simple heuristic based on error count and reconnection attempts
    const errorRate = connectionState.reconnectAttempts / Math.max(1, connectionState.maxReconnectAttempts);
    
    if (errorRate > 0.7) return 'poor';
    if (errorRate > 0.4) return 'fair';
    if (errorRate > 0.1) return 'good';
    return 'excellent';
  }, [agentContext.state]);

  // Batch operations
  const sendMultipleMessages = useCallback(async (messages: string[]): Promise<void> => {
    for (const message of messages) {
      await agentContext.sendMessage(message);
      // Add small delay between messages to avoid overwhelming the provider
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, [agentContext]);

  const executeToolSequence = useCallback(async (tools: Array<{ name: string; args: any }>): Promise<any[]> => {
    const results = [];
    
    for (const tool of tools) {
      try {
        const result = await executeTool(tool.name, tool.args);
        results.push(result);
        // Add small delay between tool executions
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        results.push({ error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    return results;
  }, [executeTool]);

  return {
    // State from ConversationalAgentProvider
    state: agentContext.state,
    
    // Connection state helpers
    isConnected,
    isConnecting,
    isRecording,
    connectionStatus,
    sessionStatus,
    
    // Provider management
    activeProvider: agentContext.state.activeProvider,
    availableProviders: agentContext.state.availableProviders,
    switchProvider: agentContext.switchProvider,
    
    // Connection management
    connect: agentContext.connect,
    disconnect: agentContext.disconnect,
    reconnect: agentContext.reconnect,
    
    // Audio controls
    startVoiceInput: agentContext.startVoiceInput,
    stopVoiceInput: agentContext.stopVoiceInput,
    mute: agentContext.mute,
    unmute: agentContext.unmute,
    isMuted,
    setVolume: agentContext.setVolume,
    volume,
    
    // Communication
    sendMessage: agentContext.sendMessage,
    interrupt: agentContext.interrupt,
    
    // Transcript management (integrated with TranscriptContext)
    transcript: transcriptContext.items,
    filteredTranscript: transcriptContext.filteredItems,
    clearTranscript: () => {
      agentContext.clearTranscript();
      transcriptContext.clearTranscript();
    },
    exportTranscript,
    searchTranscript,
    filterTranscript,
    
    // Tool management (integrated with NavigationTools)
    availableTools: [...agentContext.state.availableTools, ...navigationTools.tools],
    registerTool,
    unregisterTool,
    executeTool,
    
    // Navigation tools (direct access)
    navigateTo: navigationTools.navigateTo,
    showProjectDetails: navigationTools.showProjectDetails,
    scrollIntoView: navigationTools.scrollIntoView,
    highlightText: navigationTools.highlightText,
    clearHighlights: navigationTools.clearHighlights,
    focusElement: navigationTools.focusElement,
    
    // Configuration
    setContextId: agentContext.setContextId,
    setReflinkId: agentContext.setReflinkId,
    setAccessLevel: agentContext.setAccessLevel,
    contextId: agentContext.state.contextId,
    reflinkId: agentContext.state.reflinkId,
    accessLevel: agentContext.state.accessLevel,
    
    // Error handling
    lastError: agentContext.getLastError(),
    clearErrors: agentContext.clearErrors,
    
    // Advanced features
    conversationMetadata: agentContext.state.conversationMetadata,
    navigationHistory: navigationTools.navigationState.navigationHistory,
    
    // Utility functions
    canUseVoiceFeatures,
    getProviderCapabilities,
    getConnectionQuality,
    
    // Batch operations
    sendMultipleMessages,
    executeToolSequence
  };
}