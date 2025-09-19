/**
 * TranscriptContext
 * 
 * Specialized React Context for managing conversation transcripts and history.
 * Provides transcript filtering, search, export, and analytics capabilities.
 */

'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { TranscriptItem, VoiceProvider } from '@/types/voice-agent';

// Transcript filter options
interface TranscriptFilter {
  provider?: VoiceProvider;
  type?: TranscriptItem['type'];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  minConfidence?: number;
}

// Transcript analytics
interface TranscriptAnalytics {
  totalItems: number;
  itemsByType: Record<TranscriptItem['type'], number>;
  itemsByProvider: Record<VoiceProvider, number>;
  averageConfidence: number;
  totalDuration: number;
  conversationDuration: number;
  toolCallCount: number;
  interruptionCount: number;
}

// Action types
type TranscriptAction =
  | { type: 'ADD_ITEM'; item: TranscriptItem }
  | { type: 'ADD_ITEMS'; items: TranscriptItem[] }
  | { type: 'CLEAR_TRANSCRIPT' }
  | { type: 'SET_FILTER'; filter: TranscriptFilter }
  | { type: 'CLEAR_FILTER' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'UPDATE_ITEM'; itemId: string; updates: Partial<TranscriptItem> };

// State interface
interface TranscriptState {
  items: TranscriptItem[];
  filteredItems: TranscriptItem[];
  filter: TranscriptFilter;
  searchQuery: string;
  analytics: TranscriptAnalytics;
}

// Initial state
const initialState: TranscriptState = {
  items: [],
  filteredItems: [],
  filter: {},
  searchQuery: '',
  analytics: {
    totalItems: 0,
    itemsByType: {
      user_speech: 0,
      ai_response: 0,
      tool_call: 0,
      tool_result: 0,
      system_message: 0,
      error: 0
    },
    itemsByProvider: {
      openai: 0,
      elevenlabs: 0
    },
    averageConfidence: 0,
    totalDuration: 0,
    conversationDuration: 0,
    toolCallCount: 0,
    interruptionCount: 0
  }
};

// Helper functions
function calculateAnalytics(items: TranscriptItem[]): TranscriptAnalytics {
  const analytics: TranscriptAnalytics = {
    totalItems: items.length,
    itemsByType: {
      user_speech: 0,
      ai_response: 0,
      tool_call: 0,
      tool_result: 0,
      system_message: 0,
      error: 0
    },
    itemsByProvider: {
      openai: 0,
      elevenlabs: 0
    },
    averageConfidence: 0,
    totalDuration: 0,
    conversationDuration: 0,
    toolCallCount: 0,
    interruptionCount: 0
  };

  if (items.length === 0) {
    return analytics;
  }

  let totalConfidence = 0;
  let confidenceCount = 0;
  let totalDuration = 0;
  let firstTimestamp: Date | null = null;
  let lastTimestamp: Date | null = null;

  items.forEach(item => {
    // Count by type
    analytics.itemsByType[item.type]++;
    
    // Count by provider
    analytics.itemsByProvider[item.provider]++;
    
    // Calculate confidence
    if (item.metadata?.confidence !== undefined) {
      totalConfidence += item.metadata.confidence;
      confidenceCount++;
    }
    
    // Calculate duration
    if (item.metadata?.duration) {
      totalDuration += item.metadata.duration;
    }
    
    // Track conversation duration
    if (!firstTimestamp || item.timestamp < firstTimestamp) {
      firstTimestamp = item.timestamp;
    }
    if (!lastTimestamp || item.timestamp > lastTimestamp) {
      lastTimestamp = item.timestamp;
    }
    
    // Count tool calls
    if (item.type === 'tool_call') {
      analytics.toolCallCount++;
    }
    
    // Count interruptions
    if (item.metadata?.interrupted) {
      analytics.interruptionCount++;
    }
  });

  analytics.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
  analytics.totalDuration = totalDuration;
  analytics.conversationDuration = firstTimestamp && lastTimestamp 
    ? (lastTimestamp as Date).getTime() - (firstTimestamp as Date).getTime() 
    : 0;

  return analytics;
}

