import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY environment variable' },
        { status: 500 }
      );
    }

    const response = await fetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: 'gpt-realtime',
            tools: [
              // Add MCP tools here if needed
              // {
              //   type: 'mcp',
              //   server_label: 'deepwiki',
              //   server_url: 'https://mcp.deepwiki.com/sse',
              //   require_approval: 'always',
              // },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = JSON.stringify(errJson);
      } catch {
        detail = await response.text();
      }
      return NextResponse.json(
        { 
          error: `Failed to create ephemeral client secret: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}` 
        },
        { status: response.status }
      );
    }

    const clientSecret: {
      value: string;
      expires_at: number;
      session: Record<string, unknown>;
    } = await response.json();

    return NextResponse.json({ token: clientSecret.value });
  } catch (error) {
    console.error('Error creating client secret:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}