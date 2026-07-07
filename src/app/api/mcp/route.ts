/**
 * POST /api/mcp — public MCP endpoint (D30, mcp-server spec).
 *
 * MCP Streamable HTTP via the official SDK's web-standard transport, STATELESS
 * per request (no session ids — D43 serverless): each POST is one JSON-RPC
 * exchange against a fresh server instance. Gateway-fronted with the dedicated
 * 'mcp' bucket (own per-IP limits, mcpEnabled knob, kill switch, ledger tag 'mcp');
 * fail-closed like every public AI surface.
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { buildMcpServer } from '@/lib/mcp/server';

export const maxDuration = 30;

async function handlePOST(request: NextRequest, ctx: GatewayContext): Promise<NextResponse> {
  const server = buildMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // stateless mode: no sessionIdGenerator; plain JSON responses (no SSE stream)
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('[mcp] transport error:', error);
    // Spec-compliant JSON-RPC error, no internals (Req 1.3)
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null },
      { status: 500 }
    );
  } finally {
    // Stateless: tear down per request
    transport.close().catch(() => {});
    server.close().catch(() => {});
  }
}

export const POST = withAIGateway({ feature: 'mcp', publicAllowed: true, bucket: 'mcp' }, handlePOST);

// Stateless server: no SSE resumption stream, no sessions to delete (Req 1.1).
export async function GET() {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this MCP server is stateless — use POST' }, id: null },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this MCP server is stateless — use POST' }, id: null },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
