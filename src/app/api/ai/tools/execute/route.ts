/**
 * Unified Server-Side Tool Execution Endpoint
 * 
 * Single endpoint for all server-side tool execution with:
 * - Tool validation and access control
 * - Reflink-based permissions
 * - Session management
 * - Comprehensive error handling and logging
 * - Usage tracking for cost attribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { unifiedToolRegistry } from '@/lib/ai/tools/UnifiedToolRegistry';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';
import { contextInjector } from '@/lib/services/ai/context-injector';
import { mcpServer } from '@/lib/mcp/server';
import type { MCPToolCall } from '@/lib/mcp/types';

/**
 * Backend Tool Service - Simplified replacement for MCP server complexity
 * Handles server-side tool execution with direct service integration
 */
class BackendToolService {
  private static instance: BackendToolService;

  static getInstance(): BackendToolService {
    if (!BackendToolService.instance) {
      BackendToolService.instance = new BackendToolService();
    }
    return BackendToolService.instance;
  }

  async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    sessionId: string,
    accessLevel: string,
    reflinkId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    
    const toolDef = unifiedToolRegistry.getToolDefinition(toolName);
    if (!toolDef || toolDef.executionContext === 'client') {
      return { success: false, error: `Tool '${toolName}' not found or is client-only.` };
    }

