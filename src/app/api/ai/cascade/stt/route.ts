/**
 * Cascade STT route (D45, ai-assistant task 9.1).
 *
 * POST <raw audio body> (Content-Type: audio/webm | audio/ogg | audio/wav | audio/mp4)
 * → { text, provider, modelId }
 *
 * The STT model comes from the cascade VoiceProviderConfig row server-side —
 * the client never chooses what to spend. Gateway-wrapped (D33): public tier
 * needs a chat session (same cookie as /api/ai/chat), spend lands in the ledger.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { transcribeAudio } from '@/lib/ai/stt';
import { getClientAIModelManager } from '@/lib/voice/ClientAIModelManager';
import type { CascadeConfig } from '@/types/voice-config';

/** MediaRecorder webm/opus runs ~1KB/s of speech — 4MB covers minutes; Vercel body limit is ~4.5MB. */
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg'];

async function handlePOST(req: NextRequest, ctx: GatewayContext): Promise<NextResponse> {
  const mimeType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!ACCEPTED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { success: false, error: `Content-Type must be one of: ${ACCEPTED_TYPES.join(', ')}` },
      { status: 415 }
    );
  }

  const audio = Buffer.from(await req.arrayBuffer());
  if (!audio.length) {
    return NextResponse.json({ success: false, error: 'Empty audio body' }, { status: 400 });
  }
  if (audio.length > MAX_AUDIO_BYTES) {
    return NextResponse.json({ success: false, error: `Audio exceeds ${MAX_AUDIO_BYTES} bytes` }, { status: 413 });
  }

  const cascade = (await getClientAIModelManager().getProviderConfig('cascade')).config as unknown as CascadeConfig;

  const result = await transcribeAudio({ audio, mimeType, model: cascade.sttModel });

  await ctx.meter({
    usageType: 'stt_transcription',
    provider: result.provider,
    modelId: result.modelId,
    inputTokens: result.estimatedInputTokens,
    outputTokens: result.estimatedOutputTokens,
    metadata: { audioBytes: audio.length },
  });

  return NextResponse.json({
    success: true,
    text: result.text,
    provider: result.provider,
    modelId: result.modelId,
  });
}

export const POST = withAIGateway({ feature: 'voice', publicAllowed: true }, handlePOST);
