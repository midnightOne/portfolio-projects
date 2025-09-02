/**
 * MCP Navigation State API
 * 
 * Endpoint for receiving navigation state updates from client-side MCP tools.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { NavigationState } from '@/lib/mcp/types';
import { mcpServer } from '@/lib/mcp/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { state } = body as { state: NavigationState };

    if (!state || typeof state !== 'object') {
      return NextResponse.json(
        { error: 'Invalid navigation state' },
        { status: 400 }
      );
    }

    // Get client ID from session or generate one
    const clientId = request.headers.get('x-client-id') || 'anonymous';

    // Sync navigation state with MCP server
    await mcpServer.syncNavigationState(clientId, state);

    return NextResponse.json({
      success: true,
      clientId,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Navigation state sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync navigation state' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId') || 'anonymous';
    
    // Get current navigation state for client
    const state = mcpServer.getClientState(clientId);

    return NextResponse.json({
      success: true,
      clientId,
      state: state || null,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Navigation state retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve navigation state' },
      { status: 500 }
    );
  }
}