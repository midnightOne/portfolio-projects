/**
 * Unified Conversation Logger
 * 
 * Captures and logs all tool calls, conversation events, and debug information
 * regardless of execution context (client/server) or provider (OpenAI/ElevenLabs).
 * Provides comprehensive monitoring and analytics for the unified tool system.
 */

import { debugEventEmitter, DebugEvent } from './debugEventEmitter';

export interface ConversationLogEntry {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: 'tool_call' | 'transcript_item' | 'connection_event' | 'context_request' | 'system_event';
  provider?: string;
  executionContext?: 'client' | 'server';
  toolCallId?: string;
  correlationId?: string;
  data: any;
  metadata?: {
    executionTime?: number;
    success?: boolean;
    error?: string;
    accessLevel?: string;
    reflinkId?: string;
  };
}

export interface ConversationSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  provider: string;
  entries: ConversationLogEntry[];
  toolCallSummary: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    clientCalls: number;
    serverCalls: number;
    averageExecutionTime: number;
  };
  conversationMetrics: {
    totalTranscriptItems: number;
    totalConnectionEvents: number;
    totalContextRequests: number;
    sessionDuration?: number;
  };
}

class UnifiedConversationLogger {
  private static instance: UnifiedConversationLogger;
  private activeSessions: Map<string, ConversationSession> = new Map();
  private isEnabled = false;
  private maxSessionHistory = 100;

  static getInstance(): UnifiedConversationLogger {
    if (!UnifiedConversationLogger.instance) {
      UnifiedConversationLogger.instance = new UnifiedConversationLogger();
    }
    return UnifiedConversationLogger.instance;
  }

  constructor() {
    this.setupEventListeners();
  }

  enable() {
    this.isEnabled = true;
    console.log('Unified conversation logger enabled');
  }

  disable() {
    this.isEnabled = false;
    console.log('Unified conversation logger disabled');
  }

  private setupEventListeners() {
    // Listen to all debug events and convert them to conversation log entries
    debugEventEmitter.on('tool_call_start', (event) => this.handleToolCallStart(event));
    debugEventEmitter.on('tool_call_complete', (event) => this.handleToolCallComplete(event));
    debugEventEmitter.on('transcript_update', (event) => this.handleTranscriptUpdate(event));
    debugEventEmitter.on('voice_session_start', (event) => this.handleVoiceSessionStart(event));
    debugEventEmitter.on('voice_session_end', (event) => this.handleVoiceSessionEnd(event));
    debugEventEmitter.on('context_request', (event) => this.handleContextRequest(event));
    debugEventEmitter.on('context_loaded', (event) => this.handleContextLoaded(event));
  }

  private handleToolCallStart(event: DebugEvent) {
    if (!this.isEnabled || !event.sessionId) return;

    const session = this.getOrCreateSession(event.sessionId, event.data.provider || 'unknown');
    const entry: ConversationLogEntry = {
      id: `${event.toolCallId || 'unknown'}_start`,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      type: 'tool_call',
      provider: event.data.provider,
      executionContext: event.data.executionContext,
      toolCallId: event.toolCallId,
      correlationId: event.correlationId,
      data: {
        phase: 'start',
        toolName: event.data.toolName,
        parameters: event.data.args,
        executionContext: event.data.executionContext
      }
    };

    session.entries.push(entry);
    this.updateSessionMetrics(session);
  }

  private handleToolCallComplete(event: DebugEvent) {
    if (!this.isEnabled || !event.sessionId) return;

    const session = this.getOrCreateSession(event.sessionId, event.data.provider || 'unknown');
    const entry: ConversationLogEntry = {
      id: `${event.toolCallId || 'unknown'}_complete`,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      type: 'tool_call',
      provider: event.data.provider,
      executionContext: event.data.executionContext,
      toolCallId: event.toolCallId,
      correlationId: event.correlationId,
      data: {
        phase: 'complete',
        toolName: event.data.toolName,
        result: event.data.result,
        executionContext: event.data.executionContext
      },
      metadata: {
        executionTime: event.data.executionTime,
        success: event.data.success,
        error: event.data.error,
        accessLevel: event.data.accessLevel,
        reflinkId: event.data.reflinkId
      }
    };

    session.entries.push(entry);
    this.updateSessionMetrics(session);
  }

