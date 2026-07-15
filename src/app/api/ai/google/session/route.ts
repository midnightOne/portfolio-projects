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
import { buildEngineStartSuffix, resolveEngineMintModel } from '@/lib/services/ai/engine-runtime';
import { buildToolLatencyGuidance } from '@/lib/ai/tool-latency';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { stashMintDebug, type MintSectionMark } from '@/lib/ai/mint-debug-stash';

interface GoogleSessionResponse {
  access_token: string;
  session_id: string;
  expires_at: string;
  model: string;
  voice: string;
  responseModality: 'AUDIO' | 'TEXT';
}

// 7.2a: guidance moved to the ONE shared module (mint-guidance.ts) consumed by
// all native mint handlers — this route's former local TOOL_GUIDANCE was the
// compactness proof it was modeled on.
import { MINT_TOOL_GUIDANCE } from '@/lib/ai/mint-guidance';

async function buildSystemInstructions(
  baseInstructions: string,
  contextId: string | null,
  reflinkId: string | null,
  resumeSessionId: string | null,
  silentResume = false
): Promise<{ instructions: string; engineModelAlias: string | null; sectionMarks: MintSectionMark[] }> {
  let instructions = baseInstructions;

  // Task 7.0a(3): length checkpoints after each append — the admin mint-stash
  // builds its per-section size breakdown from these.
  const sectionMarks: MintSectionMark[] = [];
  const mark = (label: string) => sectionMarks.push({ label, end: instructions.length });
  mark('base config instructions');

  instructions += MINT_TOOL_GUIDANCE;
  mark('tool guidance');

  // Latency-aware filler policy (owner, 2026-07-08): measured per-tool medians
  // tell the model which calls are instant (act silently) and which deserve a
  // short, context-relevant lead-in.
  instructions += await buildToolLatencyGuidance();
  mark('tool latency guidance');

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
  mark('start frame');

  if (contextId) {
    instructions += `\n\nContext ID: ${contextId}`;
  }
  mark('context id');

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
  mark('reflink personalization');

  if (resumeSessionId) {
    try {
      // 7.11: silentResume (resume #2+ per the adapter) briefs "do not speak
      // until the visitor does" — matching the OpenAI route.
      const briefing = await buildResumeBriefing(resumeSessionId, { silent: silentResume });
      if (briefing) {
        instructions += briefing;
      }
    } catch (error) {
      console.error('[google/session] Failed to build resume briefing (continuing without):', error);
    }
  }
  mark('resume briefing');

  // D47 conversation engine (B3): the start node's guidance + prepared
  // context — or, on resume, the PERSISTED node's (Req 2.6). '' when no graph
  // is active, keeping the static path byte-identical (Req 2.7). On this
  // provider the whole session strategy is "full tools + full guidance at
  // mint, strong appended guidance per state" (adapter header; owner
  // 2026-07-09) — this is the mint half of that strategy. The node's model
  // alias rides out for mint-time resolution (Req 5.4, task C1) — the only
  // point it can ever touch a native session (Req 5.3).
  const enginePolicy = await buildEngineStartSuffix({ isPublic: false, resumeSessionId });
  instructions += enginePolicy.suffix;
  mark('engine start suffix');

  return { instructions, engineModelAlias: enginePolicy.modelAlias, sectionMarks };
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
      // J4 (Req 20.2, P28): Gemini Live has NO item control (append-only
      // stream — adapter header), so the rolling window is the provider's own
      // sliding-window compression, configured HERE at mint (the setup is
      // locked into the token; there is no post-setup reconfiguration — the
      // 1007 probe). Provider defaults for trigger/target; the harness adds
      // the running summary as superseding context text (base adapter's
      // window mechanics), and re-mint is NEVER used for pruning.
      contextWindowCompression: { slidingWindow: {} },
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
    const silentResume = searchParams.get('silentResume') === '1'; // 7.11

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    const config = await loadConfig();
    const { instructions: systemInstructions, engineModelAlias, sectionMarks } = await buildSystemInstructions(
      config.instructions,
      contextId,
      reflinkId,
      resumeSessionId,
      silentResume
    );

    // D47 C1 (Req 5.4): the start node's alias participates in mint-time model
    // resolution — same-provider, realtime-family overrides only (the gate in
    // resolveEngineMintModel; driven 2026-07-10: auth_tokens does NOT validate
    // the model, so a bad override would only fail at client connect — it is
    // filtered before it can leave the server, P1).
    const mintModel = await resolveEngineMintModel({
      routeProvider: 'google',
      engineAlias: engineModelAlias,
      defaultModelId: config.model,
    });
    const effectiveModel = mintModel.modelId;
    const { token, expiresAt } = await mintEphemeralToken(
      mintModel.overridden ? { ...config, model: effectiveModel } : config,
      systemInstructions,
      apiKey
    );

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Task 7.0a(3): stash what THIS session was actually minted with, for the
    // admin context-debug panel (never throws; observability only).
    stashMintDebug({
      sessionId,
      provider: 'google',
      handler: 'GET',
      model: effectiveModel,
      reflinkId,
      resumeSessionId,
      instructionsText: systemInstructions,
      marks: sectionMarks,
      tools: unifiedToolRegistry.getGoogleToolsArray(),
    });

    await ctx.meter({
      usageType: 'voice_session_mint',
      provider: 'google',
      costUsd: 0,
      metadata: { sessionId, model: effectiveModel },
    });

    const response: GoogleSessionResponse = {
      access_token: token,
      session_id: sessionId,
      expires_at: expiresAt,
      model: effectiveModel,
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
