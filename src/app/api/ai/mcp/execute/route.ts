/**
 * MCP Tool Execution API Route
 * 
 * Executes MCP server tools for voice agents.
 * Provides a unified endpoint for both OpenAI and ElevenLabs adapters to call MCP server tools.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mcpServer } from '@/lib/mcp/server';
import type { MCPToolCall } from '@/lib/mcp/types';

interface MCPExecuteRequest {
  toolName: string;
  parameters: any;
}

interface MCPExecuteResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    timestamp: number;
    executionTime: number;
    source: string;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: MCPExecuteRequest = await request.json();
    const { toolName, parameters } = body;

    if (!toolName) {
      return NextResponse.json(
        { success: false, error: 'Tool name is required' },
        { status: 400 }
      );
    }

    // Create MCP tool call
    const toolCall: MCPToolCall = {
      id: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: toolName,
      arguments: parameters || {},
      timestamp: new Date()
    };

    // Execute the tool using MCP server
    const result = await mcpServer.executeTool(toolCall);

    const response: MCPExecuteResponse = {
      success: result.success,
      data: result.data,
      error: result.error,
      metadata: {
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        source: 'mcp-server'
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('MCP tool execution failed:', error);
    
    const response: MCPExecuteResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        source: 'mcp-server'
      }
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return available MCP tools
    const availableTools = mcpServer.getAvailableTools();
    
    return NextResponse.json({
      success: true,
      tools: availableTools,
      count: availableTools.length
    });

  } catch (error) {
    console.error('Failed to get MCP tools:', error);
    
    return NextResponse.json(
      { success: false, error: 'Failed to get available tools' },
      { status: 500 }
    );
  }
}