  private handleTranscriptUpdate(event: DebugEvent) {
    if (!this.isEnabled || !event.sessionId) return;

    const session = this.getOrCreateSession(event.sessionId, 'voice-agent');
    const entry: ConversationLogEntry = {
      id: `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      type: 'transcript_item',
      correlationId: event.correlationId,
      data: event.data.item
    };

    session.entries.push(entry);
    this.updateSessionMetrics(session);
  }

  private handleVoiceSessionStart(event: DebugEvent) {
    if (!this.isEnabled || !event.sessionId) return;

    const session = this.getOrCreateSession(event.sessionId, event.data.provider);
    const entry: ConversationLogEntry = {
      id: `session_start_${event.sessionId}`,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      type: 'connection_event',
      provider: event.data.provider,
      correlationId: event.correlationId,
      data: {
        eventType: 'session_start',
        provider: event.data.provider
      }
    };

    session.entries.push(entry);
    this.updateSessionMetrics(session);
  }

  private handleVoiceSessionEnd(event: DebugEvent) {
    if (!this.isEnabled || !event.sessionId) return;

    const session = this.activeSessions.get(event.sessionId);
    if (session) {
      session.endTime = event.timestamp;
      session.conversationMetrics.sessionDuration = event.data.duration;

      const entry: ConversationLogEntry = {
        id: `session_end_${event.sessionId}`,
        sessionId: event.sessionId,
        timestamp: event.timestamp,
        type: 'connection_event',
        provider: event.data.provider,
        correlationId: event.correlationId,
        data: {
          eventType: 'session_end',
          provider: event.data.provider,
          duration: event.data.duration
        }
      };

      session.entries.push(entry);
      this.updateSessionMetrics(session);

      // Emit conversation log update for potential server-side storage
      debugEventEmitter.emitConversationLogUpdate(
        this.exportSessionData(session),
        event.sessionId,
        event.correlationId
      );
    }
  }

  private handleContextRequest(event: DebugEvent) {
    if (!this.isEnabled || !event.sessionId) return;

    const session = this.getOrCreateSession(event.sessionId, 'context-system');
    const entry: ConversationLogEntry = {
      id: `context_request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      type: 'context_request',
      correlationId: event.correlationId,
      data: {
        query: event.data.query,
        sources: event.data.sources
      }
    };

    session.entries.push(entry);
    this.updateSessionMetrics(session);
  }

