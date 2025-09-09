/**
 * Unified Tool Registry - Centralized Tool Management System
 * 
 * This singleton registry provides a single source of truth for all tool definitions
 * and eliminates redundant tool definitions across providers. It provides consistent
 * tool access and provider-specific formatters for OpenAI and ElevenLabs.
 */

import { 
  UnifiedToolDefinition, 
  IUnifiedToolRegistry, 
  OpenAIToolFormat, 
  ElevenLabsToolExecutor,
  UnifiedToolCall,
  ToolValidationResult,
  ToolExecutionError
} from './types';
import { clientToolDefinitions } from './client-tools';
import { serverToolDefinitions } from './server-tools';

export class UnifiedToolRegistry implements IUnifiedToolRegistry {
  private static instance: UnifiedToolRegistry;
  private tools: Map<string, UnifiedToolDefinition> = new Map();
  private initialized: boolean = false;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of the UnifiedToolRegistry
   */
  static getInstance(): UnifiedToolRegistry {
    if (!UnifiedToolRegistry.instance) {
      UnifiedToolRegistry.instance = new UnifiedToolRegistry();
      UnifiedToolRegistry.instance.initialize();
    }
    return UnifiedToolRegistry.instance;
  }

  /**
   * Initialize the registry with all tool definitions
   */
  private initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register all client-side tools
    clientToolDefinitions.forEach(tool => {
      this.registerTool(tool);
    });

    // Register all server-side tools
    serverToolDefinitions.forEach(tool => {
      this.registerTool(tool);
    });

    this.initialized = true;
    console.log(`UnifiedToolRegistry initialized with ${this.tools.size} tools`);
  }

  /**
   * Register a tool definition in the registry
   */
  registerTool(tool: UnifiedToolDefinition): void {
    // Validate tool definition
    const validation = this.validateToolDefinition(tool);
    if (!validation.valid) {
      throw new ToolExecutionError(
        `Invalid tool definition for '${tool.name}': ${validation.errors.join(', ')}`,
        tool.name,
        tool.executionContext
      );
    }

    // Check for duplicate tool names
    if (this.tools.has(tool.name)) {
      console.warn(`Tool '${tool.name}' is being overridden in registry`);
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Get a specific tool definition by name
   */
  getToolDefinition(toolName: string): UnifiedToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get all client-side tool definitions
   */
  getClientToolDefinitions(): UnifiedToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.executionContext === 'client');
  }

  /**
   * Get all server-side tool definitions
   */
  getServerToolDefinitions(): UnifiedToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.executionContext === 'server');
  }

  /**
   * Get all tool definitions regardless of execution context
   */
  getAllToolDefinitions(): UnifiedToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools formatted for OpenAI Realtime API
   * Returns array of OpenAI function tool format
   */
  getOpenAIToolsArray(): OpenAIToolFormat[] {
    return this.getAllToolDefinitions().map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Get tools formatted for ElevenLabs client-side execution
   * Returns object with tool names as keys and executor functions as values
   */
  getElevenLabsClientToolsExecutor(
    executor: (toolCall: UnifiedToolCall) => Promise<any>
  ): ElevenLabsToolExecutor {
    const elevenLabsClientTools: ElevenLabsToolExecutor = {};
    
    this.getAllToolDefinitions().forEach(toolDef => {
      elevenLabsClientTools[toolDef.name] = async (parameters: any) => {
        const toolCall: UnifiedToolCall = {
          id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: toolDef.name,
          arguments: parameters,
          timestamp: new Date()
        };
        
        return executor(toolCall);
      };
    });
    
    return elevenLabsClientTools;
  }

  /**
   * Get tools filtered by execution context
   */
  getToolsByExecutionContext(context: 'client' | 'server'): UnifiedToolDefinition[] {
    return context === 'client' ? this.getClientToolDefinitions() : this.getServerToolDefinitions();
  }

  /**
   * Check if a tool exists in the registry
   */
  hasToolDefinition(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get tool names by execution context
   */
  getToolNamesByContext(context: 'client' | 'server'): string[] {
    return this.getToolsByExecutionContext(context).map(tool => tool.name);
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalTools: number;
    clientTools: number;
    serverTools: number;
    toolNames: string[];
  } {
    const clientTools = this.getClientToolDefinitions();
    const serverTools = this.getServerToolDefinitions();
    
    return {
      totalTools: this.tools.size,
      clientTools: clientTools.length,
      serverTools: serverTools.length,
      toolNames: Array.from(this.tools.keys()).sort()
    };
  }

  /**
   * Validate a tool definition
   */
  private validateToolDefinition(tool: UnifiedToolDefinition): ToolValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (!tool.name || typeof tool.name !== 'string') {
      errors.push('Tool name is required and must be a string');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      errors.push('Tool description is required and must be a string');
    }

    if (!tool.executionContext || !['client', 'server'].includes(tool.executionContext)) {
      errors.push('Tool executionContext must be either "client" or "server"');
    }

    // Validate parameters schema
    if (!tool.parameters || typeof tool.parameters !== 'object') {
      errors.push('Tool parameters is required and must be an object');
    } else {
      if (tool.parameters.type !== 'object') {
        errors.push('Tool parameters.type must be "object"');
      }

      if (!tool.parameters.properties || typeof tool.parameters.properties !== 'object') {
        errors.push('Tool parameters.properties is required and must be an object');
      }
    }

    // Validate tool name format (alphanumeric and underscores only)
    if (tool.name && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tool.name)) {
      errors.push('Tool name must start with a letter and contain only letters, numbers, and underscores');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear all tools from registry (mainly for testing)
   */
  clearRegistry(): void {
    this.tools.clear();
    this.initialized = false;
  }

  /**
   * Re-initialize the registry (mainly for testing)
   */
  reinitialize(): void {
    this.clearRegistry();
    this.initialize();
  }
}

// Export singleton instance getter for convenience
export const unifiedToolRegistry = UnifiedToolRegistry.getInstance();

// Export the class for testing purposes
export default UnifiedToolRegistry;