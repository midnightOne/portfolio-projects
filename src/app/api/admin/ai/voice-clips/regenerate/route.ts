/**
 * D50 clip regeneration (ai-assistant 9b.2) — renders every enabled phrase
 * for each configured provider voice (or one provider's), through that
 * voice's own TTS engine (strict voice match). Spends TTS tokens → gateway-
 * wrapped (D33); one ledger row per TTS model used.
 *
 * POST { provider? } → { targets: [{ sessionProvider, voiceId, generated, failed }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { regenerateClips } from '@/lib/ai/voice-clips';

async function handlePOST(req: NextRequest, ctx: GatewayContext): Promise<NextResponse> {
  if (ctx.tier !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  let body: { provider?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body = regenerate for every configured provider voice
  }

  const result = await regenerateClips({
    sessionProvider: typeof body.provider === 'string' && body.provider ? body.provider : undefined,
  });

  for (const usage of result.usage) {
    await ctx.meter({
      usageType: 'tts_synthesis',
      provider: usage.provider,
      modelId: usage.modelId,
      inputTokens: usage.estimatedInputTokens,
      outputTokens: usage.estimatedOutputTokens,
      metadata: { clipRegeneration: true },
    });
  }

  const anyFailed = result.targets.some((t) => t.failed.length > 0);
  return NextResponse.json({ success: !anyFailed, targets: result.targets });
}

export const POST = withAIGateway({ feature: 'voice', publicAllowed: false }, handlePOST);
