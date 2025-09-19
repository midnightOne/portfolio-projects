/**
 * Debug Event Emitter for Voice AI Monitoring
 * 
 * This provides a simple event system for coordinating debug information
 * between the voice agent and monitoring components.
 */

type DebugEventType = 
  | 'context_request'
  | 'context_loaded' 
  | 'tool_call_start'
  | 'tool_call_complete'
  | 'voice_session_start'
  | 'voice_session_end'
  | 'transcript_update'
  | 'tool_execution_metrics'
  | 'conversation_log_update'
  | 'unified_tool_registry_update'
  | 'connection_event'
  | 'transcript_event'
  | 'audio_event'
  | 'tool_event';

interface DebugEvent {
  type: DebugEventType;
  data: any;
  timestamp: Date;
  source: string;
  correlationId?: string; // For correlating events across client-server boundary
  sessionId?: string;
  toolCallId?: string;
}

type DebugEventListener = (event: DebugEvent) => void;

class DebugEventEmitter {
  private listeners: Map<DebugEventType, DebugEventListener[]> = new Map();
  private isEnabled = false;
  private eventHistory: DebugEvent[] = [];
  private maxHistorySize = 1000;
  private toolExecutionMetrics: Map<string, {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    lastExecuted: Date;
    errorPatterns: Map<string, number>;
  }> = new Map();

  enable() {
    this.isEnabled = true;
    console.log('Debug event emitter enabled');
  }

  disable() {
    this.isEnabled = false;
    console.log('Debug event emitter disabled');
  }

  on(eventType: DebugEventType, listener: DebugEventListener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  off(eventType: DebugEventType, listener: DebugEventListener) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(eventType: DebugEventType, data: any, source: string = 'unknown', correlationId?: string, sessionId?: string, toolCallId?: string) {
    if (!this.isEnabled) return;

    const event: DebugEvent = {
      type: eventType,
      data,
      timestamp: new Date(),
      source,
      correlationId,
      sessionId,
      toolCallId
    };

    // Add to event history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Update tool execution metrics if this is a tool-related event
    if (eventType === 'tool_call_complete' && data.toolName) {
      this.updateToolMetrics(data.toolName, data.executionTime, data.success, data.error);
    }

    console.log(`Debug Event [${eventType}]:`, event);

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in debug event listener:', error);
        }
      });
    }
  }

  private updateToolMetrics(toolName: string, executionTime: number, success: boolean, error?: string) {
    let metrics = this.toolExecutionMetrics.get(toolName);
    if (!metrics) {
      metrics = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        lastExecuted: new Date(),
        errorPatterns: new Map()
      };
      this.toolExecutionMetrics.set(toolName, metrics);
    }

    metrics.totalCalls++;
    metrics.totalExecutionTime += executionTime;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalCalls;
    metrics.lastExecuted = new Date();

    if (success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
      if (error) {
        const errorCount = metrics.errorPatterns.get(error) || 0;
        metrics.errorPatterns.set(error, errorCount + 1);
      }
    }

    // Emit metrics update event
    this.emit('tool_execution_metrics', {
      toolName,
      metrics: { ...metrics, errorPatterns: Object.fromEntries(metrics.errorPatterns) }
    }, 'debug-event-emitter');
  }

  getEventHistory(): DebugEvent[] {
    return [...this.eventHistory];
  }

  getToolExecutionMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    this.toolExecutionMetrics.forEach((metrics, toolName) => {
      result[toolName] = {
        ...metrics,
        errorPatterns: Object.fromEntries(metrics.errorPatterns)
      };
    });
    return result;
  }

  clearHistory() {
    this.eventHistory = [];
    this.toolExecutionMetrics.clear();
  }

  getEventsBySession(sessionId: string): DebugEvent[] {
    return this.eventHistory.filter(event => event.sessionId === sessionId);
  }

  getEventsByToolCallId(toolCallId: string): DebugEvent[] {
    return this.eventHistory.filter(event => event.toolCallId === toolCallId);
  }

  getEventsByCorrelationId(correlationId: string): DebugEvent[] {
    return this.eventHistory.filter(event => event.correlationId === correlationId);
  }

  // Convenience methods for common events
  emitContextRequest(query: string, sources: string[], sessionId: string, correlationId?: string) {
    this.emit('context_request', { query, sources, sessionId }, 'context-monitor', correlationId, sessionId);
  }

  emitContextLoaded(context: string, tokenCount: number, processingTime: number, sessionId?: string, correlationId?: string) {
    this.emit('context_loaded', { context, tokenCount, processingTime }, 'context-api', correlationId, sessionId);
  }

  emitToolCallStart(toolName: string, parameters: any, sessionId: string, toolCallId?: string, executionContext?: 'client' | 'server', provider?: string, correlationId?: string) {
    this.emit('tool_call_start', { 
      toolName, 
      parameters, 
      sessionId, 
      toolCallId, 
      executionContext, 
      provider,
      timestamp: new Date()
    }, 'tool-monitor', correlationId, sessionId, toolCallId);
  }

  emitToolCallComplete(toolName: string, result: any, executionTime: number, success: boolean, sessionId?: string, toolCallId?: string, executionContext?: 'client' | 'server', provider?: string, error?: string, correlationId?: string) {
    this.emit('tool_call_complete', { 
      toolName, 
      result, 
      executionTime, 
      success, 
      sessionId, 
      toolCallId, 
      executionContext, 
      provider, 
      error,
      timestamp: new Date()
    }, 'tool-monitor', correlationId, sessionId, toolCallId);
  }

  emitVoiceSessionStart(provider: string, sessionId: string, correlationId?: string) {
    this.emit('voice_session_start', { provider, sessionId }, 'voice-agent', correlationId, sessionId);
  }

  emitVoiceSessionEnd(provider: string, sessionId: string, duration: number, correlationId?: string) {
    this.emit('voice_session_end', { provider, sessionId, duration }, 'voice-agent', correlationId, sessionId);
  }

  emitTranscriptUpdate(item: any, sessionId?: string, correlationId?: string) {
    this.emit('transcript_update', { item }, 'voice-agent', correlationId, sessionId);
  }

  emitConversationLogUpdate(conversationData: any, sessionId: string, correlationId?: string) {
    this.emit('conversation_log_update', conversationData, 'conversation-logger', correlationId, sessionId);
  }

  emitUnifiedToolRegistryUpdate(action: string, toolName: string, details?: any) {
    this.emit('unified_tool_registry_update', { action, toolName, details }, 'unified-tool-registry');
  }
}

// Global instance
export const debugEventEmitter = new DebugEventEmitter();

// Auto-enable in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  debugEventEmitter.enable();
}

export type { DebugEvent, DebugEventType, DebugEventListener };