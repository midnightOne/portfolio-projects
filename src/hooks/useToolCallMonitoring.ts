'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ToolCallEvent {
  id: string;
  toolName: string;
  category: 'navigation' | 'context' | 'server' | 'system';
  parameters: Record<string, any>;
  executionTime: number;
  result: any;
  success: boolean;
  error?: string;
  timestamp: Date;
  provider?: 'openai' | 'elevenlabs';
  metadata?: Record<string, any>;
}

export interface ToolCallStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  callsByCategory: Record<string, number>;
  callsByTool: Record<string, number>;
}

export interface ToolCallMonitoringState {
  toolCalls: ToolCallEvent[];
  stats: ToolCallStats;
  isMonitoring: boolean;
  lastToolCall: ToolCallEvent | null;
}

export interface UseToolCallMonitoringOptions {
  maxToolCalls?: number;
  autoStart?: boolean;
  onToolCall?: (toolCall: ToolCallEvent) => void;
}

export function useToolCallMonitoring(
  conversationId: string,
  options: UseToolCallMonitoringOptions = {}
) {
  const {
    maxToolCalls = 100,
    autoStart = false,
    onToolCall
  } = options;

  const [state, setState] = useState<ToolCallMonitoringState>({
    toolCalls: [],
    stats: {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageExecutionTime: 0,
      callsByCategory: {},
      callsByTool: {}
    },
    isMonitoring: false,
    lastToolCall: null
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const toolCallCallbackRef = useRef(onToolCall);

  // Update callback ref when it changes
  useEffect(() => {
    toolCallCallbackRef.current = onToolCall;
  }, [onToolCall]);

  // Calculate stats from tool calls
  const calculateStats = useCallback((toolCalls: ToolCallEvent[]): ToolCallStats => {
    const totalCalls = toolCalls.length;
    const successfulCalls = toolCalls.filter(call => call.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const averageExecutionTime = totalCalls > 0 
      ? toolCalls.reduce((sum, call) => sum + call.executionTime, 0) / totalCalls 
      : 0;

    const callsByCategory: Record<string, number> = {};
    const callsByTool: Record<string, number> = {};

    toolCalls.forEach(call => {
      callsByCategory[call.category] = (callsByCategory[call.category] || 0) + 1;
      callsByTool[call.toolName] = (callsByTool[call.toolName] || 0) + 1;
    });

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageExecutionTime,
      callsByCategory,
      callsByTool
    };
  }, []);

  // Add a tool call event
  const addToolCall = useCallback((toolCall: Omit<ToolCallEvent, 'id' | 'timestamp'>) => {
    const fullToolCall: ToolCallEvent = {
      ...toolCall,
      id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    setState(prev => {
      const updatedToolCalls = [fullToolCall, ...prev.toolCalls.slice(0, maxToolCalls - 1)];
      const updatedStats = calculateStats(updatedToolCalls);

      return {
        ...prev,
        toolCalls: updatedToolCalls,
        stats: updatedStats,
        lastToolCall: fullToolCall
      };
    });

    toolCallCallbackRef.current?.(fullToolCall);
  }, [maxToolCalls, calculateStats]);

  // Monitor for tool calls (this would normally hook into actual tool execution)
  const monitorToolCalls = useCallback(() => {
    if (!conversationId) return;

    // In a real implementation, this would hook into:
    // 1. MCP tool execution events
    // 2. Voice agent tool calls
    // 3. Server API calls
    // 4. Navigation tool executions

    // For demonstration, we'll simulate some tool calls
    const mockToolCalls = [
      {
        toolName: 'openProjectModal',
        category: 'navigation' as const,
        parameters: { projectId: 'proj-123', highlightSections: ['overview'] },
        executionTime: Math.floor(Math.random() * 200) + 50,
        success: Math.random() > 0.2,
        result: { modalOpened: true, projectTitle: 'Sample Project' }
      },
      {
        toolName: 'loadContext',
        category: 'context' as const,
        parameters: { query: 'project details', sources: ['projects', 'profile'] },
        executionTime: Math.floor(Math.random() * 500) + 100,
        success: Math.random() > 0.1,
        result: { contextLoaded: true, tokenCount: Math.floor(Math.random() * 2000) + 500 }
      },
      {
        toolName: 'scrollToSection',
        category: 'navigation' as const,
        parameters: { sectionId: 'technical-details' },
        executionTime: Math.floor(Math.random() * 100) + 30,
        success: Math.random() > 0.3,
        result: { scrolled: true, sectionFound: true }
      },
      {
        toolName: 'highlightText',
        category: 'navigation' as const,
        parameters: { selector: '.project-description', text: 'React' },
        executionTime: Math.floor(Math.random() * 80) + 20,
        success: Math.random() > 0.15,
        result: { highlighted: true, matchCount: Math.floor(Math.random() * 5) + 1 }
      },
      {
        toolName: 'serverContextRequest',
        category: 'server' as const,
        parameters: { endpoint: '/api/ai/context', query: 'user question' },
        executionTime: Math.floor(Math.random() * 800) + 200,
        success: Math.random() > 0.05,
        result: { responseReceived: true, contextSize: Math.floor(Math.random() * 3000) + 1000 }
      }
    ];

    // Randomly trigger a tool call (30% chance)
    if (Math.random() > 0.7) {
      const mockCall = mockToolCalls[Math.floor(Math.random() * mockToolCalls.length)];
      const toolCall = {
        ...mockCall,
        error: !mockCall.success ? 'Simulated tool execution error' : undefined,
        provider: (Math.random() > 0.5 ? 'openai' : 'elevenlabs') as 'openai' | 'elevenlabs',
        metadata: {
          conversationId,
          sessionActive: true,
          simulated: true
        }
      };

      addToolCall(toolCall);
    }
  }, [conversationId, addToolCall]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (state.isMonitoring) return;

    setState(prev => ({ ...prev, isMonitoring: true }));

    // Monitor for tool calls every 2 seconds
    intervalRef.current = setInterval(monitorToolCalls, 2000);

    addToolCall({
      toolName: 'startMonitoring',
      category: 'system',
      parameters: { conversationId },
      executionTime: 0,
      success: true,
      result: { monitoringStarted: true },
      metadata: { action: 'monitoring-started' }
    });
  }, [state.isMonitoring, monitorToolCalls, conversationId, addToolCall]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!state.isMonitoring) return;

    setState(prev => ({ ...prev, isMonitoring: false }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    addToolCall({
      toolName: 'stopMonitoring',
      category: 'system',
      parameters: { conversationId },
      executionTime: 0,
      success: true,
      result: { monitoringStopped: true },
      metadata: { action: 'monitoring-stopped' }
    });
  }, [state.isMonitoring, conversationId, addToolCall]);

  // Clear tool calls
  const clearToolCalls = useCallback(() => {
    setState(prev => ({
      ...prev,
      toolCalls: [],
      stats: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageExecutionTime: 0,
        callsByCategory: {},
        callsByTool: {}
      },
      lastToolCall: null
    }));
  }, []);

  // Export tool calls
  const exportToolCalls = useCallback(() => {
    const exportData = {
      conversationId,
      toolCalls: state.toolCalls,
      stats: state.stats,
      monitoring: {
        isMonitoring: state.isMonitoring,
        lastToolCall: state.lastToolCall
      },
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }, [conversationId, state]);

  // Simulate specific tool calls for testing
  const simulateNavigationTool = useCallback((toolName: string, parameters: Record<string, any>) => {
    const startTime = Date.now();
    
    // Simulate execution delay
    setTimeout(() => {
      const executionTime = Date.now() - startTime;
      const success = Math.random() > 0.1; // 90% success rate
      
      addToolCall({
        toolName,
        category: 'navigation',
        parameters,
        executionTime,
        success,
        result: success ? { executed: true, ...parameters } : undefined,
        error: success ? undefined : 'Navigation tool execution failed',
        metadata: {
          conversationId,
          simulated: true,
          toolType: 'navigation'
        }
      });
    }, Math.random() * 200 + 50); // 50-250ms delay
  }, [conversationId, addToolCall]);

  const simulateContextTool = useCallback((query: string, sources: string[]) => {
    const startTime = Date.now();
    
    setTimeout(() => {
      const executionTime = Date.now() - startTime;
      const success = Math.random() > 0.05; // 95% success rate
      
      addToolCall({
        toolName: 'loadContext',
        category: 'context',
        parameters: { query, sources },
        executionTime,
        success,
        result: success ? {
          contextLoaded: true,
          tokenCount: Math.floor(Math.random() * 2000) + 500,
          sources: sources.length
        } : undefined,
        error: success ? undefined : 'Context loading failed',
        metadata: {
          conversationId,
          simulated: true,
          toolType: 'context'
        }
      });
    }, Math.random() * 500 + 100); // 100-600ms delay
  }, [conversationId, addToolCall]);

  // Auto-start monitoring if enabled
  useEffect(() => {
    if (autoStart && conversationId && !state.isMonitoring) {
      startMonitoring();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoStart, conversationId, state.isMonitoring, startMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    clearToolCalls,
    exportToolCalls,
    addToolCall,
    simulateNavigationTool,
    simulateContextTool
  };
}