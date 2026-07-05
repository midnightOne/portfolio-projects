/**
 * Legacy OpenAI Realtime token mint used by the admin voice-test page.
 * Duplicate of /api/ai/openai/session — scheduled for hard deletion in Phase 3.3
 * (D42); until then it is gateway-wrapped so no unauthenticated mint exists (D33).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';

async function handlePOST(request: NextRequest, ctx: GatewayContext) {
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
            tools: [],
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

    await ctx.meter({
      usageType: 'voice_session_mint',
      provider: 'openai',
      costUsd: 0,
      metadata: { route: 'legacy-token' },
    });

    return NextResponse.json({ token: clientSecret.value });
  } catch (error) {
    console.error('Error creating client secret:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withAIGateway({ feature: 'voice', publicAllowed: false }, handlePOST);
