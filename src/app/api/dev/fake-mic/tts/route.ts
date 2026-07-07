/**
 * D53 synthesized-audio fake microphone — TTS backend (verification task 4.4).
 *
 * Serves speech audio that the client-side SyntheticMicDriver feeds into an
 * emulated microphone track, so an automated agent with no human mic can drive
 * the REAL native-voice path (mic track → provider STT → model → TTS out).
 *
 * Dev/test only (D53): the route 404s in production unconditionally, and outside
 * production still requires an admin session or DEV_VERIFICATION=true. Wrapped in
 * the gateway (D33 — it spends OpenAI TTS tokens); spend lands in the ledger.
 *
 * GET  → availability probe { available: true } (no spend)
 * POST { text, voice? } → audio/wav bytes
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { synthesizeSpeech } from '@/lib/ai/tts';

const MAX_TEXT_CHARS = 1_000;

function devGateOpen(tier: string): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return tier === 'admin' || process.env.DEV_VERIFICATION === 'true';
}

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ available: true, driver: 'synthetic-mic', decision: 'D53' });
}

async function handlePOST(req: NextRequest, ctx: GatewayContext): Promise<NextResponse> {
  if (!devGateOpen(ctx.tier)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: { text?: unknown; voice?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voice = typeof body.voice === 'string' ? body.voice : undefined;
  if (!text) {
    return NextResponse.json({ error: "'text' is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: `'text' exceeds ${MAX_TEXT_CHARS} chars` }, { status: 400 });
  }

  const speech = await synthesizeSpeech({ text, voice, format: 'wav' });

  await ctx.meter({
    usageType: 'tts_synthesis',
    provider: speech.provider,
    modelId: speech.modelId,
    inputTokens: speech.estimatedInputTokens,
    outputTokens: speech.estimatedOutputTokens,
  });

  return new NextResponse(new Uint8Array(speech.audio), {
    status: 200,
    headers: {
      'Content-Type': speech.contentType,
      'Cache-Control': 'no-store',
      'X-TTS-Model': speech.modelId,
    },
  });
}

// Admin/dev only (D53) — never a public spend surface.
export const POST = withAIGateway({ feature: 'voice', publicAllowed: false }, handlePOST);
