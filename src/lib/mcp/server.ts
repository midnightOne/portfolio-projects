import type { MCPServer, MCPTool, MCPToolCall, MCPToolResult, NavigationState, MCPError } from './types';
import { unifiedToolRegistry } from '../ai/tools/UnifiedToolRegistry';

class MCPServerImpl implements MCPServer {
  private registeredClients = new Set<string>();
  private clientStates = new Map<string, NavigationState>();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      console.log('MCP Server initializing...');
      this.isInitialized = true;
      console.log('MCP Server initialized with', this.getAvailableTools().length, 'tools');
    } catch (error) {
      console.error('Failed to initialize MCP Server:', error);
      throw error;
    }
  }

  getAvailableTools(): MCPTool[] {
    const serverTools = unifiedToolRegistry.getServerToolDefinitions();
    return serverTools.map(toolDef => ({
      name: toolDef.name,
      description: toolDef.description,
      inputSchema: toolDef.parameters,
      outputSchema: toolDef.outputSchema
    }));
  }

  async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    return {
      success: true,
      data: { message: 'Tool execution - implementation pending' },
      metadata: { timestamp: Date.now(), executionTime: 0, source: 'server' }
    };
  }

  registerClient(clientId: string): void {
    this.registeredClients.add(clientId);
  }

  unregisterClient(clientId: string): void {
    this.registeredClients.delete(clientId);
    this.clientStates.delete(clientId);
  }

  async syncNavigationState(clientId: string, state: NavigationState): Promise<void> {
    this.clientStates.set(clientId, state);
  }

  getRegisteredClients(): string[] {
    return Array.from(this.registeredClients);
  }

  getClientState(clientId: string): NavigationState | undefined {
    return this.clientStates.get(clientId);
  }
}

export { MCPServerImpl };
export const mcpServer = new MCPServerImpl();
export default mcpServer;