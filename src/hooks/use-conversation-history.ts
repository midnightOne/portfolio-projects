/**
 * Conversation History Hook
 * 
 * React hook for managing conversation history with proper client/admin separation.
 * Provides unified access to conversation storage, retrieval, and management.
 */

import { useState, useEffect, useCallback } from 'react';
import { type ConversationRecord, type ConversationSearchOptions } from '@/lib/services/ai/conversation-history-manager';

export interface UseConversationHistoryOptions {
  sessionId?: string;
  autoLoad?: boolean;
  pollInterval?: number; // milliseconds
}

export interface UseConversationHistoryReturn {
  // Current conversation data
  conversation: ConversationRecord | null;
  messages: ConversationRecord['messages'];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadConversation: (sessionId: string) => Promise<void>;
  refreshConversation: () => Promise<void>;
  clearError: () => void;
  
  // Metadata
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  startedAt: Date | null;
  lastMessageAt: Date | null;
}

export interface UseAdminConversationHistoryOptions {
  autoLoad?: boolean;
  defaultLimit?: number;
  defaultSortBy?: 'timestamp' | 'tokens' | 'cost' | 'duration';
  defaultSortOrder?: 'asc' | 'desc';
}

export interface UseAdminConversationHistoryReturn {
  // Search and filtering
  conversations: ConversationRecord[];
  totalConversations: number;
  hasMore: boolean;
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  
  // Search actions
  searchConversations: (options: ConversationSearchOptions) => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  clearSearch: () => void;
  
  // Individual conversation actions
  loadConversation: (conversationId: string) => Promise<ConversationRecord | null>;
  deleteConversation: (conversationId: string) => Promise<void>;
  
  // Export and stats
  exportConversations: (options: {
    format: 'json' | 'csv' | 'txt';
    includeMetadata?: boolean;
    includeDebugData?: boolean;
    includeVoiceData?: boolean;
    sessionIds?: string[];
  }) => Promise<void>;
  
  getStats: (dateRange?: { start: Date; end: Date }) => Promise<any>;
  
  // Cleanup
  cleanupOldConversations: (olderThanDays: number) => Promise<number>;
  
  // Current search state
  currentSearchOptions: ConversationSearchOptions | null;
  clearError: () => void;
}

/**
 * Hook for client-side conversation history access
 * Limited to session-based access only
 */
