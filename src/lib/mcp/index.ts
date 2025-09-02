/**
 * MCP (Model Context Protocol) System
 * 
 * Main export file for the MCP navigation tools system.
 * Provides AI agents with the ability to control UI navigation and highlighting.
 */

// Core types
export type {
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPNavigationTool,
  MCPServerTool,
  MCPToolRegistry,
  MCPToolExecution,
  MCPClient,
  MCPServer,
  MCPError,
  NavigationState,
  HighlightState,
  NavigationHistoryEntry,
  MCPConfig,
  // Tool argument types
  OpenProjectModalArgs,
  NavigateToProjectArgs,
  ScrollToSectionArgs,
  HighlightTextArgs,
  ClearHighlightsArgs,
  FocusElementArgs,
  AnimateElementArgs,
  LoadProjectContextArgs,
  LoadUserProfileArgs,
  ProcessJobSpecArgs,
  GetNavigationHistoryArgs,
  ReportUIStateArgs
} from './types';

// Client and server instances
export { mcpClient, MCPClientImpl } from './client';
export { mcpServer, MCPServerImpl } from './server';

// Navigation tools
export {
  navigationTools,
  getNavigationState,
  updateNavigationStateExternal,
  getNavigationHistory,
  clearNavigationHistory
} from './navigation-tools';

// Server tools
export {
  serverTools,
  getServerToolDefinitions,
  loadProjectContextTool,
  loadUserProfileTool,
  processJobSpecTool,
  getNavigationHistoryTool,
  reportUIStateTool,
  searchProjectsTool,
  getProjectSummaryTool,
  analyzeUserIntentTool,
  generateNavigationSuggestionsTool
} from './server-tools';

// React integration
export { MCPProvider, useMCP, useMCPAvailable } from '@/components/providers/mcp-provider';
export { useMCPClient } from '@/hooks/use-mcp-client';

// Utility functions
export const createMCPToolCall = (
  name: string, 
  arguments_: Record<string, any>, 
  id?: string
): MCPToolCall => ({
  name,
  arguments: arguments_,
  id
});

export const isMCPError = (error: any): error is MCPError => {
  return error && typeof error === 'object' && 'code' in error;
};

// Default MCP configuration
export const defaultMCPConfig: MCPConfig = {
  server: {
    enabled: true,
    allowedOrigins: ['http://localhost:3000', 'https://localhost:3000']
  },
  client: {
    enabled: true,
    serverUrl: '/api/ai/mcp',
    retryAttempts: 3,
    timeout: 30000
  },
  tools: {
    navigation: {
      enabled: true,
      allowedSelectors: [
        '[data-project-id]',
        '[data-section]',
        '[data-testid]',
        '#*',
        '.project-*',
        '.section-*'
      ],
      maxHighlights: 10
    },
    server: {
      enabled: true,
      rateLimiting: {
        enabled: true,
        maxRequestsPerMinute: 60
      }
    }
  }
};