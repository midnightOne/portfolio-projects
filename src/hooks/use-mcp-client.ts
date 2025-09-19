/**
 * Use MCP Client Hook
 * 
 * React hook for interacting with the MCP (Model Context Protocol) client
 * to execute navigation tools and manage AI-driven UI interactions.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { mcpClient } from '@/lib/mcp/client';
import type {
  MCPToolCall,
  MCPToolResult,
  MCPToolExecution,
  NavigationState,
  MCPError
} from '@/lib/mcp/types';

interface UseMCPClientOptions {
  autoInitialize?: boolean;
  onError?: (error: Error, toolCall: MCPToolCall) => void;
  onToolExecuted?: (execution: MCPToolExecution) => void;
}

interface UseMCPClientReturn {
  // Tool execution
  executeTool: (toolCall: MCPToolCall) => Promise<MCPToolResult>;
  
  // Navigation tools (convenience methods)
  openProjectModal: (projectId: string, highlightSections?: string[]) => Promise<MCPToolResult>;
  navigateToProject: (projectSlug: string) => Promise<MCPToolResult>;
  scrollToSection: (sectionId: string, options?: { behavior?: 'smooth' | 'instant'; block?: 'start' | 'center' | 'end' | 'nearest' }) => Promise<MCPToolResult>;
  highlightText: (selector: string, options?: { type?: 'spotlight' | 'outline' | 'color' | 'glow'; duration?: 'persistent' | 'timed'; timing?: number; intensity?: 'subtle' | 'medium' | 'strong' }) => Promise<MCPToolResult>;
  clearHighlights: (selector?: string) => Promise<MCPToolResult>;
  focusElement: (selector: string) => Promise<MCPToolResult>;
  animateElement: (selector: string, animation: { type: string; duration?: number; easing?: string; delay?: number }) => Promise<MCPToolResult>;
  
  // Server tools (convenience methods)
  loadProjectContext: (projectId: string, options?: { includeContent?: boolean; includeMedia?: boolean }) => Promise<MCPToolResult>;
  loadUserProfile: (options?: { includePrivate?: boolean }) => Promise<MCPToolResult>;
  processJobSpec: (jobSpec: string, analysisType?: 'quick' | 'detailed') => Promise<MCPToolResult>;
  searchProjects: (query: string, options?: { tags?: string[]; limit?: number }) => Promise<MCPToolResult>;
  
  // State management
  navigationState: NavigationState | null;
  executionHistory: MCPToolExecution[];
  availableTools: { navigation: string[]; server: string[] };
  
  // Status
  isInitialized: boolean;
  isExecuting: boolean;
  lastError: Error | null;
  
  // Utility methods
  clearHistory: () => void;
  refreshState: () => void;
}

export function useMCPClient(options: UseMCPClientOptions = {}): UseMCPClientReturn {
  const {
    autoInitialize = true,
    onError,
    onToolExecuted
  } = options;

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [executionHistory, setExecutionHistory] = useState<MCPToolExecution[]>([]);
  const [availableTools, setAvailableTools] = useState<{ navigation: string[]; server: string[] }>({
    navigation: [],
    server: []
  });

  // Refs
  const initializationPromise = useRef<Promise<void> | null>(null);

  // Initialize MCP client
  const initialize = useCallback(async () => {
    if (isInitialized || initializationPromise.current) {
      return initializationPromise.current;
    }

    initializationPromise.current = (async () => {
      try {
        await mcpClient.initialize();
        
        // Set up error handler
        if (onError) {
          mcpClient.onError = onError;
        }
        
        // Update state
        setIsInitialized(true);
        setAvailableTools(mcpClient.getAvailableTools());
        setNavigationState(mcpClient.getNavigationState());
        setExecutionHistory(mcpClient.getExecutionHistory());
        
        console.log('MCP Client initialized via hook');
      } catch (error) {
        console.error('Failed to initialize MCP Client:', error);
        setLastError(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    })();

    return initializationPromise.current;
  }, [isInitialized, onError]);

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize) {
      initialize().catch(console.error);
    }
  }, [autoInitialize, initialize]);

  // Execute tool with error handling and state updates
  const executeTool = useCallback(async (toolCall: MCPToolCall): Promise<MCPToolResult> => {
    if (!isInitialized) {
      await initialize();
    }

    setIsExecuting(true);
    setLastError(null);

    try {
      const result = await mcpClient.executeTool(toolCall);
      
      // Update state after execution
      setNavigationState(mcpClient.getNavigationState());
      setExecutionHistory(mcpClient.getExecutionHistory());
      
      // Call execution callback
      if (onToolExecuted) {
        const executions = mcpClient.getExecutionHistory();
        const lastExecution = executions[executions.length - 1];
        if (lastExecution) {
          onToolExecuted(lastExecution);
        }
      }
      
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setLastError(err);
      throw err;
    } finally {
      setIsExecuting(false);
    }
  }, [isInitialized, initialize, onToolExecuted]);

  // Navigation tool convenience methods
  const openProjectModal = useCallback(async (projectId: string, highlightSections?: string[]): Promise<MCPToolResult> => {
    return executeTool({
      name: 'openProjectModal',
      arguments: { projectId, highlightSections }
    });
  }, [executeTool]);

  const navigateToProject = useCallback(async (projectSlug: string): Promise<MCPToolResult> => {
    return executeTool({
      name: 'navigateToProject',
      arguments: { projectSlug }
    });
  }, [executeTool]);

  const scrollToSection = useCallback(async (
    sectionId: string, 
    options?: { behavior?: 'smooth' | 'instant'; block?: 'start' | 'center' | 'end' | 'nearest' }
  ): Promise<MCPToolResult> => {
    return executeTool({
      name: 'scrollToSection',
      arguments: { sectionId, ...options }
    });
  }, [executeTool]);

  const highlightText = useCallback(async (
    selector: string,
    options?: {
      type?: 'spotlight' | 'outline' | 'color' | 'glow';
      duration?: 'persistent' | 'timed';
      timing?: number;
      intensity?: 'subtle' | 'medium' | 'strong';
    }
  ): Promise<MCPToolResult> => {
    return executeTool({
      name: 'highlightText',
      arguments: { selector, ...options }
    });
  }, [executeTool]);

  const clearHighlights = useCallback(async (selector?: string): Promise<MCPToolResult> => {
    return executeTool({
      name: 'clearHighlights',
      arguments: { selector }
    });
  }, [executeTool]);

  const focusElement = useCallback(async (selector: string): Promise<MCPToolResult> => {
    return executeTool({
      name: 'focusElement',
      arguments: { selector }
    });
  }, [executeTool]);

  const animateElement = useCallback(async (
    selector: string,
    animation: { type: string; duration?: number; easing?: string; delay?: number }
  ): Promise<MCPToolResult> => {
    return executeTool({
      name: 'animateElement',
      arguments: { selector, animation }
    });
  }, [executeTool]);

  // Server tool convenience methods
  const loadProjectContext = useCallback(async (
    projectId: string,
    options?: { includeContent?: boolean; includeMedia?: boolean }
  ): Promise<MCPToolResult> => {
    return executeTool({
      name: 'loadProjectContext',
      arguments: { projectId, ...options }
    });
  }, [executeTool]);

  const loadUserProfile = useCallback(async (
    options?: { includePrivate?: boolean }
  ): Promise<MCPToolResult> => {
    return executeTool({
      name: 'loadUserProfile',
      arguments: options || {}
    });
  }, [executeTool]);

  const processJobSpec = useCallback(async (
    jobSpec: string,
    analysisType?: 'quick' | 'detailed'
  ): Promise<MCPToolResult> => {
    return executeTool({
      name: 'processJobSpec',
      arguments: { jobSpec, analysisType }
    });
  }, [executeTool]);

  const searchProjects = useCallback(async (
    query: string,
    options?: { tags?: string[]; limit?: number }
  ): Promise<MCPToolResult> => {
    return executeTool({
      name: 'searchProjects',
      arguments: { query, ...options }
    });
  }, [executeTool]);

  // Utility methods
  const clearHistory = useCallback(() => {
    mcpClient.clearHistory();
    setExecutionHistory([]);
  }, []);

  const refreshState = useCallback(() => {
    if (isInitialized) {
      setNavigationState(mcpClient.getNavigationState());
      setExecutionHistory(mcpClient.getExecutionHistory());
      setAvailableTools(mcpClient.getAvailableTools());
    }
  }, [isInitialized]);

  return {
    // Tool execution
    executeTool,
    
    // Navigation tools
    openProjectModal,
    navigateToProject,
    scrollToSection,
    highlightText,
    clearHighlights,
    focusElement,
    animateElement,
    
    // Server tools
    loadProjectContext,
    loadUserProfile,
    processJobSpec,
    searchProjects,
    
    // State
    navigationState,
    executionHistory,
    availableTools,
    
    // Status
    isInitialized,
    isExecuting,
    lastError,
    
    // Utility methods
    clearHistory,
    refreshState
  };
}