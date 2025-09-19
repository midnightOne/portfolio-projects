'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ContextUpdate {
  id: string;
  timestamp: Date;
  type: 'injection' | 'filtering' | 'update' | 'request';
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface ContextMonitoringState {
  updates: ContextUpdate[];
  isMonitoring: boolean;
  lastUpdate: ContextUpdate | null;
  updateCount: number;
}

export interface UseContextMonitoringOptions {
  maxUpdates?: number;
  autoStart?: boolean;
  onUpdate?: (update: ContextUpdate) => void;
}

export function useContextMonitoring(
  conversationId: string,
  options: UseContextMonitoringOptions = {}
) {
  const {
    maxUpdates = 100,
    autoStart = false,
    onUpdate
  } = options;

  const [state, setState] = useState<ContextMonitoringState>({
    updates: [],
    isMonitoring: false,
    lastUpdate: null,
    updateCount: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateCallbackRef = useRef(onUpdate);

  // Update callback ref when it changes
  useEffect(() => {
    updateCallbackRef.current = onUpdate;
  }, [onUpdate]);

  // Add a context update
  const addUpdate = useCallback((update: Omit<ContextUpdate, 'id' | 'timestamp'>) => {
    const fullUpdate: ContextUpdate = {
      ...update,
      id: `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    setState(prev => ({
      ...prev,
      updates: [fullUpdate, ...prev.updates.slice(0, maxUpdates - 1)],
      lastUpdate: fullUpdate,
      updateCount: prev.updateCount + 1
    }));

    updateCallbackRef.current?.(fullUpdate);
  }, [maxUpdates]);

  // Monitor context API calls
  const monitorContextAPI = useCallback(async () => {
    if (!conversationId) return;

    try {
      // This would normally intercept actual API calls
      // For now, we'll simulate monitoring by checking for context changes
      const response = await fetch('/api/ai/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: conversationId,
          query: 'monitoring_check',
          sources: [],
          options: { includeSystemPrompt: true },
          useCache: false
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addUpdate({
          type: 'request',
          source: 'context-api',
          data: {
            success: data.success,
            tokenCount: data.data?.tokenCount,
            processingTime: data.data?.processingTime,
            fromCache: data.data?.fromCache
          },
          metadata: {
            conversationId,
            endpoint: '/api/ai/context'
          }
        });
      }
    } catch (error) {
      addUpdate({
        type: 'request',
        source: 'context-api',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        metadata: {
          conversationId,
          endpoint: '/api/ai/context'
        }
      });
    }
  }, [conversationId, addUpdate]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (state.isMonitoring) return;

    setState(prev => ({ ...prev, isMonitoring: true }));

    // Monitor context API calls every 10 seconds
    intervalRef.current = setInterval(monitorContextAPI, 10000);

    addUpdate({
      type: 'update',
      source: 'monitoring-system',
      data: { action: 'started', conversationId }
    });
  }, [state.isMonitoring, monitorContextAPI, conversationId, addUpdate]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!state.isMonitoring) return;

    setState(prev => ({ ...prev, isMonitoring: false }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    addUpdate({
      type: 'update',
      source: 'monitoring-system',
      data: { action: 'stopped', conversationId }
    });
  }, [state.isMonitoring, conversationId, addUpdate]);

  // Clear updates
  const clearUpdates = useCallback(() => {
    setState(prev => ({
      ...prev,
      updates: [],
      lastUpdate: null,
      updateCount: 0
    }));
  }, []);

  // Export updates
  const exportUpdates = useCallback(() => {
    const exportData = {
      conversationId,
      updates: state.updates,
      monitoring: {
        isMonitoring: state.isMonitoring,
        updateCount: state.updateCount,
        lastUpdate: state.lastUpdate
      },
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }, [conversationId, state]);

  // Simulate context injection monitoring
  const simulateContextInjection = useCallback((systemPrompt: string, context: string) => {
    addUpdate({
      type: 'injection',
      source: 'context-provider',
      data: {
        systemPromptLength: systemPrompt.length,
        contextLength: context.length,
        totalTokens: Math.ceil((systemPrompt.length + context.length) / 4)
      },
      metadata: {
        conversationId,
        injectionType: 'system-prompt-with-context'
      }
    });
  }, [conversationId, addUpdate]);

  // Simulate context filtering
  const simulateContextFiltering = useCallback((
    totalSources: number,
    includedSources: number,
    accessLevel: string,
    filteringReasons: string[]
  ) => {
    addUpdate({
      type: 'filtering',
      source: 'access-control',
      data: {
        totalSources,
        includedSources,
        excludedSources: totalSources - includedSources,
        accessLevel,
        filteringReasons
      },
      metadata: {
        conversationId,
        filteringType: 'access-level-based'
      }
    });
  }, [conversationId, addUpdate]);

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
    clearUpdates,
    exportUpdates,
    addUpdate,
    simulateContextInjection,
    simulateContextFiltering
  };
}