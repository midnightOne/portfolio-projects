/**
 * MCP (Model Context Protocol) Types
 * 
 * Type definitions for the MCP navigation tools system that enables
 * AI agents to control UI navigation and highlighting.
 */

// Core MCP Types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, MCPProperty>;
    required?: string[];
  };
}

export interface MCPProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: MCPProperty;
  properties?: Record<string, MCPProperty>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
  id?: string;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    timestamp: number;
    executionTime: number;
    source: 'client' | 'server';
  };
}

// Navigation Tool Types
export interface NavigationToolCall extends MCPToolCall {
  name: 'openProjectModal' | 'navigateToProject' | 'scrollToSection' | 'highlightText' | 'clearHighlights' | 'focusElement' | 'animateElement';
}

export interface OpenProjectModalArgs {
  projectId: string;
  highlightSections?: string[];
}

export interface NavigateToProjectArgs {
  projectSlug: string;
}

export interface ScrollToSectionArgs {
  sectionId: string;
  behavior?: 'smooth' | 'instant';
  block?: 'start' | 'center' | 'end' | 'nearest';
}

export interface HighlightTextArgs {
  selector: string;
  text?: string;
  type?: 'spotlight' | 'outline' | 'color' | 'glow';
  duration?: 'persistent' | 'timed';
  timing?: number;
  intensity?: 'subtle' | 'medium' | 'strong';
}

export interface ClearHighlightsArgs {
  selector?: string;
}

export interface FocusElementArgs {
  selector: string;
}

export interface AnimateElementArgs {
  selector: string;
  animation: {
    type: string;
    duration?: number;
    easing?: string;
    delay?: number;
  };
}

// Server Context Tool Types
export interface ServerContextToolCall extends MCPToolCall {
  name: 'loadProjectContext' | 'loadUserProfile' | 'processJobSpec' | 'getNavigationHistory' | 'reportUIState';
}

export interface LoadProjectContextArgs {
  projectId: string;
  includeContent?: boolean;
  includeMedia?: boolean;
}

export interface LoadUserProfileArgs {
  includePrivate?: boolean;
}

export interface ProcessJobSpecArgs {
  jobSpec: string;
  analysisType?: 'quick' | 'detailed';
}

export interface GetNavigationHistoryArgs {
  sessionId?: string;
  limit?: number;
}

export interface ReportUIStateArgs {
  state: {
    currentModal?: string;
    currentSection?: string;
    activeHighlights?: string[];
    scrollPosition?: number;
    timestamp: number;
  };
}

// MCP Registry Types
export interface MCPToolRegistry {
  // Navigation tools (client-side execution)
  navigationTools: Map<string, MCPNavigationTool>;
  
  // Server context tools (server-side execution)
  serverTools: Map<string, MCPServerTool>;
  
  // Tool execution history
  executionHistory: MCPToolExecution[];
}

export interface MCPNavigationTool {
  definition: MCPTool;
  executor: (args: any) => Promise<MCPToolResult>;
  fallback?: (args: any, error: Error) => Promise<MCPToolResult>;
  validation?: (args: any) => boolean;
}

export interface MCPServerTool {
  definition: MCPTool;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  validation?: (args: any) => boolean;
}

export interface MCPToolExecution {
  toolName: string;
  arguments: Record<string, any>;
  result: MCPToolResult;
  timestamp: number;
  executionTime: number;
  source: 'client' | 'server';
  sessionId?: string;
}

// MCP Client Types
export interface MCPClient {
  // Tool execution
  executeTool: (toolCall: MCPToolCall) => Promise<MCPToolResult>;
  
  // Tool registration
  registerNavigationTool: (name: string, tool: MCPNavigationTool) => void;
  registerServerTool: (name: string, tool: MCPServerTool) => void;
  
  // State management
  getExecutionHistory: () => MCPToolExecution[];
  clearHistory: () => void;
  
  // Error handling
  onError?: (error: Error, toolCall: MCPToolCall) => void;
}

// MCP Server Types
export interface MCPServer {
  // Tool definitions
  getAvailableTools: () => MCPTool[];
  
  // Tool execution (for server-side tools)
  executeTool: (toolCall: MCPToolCall) => Promise<MCPToolResult>;
  
  // Client registration
  registerClient: (clientId: string) => void;
  unregisterClient: (clientId: string) => void;
  
  // State synchronization
  syncNavigationState: (clientId: string, state: any) => Promise<void>;
}

// Navigation State Types
export interface NavigationState {
  currentModal: string | null;
  currentSection: string | null;
  activeHighlights: Record<string, HighlightState>;
  scrollPosition: number;
  history: NavigationHistoryEntry[];
  timestamp: number;
}

export interface HighlightState {
  selector: string;
  type: 'spotlight' | 'outline' | 'color' | 'glow';
  intensity: 'subtle' | 'medium' | 'strong';
  startTime: number;
  duration?: number;
}

export interface NavigationHistoryEntry {
  action: string;
  target: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Error Types
export interface MCPError extends Error {
  code: 'TOOL_NOT_FOUND' | 'INVALID_ARGUMENTS' | 'EXECUTION_FAILED' | 'NETWORK_ERROR' | 'VALIDATION_ERROR';
  toolName?: string;
  arguments?: Record<string, any>;
}

// Configuration Types
export interface MCPConfig {
  server: {
    enabled: boolean;
    port?: number;
    allowedOrigins: string[];
  };
  client: {
    enabled: boolean;
    serverUrl: string;
    retryAttempts: number;
    timeout: number;
  };
  tools: {
    navigation: {
      enabled: boolean;
      allowedSelectors: string[];
      maxHighlights: number;
    };
    server: {
      enabled: boolean;
      rateLimiting: {
        enabled: boolean;
        maxRequestsPerMinute: number;
      };
    };
  };
}