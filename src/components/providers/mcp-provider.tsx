/**
 * MCP Provider
 * 
 * React context provider for the MCP (Model Context Protocol) system.
 * Makes MCP client functionality available throughout the application.
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { mcpClient } from '@/lib/mcp/client';
import type {
  MCPToolCall,
  MCPToolResult,
  MCPToolExecution,
  NavigationState,
  MCPError
} from '@/lib/mcp/types';

interface MCPContextValue {
  // Client instance
  client: typeof mcpClient;
  
  // Status
  isInitialized: boolean;
  isExecuting: boolean;
  lastError: Error | null;
  
  // State
  navigationState: NavigationState | null;
  executionHistory: MCPToolExecution[];
  availableTools: { navigation: string[]; server: string[] };
  
  // Methods
  executeTool: (toolCall: MCPToolCall) => Promise<MCPToolResult>;
  clearHistory: () => void;
  refreshState: () => void;
  
  // Event handlers
  onToolExecuted?: (execution: MCPToolExecution) => void;
  onError?: (error: Error, toolCall: MCPToolCall) => void;
}

const MCPContext = createContext<MCPContextValue | null>(null);

interface MCPProviderProps {
  children: React.ReactNode;
  onToolExecuted?: (execution: MCPToolExecution) => void;
  onError?: (error: Error, toolCall: MCPToolCall) => void;
  autoInitialize?: boolean;
}

export function MCPProvider({ 
  children, 
  onToolExecuted, 
  onError,
  autoInitialize = true 
}: MCPProviderProps) {
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

  // Initialize MCP client
  useEffect(() => {
    if (!autoInitialize) return;

    const initialize = async () => {
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
        
        console.log('MCP Client initialized via provider');
      } catch (error) {
        console.error('Failed to initialize MCP Client:', error);
        setLastError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    initialize();
  }, [autoInitialize, onError]);

  // Execute tool with state management
  const executeTool = async (toolCall: MCPToolCall): Promise<MCPToolResult> => {
    if (!isInitialized) {
      throw new Error('MCP Client not initialized');
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
  };

  // Clear execution history
  const clearHistory = () => {
    mcpClient.clearHistory();
    setExecutionHistory([]);
  };

  // Refresh state from client
  const refreshState = () => {
    if (isInitialized) {
      setNavigationState(mcpClient.getNavigationState());
      setExecutionHistory(mcpClient.getExecutionHistory());
      setAvailableTools(mcpClient.getAvailableTools());
    }
  };

  // Context value
  const contextValue: MCPContextValue = {
    client: mcpClient,
    isInitialized,
    isExecuting,
    lastError,
    navigationState,
    executionHistory,
    availableTools,
    executeTool,
    clearHistory,
    refreshState,
    onToolExecuted,
    onError
  };

  return (
    <MCPContext.Provider value={contextValue}>
      {children}
    </MCPContext.Provider>
  );
}

// Hook to use MCP context
export function useMCP(): MCPContextValue {
  const context = useContext(MCPContext);
  
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  
  return context;
}

// Hook to check if MCP is available
export function useMCPAvailable(): boolean {
  const context = useContext(MCPContext);
  return context !== null && context.isInitialized;
}

export type { MCPContextValue };