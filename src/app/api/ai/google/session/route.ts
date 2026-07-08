/**
 * Google Gemini Live Session API Route (D22, ai-assistant task 6)
 *
 * Mints a v1alpha ephemeral auth token (AuthTokenService.CreateToken) with the
 * model, system instructions, tools, and generation config LOCKED into the
 * token via `bidiGenerateContentSetup` (no `lockAdditionalFields` — per the
 * Gemini API's own documented behavior, omitting it while a setup is present
 * locks every field named there). The browser only ever sees the ephemeral
 * token, never GOOGLE_API_KEY (D3) and never the assembled system prompt —
 * the client's own WebSocket setup message can be a minimal echo since the
 * server enforces the locked config regardless of what the client sends.
 *
 * No SDK dependency (matches the D39 reasoning adapter's convention): talks
 * to the auth_tokens REST resource directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientAIModelManager } from '@/lib/voice/ClientAIModelManager';
import { GoogleLiveConfig } from '@/types/voice-config';
import { unifiedToolRegistry } from '@/lib/ai/tools/UnifiedToolRegistry';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import { buildResumeBriefing } from '@/lib/ai/resume-briefing';
import { assembleStartFrame } from '@/lib/ai/start-frame';
import { buildToolLatencyGuidance } from '@/lib/ai/tool-latency';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';

interface GoogleSessionResponse {
  access_token: string;
  session_id: string;
  expires_at: string;
  model: string;
  voice: string;
  responseModality: 'AUDIO' | 'TEXT';
}

const TOOL_GUIDANCE = `

TOOL USAGE:
- Use ui_describe to learn the current UI state before navigating, then ui_intent to navigate (projects, sections, routes, modals). Do not add artificial delays to tool calls.
- Use content_search for discovery ("tell me about", "what do you know about") and content_get for full detail on a result. Always pass the current UI state for context-aware ranking.
- Whether to SPEAK around a tool call depends on how long it actually takes — follow the TOOL LATENCY AWARENESS section below. Narrating an instant action ("give me a moment… here we are") prolongs the interaction; acting silently and then describing the result is what feels effortless.
- You will occasionally receive NAV_CONTEXT messages describing current UI state — use them silently for context, never read them aloud.

LANGUAGE POLICY (strict):
- ALWAYS speak and answer in English by default — including your very first greeting and any turn where the visitor's language seems ambiguous or the audio was unclear. Never guess a language from acoustics.
- Switch to another language ONLY when the visitor explicitly asks you to, and switch back on request.`;

async function buildSystemInstructions(
  baseInstructions: string,
  contextId: string | null,
  reflinkId: string | null,
  resumeSessionId: string | null
): Promise<string> {
  let instructions = baseInstructions + TOOL_GUIDANCE;

  // Latency-aware filler policy (owner, 2026-07-08): measured per-tool medians
  // tell the model which calls are instant (act silently) and which deserve a
  // short, context-relevant lead-in.
  instructions += await buildToolLatencyGuidance();

  // Start frame (task 5d — same grounding as text chat): without it the model
  // has zero portfolio context at session start and answers "can't find
  // specific information" whenever a single content_search comes back thin
  // (owner-observed inconsistency, 2026-07-08). The frame names the projects
  // and technologies, which both grounds broad openers AND gives the model
  // the right vocabulary for better search queries.
  const frame = await assembleStartFrame().catch((error) => {
    console.error('[google/session] start frame assembly failed (continuing without it):', error);
    return '';
  });
  if (frame) {
    instructions += `\n\n${frame}`;
  }

  if (contextId) {
    instructions += `\n\nContext ID: ${contextId}`;
  }

  if (reflinkId) {
    try {
      const reflinkValidation = await reflinkManager.validateReflinkWithBudget(reflinkId);
      if (reflinkValidation.valid && reflinkValidation.reflink) {
        const reflink = reflinkValidation.reflink;
        instructions += `\n`;
        if (reflink.recipientName) {
          instructions += `\nPersonalized Context: You are speaking with ${reflink.recipientName}.`;
        }
        if (reflink.customContext) {
          instructions += `\nCustom context from the portfolio owner about the person you are speaking to: ${reflink.customContext}`;
        }
        if (reflinkValidation.welcomeMessage) {
          instructions += `\nWelcome Message: ${reflinkValidation.welcomeMessage}`;
        }
      }
    } catch (error) {
      console.error('[google/session] Failed to load reflink context:', error);
    }
  }

  if (resumeSessionId) {
    try {
      const briefing = await buildResumeBriefing(resumeSessionId);
      if (briefing) {
        instructions += briefing;
      }
    } catch (error) {
      console.error('[google/session] Failed to build resume briefing (continuing without):', error);
    }
  }

  return instructions;
}

function toModelResource(modelId: string): string {
  return modelId.startsWith('models/') ? modelId : `models/${modelId}`;
}

async function mintEphemeralToken(
  config: GoogleLiveConfig,
  systemInstructions: string,
  apiKey: string
): Promise<{ token: string; expiresAt: string }> {
  const now = Date.now();
  // newSessionExpireTime: window to START a session with this token (short-lived).
  // expireTime: window for the session itself once started — the D31/access-and-cost
  // voice duration cap, plus a small buffer for connection setup.
  const newSessionExpireTime = new Date(now + 60_000).toISOString();
  const expireTime = new Date(now + (config.maxSessionSeconds + 60) * 1000).toISOString();

  const functionDeclarations = unifiedToolRegistry.getGoogleToolsArray();

  const body = {
    expireTime,
    newSessionExpireTime,
    uses: 1,
    bidiGenerateContentSetup: {
      model: toModelResource(config.model),
      generationConfig: {
        responseModalities: [config.responseModality],
        temperature: config.temperature,
        ...(config.responseModality === 'AUDIO'
          ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } } } }
          : {}),
        // Off by default for real-time voice: thinking adds latency and its
        // trace only separates from the spoken answer via the `thought` part
        // flag on the adapter side (D22 amendment, owner 2026-07-07).
        // Gemini 3.x replaced thinkingBudget with thinkingLevel (minimal is
        // the low-latency default); 2.x keeps the budget field.
        thinkingConfig: /gemini-3/.test(config.model)
          ? (config.enableReasoning
              ? { thinkingLevel: 'LOW', includeThoughts: true }
              : { thinkingLevel: 'MINIMAL' })
          : (config.enableReasoning
              ? { includeThoughts: true }
              : { thinkingBudget: 0 }),
      },
      systemInstruction: { parts: [{ text: systemInstructions }] },
      tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined,
      ...(config.transcription.input ? { inputAudioTranscription: {} } : {}),
      ...(config.transcription.output ? { outputAudioTranscription: {} } : {}),
    },
    // No fieldMask: per Gemini's ephemeral-token docs, when bidiGenerateContentSetup is
    // present and lockAdditionalFields is omitted, every field named above is locked —
    // the client's own WebSocket setup message cannot override model/instructions/tools.
  };

  const response = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google auth_tokens.create failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  const data = (await response.json()) as { name?: string };
  if (!data.name) {
    throw new Error('Google auth_tokens.create returned no token name');
  }

  return { token: data.name, expiresAt: expireTime };
}

async function loadConfig(): Promise<GoogleLiveConfig> {
  const modelManager = getClientAIModelManager();
  try {
    const configWithMetadata = await modelManager.getProviderConfig('google');
    return configWithMetadata.config as GoogleLiveConfig;
  } catch (error) {
    console.warn('[google/session] Failed to load Google config, using serializer default:', error instanceof Error ? error.message : error);
    const { getSerializerForProvider } = await import('@/lib/voice/config-serializers');
    return getSerializerForProvider('google').getDefaultConfig() as GoogleLiveConfig;
  }
}

async function handleGET(request: NextRequest, ctx: GatewayContext) {
  try {
    const { searchParams } = new URL(request.url);
    const contextId = searchParams.get('contextId');
    const reflinkId = searchParams.get('reflinkId');
    const resumeSessionId = searchParams.get('resumeSessionId');

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    const config = await loadConfig();
    const systemInstructions = await buildSystemInstructions(config.instructions, contextId, reflinkId, resumeSessionId);
    const { token, expiresAt } = await mintEphemeralToken(config, systemInstructions, apiKey);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    await ctx.meter({
      usageType: 'voice_session_mint',
      provider: 'google',
      costUsd: 0,
      metadata: { sessionId, model: config.model },
    });

    const response: GoogleSessionResponse = {
      access_token: token,
      session_id: sessionId,
      expires_at: expiresAt,
      model: config.model,
      voice: config.voice,
      responseModality: config.responseModality,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[google/session] Error creating session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Voice token mints are never public (D31 Req 2.4) - reflink or admin only.
export const GET = withAIGateway({ feature: 'voice', publicAllowed: false }, handleGET);
