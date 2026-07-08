/**
 * Cascade TTS route (D45, ai-assistant task 9.1).
 *
 * POST { text } → audio bytes (audio/wav or audio/mpeg per provider).
 *
 * Model AND voice come from the cascade VoiceProviderConfig row server-side —
 * the client sends only the text to speak (which the reasoning model produced
 * on this same tier moments earlier). Gateway-wrapped (D33), ledger-metered.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { synthesizeSpeech } from '@/lib/ai/tts';
import { getClientAIModelManager } from '@/lib/voice/ClientAIModelManager';
import type { CascadeConfig } from '@/types/voice-config';

/** Matches the text pipeline's reply scale; TTS beyond this is cost without UX value. */
const MAX_TEXT_CHARS = 4_000;

async function handlePOST(req: NextRequest, ctx: GatewayContext): Promise<NextResponse> {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ success: false, error: "'text' is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ success: false, error: `'text' exceeds ${MAX_TEXT_CHARS} chars` }, { status: 400 });
  }

  const cascade = (await getClientAIModelManager().getProviderConfig('cascade')).config as unknown as CascadeConfig;

  const speech = await synthesizeSpeech({
    text,
    model: cascade.ttsModel,
    voice: cascade.ttsVoice,
    format: 'wav',
  });

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

export const POST = withAIGateway({ feature: 'voice', publicAllowed: true }, handlePOST);