function applyFilter(items: TranscriptItem[], filter: TranscriptFilter, searchQuery: string): TranscriptItem[] {
  let filtered = [...items];

  // Filter by provider
  if (filter.provider) {
    filtered = filtered.filter(item => item.provider === filter.provider);
  }

  // Filter by type
  if (filter.type) {
    filtered = filtered.filter(item => item.type === filter.type);
  }

  // Filter by date range
  if (filter.dateRange) {
    filtered = filtered.filter(item => 
      item.timestamp >= filter.dateRange!.start && 
      item.timestamp <= filter.dateRange!.end
    );
  }

  // Filter by minimum confidence
  if (filter.minConfidence !== undefined) {
    filtered = filtered.filter(item => 
      item.metadata?.confidence === undefined || 
      item.metadata.confidence >= filter.minConfidence!
    );
  }

  // Apply search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(item =>
      item.content.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query) ||
      item.provider.toLowerCase().includes(query) ||
      (item.metadata?.toolName && item.metadata.toolName.toLowerCase().includes(query))
    );
  }

  return filtered;
}

// Reducer
function transcriptReducer(state: TranscriptState, action: TranscriptAction): TranscriptState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const newItems = [...state.items, action.item];
      const filteredItems = applyFilter(newItems, state.filter, state.searchQuery);
      const analytics = calculateAnalytics(newItems);
      
      return {
        ...state,
        items: newItems,
        filteredItems,
        analytics
      };
    }

    case 'ADD_ITEMS': {
      const newItems = [...state.items, ...action.items];
      const filteredItems = applyFilter(newItems, state.filter, state.searchQuery);
      const analytics = calculateAnalytics(newItems);
      
      return {
        ...state,
        items: newItems,
        filteredItems,
        analytics
      };
    }

    case 'CLEAR_TRANSCRIPT': {
      return {
        ...state,
        items: [],
        filteredItems: [],
        analytics: calculateAnalytics([])
      };
    }

    case 'SET_FILTER': {
      const filteredItems = applyFilter(state.items, action.filter, state.searchQuery);
      
      return {
        ...state,
        filter: action.filter,
        filteredItems
      };
    }

    case 'CLEAR_FILTER': {
      const filteredItems = applyFilter(state.items, {}, state.searchQuery);
      
      return {
        ...state,
        filter: {},
        filteredItems
      };
    }

    case 'SET_SEARCH_QUERY': {
      const filteredItems = applyFilter(state.items, state.filter, action.query);
      
      return {
        ...state,
        searchQuery: action.query,
        filteredItems
      };
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(item => item.id !== action.itemId);
      const filteredItems = applyFilter(newItems, state.filter, state.searchQuery);
      const analytics = calculateAnalytics(newItems);
      
      return {
        ...state,
        items: newItems,
        filteredItems,
        analytics
      };
    }

    case 'UPDATE_ITEM': {
      const newItems = state.items.map(item =>
        item.id === action.itemId ? { ...item, ...action.updates } : item
      );
      const filteredItems = applyFilter(newItems, state.filter, state.searchQuery);
      const analytics = calculateAnalytics(newItems);
      
      return {
        ...state,
        items: newItems,
        filteredItems,
        analytics
      };
    }

    default:
      return state;
  }
}

// Context interface
interface TranscriptContextType {
  // State
  items: TranscriptItem[];
  filteredItems: TranscriptItem[];
  filter: TranscriptFilter;
  searchQuery: string;
  analytics: TranscriptAnalytics;
  
  // Actions
  addItem: (item: TranscriptItem) => void;
  addItems: (items: TranscriptItem[]) => void;
  clearTranscript: () => void;
  setFilter: (filter: TranscriptFilter) => void;
  clearFilter: () => void;
  setSearchQuery: (query: string) => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, updates: Partial<TranscriptItem>) => void;
  
  // Utilities
  exportTranscript: (format?: 'json' | 'csv' | 'txt') => string;
  getItemsByType: (type: TranscriptItem['type']) => TranscriptItem[];
  getItemsByProvider: (provider: VoiceProvider) => TranscriptItem[];
  getItemsInTimeRange: (start: Date, end: Date) => TranscriptItem[];
  searchItems: (query: string) => TranscriptItem[];
}

// Create context
const TranscriptContext = createContext<TranscriptContextType | null>(null);

// Provider component props
interface TranscriptProviderProps {
  children: React.ReactNode;
  initialItems?: TranscriptItem[];
  autoSave?: boolean;
  saveInterval?: number;
}

