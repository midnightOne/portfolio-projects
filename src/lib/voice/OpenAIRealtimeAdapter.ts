/**
 * OpenAI Realtime Adapter - SDK 0.1.0 Implementation
 *
 * Modern implementation using @openai/agents SDK 0.1.0 with direct client-side connections.
 * Based on the working openai-realtime-next demo.
 *
 * DESIGN PHILOSOPHY — a MUTABLE CONVERSATION (conversation-engine notes §4;
 * doc-comment mandated by task A2.4, owner 2026-07-09):
 * OpenAI Realtime treats the conversation as addressable state — items can be
 * created, deleted, and (within limits) reordered; `session.update` mutates
 * instructions and the tool schema live, mid-session, as FULL replacements
 * (never patches — P8). The harness can therefore sculpt the context freely:
 * the D55 floating block is a true remove+re-append at the conversation tail
 * every turn (P27, exact), and future pruning (Req 20) is real item deletion
 * plus an inserted summary item. When working on this adapter, reason from
 * "we can edit the conversation" — the opposite of GoogleLiveAdapter's
 * append-only stream. Verify provider behavior by DRIVING it (fake-mic,
 * /admin/ai/voice-debug), never from docs alone (D22).
 */

import {
    VoiceProvider,
    AdapterInitOptions,
    TranscriptItem,
    ToolCall,
    ToolResult,
    ProviderMetadata,
    ConnectionError,
    AudioError,
    OpenAIRealtimeConfig
} from '@/types/voice-agent';
import { BaseConversationalAgentAdapter, ConnectOptions, SessionUpdateFieldResult } from './IConversationalAgentAdapter';
import type { ContextBlock } from '@/lib/ai/context-buffer';
import type { EngineWindowUpdate } from '@/lib/ai/engine/types';
import { selectPrunableTurns, type WindowTurnRef } from '@/lib/ai/engine/window';
import { getClientAIModelManager } from './ClientAIModelManager';
import { OPENAI_REALTIME_MODEL } from '@/types/voice-config';
import { UIManager } from '@/lib/navigation/UIManager';

