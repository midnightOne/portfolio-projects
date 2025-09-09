/**
 * AI Tools Module - Unified Tool System Exports
 * 
 * This module provides centralized access to the unified tool system,
 * including the tool registry, type definitions, and tool collections.
 */

// Import and export the unified tool registry (singleton instance)
import { unifiedToolRegistry, UnifiedToolRegistry } from './UnifiedToolRegistry';
export { unifiedToolRegistry, UnifiedToolRegistry };

// Export all type definitions
export type {
  UnifiedToolDefinition,
  UnifiedToolCall,
  UnifiedToolResult,
  ToolExecutionContext,
  ServerToolExecutionContext,
  OpenAIToolFormat,
  ElevenLabsToolExecutor,
  IUnifiedToolRegistry,
  ToolValidationResult
} from './types';

// Export tool definition collections
export { clientToolDefinitions } from './client-tools';
export { serverToolDefinitions } from './server-tools';

// Export individual tool definitions for direct access if needed
export {
  // Client tools
  navigateToToolDefinition,
  showProjectDetailsToolDefinition,
  scrollIntoViewToolDefinition,
  highlightTextToolDefinition,
  clearHighlightsToolDefinition,
  focusElementToolDefinition,
  reportUIStateToolDefinition,
  fillFormFieldToolDefinition,
  submitFormToolDefinition,
  animateElementToolDefinition
} from './client-tools';

export {
  // Server tools
  loadProjectContextToolDefinition,
  loadUserProfileToolDefinition,
  searchProjectsToolDefinition,
  getProjectSummaryToolDefinition,
  processJobSpecToolDefinition,
  analyzeUserIntentToolDefinition,
  generateNavigationSuggestionsToolDefinition,
  getNavigationHistoryToolDefinition,
  submitContactFormToolDefinition,
  processUploadedFileToolDefinition
} from './server-tools';

// Export error classes
export { ToolExecutionError } from './types';

// Convenience functions for common operations
export const getToolRegistry = () => unifiedToolRegistry;
export const getAllTools = () => unifiedToolRegistry.getAllToolDefinitions();
export const getClientTools = () => unifiedToolRegistry.getClientToolDefinitions();
export const getServerTools = () => unifiedToolRegistry.getServerToolDefinitions();
export const getOpenAITools = () => unifiedToolRegistry.getOpenAIToolsArray();
export const getElevenLabsTools = (executor: (toolCall: any) => Promise<any>) => 
  unifiedToolRegistry.getElevenLabsClientToolsExecutor(executor);