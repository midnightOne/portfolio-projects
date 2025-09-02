/**
 * MCP Client
 * 
 * Client-side MCP implementation that handles tool execution,
 * state management, and communication with the server.
 */

import type {
  MCPClient,
  MCPToolCall,
  MCPToolResult,
  MCPNavigationTool,
  MCPServerTool,
  MCPToolRegistry,
  MCPToolExecution,
  MCPError,
  NavigationState
} from './types';
import { navigationTools, getNavigationState } from './navigation-tools';
import { serverTools } from './server-tools';

class MCPClientImpl implements MCPClient {
  private registry: MCPToolRegistry;
  private isInitialized = false;

  constructor() {
    this.registry = {
      navigationTools: new Map(navigationTools),
      serverTools: new Map(serverTools),
      executionHistory: []
    };
  }

  /**
   * Initialize the MCP client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Register default navigation tools
      navigationTools.forEach((tool, name) => {
        this.registry.navigationTools.set(name, tool);
      });

      // Register default server tools
      serverTools.forEach((tool, name) => {
        this.registry.serverTools.set(name, tool);
      });

      this.isInitialized = true;
      console.log('MCP Client initialized with', 
        this.registry.navigationTools.size, 'navigation tools and',
        this.registry.serverTools.size, 'server tools'
      );
    } catch (error) {
      console.error('Failed to initialize MCP Client:', error);
      throw error;
    }
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      // Validate tool call
      if (!toolCall.name || typeof toolCall.name !== 'string') {
        throw this.createMCPError('INVALID_ARGUMENTS', 'Tool name is required', toolCall.name);
      }

      // Check if it's a navigation tool (client-side execution)
      const navigationTool = this.registry.navigationTools.get(toolCall.name);
      if (navigationTool) {
        return await this.executeNavigationTool(navigationTool, toolCall);
      }

      // Check if it's a server tool (server-side execution)
      const serverTool = this.registry.serverTools.get(toolCall.name);
      if (serverTool) {
        return await this.executeServerTool(serverTool, toolCall);
      }

      // Tool not found
      throw this.createMCPError('TOOL_NOT_FOUND', `Tool '${toolCall.name}' not found`, toolCall.name, toolCall.arguments);

    } catch (error) {
      const result: MCPToolResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'client'
        }
      };

      // Log execution
      this.logExecution(toolCall, result, Date.now() - startTime);

      // Call error handler if provided
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)), toolCall);
      }

      return result;
    }
  }

  /**
   * Execute a navigation tool (client-side)
   */
  private async executeNavigationTool(tool: MCPNavigationTool, toolCall: MCPToolCall): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      // Validate arguments if validator exists
      if (tool.validation && !tool.validation(toolCall.arguments)) {
        throw this.createMCPError('VALIDATION_ERROR', 'Tool arguments validation failed', toolCall.name, toolCall.arguments);
      }

      // Execute the tool
      const result = await tool.executor(toolCall.arguments);
      
      // Log execution
      this.logExecution(toolCall, result, Date.now() - startTime);

      return result;

    } catch (error) {
      // Try fallback if available
      if (tool.fallback) {
        try {
          const fallbackResult = await tool.fallback(toolCall.arguments, error instanceof Error ? error : new Error(String(error)));
          this.logExecution(toolCall, fallbackResult, Date.now() - startTime);
          return fallbackResult;
        } catch (fallbackError) {
          // Fallback also failed
          const result: MCPToolResult = {
            success: false,
            error: `Tool and fallback failed: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
              timestamp: Date.now(),
              executionTime: Date.now() - startTime,
              source: 'client'
            }
          };
          this.logExecution(toolCall, result, Date.now() - startTime);
          return result;
        }
      }

      throw error;
    }
  }

  /**
   * Execute a server tool (server-side via API)
   */
  private async executeServerTool(tool: MCPServerTool, toolCall: MCPToolCall): Promise<MCPToolResult> {
    const startTime = Date.now();

    try {
      // Validate arguments if validator exists
      if (tool.validation && !tool.validation(toolCall.arguments)) {
        throw this.createMCPError('VALIDATION_ERROR', 'Tool arguments validation failed', toolCall.name, toolCall.arguments);
      }

      // Make API call to server
      const response = await fetch(tool.endpoint, {
        method: tool.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: toolCall.name,
          arguments: toolCall.arguments,
          id: toolCall.id
        })
      });

      if (!response.ok) {
        throw this.createMCPError('NETWORK_ERROR', `Server request failed: ${response.status} ${response.statusText}`, toolCall.name, toolCall.arguments);
      }

      const result: MCPToolResult = await response.json();
      
      // Ensure result has proper metadata
      if (!result.metadata) {
        result.metadata = {
          timestamp: Date.now(),
          executionTime: Date.now() - startTime,
          source: 'server'
        };
      }

      // Log execution
      this.logExecution(toolCall, result, Date.now() - startTime);

      return result;

    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      throw this.createMCPError('EXECUTION_FAILED', error instanceof Error ? error.message : String(error), toolCall.name, toolCall.arguments);
    }
  }

  /**
   * Register a navigation tool
   */
  registerNavigationTool(name: string, tool: MCPNavigationTool): void {
    this.registry.navigationTools.set(name, tool);
    console.log(`Registered navigation tool: ${name}`);
  }

  /**
   * Register a server tool
   */
  registerServerTool(name: string, tool: MCPServerTool): void {
    this.registry.serverTools.set(name, tool);
    console.log(`Registered server tool: ${name}`);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): MCPToolExecution[] {
    return [...this.registry.executionHistory];
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.registry.executionHistory = [];
  }

  /**
   * Get available tools
   */
  getAvailableTools(): { navigation: string[], server: string[] } {
    return {
      navigation: Array.from(this.registry.navigationTools.keys()),
      server: Array.from(this.registry.serverTools.keys())
    };
  }

  /**
   * Get current navigation state
   */
  getNavigationState(): NavigationState {
    return getNavigationState();
  }

  /**
   * Log tool execution
   */
  private logExecution(toolCall: MCPToolCall, result: MCPToolResult, executionTime: number): void {
    const execution: MCPToolExecution = {
      toolName: toolCall.name,
      arguments: toolCall.arguments,
      result,
      timestamp: Date.now(),
      executionTime,
      source: result.metadata?.source || 'client',
      sessionId: 'current' // TODO: Get actual session ID
    };

    this.registry.executionHistory.push(execution);

    // Keep only last 100 executions
    if (this.registry.executionHistory.length > 100) {
      this.registry.executionHistory = this.registry.executionHistory.slice(-100);
    }
  }

  /**
   * Create MCP error
   */
  private createMCPError(code: MCPError['code'], message: string, toolName?: string, args?: Record<string, any>): MCPError {
    const error = new Error(message) as MCPError;
    error.code = code;
    error.toolName = toolName;
    error.arguments = args;
    return error;
  }

  /**
   * Error handler (can be set externally)
   */
  onError?: (error: Error, toolCall: MCPToolCall) => void;
}

// Create singleton instance
const mcpClient = new MCPClientImpl();

// Export client instance and class
export { mcpClient, MCPClientImpl };
export type { MCPClient };