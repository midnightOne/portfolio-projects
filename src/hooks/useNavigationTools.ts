/**
 * useNavigationTools Hook
 * 
 * React hook for integrating UI navigation tools with voice agents.
 * Provides tool registration, execution tracking, and state management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ToolDefinition, ToolResult } from '@/types/voice-agent';
import { UINavigationTools, createUINavigationToolDefinitions, uiNavigationTools } from '@/lib/voice/UINavigationTools';

interface NavigationState {
  currentPage: {
    url: string;
    title: string;
    pathname: string;
  };
  navigationHistory: Array<{
    action: string;
    params: any;
    timestamp: Date;
  }>;
  activeHighlights: string[];
  lastToolResult: ToolResult | null;
}

interface UseNavigationToolsOptions {
  autoRegisterTools?: boolean;
  trackHistory?: boolean;
  onToolExecuted?: (toolName: string, result: ToolResult) => void;
  onNavigationChange?: (newPage: NavigationState['currentPage']) => void;
}

interface UseNavigationToolsReturn {
  // State
  navigationState: NavigationState;
  tools: ToolDefinition[];
  
  // Tool execution
  executeTool: (toolName: string, args: any) => Promise<ToolResult>;
  
  // Navigation actions
  navigateTo: (path: string, newTab?: boolean) => Promise<ToolResult>;
  showProjectDetails: (projectId: string, highlightSections?: string[]) => Promise<ToolResult>;
  scrollIntoView: (selector: string, behavior?: ScrollBehavior) => Promise<ToolResult>;
  highlightText: (selector: string, text?: string, className?: string) => Promise<ToolResult>;
  clearHighlights: (className?: string) => Promise<ToolResult>;
  focusElement: (selector: string) => Promise<ToolResult>;
  
  // State management
  clearNavigationHistory: () => void;
  refreshCurrentPage: () => void;
  
  // Tool registration
  registerCustomTool: (tool: ToolDefinition) => void;
  unregisterTool: (toolName: string) => void;
  
  // Utilities
  isToolAvailable: (toolName: string) => boolean;
  getToolByName: (toolName: string) => ToolDefinition | undefined;
}

export function useNavigationTools(
  options: UseNavigationToolsOptions = {}
): UseNavigationToolsReturn {
  const {
    autoRegisterTools = true,
    trackHistory = true,
    onToolExecuted,
    onNavigationChange
  } = options;

  // State
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentPage: {
      url: typeof window !== 'undefined' ? window.location.href : '',
      title: typeof window !== 'undefined' ? document.title : '',
      pathname: typeof window !== 'undefined' ? window.location.pathname : ''
    },
    navigationHistory: [],
    activeHighlights: [],
    lastToolResult: null
  });

  const [tools, setTools] = useState<ToolDefinition[]>([]);
  
  // Refs
  const toolsMapRef = useRef<Map<string, ToolDefinition>>(new Map());
  const isInitializedRef = useRef(false);

  // Initialize tools and set up event listeners
  useEffect(() => {
    if (isInitializedRef.current || typeof window === 'undefined') {
      return;
    }

    // Register default navigation tools
    if (autoRegisterTools) {
      const defaultTools = createUINavigationToolDefinitions();
      defaultTools.forEach(tool => {
        toolsMapRef.current.set(tool.name, tool);
      });
      setTools(Array.from(toolsMapRef.current.values()));
    }

    // Set up tool result callbacks
    const toolNames = ['navigateTo', 'showProjectDetails', 'scrollIntoView', 'highlightText', 'clearHighlights', 'focusElement'];
    toolNames.forEach(toolName => {
      uiNavigationTools.registerToolResultCallback(toolName, (result) => {
        setNavigationState(prev => ({
          ...prev,
          lastToolResult: result
        }));
        
        onToolExecuted?.(toolName, result);
      });
    });

    // Track navigation changes
    const handleLocationChange = () => {
      const newPage = {
        url: window.location.href,
        title: document.title,
        pathname: window.location.pathname
      };
      
      setNavigationState(prev => ({
        ...prev,
        currentPage: newPage
      }));
      
      onNavigationChange?.(newPage);
    };

    // Listen for navigation events
    window.addEventListener('popstate', handleLocationChange);
    
    // Listen for title changes
    const titleObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.target === document.head) {
          const titleElement = document.querySelector('title');
          if (titleElement && titleElement.textContent !== navigationState.currentPage.title) {
            handleLocationChange();
          }
        }
      });
    });
    
    titleObserver.observe(document.head, { childList: true, subtree: true });

    isInitializedRef.current = true;

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      titleObserver.disconnect();
    };
  }, [autoRegisterTools, onToolExecuted, onNavigationChange]);

  // Update navigation history when tools are executed
  useEffect(() => {
    if (trackHistory) {
      const history = uiNavigationTools.getNavigationHistory();
      setNavigationState(prev => ({
        ...prev,
        navigationHistory: history
      }));
    }
  }, [trackHistory, navigationState.lastToolResult]);

  // Tool execution wrapper
  const executeTool = useCallback(async (toolName: string, args: any): Promise<ToolResult> => {
    const tool = toolsMapRef.current.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    const startTime = Date.now();
    try {
      const result = await tool.handler(args);
      const executionTime = Date.now() - startTime;
      
      const toolResult: ToolResult = {
        id: `${toolName}_${Date.now()}`,
        result,
        timestamp: new Date(),
        executionTime
      };

      setNavigationState(prev => ({
        ...prev,
        lastToolResult: toolResult
      }));

      onToolExecuted?.(toolName, toolResult);
      return toolResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const toolResult: ToolResult = {
        id: `${toolName}_${Date.now()}`,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        executionTime
      };

      setNavigationState(prev => ({
        ...prev,
        lastToolResult: toolResult
      }));

      onToolExecuted?.(toolName, toolResult);
      return toolResult;
    }
  }, [onToolExecuted]);

  // Navigation action wrappers
  const navigateTo = useCallback(async (path: string, newTab?: boolean): Promise<ToolResult> => {
    return executeTool('navigateTo', { path, newTab });
  }, [executeTool]);

  const showProjectDetails = useCallback(async (projectId: string, highlightSections?: string[]): Promise<ToolResult> => {
    return executeTool('showProjectDetails', { projectId, highlightSections });
  }, [executeTool]);

  const scrollIntoView = useCallback(async (selector: string, behavior?: ScrollBehavior): Promise<ToolResult> => {
    return executeTool('scrollIntoView', { selector, behavior });
  }, [executeTool]);

  const highlightText = useCallback(async (selector: string, text?: string, className?: string): Promise<ToolResult> => {
    const result = await executeTool('highlightText', { selector, text, className });
    
    // Track active highlights
    if (result.result?.success) {
      setNavigationState(prev => ({
        ...prev,
        activeHighlights: [...prev.activeHighlights, className || 'voice-highlight']
      }));
    }
    
    return result;
  }, [executeTool]);

  const clearHighlights = useCallback(async (className?: string): Promise<ToolResult> => {
    const result = await executeTool('clearHighlights', { className });
    
    // Clear tracked highlights
    if (result.result?.success) {
      setNavigationState(prev => ({
        ...prev,
        activeHighlights: className 
          ? prev.activeHighlights.filter(c => c !== className)
          : []
      }));
    }
    
    return result;
  }, [executeTool]);

  const focusElement = useCallback(async (selector: string): Promise<ToolResult> => {
    return executeTool('focusElement', { selector });
  }, [executeTool]);

  // State management
  const clearNavigationHistory = useCallback(() => {
    uiNavigationTools.clearNavigationHistory();
    setNavigationState(prev => ({
      ...prev,
      navigationHistory: []
    }));
  }, []);

  const refreshCurrentPage = useCallback(() => {
    if (typeof window !== 'undefined') {
      const newPage = {
        url: window.location.href,
        title: document.title,
        pathname: window.location.pathname
      };
      
      setNavigationState(prev => ({
        ...prev,
        currentPage: newPage
      }));
    }
  }, []);

  // Tool registration
  const registerCustomTool = useCallback((tool: ToolDefinition) => {
    toolsMapRef.current.set(tool.name, tool);
    setTools(Array.from(toolsMapRef.current.values()));
  }, []);

  const unregisterTool = useCallback((toolName: string) => {
    toolsMapRef.current.delete(toolName);
    setTools(Array.from(toolsMapRef.current.values()));
  }, []);

  // Utilities
  const isToolAvailable = useCallback((toolName: string): boolean => {
    return toolsMapRef.current.has(toolName);
  }, []);

  const getToolByName = useCallback((toolName: string): ToolDefinition | undefined => {
    return toolsMapRef.current.get(toolName);
  }, []);

  return {
    // State
    navigationState,
    tools,
    
    // Tool execution
    executeTool,
    
    // Navigation actions
    navigateTo,
    showProjectDetails,
    scrollIntoView,
    highlightText,
    clearHighlights,
    focusElement,
    
    // State management
    clearNavigationHistory,
    refreshCurrentPage,
    
    // Tool registration
    registerCustomTool,
    unregisterTool,
    
    // Utilities
    isToolAvailable,
    getToolByName
  };
}