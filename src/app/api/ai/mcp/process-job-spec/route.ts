/**
 * MCP Process Job Spec API
 * 
 * Server-side tool for processing and analyzing job specifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mcpServer } from '@/lib/mcp/server';
import type { MCPToolCall } from '@/lib/mcp/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name: toolName, arguments: args, id } = body as MCPToolCall;

    if (toolName !== 'processJobSpec') {
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
    console.error('Process job spec error:', error);
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