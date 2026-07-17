/**
 * POST /api/admin/ai/model-aliases/test (ai-assistant 7.23, owner ask
 * 2026-07-18): validate a provider/model pair BEFORE saving the alias — "is
 * this model id real and can we connect to it" — by running one minimal chat
 * through the same reasoning adapter the pipeline will use (D56: the test IS
 * the production path, not a parallel checker).
 *
 * Cost-incurring (a real ~10-token completion) → gateway-wrapped (D33) and
 * metered as `alias_test`. Admin tier ONLY — reflink holders must not
 * test-drive arbitrary models on the owner's keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { getReasoningAdapterForModel } from '@/lib/ai/reasoning';

const BodySchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1).max(120),
});

const CHAT_PROVIDERS = ['openai', 'anthropic', 'google'] as const;

async function handlePOST(request: NextRequest, ctx: GatewayContext) {
  if (ctx.tier !== 'admin') {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 401 });
  }
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'provider and modelId are required' }, { status: 400 });
  }
  if (!CHAT_PROVIDERS.includes(body.provider as (typeof CHAT_PROVIDERS)[number])) {
    return NextResponse.json(
      {
        success: false,
        error: `'${body.provider}' has no chat/reasoning adapter — testable providers: ${CHAT_PROVIDERS.join(', ')}.`,
      },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  try {
    const adapter = getReasoningAdapterForModel(body.provider, body.modelId);
    const res = await Promise.race([
      adapter.chat([{ role: 'user', content: 'Reply with the single word: ok' }], {
        // generous — reasoning-enabled models spend thinking tokens inside the budget
        maxOutputTokens: 500,
        temperature: 0,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out after 20s')), 20_000)),
    ]);
    const latencyMs = Date.now() - startedAt;
    await ctx
      .meter({
        usageType: 'alias_test',
        provider: res.provider,
        modelId: res.modelId,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        metadata: { latencyMs },
      })
      .catch(() => undefined);
    return NextResponse.json({
      success: true,
      ok: true,
      latencyMs,
      resolved: `${res.provider}/${res.modelId}`,
      reply: (res.content ?? '').slice(0, 120),
      usage: res.usage,
    });
  } catch (error) {
    // The REAL provider error is the product here — a 404 model id, a 401 key,
    // a 429 quota each tell the owner exactly what is wrong before they save.
    return NextResponse.json({
      success: true,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 500) : String(error),
    });
  }
}

export const POST = withAIGateway({ feature: 'admin-edit', publicAllowed: false }, handlePOST);
