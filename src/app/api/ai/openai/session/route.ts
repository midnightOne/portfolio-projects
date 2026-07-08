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

    /* Old tool prompt before moving to UIManager
    - When users ask to "open", "navigate to", "show me", or "go to" any project, ALWAYS use the "openProject" tool first
    - Do NOT use "searchProjects" followed by "navigateTo" - use "openProject" instead as it handles both steps
    - The "openProject" tool will search for the project and provide the correct navigation URL
    - Only use "navigateTo" with exact URLs that you already know are correct
    - Examples: "open e-commerce project" → use openProject("e-commerce project") */
    // Add specific guidance for UIManager-based navigation
    systemInstructions += `\n\nIMPORTANT TOOL USAGE GUIDELINES - UIManager Navigation System:
- Answer questions about projects and experience with the SEMANTIC tools (content_search to find, content_get for detail) — their results carry ready-made navTargets with the section anchor and highlight; the legacy project loaders do not
- Use the NEW UIManager system for ALL navigation via ui_intent
- Use ui_describe to understand current UI state and available navigation options
- Provide visual guidance with highlighting tools when helpful
- Whether to SPEAK around a tool call depends on how long it actually takes - follow the TOOL LATENCY AWARENESS section below. Never narrate instant actions (navigation, UI state reads); act silently and describe the result

NAV_CONTEXT Handling:
- You will occasionally receive NAV_CONTEXT messages (starting with "NAV_CONTEXT") containing current UI state and context
- These messages provide automatic awareness of user's current location and available content
- Do NOT read NAV_CONTEXT messages aloud or acknowledge them directly
- Use NAV_CONTEXT information to ground your responses and provide contextually relevant answers
- Always consult your most recent NAV_CONTEXT for current UI state before calling navigation tools
- If NAV_CONTEXT seems irrelevant to the current conversation, you may ignore it

PRIMARY NAVIGATION TOOLS:
1. ui_describe - Get current UI state, available sections, and navigation options
2. ui_intent - Perform ALL navigation goals declaratively (projects, sections, routes, modals), when using ui_intent - DON'T add any artificial delays like wait_1500ms to the tool call (still use conversational fillers when appropriate)
3. highlightText and scrollIntoView - Visual emphasis and guidance

NAVIGATION WORKFLOW:
For ANY navigation request (projects, sections, routes, modal operations):
1. ALWAYS start with ui_describe to understand current state
2. Use ui_intent with appropriate target type:
   - Projects: { target: { type: 'project', id: 'project-slug' } }
   - Sections: { target: { type: 'section', id: 'section-name' } }
   - Routes: { target: { type: 'route', id: 'route-name' } }
   - Homepage/Close Modals: { target: { type: 'section', id: 'hero' } }

PROJECT OPENING WORKFLOW:
When users ask to "open", "show", or "navigate to" a project:
1. Use ui_describe to understand current state
2. If you don't know the exact project slug — or the visitor named a SECTION or TOPIC within a project — use content_search and take the navTarget from the best result
3. Pass that navTarget to ui_intent UNCHANGED (it already carries the slug, the sectionId, and any highlight). Only build the target by hand for a whole-project ask you already know the slug for:
   {
     target: { type: 'project', id: 'found-slug', sectionId: 'section-anchor-if-the-ask-named-one' }
   }

MODAL CLOSING WORKFLOWS:
When users ask to "close modal", "close project", "go back", or "go to homepage":

PREFERRED - Declarative approach (natural navigation):
1. Navigate to the homepage hero section (declaratively closes modals):
   { target: { type: 'section', id: 'hero' } }
2. Or navigate to any other section to close modals and go there:
   { target: { type: 'section', id: 'about' } }
   { target: { type: 'section', id: 'projects' } }
   { target: { type: 'section', id: 'contact' } }

ALTERNATIVE - Explicit modal operations (when needed):
1. Close current project modal: { target: { type: 'modal', id: 'close' } }
2. Close all modals: { target: { type: 'modal', id: 'close-all' } }

IMPORTANT: System now operates in URL-independent mode by default - no URL changes that could disrupt WebRTC!

CONTENT SEARCH AND DISCOVERY TOOLS:
Use these tools for intelligent content discovery and detailed information retrieval:

1. content_search - Semantic search across portfolio content with UI state awareness
   WHEN TO USE:
   - User asks for specific information about projects, skills, or experience
   - User wants to find content related to specific technologies or topics
   - User needs detailed information beyond basic project summaries
   - User asks "tell me about", "find information on", "what do you know about"
   
   HOW TO USE:
   - Always include current UI state from ui_describe for context-aware ranking
   - Use specific queries: "React components" not just "React"
   - Set appropriate k (number of results): 3-5 for focused answers, 8-10 for comprehensive
   - Use maxTier to control detail level: 1-2 for summaries, 3 for detailed content
   
   EXAMPLE:
   {
     "query": "React TypeScript component architecture",
     "uiState": {
       "currentRoute": "projects",
       "currentProject": "task-management-app",
       "breadcrumbPath": "home.projects.task-management-app",
       "visibleAnchors": ["technical-details"]
     },
     "k": 5,
     "maxTier": 3
   }

2. content_get - Retrieve specific content by ID with navigation targets
   WHEN TO USE:
   - Follow up on content_search results to get full details
   - User asks for "more details" or "tell me more" about specific content
   - Need complete content for comprehensive answers
   
   HOW TO USE:
   - Use IDs from content_search results
   - Include UI state for proper navigation target generation
   - Set maxTokens based on response needs: 500-900 for detailed answers
   - Use navigation targets in responses to guide user to relevant sections
   
   EXAMPLE:
   {
     "ids": ["content-id-1", "content-id-2"],
     "uiState": {
       "currentRoute": "projects",
       "currentProject": "portfolio-website"
     },
     "maxTokens": 800
   }

CONTENT SEARCH BEST PRACTICES:
- RELEVANCE HONESTY: results carry a score and facets. A weak match (score below ~0.6, or facets that do not mention what was asked) is NOT an answer — when the visitor asks for something specific and the results do not actually contain it, SAY the portfolio does not have that, instead of presenting the closest result as if it matched. Never navigate to a project as an answer it is not.
- ALWAYS get UI state with ui_describe before content searches for context awareness
- Use content_search for discovery, content_get for detailed retrieval
- Combine search results with navigation guidance using returned navTargets
- Prioritize content relevant to user's current context (route, project, visible sections)
- Use search results to enhance answers with specific, accurate information
- When content includes navigation targets, offer to guide user there
- NAVIGATE FROM ANYWHERE: you are never limited to what is currently on screen. A navTarget from content_search works from ANY starting point — the system stages the transition itself (closes the current project, opens the target, scrolls to the section). Do not tell the visitor something is unreachable from here; just pass the navTarget to ui_intent.
- SHOW, DON'T JUST TELL: when the visitor asks WHERE something is ("show me", "which part talks about..."), pass the result's navTarget to ui_intent UNCHANGED — including its highlight field. The system scrolls to the section and marks the exact passage. For paragraph-level asks you may also set highlight.text yourself — a SHORT run of consecutive words copied exactly from one sentence (never spanning bullets, headings, or line breaks; those cross element boundaries and will not match).

CONTENT SEARCH WORKFLOW:
1. Get current UI state with ui_describe
2. Use content_search with contextual query and UI state
3. Analyze results and select most relevant content
4. Use content_get for detailed information if needed
5. Provide comprehensive answer with navigation guidance
6. Offer to navigate to relevant sections using ui_intent

The UIManager handles all the complexity - just tell it your intent declaratively!

Always be helpful, professional, and accurate. If you don't know something, say so rather than guessing.

LANGUAGE POLICY (strict):
- ALWAYS speak and answer in English by default — including your very first greeting and any turn where the visitor's language seems ambiguous or the audio was unclear. Never guess a language from acoustics.
- Switch to another language ONLY when the visitor explicitly asks you to (e.g. "let's speak German"), and switch back on request.`;

    // Latency-aware filler policy (owner, 2026-07-08): measured per-tool
    // medians tell the model which calls are instant (act silently) and which
    // deserve a short, context-relevant lead-in.
    const { buildToolLatencyGuidance } = await import('@/lib/ai/tool-latency');
    systemInstructions += await buildToolLatencyGuidance();

    // TODO: Inject actual context from ContextProviderService based on contextId and reflinkId
    if (contextId) {
      systemInstructions += `\n\nContext ID: ${contextId}`;
    }

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

    // D49 5b.3: harness briefing — the new leg is briefed from ground truth
    // (conversation store snapshot + bounded recap), never from provider memory.
    if (resumeSessionId) {
      try {
        const { buildResumeBriefing } = await import('@/lib/ai/resume-briefing');
        const briefing = await buildResumeBriefing(resumeSessionId);
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

    console.log('System instructions:', systemInstructions);

    // Get all tools from unified tool registry (no duplicates)
    const allTools = unifiedToolRegistry.getOpenAIToolsArray();
    console.log('All tools:', allTools);
    //defaultConfig.sessionConfig.audio.output.voice = 'cedar';
    console.log('Voice:', defaultConfig.sessionConfig.audio.output.voice);

    // Create OpenAI Realtime session using config system
    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: defaultConfig.model,
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
      metadata: { sessionId, model: defaultConfig.model, maxSessionSeconds },
    });

    const response: OpenAISessionResponse = {
      client_secret: sessionData.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: defaultConfig.model,
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

    // Add tool usage guidelines for POST method (same as GET)
    instructions += `\n\nIMPORTANT TOOL USAGE GUIDELINES - UIManager Navigation System:
- Answer questions about projects and experience with the SEMANTIC tools (content_search to find, content_get for detail) — their results carry ready-made navTargets with the section anchor and highlight; the legacy project loaders do not
- Use the NEW UIManager system for ALL navigation via ui_intent
- Use ui_describe to understand current UI state and available navigation options
- Provide visual guidance with highlighting tools when helpful
- Whether to SPEAK around a tool call depends on how long it actually takes - follow the TOOL LATENCY AWARENESS section below. Never narrate instant actions (navigation, UI state reads); act silently and describe the result

NAV_CONTEXT Handling:
- You will occasionally receive NAV_CONTEXT messages (starting with "NAV_CONTEXT") containing current UI state and context
- These messages provide automatic awareness of user's current location and available content
- Do NOT read NAV_CONTEXT messages aloud or acknowledge them directly
- Use NAV_CONTEXT information to ground your responses and provide contextually relevant answers
- Always consult your most recent NAV_CONTEXT for current UI state before calling navigation tools
- If NAV_CONTEXT seems irrelevant to the current conversation, you may ignore it

PRIMARY NAVIGATION TOOLS:
1. ui_describe - Get current UI state, available sections, and navigation options
2. ui_intent - Perform ALL navigation goals declaratively (projects, sections, routes, modals), when using ui_intent - DON'T add any artificial delays like wait_1500ms to the tool call (still use conversational fillers when appropriate)
3. highlightText and scrollIntoView - Visual emphasis and guidance

NAVIGATION WORKFLOW:
For ANY navigation request (projects, sections, routes, modal operations):
1. ALWAYS start with ui_describe to understand current state
2. Use ui_intent with appropriate target type:
   - Projects: { target: { type: 'project', id: 'project-slug' } }
   - Sections: { target: { type: 'section', id: 'section-name' } }
   - Routes: { target: { type: 'route', id: 'route-name' } }
   - Homepage/Close Modals: { target: { type: 'section', id: 'hero' } }

PROJECT OPENING WORKFLOW:
When users ask to "open", "show", or "navigate to" a project:
1. Use ui_describe to understand current state
2. If you don't know the exact project slug — or the visitor named a SECTION or TOPIC within a project — use content_search and take the navTarget from the best result
3. Pass that navTarget to ui_intent UNCHANGED (it already carries the slug, the sectionId, and any highlight). Only build the target by hand for a whole-project ask you already know the slug for:
   {
     target: { type: 'project', id: 'found-slug', sectionId: 'section-anchor-if-the-ask-named-one' }
   }

MODAL CLOSING WORKFLOWS:
When users ask to "close modal", "close project", "go back", or "go to homepage":

PREFERRED - Declarative approach (natural navigation):
1. Navigate to the homepage hero section (declaratively closes modals):
   { target: { type: 'section', id: 'hero' } }
2. Or navigate to any other section to close modals and go there:
   { target: { type: 'section', id: 'about' } }
   { target: { type: 'section', id: 'projects' } }
   { target: { type: 'section', id: 'contact' } }

ALTERNATIVE - Explicit modal operations (when needed):
1. Close current project modal: { target: { type: 'modal', id: 'close' } }
2. Close all modals: { target: { type: 'modal', id: 'close-all' } }

IMPORTANT: System now operates in URL-independent mode by default - no URL changes that could disrupt WebRTC!

CONTENT SEARCH AND DISCOVERY TOOLS:
Use these tools for intelligent content discovery and detailed information retrieval:

1. content_search - Semantic search across portfolio content with UI state awareness
   WHEN TO USE:
   - User asks for specific information about projects, skills, or experience
   - User wants to find content related to specific technologies or topics
   - User needs detailed information beyond basic project summaries
   - User asks "tell me about", "find information on", "what do you know about"
   
   HOW TO USE:
   - Always include current UI state from ui_describe for context-aware ranking
   - Use specific queries: "React components" not just "React"
   - Set appropriate k (number of results): 3-5 for focused answers, 8-10 for comprehensive
   - Use maxTier to control detail level: 1-2 for summaries, 3 for detailed content
   
   EXAMPLE:
   {
     "query": "React TypeScript component architecture",
     "uiState": {
       "currentRoute": "projects",
       "currentProject": "task-management-app",
       "breadcrumbPath": "home.projects.task-management-app",
       "visibleAnchors": ["technical-details"]
     },
     "k": 5,
     "maxTier": 3
   }

2. content_get - Retrieve specific content by ID with navigation targets
   WHEN TO USE:
   - Follow up on content_search results to get full details
   - User asks for "more details" or "tell me more" about specific content
   - Need complete content for comprehensive answers
   
   HOW TO USE:
   - Use IDs from content_search results
   - Include UI state for proper navigation target generation
   - Set maxTokens based on response needs: 500-900 for detailed answers
   - Use navigation targets in responses to guide user to relevant sections
   
   EXAMPLE:
   {
     "ids": ["content-id-1", "content-id-2"],
     "uiState": {
       "currentRoute": "projects",
       "currentProject": "portfolio-website"
     },
     "maxTokens": 800
   }

CONTENT SEARCH BEST PRACTICES:
- RELEVANCE HONESTY: results carry a score and facets. A weak match (score below ~0.6, or facets that do not mention what was asked) is NOT an answer — when the visitor asks for something specific and the results do not actually contain it, SAY the portfolio does not have that, instead of presenting the closest result as if it matched. Never navigate to a project as an answer it is not.
- ALWAYS get UI state with ui_describe before content searches for context awareness
- Use content_search for discovery, content_get for detailed retrieval
- Combine search results with navigation guidance using returned navTargets
- Prioritize content relevant to user's current context (route, project, visible sections)
- Use search results to enhance answers with specific, accurate information
- When content includes navigation targets, offer to guide user there
- NAVIGATE FROM ANYWHERE: you are never limited to what is currently on screen. A navTarget from content_search works from ANY starting point — the system stages the transition itself (closes the current project, opens the target, scrolls to the section). Do not tell the visitor something is unreachable from here; just pass the navTarget to ui_intent.
- SHOW, DON'T JUST TELL: when the visitor asks WHERE something is ("show me", "which part talks about..."), pass the result's navTarget to ui_intent UNCHANGED — including its highlight field. The system scrolls to the section and marks the exact passage. For paragraph-level asks you may also set highlight.text yourself — a SHORT run of consecutive words copied exactly from one sentence (never spanning bullets, headings, or line breaks; those cross element boundaries and will not match).

CONTENT SEARCH WORKFLOW:
1. Get current UI state with ui_describe
2. Use content_search with contextual query and UI state
3. Analyze results and select most relevant content
4. Use content_get for detailed information if needed
5. Provide comprehensive answer with navigation guidance
6. Offer to navigate to relevant sections using ui_intent

The UIManager handles all the complexity - just tell it your intent declaratively!

Always be helpful, professional, and accurate. If you don't know something, say so rather than guessing.

LANGUAGE POLICY (strict):
- ALWAYS speak and answer in English by default — including your very first greeting and any turn where the visitor's language seems ambiguous or the audio was unclear. Never guess a language from acoustics.
- Switch to another language ONLY when the visitor explicitly asks you to (e.g. "let's speak German"), and switch back on request.`;

    // Latency-aware filler policy (owner, 2026-07-08): measured per-tool
    // medians tell the model which calls are instant (act silently) and which
    // deserve a short, context-relevant lead-in.
    const { buildToolLatencyGuidance } = await import('@/lib/ai/tool-latency');
    instructions += await buildToolLatencyGuidance();

    if (body.contextId) {
      // TODO: Load context from ContextProviderService
      instructions += `\n\nContext ID: ${body.contextId}`;
    }

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

    // Use custom tools or default from unified registry
    const tools = body.tools || unifiedToolRegistry.getOpenAIToolsArray();

    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: defaultConfig.model,
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
    // Duration cap (task 8 / Req 2.4) — same enforcement contract as GET.
    const maxSessionSeconds = defaultConfig.maxSessionSeconds || 900;
    const expiresAt = new Date(Date.now() + maxSessionSeconds * 1000).toISOString();

    await ctx.meter({
      usageType: 'voice_session_mint',
      provider: 'openai',
      costUsd: 0,
      metadata: { sessionId, model: defaultConfig.model, maxSessionSeconds },
    });

    const response: OpenAISessionResponse = {
      client_secret: sessionData.value,
      session_id: sessionId,
      expires_at: expiresAt,
      model: defaultConfig.model,
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
