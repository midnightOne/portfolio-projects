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
  | 'transcript_update';

interface DebugEvent {
  type: DebugEventType;
  data: any;
  timestamp: Date;
  source: string;
}

type DebugEventListener = (event: DebugEvent) => void;

class DebugEventEmitter {
  private listeners: Map<DebugEventType, DebugEventListener[]> = new Map();
  private isEnabled = false;

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

  emit(eventType: DebugEventType, data: any, source: string = 'unknown') {
    if (!this.isEnabled) return;

    const event: DebugEvent = {
      type: eventType,
      data,
      timestamp: new Date(),
      source
    };

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

  // Convenience methods for common events
  emitContextRequest(query: string, sources: string[], sessionId: string) {
    this.emit('context_request', { query, sources, sessionId }, 'context-monitor');
  }

  emitContextLoaded(context: string, tokenCount: number, processingTime: number) {
    this.emit('context_loaded', { context, tokenCount, processingTime }, 'context-api');
  }

  emitToolCallStart(toolName: string, parameters: any, sessionId: string, toolCallId?: string) {
    this.emit('tool_call_start', { toolName, parameters, sessionId, toolCallId }, 'tool-monitor');
  }

  emitToolCallComplete(toolName: string, result: any, executionTime: number, success: boolean, sessionId?: string, toolCallId?: string) {
    this.emit('tool_call_complete', { toolName, result, executionTime, success, sessionId, toolCallId }, 'tool-monitor');
  }

  emitVoiceSessionStart(provider: string, sessionId: string) {
    this.emit('voice_session_start', { provider, sessionId }, 'voice-agent');
  }

  emitVoiceSessionEnd(provider: string, sessionId: string, duration: number) {
    this.emit('voice_session_end', { provider, sessionId, duration }, 'voice-agent');
  }

  emitTranscriptUpdate(item: any) {
    this.emit('transcript_update', { item }, 'voice-agent');
  }
}

// Global instance
export const debugEventEmitter = new DebugEventEmitter();

// Auto-enable in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  debugEventEmitter.enable();
}

export type { DebugEvent, DebugEventType, DebugEventListener };