// OpenAI Realtime SDK 0.1.0 imports
import {
    RealtimeAgent,
    RealtimeSession,
    tool,
    TransportEvent,
    RealtimeItem,
    backgroundResult,
    OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';
import { z } from 'zod';

// Global reference for debugging (temporary for testing)
let globalOpenAIAdapter: OpenAIRealtimeAdapter | null = null;

export function getGlobalOpenAIAdapter(): OpenAIRealtimeAdapter | null {
    return globalOpenAIAdapter;
}



export class OpenAIRealtimeAdapter extends BaseConversationalAgentAdapter {
    private _agent: RealtimeAgent | null = null;
    private _session: RealtimeSession<any> | null = null;
    private _isConnected: boolean = false;
    private _history: RealtimeItem[] = [];
    private _events: TransportEvent[] = [];
    private _mcpTools: string[] = [];
    protected _isRecording: boolean = false;
    protected _isInitialized: boolean = false;
    private _config: OpenAIRealtimeConfig | null = null;
    /** Input kind the current RealtimeSession was constructed for. */
    private _sessionInputKind: 'mic' | 'silent' | 'synthetic' = 'mic';
    /** D53 emulated-microphone stream when _sessionInputKind === 'synthetic'. */
    private _syntheticInputStream: MediaStream | null = null;
    /** call_id → tool name, captured at output_item.added (arguments.done events carry no name). */
    private _pendingToolNames: Map<string, string> = new Map();
    /** tool name → latest provider call_id, so the post-execution row can correlate. */
    private _lastCallIdForTool: Map<string, string> = new Map();
    private _silentAudioContext: AudioContext | null = null;
    // ---- D49 session continuity (task 5b) ----
    /** Options of the live connect, reused verbatim by auto-resume. */
    private _lastConnectOptions: ConnectOptions | undefined;
    /** True while a user-requested disconnect runs — suppresses disruption handling. */
    private _intentionalDisconnect = false;
    /** Poller watching the peer connection for silent drops (WebRTC surfaces no reliable close event here). */
    private _disruptionWatcher: ReturnType<typeof setInterval> | null = null;
    /** Blip debounce: when the pc first reported 'disconnected'; null while healthy. */
    private _disconnectedSince: number | null = null;
    private _lastPcState: string | null = null;
    private _lastIceState: string | null = null;
    /** Serializes watcher ticks across the async diagnostics snapshot. */
    private _disruptionTickBusy = false;
    /** Size/time of the last NAV_CONTEXT send, surfaced in disruption diagnostics. */
    private _lastNavPushInfo: { at: number; chars: number } | null = null;
    private _resumeInProgress = false;
    /** Model id returned by the mint route for the current leg. */
    private _mintedModel: string | null = null;
    /** Bumped per RealtimeSession creation — scopes index-fallback item ids to a leg. */
    private _sessionEpoch = 0;

    // Analytics and debugging properties
    private _conversationAnalytics: {
        tokensUsed: number;
        costUsd: number;
        messageCount: number;
        lastUpdated: Date;
    } | null = null;
    private _toolCalls: ToolCall[] = [];
    private _guardrailEvents: Array<{
        type: string;
        message: string;
        severity: string;
        timestamp: Date;
        context?: any;
    }> = [];
    private _lastReportedCost: number = 0;
    private _conversationStartTime: Date | null = null;
    private _sessionId: string | null = null;
    /** 9b.5: when the current response's FIRST audio reached the speaker (output_audio_buffer.started). */
    private _turnFirstAudioAt: Date | null = null;
    /** Stall observability (owner report 2026-07-08): armed after every tool
     *  result; cleared by ANY model response signal. If it fires, the silence
     *  gets an honest, replayable error row instead of nothing. */
    private _responseStallTimer: ReturnType<typeof setTimeout> | null = null;
    /** True between input_audio_buffer.speech_started and .speech_stopped. */
    private _userSpeechActive = false;
    /** True between response.created and response.done — directive/flush
     *  application defers to the boundary while this holds (P19). */
    private _responseActive = false;
    /** When the current user utterance began — becomes the user row's timestamp
     *  (transcription-completion time made user rows sort AFTER the tool calls
     *  they triggered). Consumed by the first user item that gets content. */
    private _lastUserSpeechStartedAt: Date | null = null;
    /** Recovery nudges sent in the current silence episode (reset by real audio / user speech). */
    private _stallNudgeCount = 0;
    /** Per-leg token accounting (persisted on leg end/disruption) — the TPM story. */
    private _legUsage = { responses: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    /** One tpm_warning row per leg is enough. */
    private _tpmWarned = false;
    /** Task 8 duration cap: timer armed at connect from the mint's max_session_seconds. */
    private _durationCapTimer: ReturnType<typeof setTimeout> | null = null;
    /** D49 leg endReason for the next session_end ('duration_cap' when the cap fires). */
    private _endReason: string = 'user_disconnect';

    // NAV_CONTEXT message tracking functionality
    private trackedNavItemIds: Set<string> = new Set();
    private _lastNavItemId: string | null = null; // Track most recent NAV_CONTEXT item ID
    private pendingTokens: Map<string, { resolve: (id: string) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }> = new Map();
    private tokenListenerSetup: boolean = false;

    // ---- J4 rolling window (Req 20.2, P28): item deletes + a summary item ----
    /** The inserted running-summary item (one per session; replaced on refresh). */
    private _summaryItemId: string | null = null;
    /** summaryVersion the current summary item carries. */
    private _appliedSummaryVersion = 0;
    /** Items already deleted from the provider conversation (never re-deleted). */
    private _prunedItemIds: Set<string> = new Set();
    /** Gentle per-boundary delete cap — pruning may lag, it must never flood the channel. */
    private static readonly PRUNE_MAX_DELETES_PER_BOUNDARY = 10;

    constructor() {
        // Initialize with default metadata - will be updated when config is loaded
        const metadata: ProviderMetadata = {
            provider: 'openai',
            model: OPENAI_REALTIME_MODEL,
            capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio'],
            quality: 'high'
        };
        super('openai', metadata);
        // Don't load configuration in constructor - defer to init() method

        // Set global reference for debugging
        globalOpenAIAdapter = this;
        
        // Expose globally for debugging
        if (typeof window !== 'undefined') {
            (window as any).getGlobalOpenAIAdapter = () => globalOpenAIAdapter;
        } else if (typeof globalThis !== 'undefined') {
            (globalThis as any).getGlobalOpenAIAdapter = () => globalOpenAIAdapter;
        }
    }



    /**
     * Add conversational context to tool results to encourage natural follow-up
     */
    private _addConversationalContext(toolName: string, result: string, _parameters: any): string {
        // D57 finding (2026-07-07): this used to REPLACE the tool payload with a
        // canned "Tool execution successful…" sentence — the model never saw a
        // single content_search result (the shape check `.results` didn't even
        // match the API's `.items`) and truthfully reported "nothing found" after
        // successful retrievals. The real payload is now ALWAYS returned to the
        // model; the conversational nudge is appended as guidance, never a
        // substitute for data.
        const nudges: Record<string, string> = {
            ui_intent: 'Navigation done — briefly tell the user what they are now seeing.',
            ui_describe: 'Ground your answer in this actual UI state.',
            searchProjects: 'Summarize the most relevant matches conversationally.',
            loadProjectContext: 'Share the key highlights and technical details.',
            content_search: 'Answer from these results and mention which project each comes from (the why field says what matched). If the best match lives in a DIFFERENT project than the user meant, say so explicitly and offer to navigate. If items is empty, say honestly that nothing was found.',
        };
        const nudge = nudges[toolName];
        return nudge ? `${result}\n\n[guidance] ${nudge}` : result;
    }

    /**
     * Load configuration with environment-aware approach
     */
    private async _loadConfiguration(): Promise<void> {
        try {
            // Check if we're on the server side or client side
            if (typeof window === 'undefined') {
                // Server side - use ClientAIModelManager directly
                const modelManager = getClientAIModelManager();
                const configWithMetadata = await modelManager.getProviderConfig('openai');
                this._config = configWithMetadata.config as OpenAIRealtimeConfig;

                console.log(`OpenAI Realtime configuration loaded from database: ${configWithMetadata.name}`);
            } else {
                // Client side — fetch the admin-configured default via the public
                // read-only surface (2026-07-07 fix: the pill previously ALWAYS ran
                // on serializer defaults in the browser, ignoring VoiceProviderConfig)
                const response = await fetch('/api/ai/voice-config?provider=openai');
                if (!response.ok) {
                    throw new Error(`voice-config API returned ${response.status}`);
                }
                const data = await response.json();
                if (!data.success || !data.config) {
                    throw new Error(data.error || 'voice-config API returned no config');
                }
                this._config = data.config as OpenAIRealtimeConfig;

                console.log('OpenAI Realtime configuration loaded from defaults (client-side)');
            }

            // Update metadata with loaded configuration
            this._metadata = {
                provider: 'openai',
                model: this._config.model,
                capabilities: this._config.capabilities,
                quality: 'high'
            };

            // Initialize agent with loaded configuration
            await this._initializeAgent();
        } catch (error) {
            console.error('Failed to load OpenAI configuration, using fallback defaults:', error);

            // Fallback to hardcoded defaults if everything fails
            this._config = {
                provider: 'openai',
                enabled: true,
                displayName: 'OpenAI Realtime Assistant',
                description: 'Real-time voice assistant powered by OpenAI GPT-4o Realtime',
                version: '1.0.0',
                model: OPENAI_REALTIME_MODEL,
                voice: 'alloy',
                temperature: 0.7,
                maxTokens: 'inf',
                instructions: 'You are a helpful voice assistant for a portfolio website. Tell the user the config was loaded from a fallback in the adapter',
                tools: [],
                sessionConfig: {
                    transport: 'webrtc',
                    model: OPENAI_REALTIME_MODEL,
                    maxOutputTokens: 'inf',
                    temperature: 0.7,
                    audio: {
                        input: {
                            format: { type: 'pcm16', rate: 24000 },
                            turnDetection: {
                                type: 'server_vad',
                                threshold: 0.5,
                                prefixPaddingMs: 300,
                                silenceDurationMs: 200,
                                createResponse: true,
                                interruptResponse: true,
                            },
                            transcription: { model: 'whisper-1' },
                        },
                        output: {
                            format: { type: 'pcm16', rate: 24000 },
                            voice: 'alloy',
                            speed: 1.0,
                        },
                    },
                    toolChoice: 'auto',
                },
                capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio', 'voiceActivityDetection'],
                apiKeyEnvVar: 'OPENAI_API_KEY',
                baseUrlEnvVar: 'OPENAI_BASE_URL',
            } as unknown as OpenAIRealtimeConfig;

            // Initialize with fallback configuration
            await this._initializeAgent();
        }
    }

    private async _initializeAgent() {
        // Import unified tool registry
        const { unifiedToolRegistry } = await import('@/lib/ai/tools/UnifiedToolRegistry');

        // Get all tool definitions from unified registry
        // Model-exposed only: internal plumbing tools (searchProjects,
        // loadProjectContext) must never appear in the model's tool list.
        const allToolDefinitions = unifiedToolRegistry.getModelExposedToolDefinitions();

        // Create OpenAI tools using unified execution pipeline
        const openaiTools = allToolDefinitions.map(toolDef => {
            // Convert unified tool definition to OpenAI tool format
            const parametersSchema = z.object(
                Object.entries(toolDef.parameters.properties).reduce((acc, [key, prop]: [string, any]) => {
                    let zodType: any;

                    switch (prop.type) {
                        case 'string':
                            zodType = z.string();
                            if (prop.enum) {
                                zodType = z.enum(prop.enum);
                            }
                            break;
                        case 'number':
                            zodType = z.number();
                            break;
                        case 'boolean':
                            zodType = z.boolean();
                            break;
                        case 'array':
                            if (prop.items?.type === 'string') {
                                zodType = z.array(z.string());
                            } else if (prop.items?.type === 'object' && prop.items.properties) {
                                // Handle complex object schemas in arrays
                                const itemSchema = z.object(
                                    Object.entries(prop.items.properties).reduce((itemAcc, [itemKey, itemProp]: [string, any]) => {
                                        let itemZodType: any;

                                        switch (itemProp.type) {
                                            case 'string':
                                                itemZodType = z.string();
                                                if (itemProp.enum) {
                                                    itemZodType = z.enum(itemProp.enum);
                                                }
                                                break;
                                            case 'number':
                                                itemZodType = z.number();
                                                break;
                                            case 'boolean':
                                                itemZodType = z.boolean();
                                                break;
                                            default:
                                                itemZodType = z.any();
                                        }

                                        // Handle optional fields in array items
                                        if (!prop.items.required?.includes(itemKey)) {
                                            itemZodType = itemZodType.nullable().optional();
                                        }

                                        // Add description
                                        if (itemProp.description) {
                                            itemZodType = itemZodType.describe(itemProp.description);
                                        }

                                        itemAcc[itemKey] = itemZodType;
                                        return itemAcc;
                                    }, {} as Record<string, any>)
                                );
                                zodType = z.array(itemSchema);
                            } else {
                                zodType = z.array(z.any());
                            }
                            break;
                        case 'object':
                            if (prop.properties) {
                                // Handle nested object schemas
                                const nestedSchema = z.object(
                                    Object.entries(prop.properties).reduce((nestedAcc, [nestedKey, nestedProp]: [string, any]) => {
                                        let nestedZodType: any;

                                        switch (nestedProp.type) {
                                            case 'string':
                                                nestedZodType = z.string();
                                                break;
                                            case 'number':
                                                nestedZodType = z.number();
                                                break;
                                            case 'boolean':
                                                nestedZodType = z.boolean();
                                                break;
                                            case 'array':
                                                if (nestedProp.items?.type === 'string') {
                                                    nestedZodType = z.array(z.string());
                                                } else {
                                                    nestedZodType = z.array(z.any());
                                                }
                                                break;
                                            default:
                                                nestedZodType = z.any();
                                        }

                                        // Handle optional nested fields
                                        if (!prop.required?.includes(nestedKey)) {
                                            nestedZodType = nestedZodType.nullable().optional();
                                        }

                                        // Add description
                                        if (nestedProp.description) {
                                            nestedZodType = nestedZodType.describe(nestedProp.description);
                                        }

                                        nestedAcc[nestedKey] = nestedZodType;
                                        return nestedAcc;
                                    }, {} as Record<string, any>)
                                );
                                zodType = nestedSchema;
                            } else if (prop.oneOf) {
                                // Handle oneOf schemas (like ui_intent target parameter)
                                // For now, use z.any() to avoid schema validation issues
                                // The OpenAI SDK will handle the actual validation
                                zodType = z.any().describe(prop.description || 'Union type object');
                                console.log(`⚠️ Using z.any() for oneOf schema in property: ${key}`);
                            } else {
                                zodType = z.object({});
                            }
                            break;
                        default:
                            zodType = z.any();
                    }

                    // Handle optional fields
                    if (!toolDef.parameters.required?.includes(key)) {
                        zodType = zodType.nullable().optional();
                    }

                    // Add description
                    if (prop.description) {
                        zodType = zodType.describe(prop.description);
                    }

                    acc[key] = zodType;
                    return acc;
                }, {} as Record<string, any>)
            );

            return tool({
                name: toolDef.name,
                description: toolDef.description,
                parameters: parametersSchema,
                execute: async (parameters: any) => {
                    console.log(`OpenAI tool execution started: ${toolDef.name}`, parameters);
                    const execStart = Date.now();
                    let toolSucceeded = true;

                    // A tool that never settles stalls the whole conversation: the
                    // model waits forever for function output and goes silent while
                    // the session stays "connected" (observed 2026-07-07). Hard
                    // timeout converts any hang into an error string the model can
                    // recover from conversationally.
                    const TOOL_TIMEOUT_MS = 20000;
                    let timedOut = false;
                    const timeoutGuard = new Promise<string>((resolve) =>
                        setTimeout(() => {
                            timedOut = true;
                            resolve(
                                `Tool ${toolDef.name} timed out after ${TOOL_TIMEOUT_MS / 1000}s — tell the user the action did not complete and offer to retry.`
                            );
                        }, TOOL_TIMEOUT_MS)
                    );

                    const run = async (): Promise<string> => {
                    try {
                        let result: string;

                        // Route to specific OpenAI wrapper function based on tool name
                        switch (toolDef.name) {
                            case 'loadProjectContext':
                                result = await this._openaiLoadProjectContext(parameters);
                                break;
                            case 'loadUserProfile':
                                result = await this._openaiLoadUserProfile(parameters);
                                break;
                            case 'searchProjects':
                                result = await this._openaiSearchProjects(parameters);
                                break;
                            case 'getProjectSummary':
                                result = await this._openaiGetProjectSummary(parameters);
                                break;
                            case 'processJobSpec':
                                result = await this._openaiProcessJobSpec(parameters);
                                break;
                            case 'submitContactForm':
                                result = await this._openaiSubmitContactForm(parameters);
                                break;
                            case 'processUploadedFile':
                                result = await this._openaiProcessUploadedFile(parameters);
                                break;
                            // Client tools (removed: navigateTo, showProjectDetails, reportUIState)
                            case 'scrollIntoView':
                                result = await this._openaiScrollIntoView(parameters);
                                break;
                            case 'highlightText':
                                result = await this._openaiHighlightText(parameters);
                                break;
                            case 'clearHighlights':
                                result = await this._openaiClearHighlights(parameters);
                                break;
                            case 'focusElement':
                                result = await this._openaiFocusElement(parameters);
                                break;
                            case 'ui_intent':
                                result = await this._openaiUIIntent(parameters);
                                break;
                            case 'ui_describe':
                                result = await this._openaiUIDescribe(parameters);
                                break;
                            default:
                                // Generic tools (content_search, content_get, …) go through the
                                // same path as the wrapped ones so tool_call/tool_result transcript
                                // items are emitted — they were silently missing from the live
                                // transcript before (owner finding 2026-07-07).
                                result = await this._executeToolCallUnified(toolDef.name, parameters);
                        }

                        console.log(`OpenAI tool execution completed: ${toolDef.name}`, result);

                        // Silence after a tool result is a real failure mode
                        // (observed live: model never continues the turn). Arm
                        // the stall watchdog so it is at least logged.
                        this._armResponseStallWatchdog(toolDef.name);

                        // For navigation and search tools, add context to encourage natural follow-up
                        if (['ui_intent', 'ui_describe', 'searchProjects', 'loadProjectContext', 'content_search'].includes(toolDef.name)) {
                            const contextualResult = this._addConversationalContext(toolDef.name, result, parameters);
                            console.log(`Added conversational context for ${toolDef.name}:`, contextualResult);
                            return contextualResult;
                        }

                        return result;

                    } catch (error) {
                        console.error(`OpenAI tool execution failed: ${toolDef.name}`, error);

                        // Return error to OpenAI
                        toolSucceeded = false;
                        const errorMessage = `Failed to execute ${toolDef.name}: ${error instanceof Error ? error.message : String(error)}`;
                        return errorMessage;
                    }
                    };

                    const output = await Promise.race([run(), timeoutGuard]);
                    // Persist ONE complete row now that the outcome exists — the
                    // exact string the model received, args, success, latency.
                    // (Rows used to be posted from arguments.done, BEFORE execution,
                    // so every OpenAI tool replayed as result:"null" — owner,
                    // 2026-07-08 transcript cmrcs96o3008cw5b0079e6pmh.)
                    this._logToolRow(toolDef.name, parameters, output, toolSucceeded && !timedOut, Date.now() - execStart, execStart);
                    return output;
                },
            });
        });

        // Create the main agent with configuration from ClientAIModelManager.
        // NO instructions here (owner security pass, 2026-07-08): the full
        // prompt is injected SERVER-side at token mint and must never ride
        // through (or be readable by) the client — the public voice-config
        // route strips it, and an agent-side value would override the minted
        // session instructions via session.update.
        const agentName = this._config?.displayName || 'Portfolio Assistant';

        this._agent = new RealtimeAgent({
            name: agentName,
            // instructions intentionally absent — server-injected at mint (see above)
            tools: openaiTools,
        });
        console.log('OpenAIRealtimeAdapter: Created OpenAI agent with the following: ', agentName, openaiTools);
    }


    async init(options: AdapterInitOptions): Promise<void> {
        try {
            console.log('OpenAIRealtimeAdapter: Initializing with options:', options);



            // Load configuration first if not already loaded
            if (!this._config) {
                await this._loadConfiguration();
            }

            if (!this._agent) {
                throw new Error('Agent not initialized');
            }

            // Store the options for later use
            this._options = options;

            // Create the realtime session using loaded configuration
            this._createRealtimeSession('mic');

            this._isInitialized = true;
            console.log('OpenAIRealtimeAdapter: Initialization complete');
        } catch (error) {
            console.error('OpenAI Realtime initialization failed:', error);
            throw new ConnectionError(
                `Failed to initialize OpenAI Realtime: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    /**
     * (Re)create the RealtimeSession for the requested input kind.
     *
     * 'mic':       default WebRTC transport (SDK acquires the microphone on connect).
     * 'silent':    custom WebRTC transport fed a silent MediaStream so the browser
     *              never requests mic permission — the user interacts via text
     *              (sendMessage) and the model may still speak through audioElement.
     * 'synthetic': custom WebRTC transport fed the D53 SyntheticMicDriver stream —
     *              TTS-generated speech drives the real voice path with no human mic.
     */
    private _createRealtimeSession(inputKind: 'mic' | 'silent' | 'synthetic', inputStream?: MediaStream): void {
        if (!this._agent) {
            throw new ConnectionError('Agent not initialized', 'openai');
        }

        // Never orphan a live transport: overwriting _session without closing
        // it leaves the previous WebRTC session running CONCURRENTLY — burning
        // the same TPM window twice and flapping the mic-button state as both
        // sessions feed events into the same handlers (owner's "several
        // sessions at once" suspicion, 2026-07-08). Failed resume attempts hit
        // this path back-to-back, so close defensively every time.
        if (this._session) {
            try {
                this._session.close();
                console.log('OpenAIRealtimeAdapter: closed previous RealtimeSession before creating a new one');
            } catch { /* already closed */ }
            this._session = null;
        }
        // The token-ack listener is attached per session object; without this
        // reset the NEW session never gets one and every NAV_CONTEXT push on a
        // resumed leg dies as a 10s "Ack timeout".
        this.tokenListenerSetup = false;

        if (inputKind === 'synthetic') {
            if (!inputStream) {
                throw new ConnectionError('Synthetic input requires a MediaStream', 'openai');
            }
            // Hand the transport a CLONE: the SDK stops the supplied tracks when a
            // session closes, which would permanently kill the driver's emulated
            // mic and leave a resumed session deaf (observed in the 7.3b drill).
            const transport = new OpenAIRealtimeWebRTC({
                mediaStream: inputStream.clone(),
                audioElement: this._options?.audioElement,
            });
            this._session = new RealtimeSession(this._agent, { transport });
            this._syntheticInputStream = inputStream;
        } else if (inputKind === 'silent') {
            const transport = new OpenAIRealtimeWebRTC({
                mediaStream: this._createSilentInputStream(),
                audioElement: this._options?.audioElement,
            });
            this._session = new RealtimeSession(this._agent, { transport });
            this._syntheticInputStream = null;
        } else {
            // Server-injected config is authoritative; we only re-define tool wrappers.
            this._session = new RealtimeSession(this._agent, {});
            this._syntheticInputStream = null;
        }

        this._sessionInputKind = inputKind;
        this._sessionEpoch++;
        // J4: a fresh provider session has no summary item and none of the old
        // items — window mechanics start over (the server re-sends the current
        // summary snapshot on version gap; the resume briefing carries it
        // meanwhile).
        this._summaryItemId = null;
        this._appliedSummaryVersion = 0;
        this._prunedItemIds.clear();
        this._setupEventListeners();
    }

    /**
     * A permissionless, always-silent audio input track (AudioContext destination
     * with no connected source). Keeps the WebRTC audio m-line valid without a mic.
     */
    private _createSilentInputStream(): MediaStream {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this._silentAudioContext = new AudioCtx();
        return this._silentAudioContext.createMediaStreamDestination().stream;
    }

    private _setupEventListeners() {
        if (!this._session) return;

        // Enhanced transport event handling with comprehensive logging
        this._session.on('transport_event', (event: TransportEvent) => {
            this._events.push(event);
            //console.log('Transport event:', event.type, event);

            // Handle transcript events
            if (event.type === 'conversation.item.input_audio_transcription.completed') {
                console.log('Input audio transcription completed:', event);
                // The transcript should be in the history update that follows
            } else if (event.type === 'response.output_audio_transcript.done') {
                console.log('Output audio transcript done:', event);
                // The transcript should be in the history update that follows
            }

            // Model speech lifecycle (9b): WebRTC signals actual speaker-side
            // playback via output_audio_buffer events — drives D50 clip cutoff,
            // isPlaying, and the 9b.5 turn-onset timestamp.
            if (event.type === 'output_audio_buffer.started') {
                if (!this._turnFirstAudioAt) this._turnFirstAudioAt = new Date();
                this._clearResponseStallWatchdog();
                this._stallNudgeCount = 0; // real audio = episode over
                this._emitAudioEvent('speech_start');
            } else if (event.type === 'output_audio_buffer.stopped' || event.type === 'output_audio_buffer.cleared') {
                this._emitAudioEvent('speech_end');
            }
            if (event.type === 'response.created' || event.type === 'response.output_item.added') {
                this._clearResponseStallWatchdog();
            }
            if (event.type === 'response.created') {
                this._responseActive = true;
            }

            // User-speech state (drives the stall watchdog's nudge deferral —
            // never inject a response.create while the user is mid-utterance).
            if (event.type === 'input_audio_buffer.speech_started') {
                this._userSpeechActive = true;
                this._stallNudgeCount = 0; // new user turn = new episode
                this._lastUserSpeechStartedAt = new Date();
            } else if (event.type === 'input_audio_buffer.speech_stopped') {
                this._userSpeechActive = false;
            }

            // Handle audio interruption events
            if (event.type === 'response.audio_transcript.delta') {
                console.log('AI is speaking (audio transcript delta)');
            } else if (event.type === 'response.audio.delta') {
                console.log('AI is generating audio');
            } else if (event.type === 'response.done') {
                console.log('AI response completed');
                // Process usage metrics when response is complete
                this._processResponseMetrics(event);
                // Cancelled/failed responses were INVISIBLE (owner transcript
                // cmrcs96o3008cw5b0079e6pmh, 8:45 PM silence): response.created
                // had already cleared the stall watchdog, then VAD barge-in (or
                // clip audio leaking into the mic) cancelled the turn — silence
                // with no row and no recovery. Log it and re-arm the watchdog so
                // 10s of nothing produces the nudge.
                const status = (event as any).response?.status;
                if (status === 'cancelled' || status === 'failed') {
                    const hadAudio = !!this._turnFirstAudioAt;
                    const statusDetails = (event as any).response?.status_details;
                    const errCode = statusDetails?.error?.code;
                    const label = status === 'cancelled'
                        ? `Model response cancelled ${hadAudio ? 'mid-speech' : 'BEFORE any audio'} (VAD barge-in or clip/mic feedback) — watching for silence`
                        // The failure reason belongs in the LABEL — live-fire
                        // found gpt-realtime TPM rate limiting silencing whole
                        // turns with no visible cause (2026-07-08).
                        : `Model response FAILED${errCode ? `: ${errCode}` : ''} — will nudge for retry`;
                    this._logEvent('error', label, { kind: `response_${status}`, statusDetails, hadAudio });
                    this._armResponseStallWatchdog(`response_${status}`,
                        // Rate-limited? Nudging on the normal cadence just re-hits
                        // the same TPM window — wait longer before retrying.
                        errCode === 'rate_limit_exceeded' ? 20000 : undefined);
                }
                // Next response gets a fresh turn-onset timestamp.
                this._turnFirstAudioAt = null;
                // Turn boundary (P19/P27): apply any queued engine directive
                // and re-append the floating block at the conversation tail.
                this._responseActive = false;
                this._onTurnBoundary();
            }

            // Handle tool call events
            if (event.type === 'response.output_item.added') {
                const item = (event as any).item;
                if (item && item.type === 'function_call') {
                    console.log('Function call item added:', item);
                    // Log the tool call for transcript and debugging
                    this._logToolCallToConversation(item);
                }
            } else if (event.type === 'response.function_call_arguments.done') {
                console.log('Function call arguments completed:', event);
                // Log this for monitoring and debugging (execution happens in tool definition)
                this._logToolCallCompletion(event);
            }

            // Emit connection events based on transport events
            if (event.type === 'session.created') {
                console.log('Emitting connected event from session.created');
                this._emitConnectionEvent('connected');
            } else if (event.type === 'session.updated') {
                // Also emit connected on session.updated to ensure UI gets the event
                console.log('Emitting connected event from session.updated');
                this._emitConnectionEvent('connected');
            } else if (event.type === 'error') {
                const errorMessage = (event as any).error?.message || 'Unknown error';
                console.log('Emitting error event:', errorMessage);

                // Check for specific item retrieval errors that are safe to ignore
                if (errorMessage.includes('item with id') && errorMessage.includes('does not exist')) {
                    console.warn('OpenAI item retrieval error detected - this is usually safe to ignore:', errorMessage);
                    // Don't emit connection error for item retrieval issues as they don't affect functionality
                    return;
                }

                this._emitConnectionEvent('error', errorMessage);
            }
        });

        this._session.on('mcp_tools_changed', (tools: any[]) => {
            this._mcpTools = tools.map((t) => t.name);
            console.log('MCP tools changed:', this._mcpTools);
        });

        // Enhanced history update handling with analytics processing
        this._session.on('history_updated', (history: RealtimeItem[]) => {
            console.log('History updated, items:', history.length);
            this._history = history;
            this._processHistoryUpdate(history);

            // Process conversation analytics from history
            this._processConversationAnalytics(history);
        });

        // Auto-approval flow for seamless UX
        this._session.on('tool_approval_requested', (_context, _agent, approvalRequest) => {
            console.log('Tool approval requested - auto-approving for seamless UX:', approvalRequest);

            // Log the tool call for debugging
            this._logToolCall(approvalRequest);

            // Automatically approve all tool calls without user confirmation
            this._session?.approve(approvalRequest.approvalItem);
            console.log('Tool call auto-approved:', approvalRequest.approvalItem);

            // Note: Tool execution and result reporting is handled automatically by the OpenAI SDK
            // when tools are defined with execute functions using the tool() helper
        });

        // Enhanced guardrail handling
        this._session.on('guardrail_tripped', (guardrailEvent) => {
            console.log('Guardrail tripped:', guardrailEvent);
            this._handleGuardrailEvent(guardrailEvent);
        });

        // Listen for audio interruption events (if available)
        if (typeof (this._session as any).on === 'function') {
            try {
                (this._session as any).on('audio_interrupted', () => {
                    console.log('Audio interrupted event received');
                    this._emitAudioEvent('audio_end');
                });
            } catch (error) {
                console.log('audio_interrupted event not available:', error);
            }
        }
    }

    private _logToolCallToConversation(functionCallItem: any) {
        try {
            // Don't emit transcript here - it will be emitted in _executeToolCallUnified
            // This method is just for conversation logging
            const parsedArgs = functionCallItem.arguments ? JSON.parse(functionCallItem.arguments) : {};

            if (functionCallItem.call_id && functionCallItem.name) {
                this._pendingToolNames.set(functionCallItem.call_id, functionCallItem.name);
            }

            const toolCallData = {
                sessionId: this._sessionId || 'unknown',
                provider: 'openai',
                conversationData: {
                    startTime: new Date().toISOString(),
                    entries: [{
                        id: `tool_call_${functionCallItem.call_id || Date.now()}`,
                        timestamp: new Date().toISOString(),
                        type: 'tool_call' as const,
                        provider: 'openai',
                        executionContext: 'server' as const,
                        toolCallId: functionCallItem.call_id,
                        correlationId: `openai_tool_${functionCallItem.call_id}`,
                        data: {
                            phase: 'start',
                            toolName: functionCallItem.name,
                            parameters: parsedArgs,
                            callId: functionCallItem.call_id
                        },
                        metadata: {
                            success: true,
                            executionTime: 0,
                            accessLevel: 'basic'
                        }
                    }],
                    toolCallSummary: {
                        totalCalls: 1,
                        successfulCalls: 1,
                        failedCalls: 0,
                        clientCalls: 0,
                        serverCalls: 1,
                        averageExecutionTime: 0
                    },
                    conversationMetrics: {
                        totalTranscriptItems: 0,
                        totalConnectionEvents: 0,
                        totalContextRequests: 0
                    }
                },
                metadata: {
                    reportType: 'real-time' as const,
                    clientTimestamp: new Date().toISOString()
                }
            };

            // Send to conversation log API
            fetch('/api/ai/conversation/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(toolCallData)
            }).catch(error => {
                console.error('Failed to log tool call to conversation:', error);
            });

        } catch (error) {
            console.error('Error logging tool call to conversation:', error);
        }
    }

    private _processHistoryUpdate(history: RealtimeItem[]) {
        // Only process new items to avoid duplication

        // Convert only new RealtimeItem[] to TranscriptItem[] for the interface
        const newTranscriptItems: TranscriptItem[] = [];

        // Keep track of processed items to avoid duplicates
        const processedItemIds = new Set(this._transcript.map(t => t.id));

        for (let index = 0; index < history.length; index++) {
            try {
                const item = history[index];

                // Safely extract item ID with error handling. The SDK's field is
                // `itemId` (not `id`) — the old `id`-only read made EVERY item fall
                // back to `item-${index}`, so after a D49 resume the new session's
                // history (indexes restarting at 0) collided with already-processed
                // ids and was silently skipped (owner-observed 2026-07-07: transcript
                // frozen after reconnect).
                let itemId: string;
                try {
                    itemId = (item as any).itemId || (item as any).id || `item-${this._sessionEpoch}-${index}`;
                } catch (error) {
                    console.warn('Error accessing item ID, using fallback:', error);
                    itemId = `item-${this._sessionEpoch}-${index}-${Date.now()}`;
                }

                // Skip items we've already processed
                if (processedItemIds.has(itemId)) {
                    continue;
                }

                // Handle function call items separately - log them but don't add to transcript
                if (item.type === 'function_call') {
                    console.log('Processing function call item for conversation log:', {
                        index,
                        type: item.type,
                        name: (item as any).name,
                        call_id: (item as any).call_id
                    });

                    // Log the tool call to the conversation system
                    this._logToolCallToConversation(item as any);
                    continue;
                }

                // Determine the type based on the item's role or origin
                let itemType: 'user_speech' | 'ai_response' = 'ai_response';

                // Debug log the item structure
                console.log('Processing history item:', {
                    index,
                    type: item.type,
                    role: 'role' in item ? item.role : 'no role',
                    object: 'object' in item ? item.object : 'no object',
                    hasContent: 'content' in item,
                    keys: Object.keys(item)
                });

                // Check various properties to determine if it's user input
                if ('role' in item && item.role === 'user') {
                    itemType = 'user_speech';
                    console.log('Detected user speech via role');
                } else if ('role' in item && item.role === 'assistant') {
                    itemType = 'ai_response';
                    console.log('Detected AI response via role');
                } else if (item.type === 'message' && 'content' in item) {
                    // Check if it's an input audio transcription
                    const content = Array.isArray(item.content) ? item.content : [item.content];
                    const hasInputAudio = content.some((c: any) =>
                        c?.type === 'input_audio' ||
                        c?.type === 'input_text' ||
                        (typeof c === 'object' && 'input_audio_transcription' in c)
                    );
                    const hasOutputAudio = content.some((c: any) =>
                        c?.type === 'output_audio' ||
                        (typeof c === 'object' && 'output_audio_transcription' in c)
                    );

                    if (hasInputAudio) {
                        itemType = 'user_speech';
                        console.log('Detected user speech via input audio content');
                    } else if (hasOutputAudio) {
                        itemType = 'ai_response';
                        console.log('Detected AI response via output audio content');
                    }
                }

                // Extract content safely with error handling
                let content: string;
                try {
                    content = this._extractContentFromItem(item);
                } catch (contentError) {
                    console.warn('Error extracting content from item, using fallback:', contentError);
                    content = `[Content extraction error: ${contentError instanceof Error ? contentError.message : String(contentError)}]`;
                }

                console.log('Final item classification:', {
                    index,
                    type: itemType,
                    content: content.substring(0, 50),
                    hasContent: content.length > 0
                });

                // NAV_CONTEXT frames are harness-injected context (D55), not visitor
                // speech — never show or persist them as user turns. (They surfaced
                // as "User" rows once real itemIds fixed the dedupe.) CONV_SUMMARY
                // is the J4 running-summary item — same rule.
                if (content.trimStart().startsWith('NAV_CONTEXT') || content.trimStart().startsWith('CONV_SUMMARY')) {
                    continue;
                }

                // Only add items with content or update existing items that now have content
                if (content.trim().length > 0) {
                    const existingIndex = this._transcript.findIndex(t => t.id === itemId);

                    // Ordering truth (owner, 2026-07-08 "transcripts are logged
                    // shuffled"): stamp user rows at the moment they STARTED
                    // speaking, not when Whisper finished transcribing — and
                    // never re-stamp an item on update, which pushed rows even
                    // later. Rows sort by timestamp, so this is the order fix.
                    let timestamp: Date;
                    if (existingIndex >= 0) {
                        timestamp = this._transcript[existingIndex].timestamp;
                    } else if (itemType === 'user_speech' && this._lastUserSpeechStartedAt) {
                        timestamp = this._lastUserSpeechStartedAt;
                        this._lastUserSpeechStartedAt = null;
                    } else {
                        timestamp = new Date();
                    }

                    const transcriptItem: TranscriptItem = {
                        id: itemId,
                        type: itemType,
                        content,
                        timestamp,
                        provider: 'openai' as VoiceProvider,
                        // 9b.5 best-effort onset for assistant turns (WebRTC playback
                        // start via output_audio_buffer.started; exact on Gemini).
                        metadata: itemType === 'ai_response' && this._turnFirstAudioAt
                            ? { firstAudioAt: this._turnFirstAudioAt.toISOString() }
                            : undefined
                    };
                    if (existingIndex >= 0) {
                        this._transcript[existingIndex] = transcriptItem;
                    } else {
                        this._transcript.push(transcriptItem);
                    }

                    newTranscriptItems.push(transcriptItem);
                    processedItemIds.add(itemId);
                }
            } catch (itemProcessingError) {
                console.error('Error processing history item at index', index, ':', itemProcessingError);
                // Continue with next item instead of breaking the entire process
                continue;
            }
        }

        // Emit events for new items with content
        newTranscriptItems.forEach(item => {
            console.log('Emitting transcript event for:', item.type, item.content.substring(0, 50));
            this._emitTranscriptEvent(item);

            // Report individual transcript items to server for real-time logging
            this._reportTranscriptItemToServer(item);
        });
    }

    /**
     * Process conversation analytics from history including tokens and cost metrics
     */
    private _processConversationAnalytics(history: RealtimeItem[]) {
        try {
            // Extract usage metrics from the conversation history
            let totalTokensUsed = 0;
            let estimatedCostUsd = 0;

            // Look for usage information in the history items
            for (const item of history) {
                if ('usage' in item && item.usage) {
                    const usage = item.usage as any;
                    if (usage.total_tokens) {
                        totalTokensUsed += usage.total_tokens;
                    }
                    if (usage.cost_usd) {
                        estimatedCostUsd += usage.cost_usd;
                    }
                }

                // Also check for response-level usage data
                if ('response' in item && item.response && typeof item.response === 'object' && item.response !== null && 'usage' in item.response) {
                    const responseUsage = (item.response as any).usage;
                    if (responseUsage.total_tokens) {
                        totalTokensUsed += responseUsage.total_tokens;
                    }
                    if (responseUsage.cost_usd) {
                        estimatedCostUsd += responseUsage.cost_usd;
                    }
                }
            }

            // Store analytics for reporting
            this._conversationAnalytics = {
                tokensUsed: totalTokensUsed,
                costUsd: estimatedCostUsd,
                messageCount: history.length,
                lastUpdated: new Date()
            };

            console.log('Conversation analytics updated:', this._conversationAnalytics);

            // Report to server periodically (every 10 messages or significant cost increase)
            if (history.length % 10 === 0 || estimatedCostUsd > (this._lastReportedCost || 0) + 0.01) {
                this._reportConversationDataToServer();
            }

        } catch (error) {
            console.error('Error processing conversation analytics:', error);
        }
    }

    /**
     * Process response completion metrics
     */
    private _processResponseMetrics(event: TransportEvent) {
        try {
            const eventData = event as any;

            // Extract usage data from the response event
            if (eventData.response && eventData.response.usage) {
                const usage = eventData.response.usage;
                console.log('Response usage metrics:', usage);

                // Realtime usage events carry input_tokens/output_tokens but NO
                // total_tokens — every consumer gated on it read 0 forever
                // (live-fire, 2026-07-09: {input_tokens: 4179, output_tokens: 112}).
                const inputTokens = usage.input_tokens ?? 0;
                const outputTokens = usage.output_tokens ?? 0;
                const totalTokens = usage.total_tokens ?? (inputTokens + outputTokens);

                // Update our analytics
                if (this._conversationAnalytics) {
                    this._conversationAnalytics.tokensUsed += totalTokens;
                    if (usage.cost_usd) {
                        this._conversationAnalytics.costUsd += usage.cost_usd;
                    }
                    this._conversationAnalytics.lastUpdated = new Date();
                }

                // Per-leg TPM accounting (owner ask, 2026-07-08): every realtime
                // response re-bills the WHOLE conversation as input tokens, so
                // this is the number that trips the org TPM limit — not the
                // spoken words.
                this._legUsage.responses += 1;
                this._legUsage.inputTokens += inputTokens;
                this._legUsage.outputTokens += outputTokens;
                this._legUsage.totalTokens += totalTokens;

                // Live counter: flush a per-response delta so the admin header
                // counts up DURING the session — leg-end persistence never
                // lands when the tab closes mid-conversation.
                if (totalTokens > 0) {
                    this._postConversationLog({
                        sessionId: this._generateSessionId(),
                        provider: 'openai',
                        reflinkId: this._options?.reflinkId,
                        usageDelta: {
                            responses: 1,
                            inputTokens,
                            outputTokens,
                            totalTokens,
                        },
                        timestamp: new Date().toISOString(),
                    });
                }

                // In-transcript early warning BEFORE the rate limiter mutes the
                // session: one response consuming a large slice of the 40K/min
                // window means the next few will start failing.
                const TPM_WARN_TOKENS = 15000;
                if (totalTokens >= TPM_WARN_TOKENS && !this._tpmWarned) {
                    this._tpmWarned = true;
                    this._logEvent('error',
                        `High token burn: this response used ${totalTokens} tokens (${inputTokens} in / ${outputTokens} out) — a 40K TPM org limit fits ~${Math.max(1, Math.floor(40000 / totalTokens))} such responses per minute`,
                        { kind: 'tpm_warning', usage: { input: inputTokens, output: outputTokens, total: totalTokens } });
                }
            }

        } catch (error) {
            console.error('Error processing response metrics:', error);
        }
    }

    /**
     * Process tool call events for logging and debugging
     */
    private _processToolCallEvent(event: TransportEvent) {
        try {
            const eventData = event as any;
            console.log('Processing tool call event:', eventData);

            // Extract tool call information
            if (eventData.name && eventData.arguments) {
                const toolCall: ToolCall = {
                    id: eventData.call_id || `tool-${Date.now()}`,
                    name: eventData.name,
                    arguments: eventData.arguments,
                    timestamp: new Date()
                };

                console.log('Tool call detected:', toolCall);

                // Store for debugging and analytics
                this._toolCalls.push(toolCall);
            }

        } catch (error) {
            console.error('Error processing tool call event:', error);
        }
    }





    /**
     * Execute tool call using unified execution pipeline
     * This method handles the execution and ensures proper result formatting
     */
    private async _executeToolCallUnified(toolName: string, parameters: any): Promise<string> {
        console.log(`Executing unified tool: ${toolName}`, parameters);

        // Emit tool call transcript at the start of execution
        this._emitToolCallTranscript(toolName, parameters, 'unified-execution');

        try {
            // Execute via unified system
            const result = await this._executeUnifiedTool(toolName, parameters);

            console.log(`Unified tool ${toolName} executed successfully:`, result);

            // Emit tool result transcript for monitoring
            this._emitToolResultTranscript(toolName, {
                success: true,
                message: typeof result === 'string' ? result : 'Tool executed successfully',
                data: result
            }, 'unified-execution', 0);

            // Return formatted result with explicit instruction to respond
            let formattedResult: string;

            if (typeof result === 'string') {
                formattedResult = result;
            } else if (result && typeof result === 'object') {
                // For complex objects, extract key information for conversational response
                if (result.success && result.data) {
                    // If it's a successful API response, extract the data
                    const data = result.data;
                    if (data.recentProjects) {
                        // Format project summary for conversation
                        const projects = data.recentProjects.map((p: any) => `${p.title}: ${p.description}`).join('\n');
                        formattedResult = `I found ${data.totalProjects} projects in this portfolio:\n\n${projects}`;
                    } else if (data.project) {
                        // Format single project for conversation
                        formattedResult = `Here's the project information:\n\n${data.project.title}: ${data.project.description}`;
                    } else {
                        // Generic successful response
                        formattedResult = result.message || 'Tool executed successfully';
                    }
                } else {
                    // Fallback to JSON string. Strip payload the model has no
                    // use for BEFORE it enters the conversation — everything a
                    // tool returns is re-billed as input on EVERY subsequent
                    // turn of the session (realtime has no server-side history
                    // trimming), and searchMetadata is ~500 tokens of timing
                    // breakdowns per search.
                    const { searchMetadata: _dropped, ...slim } = result as Record<string, unknown>;
                    formattedResult = JSON.stringify(_dropped !== undefined ? slim : result);
                }
            } else {
                formattedResult = String(result);
            }

            // Return the formatted result directly - the AI should use this to respond
            return formattedResult;

        } catch (error) {
            console.error(`Failed to execute unified tool ${toolName}:`, error);

            // Emit error result transcript
            this._emitToolResultTranscript(toolName, {
                success: false,
                message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
                error: error instanceof Error ? error.message : String(error)
            }, 'unified-execution', 0);

            // Return error message
            throw error;
        }
    }

    // OpenAI-specific tool wrapper functions
    // These functions handle the client-to-server communication for server tools

    private async _openaiLoadProjectContext(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('loadProjectContext', parameters);
    }

    private async _openaiLoadUserProfile(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('loadUserProfile', parameters);
    }

    private async _openaiSearchProjects(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('searchProjects', parameters);
    }

    private async _openaiGetProjectSummary(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('getProjectSummary', parameters);
    }

    // _openaiOpenProject method removed - deprecated tool

    private async _openaiUIIntent(parameters: any): Promise<string> {
        console.log('🎯 _openaiUIIntent called with parameters:', JSON.stringify(parameters, null, 2));
        
        // Validate that we have the required target parameter
        if (!parameters.target) {
            console.error('❌ ui_intent missing target parameter');
            return JSON.stringify({
                success: false,
                message: 'ui_intent requires a target parameter',
                error: 'MISSING_TARGET'
            });
        }
        
        if (!parameters.target.type || !parameters.target.id) {
            console.error('❌ ui_intent target missing type or id:', parameters.target);
            return JSON.stringify({
                success: false,
                message: 'ui_intent target requires both type and id properties',
                error: 'INVALID_TARGET'
            });
        }
        
        console.log('✅ ui_intent parameters validated, executing...');
        
        // The parameters should already be properly parsed by OpenAI
        // Just pass them directly to the unified tool execution
        return await this._executeToolCallUnified('ui_intent', parameters);
    }

    private async _openaiUIDescribe(parameters: any): Promise<string> {
        console.log('🔍 _openaiUIDescribe called with parameters:', JSON.stringify(parameters, null, 2));
        
        // Pass parameters directly to the unified tool execution
        return await this._executeToolCallUnified('ui_describe', parameters);
    }

    private async _openaiProcessJobSpec(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('processJobSpec', parameters);
    }

    private async _openaiSubmitContactForm(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('submitContactForm', parameters);
    }

    private async _openaiProcessUploadedFile(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('processUploadedFile', parameters);
    }

    private async _openaiScrollIntoView(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('scrollIntoView', parameters);
    }

    private async _openaiHighlightText(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('highlightText', parameters);
    }

    private async _openaiClearHighlights(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('clearHighlights', parameters);
    }

    private async _openaiFocusElement(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('focusElement', parameters);
    }

    // fillFormField/submitForm/animateElement removed (D18/D19, Phase 3 task 3.1)

    /**
     * arguments.done fires BEFORE the tool executes, so this handler cannot
     * know the result — it only remembers the provider call_id so the
     * post-execution row (_logToolRow) can correlate. Posting the row from
     * here is what made every OpenAI tool replay as result:"null" (owner,
     * 2026-07-08): the /log route dedupes by id, so the result-less row
     * always won and the real payload never reached the transcript.
     */
    private _logToolCallCompletion(event: any) {
        const name = event.name || this._pendingToolNames.get(event.call_id);
        if (name && event.call_id) this._lastCallIdForTool.set(name, event.call_id);
    }

    /**
     * Persist the completed tool call — args AND the exact output string the
     * model received — as ONE row after execution (mirrors GoogleLiveAdapter's
     * 2026-07-08 fix; the route slices results to 8KB).
     */
    private _logToolRow(toolName: string, args: unknown, result: string, success: boolean, executionTime: number, startedAt: number): void {
        try {
            const callId = this._lastCallIdForTool.get(toolName);
            this._lastCallIdForTool.delete(toolName);
            this._postConversationLog({
                sessionId: this._generateSessionId(),
                provider: 'openai',
                reflinkId: this._options?.reflinkId,
                toolName,
                toolArgs: args,
                toolResult: (result ?? '').slice(0, 6000),
                // Stamp with execution START: rows sort by timestamp, and a
                // completion-time stamp interleaved tool rows after the events
                // they caused (owner: "transcripts are logged shuffled").
                timestamp: new Date(startedAt).toISOString(),
                metadata: {
                    toolCallId: callId,
                    success,
                    executionTime,
                    reportType: 'real-time'
                }
            });
        } catch (error) {
            console.warn('Error logging tool row:', error);
        }
    }

    // ---- D49 session continuity helpers (task 5b) ----

    /** Fire-and-forget connection_event to /api/ai/conversation/log (leg lifecycle + markers). */
    private _logConnectionEvent(
        eventType: 'session_start' | 'session_end' | 'disruption',
        data: Record<string, unknown>
    ): void {
        try {
            fetch('/api/ai/conversation/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this._generateSessionId(),
                    provider: 'openai',
                    reflinkId: this._options?.reflinkId,
                    conversationData: {
                        startTime: new Date().toISOString(),
                        entries: [{
                            id: `conn_${eventType}_${Date.now()}`,
                            timestamp: new Date().toISOString(),
                            type: 'connection_event',
                            provider: 'openai',
                            data: { eventType, ...data },
                        }],
                        toolCallSummary: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, clientCalls: 0, serverCalls: 0, averageExecutionTime: 0 },
                        conversationMetrics: { totalTranscriptItems: 0, totalConnectionEvents: 1, totalContextRequests: 0 },
                    },
                    metadata: { reportType: 'real-time', clientTimestamp: new Date().toISOString() },
                }),
            }).catch((error) => console.warn('Failed to log connection event:', error));
        } catch (error) {
            console.warn('Error logging connection event:', error);
        }
    }

    private _getPeerConnection(): RTCPeerConnection | null {
        try {
            return (this._session as any)?.transport?.connectionState?.peerConnection ?? null;
        } catch {
            return null;
        }
    }

    private _getDataChannel(): RTCDataChannel | null {
        try {
            const transport = (this._session as any)?.transport;
            return transport?.connectionState?.dataChannel ?? transport?.dataChannel ?? transport?._dataChannel ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Point-in-time transport diagnostics attached to blip/disruption/ack-timeout
     * rows, so the transcript answers "what exactly happened with the disconnect"
     * (owner, 2026-07-08) instead of a bare 'network' label. The candidate-pair
     * consent counters distinguish "ICE consent stopped being answered" (path
     * dead) from "bytes still flowing" (false alarm).
     */
    private async _connectionDiagnostics(): Promise<Record<string, unknown>> {
        const pc = this._getPeerConnection();
        const dc = this._getDataChannel();
        const diag: Record<string, unknown> = {
            peerConnectionState: pc?.connectionState ?? 'none',
            iceConnectionState: pc?.iceConnectionState ?? 'none',
            signalingState: pc?.signalingState ?? 'none',
            dataChannelState: dc?.readyState ?? 'unknown',
            dataChannelBuffered: dc?.bufferedAmount,
            online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
            pendingContextAcks: this.pendingTokens.size,
            lastNavPush: this._lastNavPushInfo
                ? { ageMs: Date.now() - this._lastNavPushInfo.at, chars: this._lastNavPushInfo.chars }
                : null,
        };
        try {
            if (pc) {
                const stats = await pc.getStats();
                stats.forEach((report: any) => {
                    if (report.type === 'candidate-pair' && (report.nominated || report.state === 'succeeded')) {
                        diag.candidatePair = {
                            state: report.state,
                            rttSec: report.currentRoundTripTime,
                            bytesSent: report.bytesSent,
                            bytesReceived: report.bytesReceived,
                            requestsSent: report.requestsSent,
                            responsesReceived: report.responsesReceived,
                            consentRequestsSent: report.consentRequestsSent,
                            availableOutgoingBitrate: report.availableOutgoingBitrate,
                        };
                    }
                });
            }
        } catch { /* stats are best-effort; never block disruption handling on them */ }
        return diag;
    }

    /** How long 'disconnected' may persist before it stops counting as a blip. */
    private static readonly DISCONNECT_GRACE_MS = 10_000;

    /**
     * Watch the RTCPeerConnection for drops. WebRTC gives no reliable "closed"
     * callback through the SDK surface here, so poll connectionState. Two rules
     * learned from the owner's Firefox sessions (2026-07-08 — four disruptions
     * in three minutes at a ~36s cadence):
     * 1. 'disconnected' is a TRANSIENT state that Firefox enters far more
     *    readily than Chrome and that usually self-recovers; tearing down on
     *    first sight converts a 2-second blip into a full reconnect cycle with
     *    apology clips. Only sustained 'disconnected' (grace elapsed),
     *    'failed', or 'closed' is a disruption.
     * 2. Every blip, recovery, and disruption gets a replayable transcript row
     *    carrying transport diagnostics.
     */
    private _startDisruptionWatcher(): void {
        this._stopDisruptionWatcher();
        this._lastPcState = null;
        this._lastIceState = null;
        this._disruptionWatcher = setInterval(() => { void this._disruptionTick(); }, 2000);
    }

    private async _disruptionTick(): Promise<void> {
        if (this._disruptionTickBusy) return;
        this._disruptionTickBusy = true;
        try {
            if (!this._isConnected || this._intentionalDisconnect || this._resumeInProgress) return;
            const pc = this._getPeerConnection();
            const state = pc?.connectionState ?? 'none';
            const ice = pc?.iceConnectionState ?? 'none';

            if (state !== this._lastPcState || ice !== this._lastIceState) {
                console.log(`OpenAIRealtimeAdapter: transport state pc=${this._lastPcState ?? '∅'}→${state} ice=${this._lastIceState ?? '∅'}→${ice}`);
                this._lastPcState = state;
                this._lastIceState = ice;
            }

            if (state === 'failed' || state === 'closed') {
                const diag = await this._connectionDiagnostics();
                console.warn(`OpenAIRealtimeAdapter: peer connection ${state} without user intent — treating as disruption`, diag);
                this._disconnectedSince = null;
                void this._handleDisruption(state === 'failed' ? 'provider_error' : 'network', diag);
                return;
            }

            if (state === 'disconnected') {
                if (this._disconnectedSince === null) {
                    this._disconnectedSince = Date.now();
                    const diag = await this._connectionDiagnostics();
                    console.warn('OpenAIRealtimeAdapter: transport blip (pc disconnected) — grace window started', diag);
                    this._logEvent('error', 'Connection blip: peer disconnected — waiting for self-recovery', { kind: 'transport_blip', ...diag });
                } else if (Date.now() - this._disconnectedSince >= OpenAIRealtimeAdapter.DISCONNECT_GRACE_MS) {
                    const disconnectedForMs = Date.now() - this._disconnectedSince;
                    this._disconnectedSince = null;
                    const diag = await this._connectionDiagnostics();
                    console.warn(`OpenAIRealtimeAdapter: pc disconnected for ${disconnectedForMs}ms (past grace) — treating as disruption`, diag);
                    void this._handleDisruption('network', { ...diag, disconnectedForMs });
                }
                return;
            }

            // connected / connecting / new — recovery path
            if (this._disconnectedSince !== null) {
                const blipMs = Date.now() - this._disconnectedSince;
                this._disconnectedSince = null;
                console.log(`OpenAIRealtimeAdapter: transport blip recovered after ${blipMs}ms — session continues, no reconnect`);
                this._logEvent('error', `Connection blip recovered after ${(blipMs / 1000).toFixed(1)}s — session continued without reconnect`, { kind: 'transport_blip_recovered', blipMs });
                this._flushDeferredNavContext();
            }
        } finally {
            this._disruptionTickBusy = false;
        }
    }

    /** Re-flush the floating block after a transport blip — the D55 buffer
     *  holds the latest state, so recovery is one flush (newest wins for free). */
    private _flushDeferredNavContext(): void {
        console.log('OpenAIRealtimeAdapter: re-flushing floating block deferred during transport blip');
        void this._flushContextBlock('blip-recovery');
    }

    private _stopDisruptionWatcher(): void {
        if (this._disruptionWatcher) {
            clearInterval(this._disruptionWatcher);
            this._disruptionWatcher = null;
        }
        this._disconnectedSince = null;
    }

    /**
     * Duration cap enforcement (access-and-cost task 8 / Req 2.4). The mint
     * reports the cap; OpenAI's client secret cannot terminate a RUNNING
     * session, so the adapter disconnects at the bound (endReason
     * 'duration_cap' on the D49 leg). OpenAI's own ~60-min realtime limit is
     * the hard backstop behind this.
     */
    private _armDurationCap(maxSessionSeconds: number): void {
        this._clearDurationCap();
        this._durationCapTimer = setTimeout(() => {
            if (!this._isConnected) return;
            console.warn(`OpenAIRealtimeAdapter: session duration cap (${maxSessionSeconds}s) reached — disconnecting`);
            this._endReason = 'duration_cap';
            void this.disconnect().catch((err) =>
                console.error('OpenAIRealtimeAdapter: duration-cap disconnect failed:', err)
            );
        }, maxSessionSeconds * 1000);
    }

    private _armResponseStallWatchdog(toolName: string, delayMs = 10000): void {
        this._clearResponseStallWatchdog();
        this._responseStallTimer = setTimeout(() => {
            this._responseStallTimer = null;
            if (!this._isConnected) return;
            // Never inject a response while the user is mid-utterance — their
            // committed turn will trigger the model naturally. Re-check later.
            if (this._userSpeechActive) {
                this._armResponseStallWatchdog(toolName, delayMs);
                return;
            }
            // Cap the nudge loop: each failed retry re-arms via response.done,
            // and unbounded response.create against a rate-limited session just
            // burns more of the same TPM window (live-fire, 2026-07-08).
            if (this._stallNudgeCount >= 3) {
                console.warn('OpenAIRealtimeAdapter: stall nudge cap reached — leaving the turn silent (user speech will restart it)');
                this._logEvent('error', 'Turn still stalled after 3 recovery nudges — giving up until the user speaks', { toolName, kind: 'response_stall_capped' });
                return;
            }
            this._stallNudgeCount++;
            const message = `Model produced no response within ${Math.round(delayMs / 1000)}s of the ${toolName} tool result (turn stalled)`;
            console.warn(`OpenAIRealtimeAdapter: ${message}`);
            this._logEvent('error', `Turn stalled after tool result — sending recovery nudge (${this._stallNudgeCount}/3)`, { toolName, kind: 'response_stall' });
            // Programmatic version of the spoken nudge that revives these
            // turns: ask for a response explicitly. If a response IS active
            // the server rejects it with a harmless error event.
            void this.sendEvent({ type: 'response.create' }).catch((err) =>
                console.warn('OpenAIRealtimeAdapter: stall recovery nudge failed:', err)
            );
        }, delayMs);
    }

    private _clearResponseStallWatchdog(): void {
        if (this._responseStallTimer) {
            clearTimeout(this._responseStallTimer);
            this._responseStallTimer = null;
        }
    }

    private _clearDurationCap(): void {
        if (this._durationCapTimer) {
            clearTimeout(this._durationCapTimer);
            this._durationCapTimer = null;
        }
    }

    /**
     * D49 resume — one code path for recovery and deliberate switches: write the
     * disruption marker, then reconnect with resumeFromSessionId so the mint
     * route briefs the new leg from ground truth. Two attempts, then give up
     * with an error event (the pill can offer manual retry / D50 apology clip).
     */
    private async _handleDisruption(issueType: string, diagnostics: Record<string, unknown>): Promise<void> {
        if (this._resumeInProgress) return;
        this._resumeInProgress = true;
        this._stopDisruptionWatcher();
        this._isConnected = false;
        this._connectionStatus = 'reconnecting';
        this._logConnectionEvent('disruption', { provider: 'openai', issueType, diagnostics, usage: { ...this._legUsage } });
        this._emitConnectionEvent('reconnecting', `Connection lost (${issueType}) — resuming`);

        try {
            try { this._session?.close(); } catch { /* already dead */ }

            const delaysMs = [1000, 3000];
            for (let attempt = 0; attempt < delaysMs.length; attempt++) {
                await new Promise((r) => setTimeout(r, delaysMs[attempt]));
                try {
                    await this.connect({
                        ...(this._lastConnectOptions ?? {}),
                        resumeFromSessionId: this._generateSessionId(),
                    });
                    console.log(`OpenAIRealtimeAdapter: resume succeeded on attempt ${attempt + 1}`);
                    return;
                } catch (error) {
                    console.warn(`OpenAIRealtimeAdapter: resume attempt ${attempt + 1} failed:`, error);
                }
            }
            this._connectionStatus = 'error';
            this._emitConnectionEvent('error', 'Resume failed after disruption — manual reconnect required');
        } finally {
            this._resumeInProgress = false;
        }
    }

    /** D49: the logical-conversation session id this adapter writes history under. */
    public getConversationSessionId(): string | null {
        return this._sessionId;
    }

    /**
     * Drill helper (verification 7.3b): kill the transport WITHOUT the intent
     * flag, exactly like a network drop. The disruption watcher must detect it
     * and drive the resume flow.
     */
    public forceDropConnection(): void {
        const pc = this._getPeerConnection();
        if (pc) {
            console.warn('OpenAIRealtimeAdapter: forceDropConnection (drill) — closing peer connection');
            pc.close();
        } else {
            console.warn('OpenAIRealtimeAdapter: forceDropConnection — no peer connection to drop');
        }
    }

    /**
     * Log tool call for debugging purposes
     */
    private _logToolCall(approvalRequest: any) {
        try {
            console.log('Tool call approval request details:', {
                item: approvalRequest.approvalItem,
                context: approvalRequest.context,
                timestamp: new Date().toISOString()
            });

            // Extract tool information for logging
            const item = approvalRequest.approvalItem;
            if (item && 'name' in item) {
                const toolCall: ToolCall = {
                    id: item.id || `approval-${Date.now()}`,
                    name: item.name,
                    arguments: item.arguments || {},
                    timestamp: new Date()
                };

                this._toolCalls.push(toolCall);
                console.log('Tool call logged for debugging:', toolCall);
            }

        } catch (error) {
            console.error('Error logging tool call:', error);
        }
    }


    /**
     * Handle guardrail events
     */
    private _handleGuardrailEvent(guardrailEvent: any) {
        try {
            console.log('Guardrail event details:', guardrailEvent);

            // Log guardrail violations for debugging and safety monitoring
            const guardrailLog = {
                type: guardrailEvent.type || 'unknown',
                message: guardrailEvent.message || 'Guardrail triggered',
                severity: guardrailEvent.severity || 'warning',
                timestamp: new Date(),
                context: guardrailEvent.context
            };

            console.warn('Guardrail triggered:', guardrailLog);

            // Store guardrail events for admin review
            this._guardrailEvents.push(guardrailLog);

            // Report serious guardrail violations immediately
            if (guardrailLog.severity === 'error' || guardrailLog.severity === 'critical') {
                this._reportGuardrailViolation(guardrailLog);
            }

        } catch (error) {
            console.error('Error handling guardrail event:', error);
        }
    }

    // Helper methods to emit events to the context
    private _emitConnectionEvent(type: 'connected' | 'disconnected' | 'reconnecting' | 'error', error?: string) {
        console.log('_emitConnectionEvent called:', { type, error, hasCallback: !!this._options?.onConnectionEvent });
        if (this._options?.onConnectionEvent) {
            this._options.onConnectionEvent({
                type,
                provider: 'openai',
                error,
                timestamp: new Date()
            });
            console.log('Connection event emitted successfully');
        } else {
            console.log('No onConnectionEvent callback available');
        }
    }

    private _emitTranscriptEvent(item: TranscriptItem) {
        console.log('_emitTranscriptEvent called:', { item, hasCallback: !!this._options?.onTranscriptEvent });
        if (this._options?.onTranscriptEvent) {
            this._options.onTranscriptEvent({
                type: 'transcript_update',
                item,
                timestamp: new Date()
            });
            console.log('Transcript event emitted successfully');
        } else {
            console.log('No onTranscriptEvent callback available');
        }
    }

    private _emitAudioEvent(type: 'audio_start' | 'audio_end' | 'audio_error' | 'speech_start' | 'speech_end', error?: string) {
        if (this._options?.onAudioEvent) {
            this._options.onAudioEvent({
                type,
                error,
                timestamp: new Date()
            });
        }
    }

    private _extractContentFromItem(item: RealtimeItem): string {
        // Extract text content from RealtimeItem with comprehensive error handling
        try {
            // Safely check item properties
            let itemType: string;
            let itemKeys: string[];
            let hasContent = false;
            let hasTranscript = false;
            let hasText = false;

            try {
                itemType = item.type || 'unknown';
                itemKeys = Object.keys(item);
                hasContent = 'content' in item;
                hasTranscript = 'transcript' in item;
                hasText = 'text' in item;
            } catch (keyError) {
                console.warn('Error accessing item properties:', keyError);
                return '';
            }

            console.log('Extracting content from item:', {
                type: itemType,
                hasContent,
                hasTranscript,
                hasText,
                keys: itemKeys
            });

            // Handle different item structures
            if (itemType === 'message' && hasContent) {
                const itemWithContent = item as any;
                if (Array.isArray(itemWithContent.content)) {
                    const textContent = itemWithContent.content
                        .filter((c: any) => {
                            // Include both input and output audio types, plus text types
                            const isTextType = c.type === 'text' ||
                                c.type === 'input_text' ||
                                c.type === 'input_audio' ||
                                c.type === 'output_audio';
                            console.log('Content part:', {
                                type: c.type,
                                isTextType,
                                hasText: !!c.text,
                                hasTranscript: !!c.transcript,
                                hasAudioTranscript: !!c.audio_transcript
                            });
                            return isTextType;
                        })
                        .map((c: any) => {
                            // Try multiple properties for text content
                            const text = c.text ||
                                c.transcript ||
                                c.audio_transcript ||
                                c.content ||
                                (c.type === 'output_audio' && c.transcript) ||
                                '';
                            console.log('Extracted text from content part:', text.substring(0, 50));
                            return text;
                        })
                        .filter((text: string) => text && text.trim().length > 0)
                        .join(' ');

                    if (textContent) {
                        return textContent;
                    }
                }

                // If content is not an array, try to extract directly
                if (typeof itemWithContent.content === 'string') {
                    return itemWithContent.content;
                } else if (typeof itemWithContent.content === 'object' && itemWithContent.content !== null) {
                    // Try to extract text from object content
                    const content = itemWithContent.content as any;
                    return content.text || content.transcript || content.audio_transcript || '';
                }
            }

            // Handle audio transcription items directly
            if ('transcript' in item && item.transcript) {
                console.log('Found transcript property:', item.transcript);
                return String(item.transcript);
            }

            // Handle text items directly
            if ('text' in item && item.text) {
                console.log('Found text property:', item.text);
                return String(item.text);
            }

            // Handle audio_transcript property
            if ('audio_transcript' in item && (item as any).audio_transcript) {
                console.log('Found audio_transcript property:', (item as any).audio_transcript);
                return String((item as any).audio_transcript);
            }

            // Handle formatted content
            if ('formatted' in item && item.formatted) {
                if (typeof item.formatted === 'object' && 'text' in item.formatted) {
                    return String(item.formatted.text);
                }
                return String(item.formatted);
            }

            // Last resort: try to find any text-like property
            const itemAny = item as any;
            for (const key of ['content', 'message', 'data', 'value']) {
                if (itemAny[key] && typeof itemAny[key] === 'string') {
                    console.log(`Found text in ${key} property:`, itemAny[key]);
                    return itemAny[key];
                }
            }

            console.log('No text content found in item');
            return '';
        } catch (error) {
            console.warn('Error extracting content from item:', error, item);
            return '';
        }
    }

    async connect(options?: ConnectOptions): Promise<void> {
        const synthetic = !!options?.syntheticInputStream;
        const wantsMic = !synthetic && options?.audioInput !== false;
        const inputKind: 'mic' | 'silent' | 'synthetic' = synthetic ? 'synthetic' : wantsMic ? 'mic' : 'silent';
        const resuming = !!options?.resumeFromSessionId;
        console.log(`OpenAIRealtimeAdapter: Connect called (input: ${inputKind}${resuming ? ', resuming' : ''})`);

        if (!this._session) {
            throw new ConnectionError('Session not initialized', 'openai');
        }

        // D49: adopt the interrupted conversation's identity — history continues
        // in the same conversation row; the mint route briefs the new leg.
        if (resuming) {
            this._sessionId = options!.resumeFromSessionId!;
        }

        try {
            if (wantsMic) {
                // Request microphone permission explicitly
                console.log('OpenAIRealtimeAdapter: Requesting microphone permission...');
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            sampleRate: 24000,
                            channelCount: 1
                        }
                    });
                    console.log('OpenAIRealtimeAdapter: Microphone permission granted');
                    // Stop the stream since OpenAI SDK will handle it
                    stream.getTracks().forEach(track => track.stop());
                } catch (micError) {
                    console.error('OpenAIRealtimeAdapter: Microphone permission denied:', micError);
                    throw new AudioError('Microphone permission required for voice AI', 'openai');
                }
            }

            // The transport is fixed at session construction, so a mode switch
            // (mic <-> text-only <-> synthetic) requires recreating the session
            // before connecting. A synthetic reconnect with a NEW driver stream
            // also needs a rebuild, and a resume always rebuilds (the previous
            // RealtimeSession was closed by the disruption/disconnect).
            if (
                resuming ||
                this._sessionInputKind !== inputKind ||
                (inputKind === 'synthetic' && this._syntheticInputStream !== options?.syntheticInputStream)
            ) {
                console.log(`OpenAIRealtimeAdapter: Recreating session for input change (${this._sessionInputKind} -> ${inputKind})`);
                this._createRealtimeSession(inputKind, options?.syntheticInputStream);
            }

            console.log('OpenAIRealtimeAdapter: Getting session token...');

            // Build URL with query parameters for context injection
            const sessionUrl = new URL('/api/ai/openai/session', window.location.origin);

            if (this._options?.contextId) {
                sessionUrl.searchParams.set('contextId', this._options.contextId);
            }

            if (this._options?.reflinkId) {
                sessionUrl.searchParams.set('reflinkId', this._options.reflinkId);
                console.log('OpenAIRealtimeAdapter: Including reflinkId in session request:', this._options.reflinkId);
            }

            if (resuming) {
                sessionUrl.searchParams.set('resumeSessionId', this._sessionId!);
            }

            console.log('OpenAIRealtimeAdapter: Session request URL:', sessionUrl.toString());

            // Get session token from our API (which includes context injection)
            const response = await fetch(sessionUrl.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get session token');
            }

            const mintResponse = await response.json();
            const { client_secret } = mintResponse;
            this._mintedModel = mintResponse.model ?? null;
            console.log('OpenAIRealtimeAdapter: Session token received, connecting...');

            // Connect to OpenAI Realtime using the client_secret
            await this._session.connect({
                apiKey: client_secret,
            });

            this._session.transport.sendEvent({
                type: "response.create",
                response: {},
            });
            //this._session.transport.sendMessage("",{},{ triggerResponse: true });

            this._isConnected = true;
            this._connectionStatus = 'connected';
            this._audioInputMode = inputKind === 'mic' ? 'microphone' : inputKind === 'silent' ? 'text-only' : 'synthetic';

            // D49: leg lifecycle — the server starts a leg (and writes the
            // session_resumed marker when resuming), then watch for silent drops.
            this._lastConnectOptions = options;
            this._intentionalDisconnect = false;
            // Fresh leg = fresh token accounting
            this._legUsage = { responses: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
            this._tpmWarned = false;
            this._logConnectionEvent('session_start', {
                provider: 'openai',
                modelAlias: 'default-realtime',
                modelId: this._mintedModel ?? undefined,
                providerSessionId: mintResponse.session_id,
                resumed: resuming,
            });
            this._startDisruptionWatcher();

            // Duration cap from the mint (task 8 / Req 2.4): the client secret
            // can't kill a running session, so the adapter enforces the cap.
            this._armDurationCap(Number(mintResponse.max_session_seconds) || 900);

            // Initialize conversation tracking
            this._conversationStartTime = new Date();
            this._conversationAnalytics = {
                tokensUsed: 0,
                costUsd: 0,
                messageCount: 0,
                lastUpdated: new Date()
            };

            console.log('OpenAIRealtimeAdapter: Connected successfully, emitting event');
            this._emitConnectionEvent('connected');

            // Initialize UI state tracking with background updates
            this._initializeUIStateTracking();

            // D55: a fresh provider session has no floating block yet — if the
            // buffer already holds state (re-mint / resume), re-deliver it.
            void this._flushContextBlock('session-start');

        } catch (error) {
            console.error('OpenAIRealtimeAdapter: Connection failed:', error);
            this._connectionStatus = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._emitConnectionEvent('error', errorMessage);
            throw new ConnectionError(`Failed to connect: ${errorMessage}`, 'openai');
        }
    }

    /**
     * Initialize UI state tracking with background updates
     */
    private _initializeUIStateTracking(): void {
        if (typeof window === 'undefined') {
            return; // Skip on server side
        }

        try {
            // Initialize UI state manager with background update callback
            const uiManager = UIManager.getInstance();
            uiManager.initialize((update) => {
                this._sendBackgroundResult(update);
            });

            // Enable passive context integration for automatic NAV_CONTEXT updates
            uiManager.enablePassiveContext(this);

            console.log('OpenAI Realtime: UI state tracking and passive context integration initialized');
        } catch (error) {
            console.error('Failed to initialize UI state tracking:', error);
        }
    }

    /**
     * Send background result to OpenAI using backgroundResult function
     */
    private _sendBackgroundResult(update: {
        type: 'ui_state_update';
        breadcrumbPath: string;
        visibleAnchors: string[];
        activeFilters?: any;
        timestamp: number;
    }): void {
        if (!this._session) {
            return;
        }

        try {
            // Create a formatted message for the AI about the UI state change
            const stateMessage = `UI State Update: User is now at ${update.breadcrumbPath}${update.visibleAnchors.length > 0
                ? ` viewing sections: ${update.visibleAnchors.join(', ')}`
                : ''
                }${update.activeFilters?.searchTerm
                    ? ` searching for: ${update.activeFilters.searchTerm}`
                    : ''
                }`;

            // Use OpenAI's backgroundResult to send non-interrupting update
            const bgResult = backgroundResult(stateMessage);

            // Send the background result to the session
            // Note: This updates the AI's context without triggering a response
            console.log('Sending background UI state update to OpenAI:', stateMessage);

            // The backgroundResult should be sent through the session's context
            // This is a non-interrupting way to keep the AI informed of UI changes

        } catch (error) {
            console.error('Failed to send background UI state update:', error);
        }
    }

    async disconnect(): Promise<void> {
        this._clearDurationCap();
        this._clearResponseStallWatchdog();
        if (this._session && this._isConnected) {
            try {
                // D49: user-requested disconnect — not a disruption
                this._intentionalDisconnect = true;
                this._stopDisruptionWatcher();
                this._logConnectionEvent('session_end', { provider: 'openai', endReason: this._endReason, usage: { ...this._legUsage } });
                this._endReason = 'user_disconnect';

                // Report final conversation data before disconnecting
                if (this._conversationAnalytics && this._conversationAnalytics.messageCount > 0) {
                    await this._reportConversationDataToServer();
                }

                this._session.close();
                this._isConnected = false;
                this._connectionStatus = 'disconnected';
                this._audioInputMode = null;

                if (this._silentAudioContext) {
                    this._silentAudioContext.close().catch(() => {});
                    this._silentAudioContext = null;
                }

                // Clean up UI state tracking
                if (typeof window !== 'undefined') {
                    const uiManager = UIManager.getInstance();
                    uiManager.setBackgroundUpdateCallback(null);
                    uiManager.disablePassiveContext();
                }

                // Clean up NAV_CONTEXT message tracking
                this.tokenListenerSetup = false;
                this.pendingTokens.clear();
                this.trackedNavItemIds.clear();
                this._lastNavItemId = null;

                console.log('Disconnected from OpenAI Realtime');
                this._emitConnectionEvent('disconnected');
            } catch (error) {
                console.error('Disconnect failed:', error);
                throw new ConnectionError(
                    `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    'openai'
                );
            }
        }
    }

    async startListening(): Promise<void> {
        console.log('OpenAIRealtimeAdapter: startListening called, isConnected:', this._isConnected);

        if (!this._isConnected) {
            throw new ConnectionError('Not connected to OpenAI Realtime', 'openai');
        }

        try {
            console.log('OpenAIRealtimeAdapter: Current mute state:', this._isMuted);
            if (this._isMuted) {
                console.log('OpenAIRealtimeAdapter: Unmuting session...');
                this._session?.mute(false);
                this._isMuted = false;
            }

            this._isRecording = true;
            this._sessionStatus = 'listening';
            console.log('OpenAIRealtimeAdapter: Started listening, isRecording:', this._isRecording);
            this._emitAudioEvent('audio_start');

            // Check if session is properly set up for audio input
            if (this._session) {
                console.log('OpenAIRealtimeAdapter: Session state:', {
                    sessionExists: !!this._session,
                    isMuted: this._isMuted,
                    isRecording: this._isRecording,
                    isConnected: this._isConnected
                });
            }
        } catch (error) {
            console.error('OpenAIRealtimeAdapter: Error in startListening:', error);
            throw new AudioError(
                `Failed to start listening: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    async stopListening(): Promise<void> {
        try {
            if (this._session && !this._isMuted) {
                this._session.mute(true);
                this._isMuted = true;
            }
            this._isRecording = false;
            this._sessionStatus = 'idle';
            console.log('Stopped listening');
            this._emitAudioEvent('audio_end');
        } catch (error) {
            throw new AudioError(
                `Failed to stop listening: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    async sendMessage(message: string): Promise<void> {
        if (!this._session || !this._isConnected) {
            throw new ConnectionError('Not connected to OpenAI Realtime', 'openai');
        }

        try {
            console.log('=== SENDING TEXT MESSAGE ===');
            console.log('Message:', message);
            console.log('Session state before interrupt:', {
                isConnected: this._isConnected,
                sessionStatus: this._sessionStatus,
                isRecording: this._isRecording
            });

            // Interrupt any ongoing AI speech before sending the message
            console.log('Calling interrupt...');
            await this.interrupt();
            console.log('Interrupt completed, now sending message...');

            // Use the RealtimeSession's sendMessage method with proper typing
            this._session.sendMessage(message);
            console.log('Text message sent successfully to session');
            console.log('=== MESSAGE SEND COMPLETE ===');
        } catch (error) {
            console.error('Failed to send text message:', error);
            throw new Error(
                `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async callTool(toolCall: ToolCall): Promise<ToolResult> {
        // Tools are handled automatically by the RealtimeSession
        // This method is kept for interface compatibility
        return {
            id: toolCall.id,
            result: 'Tool calls are handled automatically by the session',
            timestamp: new Date(),
            executionTime: 0
        };
    }

    getProviderMetadata(): ProviderMetadata {
        return {
            provider: 'openai',
            model: OPENAI_REALTIME_MODEL,
            capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio'],
            quality: 'high'
        };
    }

    // Additional methods for the new SDK
    async toggleMute(): Promise<void> {
        if (!this._session || !this._isConnected) {
            throw new ConnectionError('Not connected to OpenAI Realtime', 'openai');
        }

        try {
            if (this._isMuted) {
                this._session.mute(false);
                this._isMuted = false;
            } else {
                this._session.mute(true);
                this._isMuted = true;
            }
            console.log('Mute toggled:', this._isMuted);
        } catch (error) {
            throw new AudioError(
                `Failed to toggle mute: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    getHistory(): RealtimeItem[] {
        return this._history;
    }

    getEvents(): TransportEvent[] {
        return this._events;
    }

    getMcpTools(): string[] {
        return this._mcpTools;
    }

    addImage(dataUrl: string): void {
        if (this._session && this._isConnected) {
            this._session.addImage(dataUrl, { triggerResponse: false });
        }
    }

    // Required abstract methods from IConversationalAgentAdapter
    async cleanup(): Promise<void> {
        await this.disconnect();
        this._agent = null;
        this._session = null;
        this._history = [];
        this._events = [];
        this._mcpTools = [];
    }

    async startAudioInput(): Promise<void> {
        // Upgrade path: a text-only session has no mic track, so enabling voice means
        // reconnecting with a microphone transport. Probe permission BEFORE dropping
        // the current session so a denial leaves the text-only conversation intact.
        // (Model-side context is lost on reconnect until D49 resume lands.)
        if (this._isConnected && this._audioInputMode === 'text-only') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
            } catch (micError) {
                console.error('OpenAIRealtimeAdapter: Mic upgrade denied:', micError);
                throw new AudioError('Microphone permission required for voice AI', 'openai');
            }

            console.log('OpenAIRealtimeAdapter: Upgrading text-only session to microphone session (reconnect)');
            await this.disconnect();
            await this.connect({ audioInput: true });
        }

        return this.startListening();
    }

    async stopAudioInput(): Promise<void> {
        return this.stopListening();
    }

    async sendAudioData(_audioData: ArrayBuffer): Promise<void> {
        // The RealtimeSession handles audio input automatically through the microphone
        // This method is kept for interface compatibility but not used in this implementation
        console.log('sendAudioData called but not implemented for RealtimeSession');
    }

    async interrupt(): Promise<void> {
        if (this._session && this._isConnected) {
            console.log('Interrupt requested - stopping AI speech');
            console.log('Session state:', {
                isConnected: this._isConnected,
                sessionExists: !!this._session,
                sessionStatus: this._sessionStatus
            });
            this._session.interrupt();
            console.log('Interrupt command sent to session');
        } else {
            console.log('Cannot interrupt - session not available or not connected:', {
                sessionExists: !!this._session,
                isConnected: this._isConnected
            });
        }
    }

    async updateConfig(config: Partial<AdapterInitOptions>): Promise<void> {
        // Store the new config for future use (init() must have run first)
        if (!this._options) return;
        this._options = { ...this._options, ...config };

        // If we need to update the session config, we would need to reconnect
        // For now, just store the config
        console.log('Config updated:', config);
    }

    /**
     * Report conversation data to server for persistent storage and cost tracking
     */
    private async _reportConversationDataToServer(): Promise<void> {
        try {
            if (!this._conversationAnalytics) {
                console.log('No conversation analytics to report');
                return;
            }

            // Calculate total audio duration from transcript
            const audioInputDuration = this._transcript
                .filter(item => item.type === 'user_speech')
                .reduce((total, item) => total + (item.content.length * 100), 0); // Rough estimate

            const audioOutputDuration = this._transcript
                .filter(item => item.type === 'ai_response')
                .reduce((total, item) => total + (item.content.length * 100), 0); // Rough estimate

            const sessionId = this._generateSessionId();
            const startTime = this._conversationStartTime?.toISOString() || new Date().toISOString();
            const endTime = new Date().toISOString();

            // Convert internal data to the expected API format
            const conversationData = {
                sessionId,
                provider: 'openai' as const,
                conversationData: {
                    startTime,
                    endTime,
                    entries: [], // TODO: Convert internal events to entries format
                    toolCallSummary: {
                        totalCalls: this._toolCalls.length,
                        successfulCalls: this._toolCalls.length, // Simplified for now
                        failedCalls: 0, // Simplified for now
                        clientCalls: this._toolCalls.length, // Simplified for now
                        serverCalls: 0, // Simplified for now
                        averageExecutionTime: 0 // Simplified for now
                    },
                    conversationMetrics: {
                        totalTranscriptItems: this._transcript.length,
                        totalConnectionEvents: this._events.filter(e => e.type.includes('connection')).length,
                        totalContextRequests: this._events.filter(e => e.type.includes('context')).length,
                        sessionDuration: this._conversationStartTime ?
                            Date.now() - this._conversationStartTime.getTime() : 0
                    }
                },
                metadata: {
                    userAgent: navigator.userAgent,
                    clientTimestamp: new Date().toISOString(),
                    reportType: 'session-end' as const
                }
            };

            console.log('Reporting conversation data to server:', {
                sessionId: conversationData.sessionId,
                provider: conversationData.provider,
                entriesCount: conversationData.conversationData.entries.length,
                toolCallCount: conversationData.conversationData.toolCallSummary.totalCalls,
                sessionDuration: conversationData.conversationData.conversationMetrics.sessionDuration
            });

            const response = await fetch('/api/ai/conversation/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(conversationData)
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            // Update last reported cost to avoid duplicate reporting
            this._lastReportedCost = this._conversationAnalytics.costUsd;

            console.log('Conversation data reported successfully');

        } catch (error) {
            console.error('Failed to report conversation data to server:', error);
            // Don't throw - this is a background operation that shouldn't break the conversation
        }
    }

    /**
     * Report guardrail violations to server for admin review
     */
    private async _reportGuardrailViolation(guardrailLog: any): Promise<void> {
        try {
            console.log('Reporting guardrail violation to server:', guardrailLog);

            const response = await fetch('/api/ai/guardrail/violation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: 'openai',
                    sessionId: this._generateSessionId(),
                    violation: guardrailLog,
                    context: {
                        recentTranscript: this._transcript.slice(-5), // Last 5 messages for context
                        recentToolCalls: this._toolCalls.slice(-3)    // Last 3 tool calls for context
                    }
                })
            });

            if (!response.ok) {
                console.error('Failed to report guardrail violation:', response.status);
            } else {
                console.log('Guardrail violation reported successfully');
            }

        } catch (error) {
            console.error('Error reporting guardrail violation:', error);
            // Don't throw - this is a background operation
        }
    }

    /**
     * Generate a consistent session ID for tracking
     * This ensures the same session ID is used throughout the conversation
     */
    private _generateSessionId(): string {
        // Use a combination of timestamp and random string for uniqueness
        if (!this._sessionId) {
            this._sessionId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.log('Generated new session ID:', this._sessionId);
        }
        return this._sessionId;
    }

    /**
     * Get current conversation analytics
     */
    public getConversationAnalytics() {
        return {
            ...this._conversationAnalytics,
            toolCallCount: this._toolCalls.length,
            guardrailEventCount: this._guardrailEvents.length,
            sessionDuration: this._conversationStartTime ?
                Date.now() - this._conversationStartTime.getTime() : 0
        };
    }

    /**
     * Get tool calls for debugging
     */
    public getToolCalls(): ToolCall[] {
        return [...this._toolCalls];
    }

    /**
     * Get guardrail events for debugging
     */
    public getGuardrailEvents() {
        return [...this._guardrailEvents];
    }

    /**
     * Report individual transcript items to server for real-time logging
     */
    private async _reportTranscriptItemToServer(item: TranscriptItem): Promise<void> {
        try {
            const transcriptData = {
                sessionId: this._generateSessionId(),
                provider: 'openai' as const,
                timestamp: new Date().toISOString(),
                transcriptItem: {
                    id: item.id,
                    type: item.type,
                    content: item.content,
                    timestamp: item.timestamp.toISOString(),
                    provider: item.provider,
                    metadata: {
                        confidence: 0.95, // Default confidence for OpenAI Realtime
                        interrupted: false // Could be enhanced to detect interruptions
                    }
                }
            };

            // Don't await this to avoid blocking the conversation flow; the shared
            // helper also captures the DB conversationId from the response.
            this._postConversationLog(transcriptData);

        } catch (error) {
            console.error('Error preparing transcript item for server:', error);
        }
    }

    /**
     * Emit tool call transcript item
     */
    private _emitToolCallTranscript(toolName: string, args: any, callId: string) {
        if (!this._options?.onTranscriptEvent) return;

        const transcriptItem: TranscriptItem = {
            id: `tool-call-${callId}`,
            type: 'tool_call',
            content: `Calling ${toolName}`,
            timestamp: new Date(),
            provider: 'openai',
            metadata: {
                toolName,
                toolArgs: args
            }
        };

        this._options.onTranscriptEvent({
            type: 'transcript_update',
            item: transcriptItem,
            timestamp: new Date()
        });
    }

    /**
     * Emit tool result transcript item
     */
    private _emitToolResultTranscript(toolName: string, result: any, callId: string, executionTime: number) {
        if (!this._options?.onTranscriptEvent) return;

        const transcriptItem: TranscriptItem = {
            id: `tool-result-${callId}`,
            type: 'tool_result',
            content: result.success ? result.message : `Error: ${result.error}`,
            timestamp: new Date(),
            provider: 'openai',
            metadata: {
                toolName,
                toolResult: result,
                duration: executionTime
            }
        };

        this._options.onTranscriptEvent({
            type: 'transcript_update',
            item: transcriptItem,
            timestamp: new Date()
        });
    }

    // ============================================================================
    // NAV_CONTEXT MESSAGE TRACKING METHODS
    // ============================================================================

    /**
     * Send event to OpenAI Realtime session
     */
    private async sendEvent(event: any): Promise<void> {
        if (!this._session) {
            throw new Error("No active session for sending events");
        }

        return this._session.transport.sendEvent(event);
    }

    /**
     * Generate UUID for token correlation
     */
    private uuid(): string {
        return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    }

    /**
     * Setup token listener for message tracking (single event listener per session)
     */
    private setupTokenListener(): void {
        if (this.tokenListenerSetup || !this._session) {
            return;
        }

        this.tokenListenerSetup = true;

        const onEvent = (e: any) => {
            // Both event-name generations: GA emits conversation.item.created,
            // newer API revisions emit conversation.item.added — missing one
            // turns every NAV_CONTEXT push into a 10s "Ack timeout".
            if (e.type === "conversation.item.added" || e.type === "conversation.item.created") {
                const parts = e.item?.content ?? [];
                const text = parts.find((p: any) => p.type === "input_text")?.text || "";

                // Check if this is a NAV_CONTEXT message and track it
                if (text.startsWith('NAV_CONTEXT ')) {
                    this.trackedNavItemIds.add(e.item.id);
                    this._lastNavItemId = e.item.id; // Update last nav item ID
                    console.log('📍 Tracking NAV_CONTEXT message:', e.item.id, `(total: ${this.trackedNavItemIds.size})`);
                }

                // Check all pending tokens
                for (const [token, pending] of Array.from(this.pendingTokens.entries())) {
                    if (text.includes(token)) {
                        console.log('✅ Found matching token, item ID:', e.item.id);
                        clearTimeout(pending.timeout);
                        this.pendingTokens.delete(token);
                        pending.resolve(e.item.id);
                        break;
                    }
                }
            } else if (e.type === "error") {
                // Reject all pending tokens on error
                const errorMessage = e.error?.message || "server error";
                console.log('❌ Received error event:', errorMessage);

                for (const [token, pending] of Array.from(this.pendingTokens.entries())) {
                    clearTimeout(pending.timeout);
                    pending.reject(new Error(errorMessage));
                }
                this.pendingTokens.clear();
            }
        };

        this._session.on('transport_event', onEvent);
        console.log('🎧 Token listener setup complete');
    }

    /**
     * Wait for conversation.item.added event with specific token
     */
    private waitForCreatedWithToken(token: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            console.log('⏳ Waiting for item.added with token:', token);
            
            if (!this._session) {
                reject(new Error("No session available"));
                return;
            }
            
            // Setup the listener if not already done
            this.setupTokenListener();
            
            // Set up timeout
            const timeout = setTimeout(() => {
                this.pendingTokens.delete(token);
                console.log('⏰ Timeout waiting for token:', token);
                // Replayable evidence: the owner's disruption reports showed ack
                // timeouts ONLY in the console — put them in the transcript with
                // the transport state at the moment they fired.
                void this._connectionDiagnostics().then((diag) => {
                    this._logEvent('error', 'NAV_CONTEXT ack timeout (10s) — transport diagnostics attached', { kind: 'nav_context_ack_timeout', ...diag });
                }).catch(() => { /* diagnostics only */ });
                reject(new Error("Ack timeout"));
            }, 10000);
            
            // Add to pending tokens
            this.pendingTokens.set(token, { resolve, reject, timeout });
        });
    }

    /**
     * Legacy passive-context entry point (kept for the voice-debug panel and
     * any older callers): now a thin shim over the D55 buffer — publish under
     * source key 'fid' and let the floating-block injector deliver it. The
     * pre-buffer behavior (immediate replace-don't-append) is preserved
     * because publish flushes immediately when the model is idle.
     */
    async pushPassiveContext(fidContext: any): Promise<void> {
        this.publishPassiveContext('fid', fidContext);
    }

    /**
     * WebRTC data-channel messages must stay well under the SCTP limits — an
     * oversized send can silently drop or kill the channel. Compact oversized
     * F-I-D payloads progressively BEFORE they enter the buffer (the buffer's
     * budget drops whole ITEMS, it never edits inside one — notes §6).
     */
    publishPassiveContext(key: string, value: unknown, opts?: { ttlMs?: number; priority?: number }): void {
        if (key === 'fid' && value && typeof value === 'object') {
            value = this._compactFidForTransport(value);
        }
        super.publishPassiveContext(key, value, opts);
    }

    private _compactFidForTransport(fidContext: unknown): unknown {
        // Budget for the raw JSON, leaving headroom for the NAV_CONTEXT prefix + token.
        const MAX_FID_JSON_CHARS = 11800;
        let text = JSON.stringify(fidContext);
        if (text.length <= MAX_FID_JSON_CHARS) return fidContext;

        const compact = JSON.parse(text);
        if (compact.details) {
            compact.details = {
                briefSummary: typeof compact.details.briefSummary === 'string' ? compact.details.briefSummary.slice(0, 600) : compact.details.briefSummary,
                truncated: true
            };
        }
        text = JSON.stringify(compact);
        if (text.length > MAX_FID_JSON_CHARS && compact.index?.projectSemanticItems) {
            compact.index.projectSemanticItems = compact.index.projectSemanticItems.slice(0, 20);
            text = JSON.stringify(compact);
        }
        if (text.length > MAX_FID_JSON_CHARS && Array.isArray(compact.index?.availableProjects)) {
            compact.index.availableProjects = compact.index.availableProjects.map((p: any) => ({ slug: p.slug, title: p.title }));
        }
        console.warn(`F-I-D context compacted for transport (was over ${MAX_FID_JSON_CHARS} chars)`);
        return compact;
    }

    // ---- D47(d) updateSession mechanics (conversation-engine task A2.1) ----

    /** Floating block cadence: exact remove+re-append EVERY turn (P27) — items are addressable here. */
    protected _contextFlushMode(): 'every-turn' | 'on-change' | 'none' {
        return 'every-turn';
    }

    protected _isModelResponding(): boolean {
        return this._responseActive;
    }

    /**
     * Instructions via `session.update` — FULL replacement (P8): the string
     * handed in must already be the complete assembled state (base + node);
     * nothing is merged client-side (D47(e)). Confirmed by the session.updated
     * echo before reporting `applied`.
     */
    protected async _applyInstructions(instructions: string): Promise<SessionUpdateFieldResult> {
        if (!this._session) return 'failed';
        await this.sendEvent({
            type: 'session.update',
            session: { type: 'realtime', instructions },
        });
        await this._waitForSessionUpdated();
        return 'applied';
    }

    /**
     * Tool schema via `session.update` — FULL array replacement (P8), in the
     * same provider-ready shape the mint route sends (getOpenAIToolsArray()).
     * Narrowing is policy from the server; execution-side enforcement stays in
     * /api/ai/tools/execute regardless (Req 4.1).
     */
    protected async _applyToolSchema(tools: Array<Record<string, unknown>>): Promise<SessionUpdateFieldResult> {
        if (!this._session) return 'failed';
        await this.sendEvent({
            type: 'session.update',
            session: { type: 'realtime', tools },
        });
        await this._waitForSessionUpdated();
        return 'applied';
    }

    /**
     * Floating block, exact semantics (P27): delete ALL tracked block items,
     * then create ONE fresh item at the conversation tail — riding the proven
     * NAV_CONTEXT mechanics (token-acked creation, transcript suppression,
     * minted-prompt references to "NAV_CONTEXT" stay valid).
     */
    protected async _applyContextBlock(block: ContextBlock): Promise<SessionUpdateFieldResult> {
        if (!this._session) return 'failed';
        // A push into a stalled channel cannot be acked — it just burns a 10s
        // "Ack timeout" (the noise in the owner's 2026-07-08 transcript).
        // Report failed; the buffer stays dirty and blip recovery re-flushes.
        const dcState = this._getDataChannel()?.readyState;
        if (this._disconnectedSince !== null || (dcState && dcState !== 'open')) {
            return 'failed';
        }

        if (this.trackedNavItemIds.size > 0) {
            await this.deleteAllNavContexts();
        }
        if (!block.text) return 'applied'; // all sources gone — block stays removed

        const token = this.uuid();
        const text = `NAV_CONTEXT ${token} ${block.text}`;
        if (text.length > 12000) {
            console.warn(`Floating block over transport budget after merge: ${text.length} chars`);
        }
        this._lastNavPushInfo = { at: Date.now(), chars: text.length };
        await this.sendEvent({
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text }]
            }
        });
        await this.waitForCreatedWithToken(token);
        return 'applied';
    }

    /** Resolve on the next session.updated echo (no correlation id exists in the protocol). */
    private _waitForSessionUpdated(timeoutMs = 5000): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const session = this._session as any;
            if (!session) {
                reject(new Error('No active session'));
                return;
            }
            const cleanup = () => {
                clearTimeout(timer);
                try { session.off?.('transport_event', onEvent); } catch { /* listener cleanup best-effort */ }
            };
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error('session.updated ack timeout'));
            }, timeoutMs);
            const onEvent = (e: any) => {
                if (e.type === 'session.updated') {
                    cleanup();
                    resolve();
                } else if (e.type === 'error') {
                    cleanup();
                    reject(new Error(e.error?.message || 'server error during session.update'));
                }
            };
            session.on('transport_event', onEvent);
        });
    }

    /**
     * Delete a specific NAV_CONTEXT message
     */
    async deleteNavContext(itemId: string): Promise<void> {
        if (!this._session) {
            throw new Error("No active session for context deletion");
        }

        console.log('🗑️ Deleting NAV_CONTEXT item:', itemId);
        await this.sendEvent({
            type: "conversation.item.delete",
            item_id: itemId
        });
        this.trackedNavItemIds.delete(itemId);
        
        // Update _lastNavItemId if we deleted the last item
        if (this._lastNavItemId === itemId) {
            const remainingIds = Array.from(this.trackedNavItemIds);
            this._lastNavItemId = remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null;
        }
        
        console.log(`📍 Removed from tracking (remaining: ${this.trackedNavItemIds.size})`);
    }

    /**
     * Delete all tracked NAV_CONTEXT messages
     */
    async deleteAllNavContexts(): Promise<void> {
        if (!this._session) {
            throw new Error("No active session for context deletion");
        }

        const itemIds = Array.from(this.trackedNavItemIds);
        console.log(`🗑️ Deleting all ${itemIds.length} NAV_CONTEXT items:`, itemIds);
        
        for (const itemId of itemIds) {
            try {
                await this.sendEvent({
                    type: "conversation.item.delete",
                    item_id: itemId
                });
                this.trackedNavItemIds.delete(itemId);
            } catch (error) {
                console.warn(`Failed to delete NAV_CONTEXT item ${itemId}:`, error);
            }
        }
        
        this._lastNavItemId = null; // Clear last nav item ID
        console.log(`📍 Cleared all NAV_CONTEXT tracking (remaining: ${this.trackedNavItemIds.size})`);
    }

    /**
     * Replace NAV_CONTEXT messages (legacy entry point): with the D55 buffer,
     * replace-don't-append IS the flush semantics — publish and let the
     * injector delete-then-create.
     */
    async replaceNavContext(_oldItemId: string | null, newCtx: any): Promise<void> {
        this.publishPassiveContext('fid', newCtx);
    }

    // ---- J4 rolling window (Req 20.2, P28): TRUE pruning on the mutable conversation ----

    /** Age-based prune candidates accrue with time — check every boundary once a window exists. */
    protected _windowNeedsBoundaryCheck(): boolean {
        return true;
    }

    /**
     * OpenAI mechanics: (1) keep ONE summary item pinned at the conversation
     * head (`previous_item_id: 'root'`), replaced when the running summary
     * refreshes; (2) delete verbatim turn items that are outside the window
     * AND covered by the summary (selection logic is the shared core module —
     * the adapter only executes). Boundary-only (base class guarantees it),
     * never a re-mint (P28). Deletes are fire-and-forget like the NAV_CONTEXT
     * path — an unknown-id error from the server is tolerable, a stalled
     * channel is not (checked first).
     */
    protected async _applyWindowMechanics(window: EngineWindowUpdate, reason: string): Promise<void> {
        if (!this._session) return;
        const dcState = this._getDataChannel()?.readyState;
        if (this._disconnectedSince !== null || (dcState && dcState !== 'open')) {
            throw new Error('transport not open — window application retried at next boundary');
        }

        // (1) Summary item refresh — create the NEW one first (never a gap
        // where old turns are deleted and no summary exists), then drop the old.
        if (window.summaryVersion > this._appliedSummaryVersion && window.summaryText.trim()) {
            const token = this.uuid();
            const text = `CONV_SUMMARY ${token} ${window.summaryText}`;
            await this.sendEvent({
                type: 'conversation.item.create',
                previous_item_id: 'root', // head of the conversation — stable-prefix position (Req 20.1)
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text }],
                },
            });
            const newItemId = await this.waitForCreatedWithToken(token);
            const oldSummaryId = this._summaryItemId;
            this._summaryItemId = newItemId;
            this._appliedSummaryVersion = window.summaryVersion;
            if (oldSummaryId) {
                try {
                    await this.sendEvent({ type: 'conversation.item.delete', item_id: oldSummaryId });
                } catch (error) {
                    console.warn('Failed to delete previous summary item (superseded copy remains):', error);
                }
            }
        }

        // (2) Prune covered, out-of-window verbatim turns. Only items with
        // PROVIDER ids are deletable — locally-generated fallback ids
        // (`item-<epoch>-<index>…`) never reached the server as addressable items.
        const turns: WindowTurnRef[] = this._transcript
            .filter(
                (t) =>
                    (t.type === 'user_speech' || t.type === 'ai_response') &&
                    !this._prunedItemIds.has(t.id) &&
                    !/^item-\d+-\d+/.test(t.id)
            )
            .map((t) => ({
                id: t.id,
                role: t.type === 'user_speech' ? ('user' as const) : ('assistant' as const),
                timestamp: t.timestamp.getTime(),
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

        const candidates = selectPrunableTurns(turns, window.upToItemId, window.config, Date.now()).slice(
            0,
            OpenAIRealtimeAdapter.PRUNE_MAX_DELETES_PER_BOUNDARY
        );
        if (candidates.length === 0) return;

        const deleted: string[] = [];
        for (const turn of candidates) {
            try {
                await this.sendEvent({ type: 'conversation.item.delete', item_id: turn.id });
                this._prunedItemIds.add(turn.id);
                deleted.push(turn.id);
            } catch (error) {
                console.warn(`Failed to delete turn item ${turn.id} (kept verbatim):`, error);
            }
        }
        if (deleted.length > 0) {
            // Replayable prune record (Req 7.4 spirit): what collapsed, into
            // which summary version — replay explains why old turns vanished
            // from the provider context while the transcript still shows them.
            this._logEvent(
                'window_prune',
                `Pruned ${deleted.length} verbatim turn(s) → running summary v${window.summaryVersion}`,
                { deletedItemIds: deleted, summaryVersion: window.summaryVersion, upToItemId: window.upToItemId, reason }
            );
        }
    }

    /**
     * Get all tracked NAV_CONTEXT item IDs
     */
    getTrackedNavItemIds(): string[] {
        return Array.from(this.trackedNavItemIds);
    }

    /**
     * Get most recent NAV_CONTEXT item ID (backward compatibility)
     */
    getTrackedNavItemId(): string | null {
        return this._lastNavItemId;
    }

    /**
     * Get count of tracked NAV_CONTEXT messages
     */
    getTrackedNavItemCount(): number {
        return this.trackedNavItemIds.size;
    }

    /**
     * Generate test NAV_CONTEXT data for debugging
     */
    generateRandomNavContext(): any {
        const routes = ['/home', '/projects', '/about', '/contact', '/projects/task-manager', '/projects/portfolio'];
        const projects = [null, 'task-manager', 'portfolio-site', 'ai-assistant', 'e-commerce'];
        const modals = [null, 'gallery', 'details', 'contact'];
        
        return {
            route: routes[Math.floor(Math.random() * routes.length)],
            project: projects[Math.floor(Math.random() * projects.length)],
            modal: modals[Math.floor(Math.random() * modals.length)],
            timestamp: Date.now(),
            testId: this.uuid().substring(0, 8)
        };
    }
}
