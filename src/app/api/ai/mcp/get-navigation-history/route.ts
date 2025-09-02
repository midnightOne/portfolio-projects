/**
 * MCP Get Navigation History API
 * 
 * Server-side tool for retrieving navigation history for AI agents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mcpServer } from '@/lib/mcp/server';
import type { MCPToolCall } from '@/lib/mcp/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name: toolName, arguments: args, id } = body as MCPToolCall;

    if (toolName !== 'getNavigationHistory') {
      return NextResponse.json(
        { error: 'Invalid tool name' },
        { status: 400 }
      );
    }

    const toolCall: MCPToolCall = {
      name: toolName,
      arguments: args,
      id
    };

    // Execute the tool via MCP server
    const result = await mcpServer.executeTool(toolCall);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Get navigation history error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        timestamp: Date.now(),
        executionTime: 0,
        source: 'server'
      }
    });
  }
}