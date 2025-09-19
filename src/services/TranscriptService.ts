/**
 * Transcript Service
 * 
 * Service for collecting, storing, and managing real conversation transcripts
 * from OpenAI Realtime and ElevenLabs voice AI interactions.
 */

import { TranscriptItem } from '@/types/voice-agent';

export interface ConversationSession {
  id: string;
  provider: 'openai' | 'elevenlabs';
  startTime: Date;
  endTime?: Date;
  participantCount: number;
  totalMessages: number;
  totalDuration?: number;
  metadata: {
    userAgent?: string;
    contextId?: string;
    reflinkId?: string;
    accessLevel?: string;
    [key: string]: any;
  };
}

export interface ConversationTranscript {
  sessionId: string;
  items: TranscriptItem[];
  session: ConversationSession;
  analytics: {
    averageResponseTime: number;
    userMessageCount: number;
    aiMessageCount: number;
    toolCallCount: number;
    interruptionCount: number;
    averageConfidence: number;
    totalAudioDuration: number;
  };
}

export interface TranscriptFilter {
  provider?: 'openai' | 'elevenlabs';
  dateFrom?: Date;
  dateTo?: Date;
  sessionId?: string;
  contextId?: string;
  reflinkId?: string;
  minDuration?: number;
  maxDuration?: number;
  hasErrors?: boolean;
  hasToolCalls?: boolean;
}

export interface TranscriptExportOptions {
  format: 'json' | 'csv' | 'txt';
  includeMetadata: boolean;
  includeAnalytics: boolean;
  timeFormat: 'iso' | 'local' | 'relative';
}

class TranscriptService {
  private baseUrl = '/api/ai/conversation';