// Provider component
export function TranscriptProvider({
  children,
  initialItems = [],
  autoSave = false,
  saveInterval = 30000 // 30 seconds
}: TranscriptProviderProps) {
  const [state, dispatch] = useReducer(transcriptReducer, {
    ...initialState,
    items: initialItems,
    filteredItems: applyFilter(initialItems, {}, ''),
    analytics: calculateAnalytics(initialItems)
  });

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave) return;

    const interval = setInterval(() => {
      // Save transcript to localStorage or server
      try {
        localStorage.setItem('voice-transcript', JSON.stringify(state.items));
      } catch (error) {
        console.error('Failed to auto-save transcript:', error);
      }
    }, saveInterval);

    return () => clearInterval(interval);
  }, [autoSave, saveInterval, state.items]);

  // Actions
  const addItem = useCallback((item: TranscriptItem) => {
    dispatch({ type: 'ADD_ITEM', item });
  }, []);

  const addItems = useCallback((items: TranscriptItem[]) => {
    dispatch({ type: 'ADD_ITEMS', items });
  }, []);

  const clearTranscript = useCallback(() => {
    dispatch({ type: 'CLEAR_TRANSCRIPT' });
  }, []);

  const setFilter = useCallback((filter: TranscriptFilter) => {
    dispatch({ type: 'SET_FILTER', filter });
  }, []);

  const clearFilter = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTER' });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    dispatch({ type: 'REMOVE_ITEM', itemId });
  }, []);

  const updateItem = useCallback((itemId: string, updates: Partial<TranscriptItem>) => {
    dispatch({ type: 'UPDATE_ITEM', itemId, updates });
  }, []);

  // Utilities
  const exportTranscript = useCallback((format: 'json' | 'csv' | 'txt' = 'json'): string => {
    const items = state.filteredItems.length > 0 ? state.filteredItems : state.items;
    
    switch (format) {
      case 'json':
        return JSON.stringify(items, null, 2);
      
      case 'csv': {
        const headers = ['timestamp', 'type', 'provider', 'content', 'confidence', 'duration'];
        const rows = items.map(item => [
          item.timestamp.toISOString(),
          item.type,
          item.provider,
          `"${item.content.replace(/"/g, '""')}"`,
          item.metadata?.confidence?.toString() || '',
          item.metadata?.duration?.toString() || ''
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      }
      
      case 'txt': {
        return items.map(item => {
          const timestamp = item.timestamp.toLocaleString();
          const speaker = item.type === 'user_speech' ? 'User' : 
                         item.type === 'ai_response' ? 'AI' : 
                         item.type === 'tool_call' ? 'Tool' : 'System';
          return `[${timestamp}] ${speaker}: ${item.content}`;
        }).join('\n');
      }
      
      default:
        return JSON.stringify(items, null, 2);
    }
  }, [state.filteredItems, state.items]);

  const getItemsByType = useCallback((type: TranscriptItem['type']): TranscriptItem[] => {
    return state.items.filter(item => item.type === type);
  }, [state.items]);

  const getItemsByProvider = useCallback((provider: VoiceProvider): TranscriptItem[] => {
    return state.items.filter(item => item.provider === provider);
  }, [state.items]);

  const getItemsInTimeRange = useCallback((start: Date, end: Date): TranscriptItem[] => {
    return state.items.filter(item => item.timestamp >= start && item.timestamp <= end);
  }, [state.items]);

  const searchItems = useCallback((query: string): TranscriptItem[] => {
    return applyFilter(state.items, {}, query);
  }, [state.items]);

  const contextValue: TranscriptContextType = {
    // State
    items: state.items,
    filteredItems: state.filteredItems,
    filter: state.filter,
    searchQuery: state.searchQuery,
    analytics: state.analytics,
    
    // Actions
    addItem,
    addItems,
    clearTranscript,
    setFilter,
    clearFilter,
    setSearchQuery,
    removeItem,
    updateItem,
    
    // Utilities
    exportTranscript,
    getItemsByType,
    getItemsByProvider,
    getItemsInTimeRange,
    searchItems
  };

  return (
    <TranscriptContext.Provider value={contextValue}>
      {children}
    </TranscriptContext.Provider>
  );
}

// Hook to use the context
export function useTranscript(): TranscriptContextType {
  const context = useContext(TranscriptContext);
  if (!context) {
    throw new Error('useTranscript must be used within a TranscriptProvider');
  }
  return context;
}