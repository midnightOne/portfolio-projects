/**
 * OpenAI Realtime Session API Route
 * 
 * Generates ephemeral OpenAI client_secret tokens for WebRTC connections.
 * Implements secure server-side token generation with context injection.
 * Uses the ClientAIModelManager for consistent OpenAI configuration management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getClientAIModelManager } from '../../../../../lib/voice/ClientAIModelManager';
import { OpenAIRealtimeConfig } from '../../../../../types/voice-config';
import { unifiedToolRegistry } from '../../../../../lib/ai/tools/UnifiedToolRegistry';
import { reflinkManager } from '../../../../../lib/services/ai/reflink-manager';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { stashMintDebug, type MintSectionMark } from '@/lib/ai/mint-debug-stash';

interface OpenAISessionRequest {
  contextId?: string;
  reflinkId?: string;
  instructions?: string;
  tools?: any[];
}

interface OpenAISessionResponse {
  client_secret: string;
  session_id: string;
  expires_at: string;
  model: string;
  voice: string;
  /** Session duration cap in seconds (task 8 / Req 2.4) — the adapter
   *  auto-disconnects at this bound (OpenAI's client secret cannot kill a
   *  running session; its ~60-min realtime limit is the hard backstop). */
  max_session_seconds: number;
}

async function handleGET(request: NextRequest, ctx: GatewayContext) {
  try {
    // Get request parameters
    const { searchParams } = new URL(request.url);
    const contextId = searchParams.get('contextId');
    const reflinkId = searchParams.get('reflinkId');
    // D49 5b.3: adapter session id of an interrupted conversation to resume
    const resumeSessionId = searchParams.get('resumeSessionId');
    // 7.11: set by the adapter from resume #2 on — the briefing tells the
    // model not to speak until the visitor does (the adapter skips its auto
    // response.create for the same legs).
    const silentResume = searchParams.get('silentResume') === '1';

    console.log('GET /api/ai/openai/session - Request URL:', request.url);
    console.log('Search params:', Object.fromEntries(searchParams.entries()));
    console.log('Extracted contextId:', contextId);
    console.log('Extracted reflinkId:', reflinkId);

    // Validate OpenAI API key using centralized environment validation
    const { getEnvironmentVariable } = await import('../../../../../types/voice-config');
    let openaiApiKey: string;

    try {
      openaiApiKey = getEnvironmentVariable('OPENAI_API_KEY', true)!;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Get client IP for rate limiting (basic implementation)
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for') ||
      headersList.get('x-real-ip') ||
      'unknown';

    // TODO: Implement rate limiting based on IP and reflink
    // TODO: Validate reflink and get access level
    // TODO: Load context from ContextProviderService

    // Get OpenAI configuration using ClientAIModelManager
    const modelManager = getClientAIModelManager();
    let defaultConfig: OpenAIRealtimeConfig;

    try {
      const configWithMetadata = await modelManager.getProviderConfig('openai');

      if (configWithMetadata) {
        defaultConfig = configWithMetadata.config as OpenAIRealtimeConfig;
        console.log(`Using database OpenAI config: ${configWithMetadata.name}`);
      } else {
        // Fallback to default config if no database config found
        const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
        const openaiSerializer = getSerializerForProvider('openai');
        defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
        console.log('Using fallback OpenAI config (no database config found)');
      }
    } catch (error) {
      console.warn('Failed to load OpenAI config from ClientAIModelManager, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to default config
      const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
      const openaiSerializer = getSerializerForProvider('openai');
      defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
    }

    // CRITICAL FIX: Synchronize voice settings between top-level and sessionConfig
    // The top-level 'voice' property should always match sessionConfig.audio.output.voice
    if (defaultConfig.voice !== defaultConfig.sessionConfig.audio.output.voice) {
      console.log(`Voice synchronization: Updating sessionConfig.audio.output.voice from '${defaultConfig.sessionConfig.audio.output.voice}' to '${defaultConfig.voice}'`);
      defaultConfig.sessionConfig.audio.output.voice = defaultConfig.voice;
    }

    // Build system instructions with context (using config as base)
    let systemInstructions = defaultConfig.instructions;

    // Task 7.0a(3): length checkpoints after each append — the admin
    // mint-stash builds its per-section size breakdown from these (the final
    // string has no delimiters to re-split on).
    const sectionMarks: MintSectionMark[] = [];
    const mark = (label: string) => sectionMarks.push({ label, end: systemInstructions.length });
    mark('base config instructions');

    // 7.2a: the ONE shared guidance block (mint-guidance.ts) — never inline a
    // per-route copy here again; the module doc records why.
    const { MINT_TOOL_GUIDANCE } = await import('@/lib/ai/mint-guidance');
    systemInstructions += MINT_TOOL_GUIDANCE;

    // Latency-aware filler policy (owner, 2026-07-08): measured per-tool
    // medians tell the model which calls are instant (act silently) and which
    // deserve a short, context-relevant lead-in.
    mark('tool guidance');
    const { buildToolLatencyGuidance } = await import('@/lib/ai/tool-latency');
    systemInstructions += await buildToolLatencyGuidance();
    mark('tool latency guidance');

    // 7.2c: owner identity + portfolio orientation ride the STABLE, cacheable
    // mint instructions (Google-mint parity, task 5d.1) — the fid no longer
    // carries them (7.1a), so this is the one home for who Kirill is.
    const { assembleStartFrame } = await import('@/lib/ai/start-frame');
    const startFrame = await assembleStartFrame().catch(() => '');
    if (startFrame) {
      systemInstructions += `\n\n${startFrame}`;
    }
    mark('start frame');

    // TODO: Inject actual context from ContextProviderService based on contextId and reflinkId
    if (contextId) {
      systemInstructions += `\n\nContext ID: ${contextId}`;
    }
    mark('context id');

    if (reflinkId) {
      try {
        // Validate reflink and get personalized data
        const reflinkValidation = await reflinkManager.validateReflinkWithBudget(reflinkId);

        if (reflinkValidation.valid && reflinkValidation.reflink) {
          const reflink = reflinkValidation.reflink;
          systemInstructions += `\n`;

          // Add personalized greeting if available
          if (reflink.recipientName) {
            systemInstructions += `\nPersonalized Context: You are speaking with ${reflink.recipientName}.`;
          }

          // Add custom context if provided
          if (reflink.customContext) {
            systemInstructions += `\nCustom context from the portfolio owner about the person you are speaking to: ${reflink.customContext}`;
          }

          // Add feature availability context
          const enabledFeatures = [];
          if (reflink.enableVoiceAI) enabledFeatures.push('voice AI');
          if (reflink.enableJobAnalysis) enabledFeatures.push('job analysis');
          if (reflink.enableAdvancedNavigation) enabledFeatures.push('advanced navigation');

          if (enabledFeatures.length > 0) {
            systemInstructions += `\nEnabled Features: This user has access to ${enabledFeatures.join(', ')}.`;
          }

          // Add budget status if available
          if (reflinkValidation.budgetStatus) {
            const budget = reflinkValidation.budgetStatus;
            if (budget.tokensRemaining !== undefined) {
              systemInstructions += `\nBudget Status: ${budget.tokensRemaining} tokens remaining.`;
            }
          }

          // Add welcome message if available
          if (reflinkValidation.welcomeMessage) {
            systemInstructions += `\nWelcome Message: ${reflinkValidation.welcomeMessage}`;
          }

          console.log(`Personalized context loaded for reflink: ${reflinkId} (${reflink.name || 'unnamed'})`);
        } else {
          console.warn(`Invalid reflink: ${reflinkId} - ${reflinkValidation.reason}`);
          systemInstructions += `\n\nThis user provided reflink: ${reflinkId} (validation failed)`;
        }
      } catch (error) {
        console.error('Failed to load reflink context:', error);
        systemInstructions += `\n\nThis user has special access via reflink: ${reflinkId}`;
      }
    } else {
      console.log('No reflink ID provided, personalized context not loaded for reflink: ', reflinkId);
    }
    mark('reflink personalization');

    // D49 5b.3: harness briefing — the new leg is briefed from ground truth
    // (conversation store snapshot + bounded recap), never from provider memory.
    if (resumeSessionId) {
      try {
        const { buildResumeBriefing } = await import('@/lib/ai/resume-briefing');
        const briefing = await buildResumeBriefing(resumeSessionId, { silent: silentResume });
        if (briefing) {
          systemInstructions += briefing;
          console.log(`Resume briefing injected for session ${resumeSessionId} (${briefing.length} chars)`);
        } else {
          console.warn(`Resume requested but no conversation found for session ${resumeSessionId}`);
        }
      } catch (error) {
        console.error('Failed to build resume briefing (continuing without):', error);
      }
    }

    // D47 conversation engine (B3): start-node (or, on resume, persisted-node
    // — Req 2.6) guidance + prepared context appended AFTER the base policy
    // (notes §2.1.4). '' when no graph is active — static path unchanged (Req 2.7).
    // C1 (Req 5.4): the node's alias participates in mint-time model resolution
    // — the only point a node alias ever touches a native session (Req 5.3).
    mark('resume briefing');
    const { buildEngineStartSuffix, resolveEngineMintModel } = await import('@/lib/services/ai/engine-runtime');
    const enginePolicy = await buildEngineStartSuffix({ isPublic: false, resumeSessionId });
    systemInstructions += enginePolicy.suffix;
    mark('engine start suffix');
    const mintModel = await resolveEngineMintModel({
      routeProvider: 'openai',
      engineAlias: enginePolicy.modelAlias,
      defaultModelId: defaultConfig.model,
    });

    console.log('System instructions:', systemInstructions);

    // Get all tools from unified tool registry (no duplicates)
    const allTools = unifiedToolRegistry.getOpenAIToolsArray();
    console.log('All tools:', allTools);
    //defaultConfig.sessionConfig.audio.output.voice = 'cedar';
    console.log('Voice:', defaultConfig.sessionConfig.audio.output.voice);

    // Create OpenAI Realtime session using config system. The model may carry
    // the engine's mint-time override (Req 5.4) — pre-validated by
    // resolveEngineMintModel's realtime gate, because this endpoint accepts
    // ANY model string (driven 2026-07-10: 200 for a nonsense id; failures
    // surface only at client connect, beyond server reach).
    const mintSession = (model: string) =>
      fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 600 },
          session: {
            type: "realtime",
            model,
            // Server-side context injection - instructions are injected here and not visible to client
            instructions: systemInstructions,
            // Server-side tool definitions injection
            tools: allTools,
            // Audio configuration from config system
            audio: {
              input: {
                format: {
                  type: 'audio/pcm',
                  rate: defaultConfig.sessionConfig.audio.input.format.rate
                },
                turn_detection: {
                  type: defaultConfig.sessionConfig.audio.input.turnDetection.type,
                  threshold: defaultConfig.sessionConfig.audio.input.turnDetection.threshold,
                  prefix_padding_ms: defaultConfig.sessionConfig.audio.input.turnDetection.prefixPaddingMs,
                  silence_duration_ms: defaultConfig.sessionConfig.audio.input.turnDetection.silenceDurationMs,
                  create_response: defaultConfig.sessionConfig.audio.input.turnDetection.createResponse,
                  interrupt_response: defaultConfig.sessionConfig.audio.input.turnDetection.interruptResponse
                },
                transcription: {
                  model: defaultConfig.sessionConfig.audio.input.transcription?.model || 'whisper-1'
                }
              },
              output: {
                format: {
                  type: 'audio/pcm',
                  rate: defaultConfig.sessionConfig.audio.output.format.rate
                },
                voice: defaultConfig.sessionConfig.audio.output.voice
              }
            }
          }
        }),
      });

    const effectiveModel = mintModel.modelId;
    const sessionResponse = await mintSession(effectiveModel);

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('OpenAI session creation failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to create OpenAI session' },
        { status: sessionResponse.status }
      );
    }

    const sessionData = await sessionResponse.json();

    // Generate session ID for tracking
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Task 7.0a(3): stash what THIS session was actually minted with, for the
    // admin context-debug panel (never throws; observability only).
    stashMintDebug({
      sessionId,
      provider: 'openai',
      handler: 'GET',
      model: effectiveModel,
      reflinkId,
      resumeSessionId,
      instructionsText: systemInstructions,
      marks: sectionMarks,
      tools: allTools,
    });

    // Duration cap (task 8 / Req 2.4) — expires_at reflects the REAL cap the
    // adapter enforces, not a fictional 15 minutes. Older DB rows may predate
    // the field, hence the fallback.
    const maxSessionSeconds = defaultConfig.maxSessionSeconds || 900;
    const expiresAt = new Date(Date.now() + maxSessionSeconds * 1000).toISOString();

    // Ledger row for the mint event (D32). Realtime session spend is metered
    // per-leg when voice telemetry lands (Phase 4 / D49); the mint itself is $0.
    await ctx.meter({
      usageType: 'voice_session_mint',
      provider: 'openai',
      costUsd: 0,
      metadata: { sessionId, model: effectiveModel, maxSessionSeconds },
    });

    const response: OpenAISessionResponse = {
      client_secret: sessionData.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: effectiveModel,
      voice: defaultConfig.sessionConfig.audio.output.voice,
      max_session_seconds: maxSessionSeconds
    };

    // Log session creation (without sensitive data)
    console.log(`OpenAI session created: ${sessionId} for IP: ${clientIP}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePOST(request: NextRequest, ctx: GatewayContext) {
  try {
    const body: OpenAISessionRequest = await request.json();

    console.log('POST /api/ai/openai/session - Request body:', JSON.stringify(body, null, 2));
    console.log('POST reflinkId:', body.reflinkId);

    // Handle POST requests with custom configuration
    // This allows for more complex session setup with custom instructions and tools

    // Validate OpenAI API key using centralized environment validation
    const { getEnvironmentVariable } = await import('../../../../../types/voice-config');
    let openaiApiKey: string;

    try {
      openaiApiKey = getEnvironmentVariable('OPENAI_API_KEY', true)!;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Get OpenAI configuration using ClientAIModelManager
    const modelManager = getClientAIModelManager();
    let defaultConfig: OpenAIRealtimeConfig;

    try {
      const configWithMetadata = await modelManager.getProviderConfig('openai');

      if (configWithMetadata) {
        defaultConfig = configWithMetadata.config as OpenAIRealtimeConfig;
        console.log(`Using database OpenAI config: ${configWithMetadata.name}`);
      } else {
        // Fallback to default config if no database config found
        const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
        const openaiSerializer = getSerializerForProvider('openai');
        defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
        console.log('Using fallback OpenAI config (no database config found)');
      }
    } catch (error) {
      console.warn('Failed to load OpenAI config from ClientAIModelManager, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to default config
      const { getSerializerForProvider } = await import('../../../../../lib/voice/config-serializers');
      const openaiSerializer = getSerializerForProvider('openai');
      defaultConfig = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
    }

    // CRITICAL FIX: Synchronize voice settings between top-level and sessionConfig
    // The top-level 'voice' property should always match sessionConfig.audio.output.voice
    if (defaultConfig.voice !== defaultConfig.sessionConfig.audio.output.voice) {
      console.log(`Voice synchronization (POST): Updating sessionConfig.audio.output.voice from '${defaultConfig.sessionConfig.audio.output.voice}' to '${defaultConfig.voice}'`);
      defaultConfig.sessionConfig.audio.output.voice = defaultConfig.voice;
    }

    // Build custom instructions (use config default if not provided)
    let instructions = body.instructions || defaultConfig.instructions;

    // Task 7.0a(3): length checkpoints — same convention as GET.
    const sectionMarks: MintSectionMark[] = [];
    const mark = (label: string) => sectionMarks.push({ label, end: instructions.length });
    mark('base config instructions');

    // 7.2a: same shared guidance module as GET — one policy, zero copies.
    const { MINT_TOOL_GUIDANCE } = await import('@/lib/ai/mint-guidance');
    instructions += MINT_TOOL_GUIDANCE;

    // Latency-aware filler policy (owner, 2026-07-08): measured per-tool
    // medians tell the model which calls are instant (act silently) and which
    // deserve a short, context-relevant lead-in.
    mark('tool guidance');
    const { buildToolLatencyGuidance } = await import('@/lib/ai/tool-latency');
    instructions += await buildToolLatencyGuidance();
    mark('tool latency guidance');

    // 7.2c: owner identity + portfolio orientation in the cacheable mint
    // instructions — mirrors handleGET (the fid no longer carries them, 7.1a).
    const { assembleStartFrame } = await import('@/lib/ai/start-frame');
    const startFrame = await assembleStartFrame().catch(() => '');
    if (startFrame) {
      instructions += `\n\n${startFrame}`;
    }
    mark('start frame');

    if (body.contextId) {
      // TODO: Load context from ContextProviderService
      instructions += `\n\nContext ID: ${body.contextId}`;
    }
    mark('context id');

    if (body.reflinkId) {
      try {
        // Validate reflink and get personalized data
        const reflinkValidation = await reflinkManager.validateReflinkWithBudget(body.reflinkId);

        if (reflinkValidation.valid && reflinkValidation.reflink) {
          const reflink = reflinkValidation.reflink;
          instructions += `\n`;

          // Add personalized greeting if available
          if (reflink.recipientName) {
            instructions += `\nPersonalized Context: You are speaking with ${reflink.recipientName}.`;
          }

          // Add custom context if provided
          if (reflink.customContext) {
            instructions += `\nCustom context from the portfolio owner about the person you are speaking to: ${reflink.customContext}`;
          }

          // Add feature availability context
          const enabledFeatures = [];
          if (reflink.enableVoiceAI) enabledFeatures.push('voice AI');
          if (reflink.enableJobAnalysis) enabledFeatures.push('job analysis');
          if (reflink.enableAdvancedNavigation) enabledFeatures.push('advanced navigation');

          if (enabledFeatures.length > 0) {
            instructions += `\nEnabled Features: This user has access to ${enabledFeatures.join(', ')}.`;
          }

          // Add budget status if available
          if (reflinkValidation.budgetStatus) {
            const budget = reflinkValidation.budgetStatus;
            if (budget.tokensRemaining !== undefined) {
              instructions += `\nBudget Status: ${budget.tokensRemaining} tokens remaining.`;
            }
          }

          // Add welcome message if available
          if (reflinkValidation.welcomeMessage) {
            instructions += `\nWelcome Message: ${reflinkValidation.welcomeMessage}`;
          }

          console.log(`Personalized context loaded for reflink (POST): ${body.reflinkId} (${reflink.name || 'unnamed'})`);
        } else {
          console.warn(`Invalid reflink (POST): ${body.reflinkId} - ${reflinkValidation.reason}`);
          instructions += `\n\nThis user provided reflink: ${body.reflinkId} (validation failed)`;
        }
      } catch (error) {
        console.error('Failed to load reflink context (POST):', error);
        instructions += `\n\nThis user has special access via reflink: ${body.reflinkId}`;
      }
    } else {
      console.log('No reflink ID provided, personalized context not loaded for reflink: ', body.reflinkId);
    }
    mark('reflink personalization');

    // D47 conversation engine (B3): start-node guidance + prepared context,
    // '' when no graph is active (Req 2.7). POST mint has no resume path.
    // C1 (Req 5.4): node alias participates in mint-time model resolution.
    const { buildEngineStartSuffix, resolveEngineMintModel } = await import('@/lib/services/ai/engine-runtime');
    const enginePolicy = await buildEngineStartSuffix({ isPublic: false });
    instructions += enginePolicy.suffix;
    mark('engine start suffix');
    const mintModel = await resolveEngineMintModel({
      routeProvider: 'openai',
      engineAlias: enginePolicy.modelAlias,
      defaultModelId: defaultConfig.model,
    });

    // Use custom tools or default from unified registry
    const tools = body.tools || unifiedToolRegistry.getOpenAIToolsArray();

    // Engine mint override pre-validated by the realtime gate — this endpoint
    // does not validate models (driven 2026-07-10; same contract as GET).
    const mintSession = (model: string) =>
      fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model,
          // Server-side context injection - instructions are injected here and not visible to client
          instructions: instructions,
          // Server-side tool definitions injection
          tools: tools,
          // Audio configuration from config system
          audio: {
            input: {
              format: {
                type: 'audio/pcm',
                rate: defaultConfig.sessionConfig.audio.input.format.rate
              },
              turn_detection: {
                type: defaultConfig.sessionConfig.audio.input.turnDetection.type,
                threshold: defaultConfig.sessionConfig.audio.input.turnDetection.threshold,
                prefix_padding_ms: defaultConfig.sessionConfig.audio.input.turnDetection.prefixPaddingMs,
                silence_duration_ms: defaultConfig.sessionConfig.audio.input.turnDetection.silenceDurationMs,
                create_response: defaultConfig.sessionConfig.audio.input.turnDetection.createResponse,
                interrupt_response: defaultConfig.sessionConfig.audio.input.turnDetection.interruptResponse
              },
              transcription: {
                model: defaultConfig.sessionConfig.audio.input.transcription?.model || 'whisper-1'
              }
            },
            output: {
              format: {
                type: 'audio/pcm',
                rate: defaultConfig.sessionConfig.audio.output.format.rate
              },
              voice: defaultConfig.sessionConfig.audio.output.voice
            }
          }
        }
      }),
    });

    console.log('2Voice:', defaultConfig.sessionConfig.audio.output.voice);

    const effectiveModel = mintModel.modelId;
    const sessionResponse = await mintSession(effectiveModel);

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('OpenAI session creation failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to create OpenAI session' },
        { status: sessionResponse.status }
      );
    }

    const sessionData = await sessionResponse.json();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Task 7.0a(3): stash the assembled mint material — same convention as GET.
    stashMintDebug({
      sessionId,
      provider: 'openai',
      handler: 'POST',
      model: effectiveModel,
      reflinkId: body.reflinkId,
      instructionsText: instructions,
      marks: sectionMarks,
      tools,
    });
    // Duration cap (task 8 / Req 2.4) — same enforcement contract as GET.
    const maxSessionSeconds = defaultConfig.maxSessionSeconds || 900;
    const expiresAt = new Date(Date.now() + maxSessionSeconds * 1000).toISOString();

    await ctx.meter({
      usageType: 'voice_session_mint',
      provider: 'openai',
      costUsd: 0,
      metadata: { sessionId, model: effectiveModel, maxSessionSeconds },
    });

    const response: OpenAISessionResponse = {
      client_secret: sessionData.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: effectiveModel,
      voice: defaultConfig.sessionConfig.audio.output.voice,
      max_session_seconds: maxSessionSeconds
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Voice token mints are never public (D31 Req 2.4) - reflink or admin only.
export const GET = withAIGateway({ feature: 'voice', publicAllowed: false }, handleGET);
export const POST = withAIGateway({ feature: 'voice', publicAllowed: false }, handlePOST);