  /**
   * Store a conversation transcript on the server
   */
  async storeTranscript(
    sessionId: string,
    items: TranscriptItem[],
    metadata: Partial<ConversationSession['metadata']> = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          items,
          metadata: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            ...metadata
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: true };
    } catch (error) {
      console.error('Failed to store transcript:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Retrieve conversation transcripts with filtering
   */
  async getTranscripts(filter: TranscriptFilter = {}): Promise<{
    success: boolean;
    data?: ConversationTranscript[];
    error?: string;
    pagination?: {
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };
  }> {
    try {
      const params = new URLSearchParams();
      
      if (filter.provider) params.append('provider', filter.provider);
      if (filter.dateFrom) params.append('dateFrom', filter.dateFrom.toISOString());
      if (filter.dateTo) params.append('dateTo', filter.dateTo.toISOString());
      if (filter.sessionId) params.append('sessionId', filter.sessionId);
      if (filter.contextId) params.append('contextId', filter.contextId);
      if (filter.reflinkId) params.append('reflinkId', filter.reflinkId);
      if (filter.minDuration) params.append('minDuration', filter.minDuration.toString());
      if (filter.maxDuration) params.append('maxDuration', filter.maxDuration.toString());
      if (filter.hasErrors !== undefined) params.append('hasErrors', filter.hasErrors.toString());
      if (filter.hasToolCalls !== undefined) params.append('hasToolCalls', filter.hasToolCalls.toString());

      const response = await fetch(`${this.baseUrl}/transcripts?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data,
        pagination: result.pagination
      };
    } catch (error) {
      console.error('Failed to get transcripts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get a specific conversation transcript
   */
  async getTranscript(sessionId: string): Promise<{
    success: boolean;
    data?: ConversationTranscript;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/transcript/${encodeURIComponent(sessionId)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'Transcript not found'
          };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Failed to get transcript:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a conversation transcript
   */
  async deleteTranscript(sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/transcript/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to delete transcript:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Export conversation transcripts
   */
  async exportTranscripts(
    filter: TranscriptFilter = {},
    options: TranscriptExportOptions = {
      format: 'json',
      includeMetadata: true,
      includeAnalytics: true,
      timeFormat: 'iso'
    }
  ): Promise<{
    success: boolean;
    data?: string;
    filename?: string;
    error?: string;
  }> {
    try {
      const transcriptsResult = await this.getTranscripts(filter);
      
      if (!transcriptsResult.success || !transcriptsResult.data) {
        throw new Error(transcriptsResult.error || 'Failed to get transcripts');
      }

      const transcripts = transcriptsResult.data;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      let exportData: string;
      let filename: string;

      switch (options.format) {
        case 'json':
          exportData = JSON.stringify({
            exportedAt: new Date().toISOString(),
            filter,
            options,
            transcripts: transcripts.map(t => this.formatTranscriptForExport(t, options))
          }, null, 2);
          filename = `voice-transcripts-${timestamp}.json`;
          break;

        case 'csv':
          exportData = this.convertTranscriptsToCSV(transcripts, options);
          filename = `voice-transcripts-${timestamp}.csv`;
          break;

        case 'txt':
          exportData = this.convertTranscriptsToText(transcripts, options);
          filename = `voice-transcripts-${timestamp}.txt`;
          break;

        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      return {
        success: true,
        data: exportData,
        filename
      };
    } catch (error) {
      console.error('Failed to export transcripts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get conversation analytics
   */
  async getAnalytics(filter: TranscriptFilter = {}): Promise<{
    success: boolean;
    data?: {
      totalSessions: number;
      totalMessages: number;
      averageSessionDuration: number;
      providerBreakdown: Record<string, number>;
      dailyActivity: Array<{ date: string; sessions: number; messages: number }>;
      topErrors: Array<{ error: string; count: number }>;
      responseTimeStats: {
        average: number;
        median: number;
        p95: number;
        p99: number;
      };
    };
    error?: string;
  }> {
    try {
      const params = new URLSearchParams();
      
      if (filter.provider) params.append('provider', filter.provider);
      if (filter.dateFrom) params.append('dateFrom', filter.dateFrom.toISOString());
      if (filter.dateTo) params.append('dateTo', filter.dateTo.toISOString());

      const response = await fetch(`${this.baseUrl}/analytics?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Failed to get analytics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search transcripts by content
   */
  async searchTranscripts(
    query: string,
    filter: TranscriptFilter = {}
  ): Promise<{
    success: boolean;
    data?: Array<{
      transcript: ConversationTranscript;
      matches: Array<{
        item: TranscriptItem;
        snippet: string;
        score: number;
      }>;
    }>;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      
      if (filter.provider) params.append('provider', filter.provider);
      if (filter.dateFrom) params.append('dateFrom', filter.dateFrom.toISOString());
      if (filter.dateTo) params.append('dateTo', filter.dateTo.toISOString());

      const response = await fetch(`${this.baseUrl}/search?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Failed to search transcripts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private helper methods

  private formatTranscriptForExport(
    transcript: ConversationTranscript,
    options: TranscriptExportOptions
  ): any {
    const result: any = {
      sessionId: transcript.sessionId,
      items: transcript.items.map(item => ({
        ...item,
        timestamp: this.formatTimestamp(item.timestamp, options.timeFormat)
      }))
    };

    if (options.includeMetadata) {
      result.session = {
        ...transcript.session,
        startTime: this.formatTimestamp(transcript.session.startTime, options.timeFormat),
        endTime: transcript.session.endTime 
          ? this.formatTimestamp(transcript.session.endTime, options.timeFormat)
          : null
      };
    }

    if (options.includeAnalytics) {
      result.analytics = transcript.analytics;
    }

    return result;
  }

  private convertTranscriptsToCSV(
    transcripts: ConversationTranscript[],
    options: TranscriptExportOptions
  ): string {
    const headers = [
      'Session ID',
      'Provider',
      'Timestamp',
      'Type',
      'Content',
      'Confidence',
      'Duration'
    ];

    if (options.includeMetadata) {
      headers.push('Context ID', 'Reflink ID', 'Access Level');
    }

    const rows = [headers.join(',')];

    for (const transcript of transcripts) {
      for (const item of transcript.items) {
        const row = [
          transcript.sessionId,
          item.provider,
          this.formatTimestamp(item.timestamp, options.timeFormat),
          item.type,
          `"${item.content.replace(/"/g, '""')}"`,
          item.metadata?.confidence || '',
          item.metadata?.duration || ''
        ];

        if (options.includeMetadata) {
          row.push(
            transcript.session.metadata.contextId || '',
            transcript.session.metadata.reflinkId || '',
            transcript.session.metadata.accessLevel || ''
          );
        }

        rows.push(row.join(','));
      }
    }

    return rows.join('\n');
  }

  private convertTranscriptsToText(
    transcripts: ConversationTranscript[],
    options: TranscriptExportOptions
  ): string {
    const sections = [];

    for (const transcript of transcripts) {
      const section = [];
      section.push(`=== Conversation ${transcript.sessionId} ===`);
      section.push(`Provider: ${transcript.session.provider}`);
      section.push(`Start Time: ${this.formatTimestamp(transcript.session.startTime, options.timeFormat)}`);
      
      if (transcript.session.endTime) {
        section.push(`End Time: ${this.formatTimestamp(transcript.session.endTime, options.timeFormat)}`);
      }

      if (options.includeAnalytics) {
        section.push(`Messages: ${transcript.analytics.userMessageCount + transcript.analytics.aiMessageCount}`);
        section.push(`Average Response Time: ${transcript.analytics.averageResponseTime}ms`);
      }

      section.push('');
      section.push('--- Transcript ---');

      for (const item of transcript.items) {
        const timestamp = this.formatTimestamp(item.timestamp, options.timeFormat);
        const speaker = item.type === 'user_speech' ? 'User' : 
                      item.type === 'ai_response' ? 'AI' : 'System';
        
        section.push(`[${timestamp}] ${speaker}: ${item.content}`);
        
        if (item.metadata?.confidence) {
          section.push(`  (Confidence: ${Math.round(item.metadata.confidence * 100)}%)`);
        }
      }

      section.push('');
      sections.push(section.join('\n'));
    }

    return sections.join('\n\n');
  }

  private formatTimestamp(timestamp: Date, format: 'iso' | 'local' | 'relative'): string {
    switch (format) {
      case 'iso':
        return timestamp.toISOString();
      case 'local':
        return timestamp.toLocaleString();
      case 'relative':
        const now = new Date();
        const diff = now.getTime() - timestamp.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
      default:
        return timestamp.toISOString();
    }
  }
}

export const transcriptService = new TranscriptService();