    try {
      // For now, delegate to existing MCP server implementation
      // This provides compatibility while we transition to the unified system
      const mcpToolCall: MCPToolCall = {
        id: `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: toolName,
        arguments: parameters
      };

      const result = await mcpServer.executeTool(mcpToolCall);
      
      return {
        success: result.success,
        data: result.data,
        error: result.error
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}

/**
 * Unified tool execution request interface
 */
interface UnifiedToolExecuteRequest {
  toolName: string;
  parameters: Record<string, any>;
  sessionId?: string;
  toolCallId?: string;
  reflinkId?: string;
}

/**
 * Unified tool execution response interface
 */
interface UnifiedToolExecuteResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    timestamp: number;
    source: string;
    sessionId?: string;
    toolCallId?: string;
    executionTime: number;
    accessLevel?: string;
    costTracking?: {
      reflinkId?: string;
      estimatedCost?: number;
      remainingBudget?: number;
    };
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<UnifiedToolExecuteResponse>> {
  const startTime = Date.now();
  let toolCallId: string | undefined;
  let sessionId: string | undefined;
  let toolName: string | undefined;
  let reflinkId: string | undefined;

  try {
    const body: UnifiedToolExecuteRequest = await request.json();
    const { 
      toolName: requestedToolName, 
      parameters, 
      sessionId: requestSessionId, 
      toolCallId: requestToolCallId, 
      reflinkId: requestReflinkId 
    } = body;
    
    toolName = requestedToolName;
    sessionId = requestSessionId || 'anonymous';
    toolCallId = requestToolCallId || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    reflinkId = requestReflinkId;

    // Validate required parameters
    if (!toolName || typeof toolName !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'Tool name is required and must be a string.',
        metadata: {
          timestamp: Date.now(),
          source: 'unified-tools-api',
          executionTime: Date.now() - startTime
        }
      }, { status: 400 });
    }

    if (!parameters || typeof parameters !== 'object') {
      return NextResponse.json({ 
        success: false, 
        error: 'Parameters are required and must be an object.',
        metadata: {
          timestamp: Date.now(),
          source: 'unified-tools-api',
          executionTime: Date.now() - startTime
        }
      }, { status: 400 });
    }

    // Emit debug event for server-side tool call start
    debugEventEmitter.emit('tool_call_start', {
      toolName,
      args: parameters,
      sessionId,
      toolCallId,
      executionContext: 'server',
      provider: 'unified-tools-api',
      reflinkId
    }, 'unified-tools-api');

    // Validate tool exists and is server-side
    const toolDef = unifiedToolRegistry.getToolDefinition(toolName);
    if (!toolDef) {
      const error = `Tool '${toolName}' not found in registry.`;
      
      debugEventEmitter.emit('tool_call_complete', {
        toolName,
        result: null,
        error,
        executionTime: Date.now() - startTime,
        success: false,
        sessionId,
        toolCallId,
        executionContext: 'server',
        provider: 'unified-tools-api'
      }, 'unified-tools-api');

      return NextResponse.json({ 
        success: false, 
        error,
        metadata: {
          timestamp: Date.now(),
          source: 'unified-tools-api',
          sessionId,
          toolCallId,
          executionTime: Date.now() - startTime
        }
      }, { status: 404 });
    }

    if (toolDef.executionContext !== 'server') {
      const error = `Tool '${toolName}' is not a server-side tool.`;
      
      debugEventEmitter.emit('tool_call_complete', {
        toolName,
        result: null,
        error,
        executionTime: Date.now() - startTime,
        success: false,
        sessionId,
        toolCallId,
        executionContext: 'server',
        provider: 'unified-tools-api'
      }, 'unified-tools-api');

      return NextResponse.json({ 
        success: false, 
        error,
        metadata: {
          timestamp: Date.now(),
          source: 'unified-tools-api',
          sessionId,
          toolCallId,
          executionTime: Date.now() - startTime
        }
      }, { status: 400 });
    }

    // Validate reflink and access control using contextInjector
    const validation = await contextInjector.validateAndFilterContext(sessionId, reflinkId);
    if (!validation.valid) {
      const error = validation.error || 'Access denied.';
      
      debugEventEmitter.emit('tool_call_complete', {
        toolName,
        result: null,
        error,
        executionTime: Date.now() - startTime,
        success: false,
        sessionId,
        toolCallId,
        executionContext: 'server',
        provider: 'unified-tools-api'
      }, 'unified-tools-api');

      return NextResponse.json({ 
        success: false, 
        error,
        metadata: {
          timestamp: Date.now(),
          source: 'unified-tools-api',
          sessionId,
          toolCallId,
          executionTime: Date.now() - startTime,
          accessLevel: validation.accessLevel
        }
      }, { status: 403 });
    }

    // Execute tool via BackendToolService
    const backendService = BackendToolService.getInstance();
    const toolResult = await backendService.executeTool(
      toolName, 
      parameters, 
      sessionId, 
      validation.accessLevel, 
      reflinkId
    );

    const executionTime = Date.now() - startTime;

    // Emit debug event for server-side tool call completion
    debugEventEmitter.emit('tool_call_complete', {
      toolName,
      result: toolResult.data,
      error: toolResult.error,
      executionTime,
      success: toolResult.success,
      sessionId,
      toolCallId,
      executionContext: 'server',
      provider: 'unified-tools-api',
      accessLevel: validation.accessLevel
    }, 'unified-tools-api');

    // TODO: Implement cost tracking and budget deduction for reflinks
    const costTracking = reflinkId ? {
      reflinkId,
      estimatedCost: 0.001, // Placeholder cost estimation
      remainingBudget: undefined // Will be implemented with reflink manager integration
    } : undefined;

    const response: UnifiedToolExecuteResponse = {
      success: toolResult.success,
      data: toolResult.data,
      error: toolResult.error,
      metadata: {
        timestamp: Date.now(),
        source: 'unified-tools-api',
        sessionId,
        toolCallId,
        executionTime,
        accessLevel: validation.accessLevel,
        costTracking
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Emit debug event for server-side tool call error
    if (toolName && sessionId && toolCallId) {
      debugEventEmitter.emit('tool_call_complete', {
        toolName,
        result: null,
        error: errorMessage,
        executionTime,
        success: false,
        sessionId,
        toolCallId,
        executionContext: 'server',
        provider: 'unified-tools-api'
      }, 'unified-tools-api');
    }

    console.error('Unified tool execution error:', {
      toolName,
      sessionId,
      toolCallId,
      reflinkId,
      error: errorMessage,
      executionTime
    });
    
    const response: UnifiedToolExecuteResponse = {
      success: false,
      error: errorMessage,
      metadata: {
        timestamp: Date.now(),
        source: 'unified-tools-api',
        sessionId,
        toolCallId,
        executionTime
      }
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * GET endpoint to retrieve available server-side tools
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const serverTools = unifiedToolRegistry.getServerToolDefinitions();
    
    return NextResponse.json({
      success: true,
      tools: serverTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        executionContext: tool.executionContext
      })),
      count: serverTools.length,
      metadata: {
        timestamp: Date.now(),
        source: 'unified-tools-api'
      }
    });

  } catch (error) {
    console.error('Failed to get server tools:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve available server tools',
      metadata: {
        timestamp: Date.now(),
        source: 'unified-tools-api'
      }
    }, { status: 500 });
  }
}