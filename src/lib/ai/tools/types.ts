/**
 * Unified Tool Definition System Types
 * 
 * This file defines the unified types for tool definitions and execution contexts
 * that provide a single source of truth for all tool definitions with clear execution boundaries.
 */

// Tool execution context - defines where tool logic runs
export type ToolExecutionContext = 'client' | 'server';

// Unified tool definition interface
export interface UnifiedToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  executionContext: ToolExecutionContext; // Defines where tool logic runs
  outputSchema?: {
    type: 'object';
    properties: Record<string, any>;
  };
}

// Tool call interface for unified execution
export interface UnifiedToolCall {
  id: string;
  name: string;
  arguments: any;
  timestamp: Date;
  sessionId?: string;
  reflinkId?: string;
}

// Tool result interface for unified responses
export interface UnifiedToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    timestamp: number;
    executionTime: number;
    source: 'client' | 'server';
    sessionId?: string;
    toolCallId?: string;
  };
}

// UI State interface for context-aware server tools
export interface UIState {
  // Hierarchical navigation path (breadcrumb style)
  breadcrumbPath: string;              // "home.projects.aurora-avatar.technical-details"
  
  // Currently visible content anchors (debounced scroll updates)
  visibleAnchors: string[];            // ["linear-algebra-deepdive", "normal-distribution-chart"]
  
  // Active search/filter state (debounced updates)
  activeFilters?: {
    searchTerm?: string;               // Current search query if any
    tags?: string[];                   // Active tag filters
    techStack?: string[];              // Active technology filters
  };
  
  // Current route and modal context
  currentRoute?: string;               // "home", "projects", "about"
  currentProject?: string;             // Project slug if viewing project
  currentModal?: string;               // Modal ID if modal is open
  
  // Minimal interaction context for AI awareness
  lastUserAction?: {
    type: 'navigate' | 'search' | 'filter' | 'scroll';
    timestamp: number;
  };
}

// Tool execution context for server-side tools
export interface ServerToolExecutionContext {
  sessionId: string;
  accessLevel: 'basic' | 'limited' | 'premium';
  reflinkId?: string;
  userId?: string;
  uiState?: UIState;                   // UI state context for context-aware tools
}

// Provider-specific tool format interfaces
export interface OpenAIToolFormat {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ElevenLabsToolExecutor {
  [toolName: string]: (parameters: any) => Promise<any>;
}

/** Gemini Live `functionDeclarations` entry (D22, ai-assistant task 6). */
export interface GoogleFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Tool registry interface
export interface IUnifiedToolRegistry {
  registerTool(tool: UnifiedToolDefinition): void;
  getToolDefinition(toolName: string): UnifiedToolDefinition | undefined;
  getClientToolDefinitions(): UnifiedToolDefinition[];
  getServerToolDefinitions(): UnifiedToolDefinition[];
  getAllToolDefinitions(): UnifiedToolDefinition[];

  // Provider-specific formatters
  getOpenAIToolsArray(): OpenAIToolFormat[];
  getElevenLabsClientToolsExecutor(executor: (toolCall: UnifiedToolCall) => Promise<any>): ElevenLabsToolExecutor;
  getGoogleToolsArray(): GoogleFunctionDeclaration[];
}

// Tool validation result
export interface ToolValidationResult {
  valid: boolean;
  errors: string[];
}

// Tool execution error
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public toolName: string,
    public executionContext: ToolExecutionContext,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}