  private handleContextLoaded(event: DebugEvent) {
    if (!this.isEnabled || !event.sessionId) return;

    const session = this.getOrCreateSession(event.sessionId, 'context-system');
    const entry: ConversationLogEntry = {
      id: `context_loaded_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      type: 'system_event',
      correlationId: event.correlationId,
      data: {
        eventType: 'context_loaded',
        tokenCount: event.data.tokenCount,
        processingTime: event.data.processingTime
      }
    };

    session.entries.push(entry);
    this.updateSessionMetrics(session);
  }

  private getOrCreateSession(sessionId: string, provider: string): ConversationSession {
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        startTime: new Date(),
        provider,
        entries: [],
        toolCallSummary: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          clientCalls: 0,
          serverCalls: 0,
          averageExecutionTime: 0
        },
        conversationMetrics: {
          totalTranscriptItems: 0,
          totalConnectionEvents: 0,
          totalContextRequests: 0
        }
      };
      this.activeSessions.set(sessionId, session);

      // Limit session history
      if (this.activeSessions.size > this.maxSessionHistory) {
        const oldestSessionId = this.activeSessions.keys().next().value;
        this.activeSessions.delete(oldestSessionId);
      }
    }
    return session;
  }

  private updateSessionMetrics(session: ConversationSession) {
    // Reset metrics
    session.toolCallSummary = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      clientCalls: 0,
      serverCalls: 0,
      averageExecutionTime: 0
    };
    session.conversationMetrics = {
      totalTranscriptItems: 0,
      totalConnectionEvents: 0,
      totalContextRequests: 0,
      sessionDuration: session.conversationMetrics.sessionDuration
    };

    let totalExecutionTime = 0;
    let executionTimeCount = 0;

    // Recalculate metrics from entries
    session.entries.forEach(entry => {
      switch (entry.type) {
        case 'tool_call':
          if (entry.data.phase === 'complete') {
            session.toolCallSummary.totalCalls++;
            if (entry.metadata?.success) {
              session.toolCallSummary.successfulCalls++;
            } else {
              session.toolCallSummary.failedCalls++;
            }
            if (entry.executionContext === 'client') {
              session.toolCallSummary.clientCalls++;
            } else if (entry.executionContext === 'server') {
              session.toolCallSummary.serverCalls++;
            }
            if (entry.metadata?.executionTime) {
              totalExecutionTime += entry.metadata.executionTime;
              executionTimeCount++;
            }
          }
          break;
        case 'transcript_item':
          session.conversationMetrics.totalTranscriptItems++;
          break;
        case 'connection_event':
          session.conversationMetrics.totalConnectionEvents++;
          break;
        case 'context_request':
          session.conversationMetrics.totalContextRequests++;
          break;
      }
    });

    if (executionTimeCount > 0) {
      session.toolCallSummary.averageExecutionTime = totalExecutionTime / executionTimeCount;
    }
  }

  // Public API methods
  getActiveSession(sessionId: string): ConversationSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getAllActiveSessions(): ConversationSession[] {
    return Array.from(this.activeSessions.values());
  }

  getSessionsByProvider(provider: string): ConversationSession[] {
    return Array.from(this.activeSessions.values()).filter(session => session.provider === provider);
  }

  getToolCallsBySession(sessionId: string): ConversationLogEntry[] {
    const session = this.activeSessions.get(sessionId);
    return session ? session.entries.filter(entry => entry.type === 'tool_call') : [];
  }

  getCorrelatedEvents(correlationId: string): ConversationLogEntry[] {
    const correlatedEvents: ConversationLogEntry[] = [];
    this.activeSessions.forEach(session => {
      session.entries.forEach(entry => {
        if (entry.correlationId === correlationId) {
          correlatedEvents.push(entry);
        }
      });
    });
    return correlatedEvents;
  }

  exportSessionData(session: ConversationSession): any {
    return {
      sessionId: session.sessionId,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString(),
      provider: session.provider,
      toolCallSummary: session.toolCallSummary,
      conversationMetrics: session.conversationMetrics,
      entries: session.entries.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString()
      }))
    };
  }

  clearSession(sessionId: string) {
    this.activeSessions.delete(sessionId);
  }

  clearAllSessions() {
    this.activeSessions.clear();
  }

  getSessionMetrics(): {
    totalActiveSessions: number;
    totalToolCalls: number;
    totalSuccessfulCalls: number;
    totalFailedCalls: number;
    averageSessionDuration: number;
    providerDistribution: Record<string, number>;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const metrics = {
      totalActiveSessions: sessions.length,
      totalToolCalls: 0,
      totalSuccessfulCalls: 0,
      totalFailedCalls: 0,
      averageSessionDuration: 0,
      providerDistribution: {} as Record<string, number>
    };

    let totalDuration = 0;
    let sessionsWithDuration = 0;

    sessions.forEach(session => {
      metrics.totalToolCalls += session.toolCallSummary.totalCalls;
      metrics.totalSuccessfulCalls += session.toolCallSummary.successfulCalls;
      metrics.totalFailedCalls += session.toolCallSummary.failedCalls;

      if (session.conversationMetrics.sessionDuration) {
        totalDuration += session.conversationMetrics.sessionDuration;
        sessionsWithDuration++;
      }

      metrics.providerDistribution[session.provider] = 
        (metrics.providerDistribution[session.provider] || 0) + 1;
    });

    if (sessionsWithDuration > 0) {
      metrics.averageSessionDuration = totalDuration / sessionsWithDuration;
    }

    return metrics;
  }
}

// Global instance
export const unifiedConversationLogger = UnifiedConversationLogger.getInstance();

// Auto-enable in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  unifiedConversationLogger.enable();
}

export type { ConversationLogEntry, ConversationSession };