export function useConversationHistory(options: UseConversationHistoryOptions = {}): UseConversationHistoryReturn {
  const { sessionId, autoLoad = true, pollInterval } = options;

  const [conversation, setConversation] = useState<ConversationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async (targetSessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai/conversation/history?sessionId=${encodeURIComponent(targetSessionId)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setConversation(data.data.conversation);
      } else {
        throw new Error(data.error || 'Failed to load conversation');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversation';
      setError(errorMessage);
      console.error('Failed to load conversation:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshConversation = useCallback(async () => {
    if (sessionId) {
      await loadConversation(sessionId);
    }
  }, [sessionId, loadConversation]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-load conversation on mount or sessionId change
  useEffect(() => {
    if (autoLoad && sessionId) {
      loadConversation(sessionId);
    }
  }, [autoLoad, sessionId, loadConversation]);

  // Set up polling if specified
  useEffect(() => {
    if (pollInterval && sessionId) {
      const interval = setInterval(() => {
        refreshConversation();
      }, pollInterval);

      return () => clearInterval(interval);
    }
  }, [pollInterval, sessionId, refreshConversation]);

  return {
    conversation,
    messages: conversation?.messages || [],
    isLoading,
    error,
    loadConversation,
    refreshConversation,
    clearError,
    messageCount: conversation?.messageCount || 0,
    totalTokens: conversation?.totalTokens || 0,
    totalCost: conversation?.totalCost || 0,
    startedAt: conversation?.startedAt || null,
    lastMessageAt: conversation?.lastMessageAt || null
  };
}

/**
 * Hook for admin conversation history management
 * Full access to all conversations with search, filtering, and management capabilities
 */
export function useAdminConversationHistory(options: UseAdminConversationHistoryOptions = {}): UseAdminConversationHistoryReturn {
  const {
    autoLoad = true,
    defaultLimit = 20,
    defaultSortBy = 'timestamp',
    defaultSortOrder = 'desc'
  } = options;

  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [totalConversations, setTotalConversations] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSearchOptions, setCurrentSearchOptions] = useState<ConversationSearchOptions | null>(null);

  const searchConversations = useCallback(async (searchOptions: ConversationSearchOptions) => {
    setIsSearching(true);
    setError(null);
    setCurrentSearchOptions(searchOptions);

    try {
      const params = new URLSearchParams({
        action: 'search',
        ...Object.entries(searchOptions).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            if (key === 'dateRange' && typeof value === 'object') {
              acc.startDate = value.start.toISOString();
              acc.endDate = value.end.toISOString();
            } else {
              acc[key] = String(value);
            }
          }
          return acc;
        }, {} as Record<string, string>)
      });

      const response = await fetch(`/api/admin/ai/conversation/history?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setConversations(data.data.conversations);
        setTotalConversations(data.data.total);
        setHasMore(data.data.hasMore);
      } else {
        throw new Error(data.error || 'Failed to search conversations');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search conversations';
      setError(errorMessage);
      console.error('Failed to search conversations:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (!hasMore || isLoading || !currentSearchOptions) return;

    setIsLoading(true);
    setError(null);

    try {
      const searchOptions = {
        ...currentSearchOptions,
        offset: (currentSearchOptions.offset || 0) + conversations.length
      };

      const params = new URLSearchParams({
        action: 'search',
        ...Object.entries(searchOptions).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            if (key === 'dateRange' && typeof value === 'object') {
              acc.startDate = value.start.toISOString();
              acc.endDate = value.end.toISOString();
            } else {
              acc[key] = String(value);
            }
          }
          return acc;
        }, {} as Record<string, string>)
      });

      const response = await fetch(`/api/admin/ai/conversation/history?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setConversations(prev => [...prev, ...data.data.conversations]);
        setHasMore(data.data.hasMore);
      } else {
        throw new Error(data.error || 'Failed to load more conversations');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more conversations';
      setError(errorMessage);
      console.error('Failed to load more conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, currentSearchOptions, conversations.length]);

  const refreshConversations = useCallback(async () => {
    if (currentSearchOptions) {
      await searchConversations(currentSearchOptions);
    } else {
      // Load default conversations
      await searchConversations({
        limit: defaultLimit,
        sortBy: defaultSortBy,
        sortOrder: defaultSortOrder
      });
    }
  }, [currentSearchOptions, searchConversations, defaultLimit, defaultSortBy, defaultSortOrder]);

  const clearSearch = useCallback(() => {
    setConversations([]);
    setTotalConversations(0);
    setHasMore(false);
    setCurrentSearchOptions(null);
    setError(null);
  }, []);

  const loadConversation = useCallback(async (conversationId: string): Promise<ConversationRecord | null> => {
    try {
      const response = await fetch(`/api/admin/ai/conversation/history?action=conversation&conversationId=${encodeURIComponent(conversationId)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to load conversation');
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
      throw err;
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/admin/ai/conversation/history?conversationId=${encodeURIComponent(conversationId)}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Remove from local state
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));
        setTotalConversations(prev => prev - 1);
      } else {
        throw new Error(data.error || 'Failed to delete conversation');
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      throw err;
    }
  }, []);

  const exportConversations = useCallback(async (exportOptions: {
    format: 'json' | 'csv' | 'txt';
    includeMetadata?: boolean;
    includeDebugData?: boolean;
    includeVoiceData?: boolean;
    sessionIds?: string[];
  }) => {
    try {
      const params = new URLSearchParams({
        action: 'export',
        format: exportOptions.format,
        includeMetadata: String(exportOptions.includeMetadata || false),
        includeDebugData: String(exportOptions.includeDebugData || false),
        includeVoiceData: String(exportOptions.includeVoiceData || false)
      });

      if (exportOptions.sessionIds && exportOptions.sessionIds.length > 0) {
        params.set('sessionIds', exportOptions.sessionIds.join(','));
      }

      const response = await fetch(`/api/admin/ai/conversation/history?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversations.${exportOptions.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export conversations:', err);
      throw err;
    }
  }, []);

  const getStats = useCallback(async (dateRange?: { start: Date; end: Date }) => {
    try {
      const params = new URLSearchParams({ action: 'stats' });
      
      if (dateRange) {
        params.set('startDate', dateRange.start.toISOString());
        params.set('endDate', dateRange.end.toISOString());
      }

      const response = await fetch(`/api/admin/ai/conversation/history?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to get stats');
      }
    } catch (err) {
      console.error('Failed to get stats:', err);
      throw err;
    }
  }, []);

  const cleanupOldConversations = useCallback(async (olderThanDays: number): Promise<number> => {
    try {
      const response = await fetch(`/api/admin/ai/conversation/history?action=cleanup&olderThanDays=${olderThanDays}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        return data.data.deletedCount;
      } else {
        throw new Error(data.error || 'Failed to cleanup conversations');
      }
    } catch (err) {
      console.error('Failed to cleanup conversations:', err);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-load conversations on mount
  useEffect(() => {
    if (autoLoad) {
      searchConversations({
        limit: defaultLimit,
        sortBy: defaultSortBy,
        sortOrder: defaultSortOrder
      });
    }
  }, [autoLoad, defaultLimit, defaultSortBy, defaultSortOrder, searchConversations]);

  return {
    conversations,
    totalConversations,
    hasMore,
    isLoading,
    isSearching,
    error,
    searchConversations,
    loadMoreConversations,
    refreshConversations,
    clearSearch,
    loadConversation,
    deleteConversation,
    exportConversations,
    getStats,
    cleanupOldConversations,
    currentSearchOptions,
    clearError
  };
}