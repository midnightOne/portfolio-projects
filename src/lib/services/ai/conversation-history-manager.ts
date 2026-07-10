/**
 * Unified Conversation History Manager
 * 
 * Comprehensive conversation storage and retrieval system designed from scratch
 * with proper architecture for scalable conversation management.
 * 
 * Features:
 * - Unified storage for text, voice, and hybrid conversations
 * - Scalable conversation ID system with proper session management
 * - Comprehensive metadata tracking and debug data storage
 * - Conversation search, filtering, and export capabilities
 * - Proper API separation between client and admin access
 */

import { prisma } from '@/lib/prisma';

// Message shape accepted by addMessage (salvaged from the deleted Gen-1
// unified-conversation-manager, Phase 3 task 2.4a)
export interface NavigationCommand {
    type: 'navigate' | 'highlight' | 'scroll' | 'modal';
    target: string;
    parameters: Record<string, any>;
    timing: 'immediate' | 'delayed' | 'synchronized';
    duration?: number;
}

export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    inputMode: 'text' | 'voice' | 'hybrid';
    /** D49: provider leg that produced this message (voice path); null on the text path today. */
    legId?: string;
    metadata?: {
        tokensUsed?: number;
        cost?: number;
        model?: string;
        processingTime?: number;
        voiceData?: {
            duration?: number;
            audioUrl?: string;
            transcription?: string;
        };
        contextUsed?: string[];
        navigationCommands?: NavigationCommand[];
        /** Adapter-side transcript item id (voice path) — dedupe key for /api/ai/conversation/log retries. */
        transcriptItemId?: string;
        /** Gateway request id (text path) — cross-reference to the AIUsageLog ledger row. */
        requestId?: string;
        /** Internal reasoning/thinking trace, stored separately from `content` (D22 amendment) — never the spoken answer, rendered collapsed by default. */
        reasoning?: string;
        /** Labeled event row (owner, 2026-07-07; clip_played D50/9b; context_flush/engine_directive
         *  conversation-engine A3/A4; window_prune J4) — `content` carries the human-readable label. */
        eventType?: 'navigation' | 'error' | 'clip_played' | 'context_flush' | 'engine_directive' | 'window_prune';
        detail?: string;
        /** 9b.5 turn ONSET (assistant voice rows): when the turn's first audio became audible; the row timestamp is turn-END. */
        firstAudioAt?: string;
        /** Task A4 (D47): UI-state deltas since the previous user turn — the engine's ui_state transition evidence. */
        uiEvidence?: Array<Record<string, unknown>>;
    };
}

// Core conversation history types
export interface ConversationRecord {
    id: string;
    sessionId: string;
    reflinkId?: string;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
    startedAt: Date;
    lastMessageAt?: Date;
    /** D49 latest-state snapshot (null until the first leg/updateSession writes it). */
    latestState?: LatestStateSnapshot | null;
    metadata: ConversationMetadata;
    messages: ConversationMessageRecord[];
    /** D49 provider legs, oldest first (present when loaded with legs). */
    legs?: ConversationLegRecord[];
}

// ---- D49 session continuity types (task 5b) ----

export interface ConversationLegRecord {
    id: string;
    conversationId: string;
    provider: string;
    modelAlias?: string | null;
    modelId?: string | null;
    providerSessionId?: string | null;
    startedAt: Date;
    endedAt?: Date | null;
    endReason?: LegEndReason | null;
    metadata?: Record<string, unknown>;
}

export type LegEndReason =
    | 'user_disconnect'
    | 'disruption'
    | 'provider_switch'
    | 'duration_cap'
    | 'error'
    | 'superseded';

/** What a new leg needs to be briefed with — updated on every leg start and updateSession. */
export interface LatestStateSnapshot {
    provider?: string;
    modelAlias?: string;
    instructions?: string;
    activeTools?: string[];
    /** D47 node pointer, later. */
    nodeId?: string;
    /**
     * ConversationState optimistic-concurrency counter (Req 7.2, task J1):
     * bumped by EVERY latestState write in this manager — merge, engine merge,
     * and turn claim alike — generalizing the B3 CAS. The full typed contract
     * is ConversationStateSchema in src/lib/ai/engine/types.ts.
     */
    stateVersion?: number;
    updatedAt: string;
}

export type SessionMarkerType =
    | 'session_disruption'
    | 'session_resumed'
    /** D47 traversal telemetry (conversation-engine Req 7.1/7.3) */
    | 'node_transition'
    | 'edge_evaluated'
    /** Running conversation summary (Req 17.2/20.5, task J3) — ONE artifact for
     *  in-session pruning, cross-session briefings, and the admin transcript. */
    | 'conversation_summary';

export interface SessionMarker {
    type: SessionMarkerType;
    /** disruption: network | provider_error | token_expiry | watchdog | reload | forced_drill */
    issueType?: string;
    diagnostics?: Record<string, unknown>;
    /** resumed: the new leg's identity */
    legId?: string;
    provider?: string;
    modelAlias?: string;
    briefingSummary?: string;
    // ---- node_transition / edge_evaluated (D47, Req 7.1) ----
    fromNode?: string | null;
    toNode?: string;
    edgeId?: string | null;
    conditionType?: string | null;
    /** Compact evidence reference (utterance snippet / chip id / tool name). */
    evidence?: string;
    graphVersionId?: string;
    turnMessageId?: string | null;
    /** edge_evaluated: the evaluated-but-not-taken rows (debug sessions, Req 7.3). */
    evaluated?: Array<{ edgeId: string; fired: boolean; reason: string }>;
    // ---- conversation_summary (Req 17.2/20.5, task J3) ----
    /** The running summary text itself — rendered as the row's content. */
    summaryText?: string;
    summaryVersion?: number;
    /** Last message the summary covers (adapter transcriptItemId when the row
     *  has one, else the DB message id) — the J4 prune boundary. */
    upToMessageId?: string | null;
    /** The profile assessment this run produced (replay: what changed and when). */
    profile?: Record<string, unknown>;
}

export interface ConversationMessageRecord {
    id: string;
    conversationId: string;
    legId?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokensUsed?: number;
    costUsd?: number;
    modelUsed?: string;
    transportMode?: 'text' | 'voice' | 'hybrid';
    timestamp: Date;
    metadata: MessageMetadata;
}

export interface ConversationMetadata {
    userAgent?: string;
    ipAddress?: string;
    reflinkCode?: string;
    accessLevel?: 'no_access' | 'basic' | 'limited' | 'premium';
    sessionStartTime?: Date;
    conversationMode?: 'text' | 'voice' | 'hybrid';
    /** Runtime identity for leg-less conversations (/chat text/cascade — legs
     *  are the voice-session mechanism, D49): the admin browse view reads
     *  these as its provider/model fallback. */
    provider?: string;
    modelAlias?: string;
    averageResponseTime?: number;
    errorCount?: number;
    navigationCommandsUsed?: number;
    voiceInteractionCount?: number;
    contextSourcesUsed?: string[];
    userPreferences?: {
        tone?: 'technical' | 'casual' | 'professional';
        responseLength?: 'concise' | 'detailed' | 'comprehensive';
        includeNavigation?: boolean;
    };
}

export interface MessageMetadata {
    processingTime?: number;
    /** Internal reasoning/thinking trace, stored separately from the message content (D22 amendment). */
    reasoning?: string;
    /** Labeled event row (owner, 2026-07-07; clip_played D50/9b; context_flush/engine_directive
     *  conversation-engine A3/A4) — `content` carries the human-readable label. */
    eventType?: 'navigation' | 'error' | 'clip_played' | 'context_flush' | 'engine_directive';
    detail?: string;
    /** 9b.5 turn ONSET (assistant voice rows): when the turn's first audio became audible; the row timestamp is turn-END. */
    firstAudioAt?: string;
    /** Task A4 (D47): UI-state deltas since the previous user turn — the engine's ui_state transition evidence. */
    uiEvidence?: Array<Record<string, unknown>>;
    voiceData?: {
        duration?: number;
        audioUrl?: string;
        transcription?: string;
        voiceModel?: string;
        audioQuality?: string;
    };
    contextUsed?: string[];
    navigationCommands?: Array<{
        type: string;
        target: string;
        parameters: Record<string, any>;
        timing: string;
    }>;
    errorDetails?: {
        code: string;
        message: string;
        stack?: string;
        recoverable: boolean;
    };
    performanceMetrics?: {
        contextBuildTime?: number;
        aiRequestTime?: number;
        voiceGenerationTime?: number;
        totalProcessingTime?: number;
    };
    debugInfo?: {
        systemPrompt?: string;
        contextString?: string;
        aiRequest?: any;
        aiResponse?: any;
    };
}

// Debug data storage for admin access
export interface ConversationDebugRecord {
    id: string;
    conversationId: string;
    messageId?: string;
    sessionId: string;
    timestamp: Date;
    debugType: 'system_prompt' | 'context_snapshot' | 'ai_request' | 'ai_response' | 'error' | 'performance';
    debugData: any;
    metadata: {
        userAgent?: string;
        ipAddress?: string;
        reflinkId?: string;
        transportMode?: string;
        modelUsed?: string;
    };
}

// Search and filtering interfaces
export interface ConversationSearchOptions {
    sessionId?: string;
    reflinkId?: string;
    dateRange?: {
        start: Date;
        end: Date;
    };
    transportMode?: 'text' | 'voice' | 'hybrid';
    modelUsed?: string;
    hasErrors?: boolean;
    minTokens?: number;
    maxTokens?: number;
    contentSearch?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'timestamp' | 'tokens' | 'cost' | 'duration';
    sortOrder?: 'asc' | 'desc';
}

export interface ConversationExportOptions {
    format: 'json' | 'csv' | 'txt';
    includeMetadata: boolean;
    includeDebugData: boolean;
    includeVoiceData: boolean;
    dateRange?: {
        start: Date;
        end: Date;
    };
    sessionIds?: string[];
}

export interface ConversationStats {
    totalConversations: number;
    totalMessages: number;
    totalTokensUsed: number;
    totalCost: number;
    averageMessagesPerConversation: number;
    averageTokensPerMessage: number;
    averageCostPerConversation: number;
    transportModeBreakdown: {
        text: number;
        voice: number;
        hybrid: number;
    };
    modelUsageBreakdown: Record<string, number>;
    errorRate: number;
    averageResponseTime: number;
}

/**
 * Unified Conversation History Manager
 * 
 * Handles all conversation storage, retrieval, and management operations
 * with proper separation between client and admin access levels.
 */
export class ConversationHistoryManager {
    private static instance: ConversationHistoryManager;

    constructor() {
        // Initialize any required setup
    }

    static getInstance(): ConversationHistoryManager {
        if (!ConversationHistoryManager.instance) {
            ConversationHistoryManager.instance = new ConversationHistoryManager();
        }
        return ConversationHistoryManager.instance;
    }

    /**
     * Create a new conversation record
     */
    async createConversation(
        sessionId: string,
        reflinkId?: string,
        metadata: Partial<ConversationMetadata> = {}
    ): Promise<ConversationRecord> {
        try {
            const conversation = await prisma.aIConversation.create({
                data: {
                    sessionId,
                    reflinkId,
                    messageCount: 0,
                    totalTokens: 0,
                    totalCost: 0,
                    startedAt: new Date(),
                    metadata: {
                        ...metadata,
                        sessionStartTime: new Date(),
                        errorCount: 0,
                        navigationCommandsUsed: 0,
                        voiceInteractionCount: 0,
                        contextSourcesUsed: []
                    }
                },
                include: {
                    messages: {
                        orderBy: { timestamp: 'asc' }
                    }
                }
            });

            return this.mapPrismaConversationToRecord(conversation);
        } catch (error) {
            console.error('Failed to create conversation:', error);
            throw new Error('Failed to create conversation record');
        }
    }

    /**
     * Add a message to a conversation
     */
    async addMessage(
        conversationId: string,
        message: ConversationMessage,
        debugData?: {
            systemPrompt?: string;
            contextString?: string;
            aiRequest?: any;
            aiResponse?: any;
        }
    ): Promise<ConversationMessageRecord> {
        try {
            // Start a transaction to ensure data consistency
            const result = await prisma.$transaction(async (tx) => {
                // Create the message record
                const messageRecord = await tx.aIConversationMessage.create({
                    data: {
                        conversationId,
                        legId: message.legId,
                        role: message.role,
                        content: message.content,
                        tokensUsed: message.metadata?.tokensUsed,
                        costUsd: message.metadata?.cost,
                        modelUsed: message.metadata?.model,
                        transportMode: message.inputMode,
                        timestamp: message.timestamp,
                        metadata: {
                            processingTime: message.metadata?.processingTime,
                            voiceData: message.metadata?.voiceData,
                            contextUsed: message.metadata?.contextUsed,
                            transcriptItemId: message.metadata?.transcriptItemId,
                            requestId: message.metadata?.requestId,
                            reasoning: message.metadata?.reasoning,
                            eventType: message.metadata?.eventType,
                            detail: message.metadata?.detail,
                            firstAudioAt: message.metadata?.firstAudioAt,
                            // Task A4 (D47): ui_state transition evidence riding user turns
                            uiEvidence: message.metadata?.uiEvidence,
                            navigationCommands: message.metadata?.navigationCommands ? JSON.stringify(message.metadata.navigationCommands) : undefined,
                            performanceMetrics: {
                                totalProcessingTime: message.metadata?.processingTime
                            },
                            debugInfo: debugData
                        } as any
                    }
                });

                // Update conversation totals
                await tx.aIConversation.update({
                    where: { id: conversationId },
                    data: {
                        messageCount: { increment: 1 },
                        totalTokens: { increment: message.metadata?.tokensUsed || 0 },
                        totalCost: { increment: message.metadata?.cost || 0 },
                        lastMessageAt: message.timestamp
                    }
                });

                // Store debug data if provided
                if (debugData) {
                    await this.storeDebugData(
                        conversationId,
                        messageRecord.id,
                        conversationId, // Use conversationId as sessionId fallback
                        debugData
                    );
                }

                return messageRecord;
            });

            return this.mapPrismaMessageToRecord(result);
        } catch (error) {
            console.error('Failed to add message:', error);
            throw new Error('Failed to add message to conversation');
        }
    }

    /**
     * Store debug data for admin access
     */
    private async storeDebugData(
        conversationId: string,
        messageId: string,
        sessionId: string,
        debugData: {
            systemPrompt?: string;
            contextString?: string;
            aiRequest?: any;
            aiResponse?: any;
        }
    ): Promise<void> {
        try {
            const debugRecords = [];

            if (debugData.systemPrompt) {
                debugRecords.push({
                    conversationId,
                    messageId,
                    sessionId,
                    timestamp: new Date(),
                    debugType: 'system_prompt' as const,
                    debugData: { systemPrompt: debugData.systemPrompt },
                    metadata: {}
                });
            }

            if (debugData.contextString) {
                debugRecords.push({
                    conversationId,
                    messageId,
                    sessionId,
                    timestamp: new Date(),
                    debugType: 'context_snapshot' as const,
                    debugData: { contextString: debugData.contextString },
                    metadata: {}
                });
            }

            if (debugData.aiRequest) {
                debugRecords.push({
                    conversationId,
                    messageId,
                    sessionId,
                    timestamp: new Date(),
                    debugType: 'ai_request' as const,
                    debugData: debugData.aiRequest,
                    metadata: {}
                });
            }

            if (debugData.aiResponse) {
                debugRecords.push({
                    conversationId,
                    messageId,
                    sessionId,
                    timestamp: new Date(),
                    debugType: 'ai_response' as const,
                    debugData: debugData.aiResponse,
                    metadata: {}
                });
            }

            // Store debug records in a separate table (we'll need to create this)
            // For now, we'll store it in the message metadata
        } catch (error) {
            console.error('Failed to store debug data:', error);
            // Don't throw here as this is supplementary data
        }
    }

    /**
     * Get conversation by session ID (client access)
     */
    /**
     * Idempotency check for the voice log route: has this adapter transcript
     * item already been persisted into the conversation?
     */
    async hasTranscriptItem(conversationId: string, transcriptItemId: string): Promise<boolean> {
        const row = await prisma.aIConversationMessage.findFirst({
            where: {
                conversationId,
                metadata: { path: ['transcriptItemId'], equals: transcriptItemId }
            },
            select: { id: true }
        });
        return row !== null;
    }

    /**
     * Get the conversation id for a session, creating the conversation when it
     * does not exist yet — without loading the full message history (write-path
     * helper for task 2b; addMessage maintains the counters).
     */
    async getOrCreateConversationId(
        sessionId: string,
        reflinkId?: string,
        metadata: Partial<ConversationMetadata> = {}
    ): Promise<string> {
        const existing = await prisma.aIConversation.findFirst({
            where: { sessionId },
            select: { id: true }
        });
        if (existing) return existing.id;
        try {
            const created = await this.createConversation(sessionId, reflinkId, metadata);
            return created.id;
        } catch (error) {
            // Concurrent first writes on a fresh session (session_start + the
            // first transcript post) race this check-then-create; sessionId is
            // UNIQUE, so the loser lands here — adopt the winner's conversation
            // instead of splitting the session across two rows.
            const winner = await prisma.aIConversation.findUnique({
                where: { sessionId },
                select: { id: true }
            });
            if (winner) return winner.id;
            throw error;
        }
    }

    // ---- D49 session continuity (task 5b) ----

    /**
     * Start a new provider leg. Any dangling open leg on the conversation is
     * closed first (endReason 'superseded') so there is exactly one open leg.
     */
    async startLeg(
        conversationId: string,
        leg: {
            provider: string;
            modelAlias?: string;
            modelId?: string;
            providerSessionId?: string;
            metadata?: Record<string, unknown>;
        }
    ): Promise<ConversationLegRecord> {
        await prisma.aIConversationLeg.updateMany({
            where: { conversationId, endedAt: null },
            data: { endedAt: new Date(), endReason: 'superseded' }
        });
        const created = await prisma.aIConversationLeg.create({
            data: {
                conversationId,
                provider: leg.provider,
                modelAlias: leg.modelAlias,
                modelId: leg.modelId,
                providerSessionId: leg.providerSessionId,
                metadata: (leg.metadata ?? {}) as any
            }
        });
        await this.updateLatestState(conversationId, {
            provider: leg.provider,
            modelAlias: leg.modelAlias,
        });
        return created as unknown as ConversationLegRecord;
    }

    /** Close the conversation's open leg (no-op when none is open). */
    async endLeg(
        conversationId: string,
        endReason: LegEndReason,
        usage?: { responses?: number; inputTokens?: number; outputTokens?: number; totalTokens?: number }
    ): Promise<void> {
        const openLeg = await prisma.aIConversationLeg.findFirst({
            where: { conversationId, endedAt: null },
            select: { id: true, metadata: true }
        });
        await prisma.aIConversationLeg.updateMany({
            where: { conversationId, endedAt: null },
            data: { endedAt: new Date(), endReason }
        });
        // Per-leg token accounting (owner ask, 2026-07-08): the leg keeps its
        // realtime usage in metadata. The conversation's totalTokens aggregate
        // is fed by per-response usageDelta posts (live counter), NOT here —
        // incrementing in both places would double-count.
        if (usage && openLeg && (usage.totalTokens ?? 0) > 0) {
            const existing = (openLeg.metadata && typeof openLeg.metadata === 'object')
                ? openLeg.metadata as Record<string, unknown>
                : {};
            await prisma.aIConversationLeg.update({
                where: { id: openLeg.id },
                data: { metadata: { ...existing, usage } as any }
            });
        }
    }

    /** Live token counter (owner, 2026-07-08): per-response delta from the
     *  adapter — the "N tok" header counts up while the conversation runs
     *  instead of staying 0 until a clean disconnect that may never come. */
    async addUsageDelta(conversationId: string, totalTokens: number): Promise<void> {
        if (!totalTokens || totalTokens <= 0) return;
        await prisma.aIConversation.update({
            where: { id: conversationId },
            data: { totalTokens: { increment: totalTokens } }
        });
    }

    /** The currently open leg id, for tagging incoming messages. */
    async getOpenLegId(conversationId: string): Promise<string | null> {
        const leg = await prisma.aIConversationLeg.findFirst({
            where: { conversationId, endedAt: null },
            orderBy: { startedAt: 'desc' },
            select: { id: true }
        });
        return leg?.id ?? null;
    }

    /**
     * Write a D49 marker event (session_disruption / session_resumed) into the
     * conversation history itself — replay shows a failed-and-recovered
     * conversation without the owner having been present. Markers are system
     * rows with metadata.markerType; they carry no modality label (not speech,
     * not typed text).
     */
    async recordSessionMarker(conversationId: string, marker: SessionMarker): Promise<void> {
        const content =
            marker.type === 'session_disruption' ? `[session_disruption] ${marker.issueType ?? 'unknown'}`
            : marker.type === 'session_resumed' ? `[session_resumed] ${marker.provider ?? 'unknown'}${marker.modelAlias ? ` (${marker.modelAlias})` : ''}`
            // D47 traversal telemetry (Req 7.1): inline with the transcript,
            // attributable to the exact graph version the conversation runs under
            : marker.type === 'node_transition' ? `[node_transition] ${marker.fromNode ?? '∅'} → ${marker.toNode}${marker.conditionType ? ` (${marker.conditionType})` : ''}`
            // Summary rows carry the summary TEXT as content — the admin
            // transcript renders it directly (Req 17.2), replay shows the
            // memory the model resumes/prunes onto.
            : marker.type === 'conversation_summary' ? `[summary v${marker.summaryVersion ?? '?'}] ${marker.summaryText ?? ''}`
            : `[edge_evaluated] ${marker.evaluated?.length ?? 0} edge(s)${marker.evaluated?.some((r) => r.fired) ? ' — one fired' : ', none fired'}`;
        await prisma.$transaction([
            prisma.aIConversationMessage.create({
                data: {
                    conversationId,
                    legId: marker.legId,
                    role: 'system',
                    content,
                    timestamp: new Date(),
                    metadata: {
                        markerType: marker.type,
                        issueType: marker.issueType,
                        diagnostics: marker.diagnostics,
                        provider: marker.provider,
                        modelAlias: marker.modelAlias,
                        briefingSummary: marker.briefingSummary,
                        // D47 fields (undefined keys are dropped by Prisma Json)
                        fromNode: marker.fromNode,
                        toNode: marker.toNode,
                        edgeId: marker.edgeId,
                        conditionType: marker.conditionType,
                        evidence: marker.evidence,
                        graphVersionId: marker.graphVersionId,
                        turnMessageId: marker.turnMessageId,
                        // Capped whole-row (never mid-JSON truncation): 30 edges × 150-char reasons
                        evaluated: marker.evaluated
                            ? marker.evaluated.slice(0, 30).map((r) => ({ ...r, reason: r.reason.slice(0, 150) }))
                            : undefined,
                        // conversation_summary fields (J3) — version + prune
                        // boundary + the profile this run produced
                        summaryVersion: marker.summaryVersion,
                        upToMessageId: marker.upToMessageId,
                        profile: marker.profile
                    } as any
                }
            }),
            prisma.aIConversation.update({
                where: { id: conversationId },
                data: { messageCount: { increment: 1 }, lastMessageAt: new Date() }
            })
        ]);
    }

    /** Merge fields into the conversation's latest-state snapshot (cheap write, D49). */
    async updateLatestState(
        conversationId: string,
        patch: Partial<Omit<LatestStateSnapshot, 'updatedAt'>>
    ): Promise<void> {
        const existing = await prisma.aIConversation.findUnique({
            where: { id: conversationId },
            select: { latestState: true }
        });
        const current = (existing?.latestState ?? {}) as Partial<LatestStateSnapshot>;
        await prisma.aIConversation.update({
            where: { id: conversationId },
            data: {
                latestState: {
                    ...current,
                    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
                    // ConversationState contract (Req 7.2, J1): every write bumps
                    // the snapshot's optimistic-concurrency counter
                    stateVersion: (typeof current.stateVersion === 'number' ? current.stateVersion : 0) + 1,
                    updatedAt: new Date().toISOString()
                } as any
            }
        });
    }

    // ---- D47 engine state (conversation-engine Block B; notes §3 serverless truths) ----
    // The engine's keys live under latestState.engine; every write MERGES at
    // the JSONB level (P18 — sibling keys owned by legs code stay untouched)
    // and the per-turn claim is a single atomic compare-and-set (P3 — no
    // advisory locks, no queues). Raw SQL because Prisma's update() cannot
    // merge JSON and updateMany() cannot CAS-and-merge in one statement
    // (implementer's call blessed by notes §3; recorded in the Block B ledger).

    /** Light conversation lookup for engine hooks (no message loading). */
    async getConversationRefBySessionId(sessionId: string): Promise<{ id: string; latestState: unknown } | null> {
        const row = await prisma.aIConversation.findUnique({
            where: { sessionId },
            select: { id: true, latestState: true }
        });
        return row ? { id: row.id, latestState: row.latestState } : null;
    }

    /** Raw latestState.engine value (tolerant parsing is the engine's job — P18). */
    async readEngineStateRaw(conversationId: string): Promise<unknown> {
        const row = await prisma.aIConversation.findUnique({
            where: { id: conversationId },
            select: { latestState: true }
        });
        return (row?.latestState as Record<string, unknown> | null)?.engine ?? null;
    }

    /**
     * Merge a patch into latestState.engine atomically (JSONB-level merge, P18).
     * When the patch moves the node pointer, the top-level `nodeId` mirror (the
     * D49 snapshot's reserved D47 pointer) is updated in the same statement.
     */
    async mergeEngineState(conversationId: string, patch: Record<string, unknown>): Promise<void> {
        const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
        const topLevel: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if ('nodeId' in defined) topLevel.nodeId = defined.nodeId;
        // stateVersion bump (Req 7.2, J1) is computed in SQL so it stays
        // correct under concurrent writers — jsonb || applies left to right.
        await prisma.$executeRaw`
            UPDATE ai_conversations
            SET latest_state = jsonb_set(
                    COALESCE(latest_state, '{}'::jsonb),
                    '{engine}',
                    COALESCE(latest_state->'engine', '{}'::jsonb) || ${JSON.stringify(defined)}::jsonb
                ) || ${JSON.stringify(topLevel)}::jsonb
                  || jsonb_build_object('stateVersion', COALESCE((latest_state->>'stateVersion')::int, 0) + 1)
            WHERE id = ${conversationId}`;
    }

    /**
     * G2 (Req 13.8, P36): visitor preferences under latestState.prefs — a
     * NON-engine sibling key (the auto-nav toggle must survive graph archival
     * and exist graph-less). Same atomic jsonb merge discipline as the engine
     * key (P18): merge, never blob-replace; stateVersion bumps in SQL.
     */
    async mergeConversationPrefs(conversationId: string, patch: Record<string, unknown>): Promise<void> {
        const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
        if (Object.keys(defined).length === 0) return;
        await prisma.$executeRaw`
            UPDATE ai_conversations
            SET latest_state = jsonb_set(
                    COALESCE(latest_state, '{}'::jsonb),
                    '{prefs}',
                    COALESCE(latest_state->'prefs', '{}'::jsonb) || ${JSON.stringify(defined)}::jsonb
                ) || jsonb_build_object('updatedAt', ${new Date().toISOString()}::text)
                  || jsonb_build_object('stateVersion', COALESCE((latest_state->>'stateVersion')::int, 0) + 1)
            WHERE id = ${conversationId}`;
    }

    /**
     * P3 optimistic claim: set engine.lastEvaluatedTurnId = turnId iff it still
     * equals `expected` (IS NOT DISTINCT FROM handles the turn-zero null).
     * Zero rows updated = a concurrent invocation won; the caller aborts the
     * whole transition silently — no markers, no directive.
     */
    async claimEngineTurn(conversationId: string, expected: string | null, turnId: string): Promise<boolean> {
        const updated = await prisma.$executeRaw`
            UPDATE ai_conversations
            SET latest_state = jsonb_set(
                    COALESCE(latest_state, '{}'::jsonb),
                    '{engine}',
                    COALESCE(latest_state->'engine', '{}'::jsonb) || jsonb_build_object('lastEvaluatedTurnId', ${turnId}::text)
                ) || jsonb_build_object('stateVersion', COALESCE((latest_state->>'stateVersion')::int, 0) + 1)
            WHERE id = ${conversationId}
              AND (latest_state->'engine'->>'lastEvaluatedTurnId') IS NOT DISTINCT FROM ${expected}`;
        return updated > 0;
    }

    /**
     * P29 staleness trigger + in-flight guard for the behavior summarizer
     * (task J3), as ONE atomic claim: succeeds only when the engine steers
     * this conversation (nodeId non-null — removal safety, Req 2.7), no run is
     * in flight (or the in-flight stamp is stale — a crashed serverless
     * invocation must not wedge the summarizer forever), and the last
     * completed run is older than the interval. Winning the claim stamps
     * summarizerInFlightSince; the job clears it on completion or failure.
     */
    async claimSummarizerRun(
        conversationId: string,
        intervalMs: number,
        inFlightStaleMs: number
    ): Promise<boolean> {
        const now = new Date();
        const nowIso = now.toISOString();
        const intervalFloor = new Date(now.getTime() - intervalMs).toISOString();
        const staleFloor = new Date(now.getTime() - inFlightStaleMs).toISOString();
        const updated = await prisma.$executeRaw`
            UPDATE ai_conversations
            SET latest_state = jsonb_set(
                    COALESCE(latest_state, '{}'::jsonb),
                    '{engine}',
                    COALESCE(latest_state->'engine', '{}'::jsonb) || jsonb_build_object('summarizerInFlightSince', ${nowIso}::text)
                ) || jsonb_build_object('stateVersion', COALESCE((latest_state->>'stateVersion')::int, 0) + 1)
            WHERE id = ${conversationId}
              AND (latest_state->'engine'->>'nodeId') IS NOT NULL
              AND (
                    (latest_state->'engine'->>'summarizerInFlightSince') IS NULL
                 OR (latest_state->'engine'->>'summarizerInFlightSince')::timestamptz < ${staleFloor}::timestamptz
              )
              AND (
                    (latest_state->'engine'->>'lastSummarizerRunAt') IS NULL
                 OR (latest_state->'engine'->>'lastSummarizerRunAt')::timestamptz < ${intervalFloor}::timestamptz
              )`;
        return updated > 0;
    }

    /** Latest running-summary row (Req 20.5) — the ONE artifact briefings, pruning, and the batch share. */
    async getLatestConversationSummary(conversationId: string): Promise<{
        summaryText: string;
        summaryVersion: number;
        upToMessageId: string | null;
        createdAt: Date;
    } | null> {
        const row = await prisma.aIConversationMessage.findFirst({
            where: {
                conversationId,
                metadata: { path: ['markerType'], equals: 'conversation_summary' }
            },
            orderBy: { timestamp: 'desc' },
            select: { content: true, timestamp: true, metadata: true }
        });
        if (!row) return null;
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const version = typeof meta.summaryVersion === 'number' ? meta.summaryVersion : 0;
        // Content carries a "[summary vN] " prefix for transcript readability —
        // strip it back off for prompt use.
        const text = row.content.replace(/^\[summary v[^\]]*\]\s*/, '');
        return {
            summaryText: text,
            summaryVersion: version,
            upToMessageId: typeof meta.upToMessageId === 'string' ? meta.upToMessageId : null,
            createdAt: row.timestamp
        };
    }

    /**
     * User/assistant turns AFTER a given message (by that row's timestamp;
     * null = from the start), oldest first — the summarizer's incremental
     * input (J3). Returns the adapter transcriptItemId alongside the DB id so
     * the summary's prune boundary can speak the CLIENT's item language (J4).
     */
    async getTurnsSince(
        conversationId: string,
        afterMessageId: string | null,
        cap = 60
    ): Promise<Array<{ id: string; itemId: string; role: 'user' | 'assistant'; content: string }>> {
        let afterTimestamp: Date | null = null;
        if (afterMessageId) {
            const anchor = await prisma.aIConversationMessage.findFirst({
                where: {
                    conversationId,
                    OR: [
                        { id: afterMessageId },
                        { metadata: { path: ['transcriptItemId'], equals: afterMessageId } }
                    ]
                },
                select: { timestamp: true }
            });
            afterTimestamp = anchor?.timestamp ?? null;
        }
        const rows = await prisma.aIConversationMessage.findMany({
            where: {
                conversationId,
                role: { in: ['user', 'assistant'] },
                ...(afterTimestamp ? { timestamp: { gt: afterTimestamp } } : {})
            },
            orderBy: { timestamp: 'asc' },
            take: cap,
            select: { id: true, role: true, content: true, metadata: true }
        });
        return rows.map((r) => ({
            id: r.id,
            itemId: ((r.metadata as Record<string, unknown> | null)?.transcriptItemId as string | undefined) ?? r.id,
            role: r.role as 'user' | 'assistant',
            content: r.content
        }));
    }

    /**
     * Latest conversation on a reflink that actually got somewhere (≥1 user
     * turn) — the returning-visitor resume target (Block I3, Req 17.1). The
     * reflink is the ONLY access control on this lookup (P32 — the client
     * continuity marker merely selects auto-resume vs confirm UX); a revoked
     * reflink never reaches here because validation fails upstream (Req 21.5).
     * `summaryLine` is the safe one-liner for the cross-device confirmation
     * (Req 21.1) — never raw transcript content.
     */
    async getLatestConversationForReflink(reflinkId: string): Promise<{
        conversationId: string;
        sessionId: string;
        lastActivityAt: Date | null;
        summaryLine: string | null;
    } | null> {
        const conversation = await prisma.aIConversation.findFirst({
            where: { reflinkId, messages: { some: { role: 'user' } } },
            orderBy: [{ lastMessageAt: 'desc' }, { startedAt: 'desc' }],
            select: { id: true, sessionId: true, lastMessageAt: true }
        });
        if (!conversation) return null;
        const summary = await this.getLatestConversationSummary(conversation.id);
        const summaryLine = summary
            ? (() => {
                  const firstSentence = summary.summaryText.split(/(?<=[.!?])\s/)[0] ?? summary.summaryText;
                  return firstSentence.length > 160 ? `${firstSentence.slice(0, 157)}…` : firstSentence;
              })()
            : null;
        return {
            conversationId: conversation.id,
            sessionId: conversation.sessionId,
            lastActivityAt: conversation.lastMessageAt,
            summaryLine
        };
    }

    /**
     * Everything a new leg needs to continue an interrupted conversation:
     * the latest-state snapshot + a bounded recap of recent turns. Ground truth
     * only — provider-side memory from earlier legs is gone and never assumed.
     *
     * Req 17.3 (Block I3): when a running summary exists, the briefing is
     * `summary + the last few verbatim turns` instead of a longer raw recap;
     * no summary yet (same-day resume before any summarizer run) falls back to
     * the full-recap briefing — the P24 ladder, never blocking on generating
     * a summary inline.
     */
    async getResumeBriefing(
        sessionId: string,
        recapTurns = 8
    ): Promise<{
        conversationId: string;
        snapshot: LatestStateSnapshot | null;
        recentTurns: Array<{ role: string; content: string }>;
        lastDisruption?: { issueType?: string; at?: Date };
        /** The running conversation summary (Req 20.5 — the ONE artifact), when one exists. */
        summary?: { text: string; version: number; createdAt: Date };
    } | null> {
        const conversation = await prisma.aIConversation.findFirst({
            where: { sessionId },
            select: { id: true, latestState: true }
        });
        if (!conversation) return null;

        const summary = await this.getLatestConversationSummary(conversation.id);
        // Summary present → a short verbatim tail suffices (the summary carries
        // the rest); absent → today's full-recap briefing (P24 fallback).
        const verbatimCap = summary ? Math.min(recapTurns, 4) : recapTurns;

        const recent = await prisma.aIConversationMessage.findMany({
            where: { conversationId: conversation.id, role: { in: ['user', 'assistant'] } },
            orderBy: { timestamp: 'desc' },
            take: verbatimCap,
            select: { role: true, content: true }
        });
        const lastMarker = await prisma.aIConversationMessage.findFirst({
            where: {
                conversationId: conversation.id,
                metadata: { path: ['markerType'], equals: 'session_disruption' }
            },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true, metadata: true }
        });

        return {
            conversationId: conversation.id,
            snapshot: (conversation.latestState as unknown as LatestStateSnapshot | null) ?? null,
            recentTurns: recent.reverse().map((m) => ({
                role: m.role,
                content: m.content.length > 600 ? `${m.content.slice(0, 600)}…` : m.content
            })),
            lastDisruption: lastMarker
                ? { issueType: (lastMarker.metadata as any)?.issueType, at: lastMarker.timestamp }
                : undefined,
            summary: summary
                ? { text: summary.summaryText, version: summary.summaryVersion, createdAt: summary.createdAt }
                : undefined
        };
    }

    /** Legs for a conversation, oldest first (admin replay). */
    async getLegs(conversationId: string): Promise<ConversationLegRecord[]> {
        const legs = await prisma.aIConversationLeg.findMany({
            where: { conversationId },
            orderBy: { startedAt: 'asc' }
        });
        return legs as unknown as ConversationLegRecord[];
    }

    async getConversationBySessionId(sessionId: string): Promise<ConversationRecord | null> {
        try {
            const conversation = await prisma.aIConversation.findFirst({
                where: { sessionId },
                include: {
                    messages: {
                        orderBy: { timestamp: 'asc' }
                    },
                    legs: {
                        orderBy: { startedAt: 'asc' }
                    }
                }
            });

            return conversation ? this.mapPrismaConversationToRecord(conversation) : null;
        } catch (error) {
            console.error('Failed to get conversation by session ID:', error);
            return null;
        }
    }

    /**
     * Get conversation by ID (admin access)
     */
    async getConversationById(conversationId: string): Promise<ConversationRecord | null> {
        try {
            const conversation = await prisma.aIConversation.findUnique({
                where: { id: conversationId },
                include: {
                    messages: {
                        orderBy: { timestamp: 'asc' }
                    },
                    legs: {
                        orderBy: { startedAt: 'asc' }
                    }
                }
            });

            return conversation ? this.mapPrismaConversationToRecord(conversation) : null;
        } catch (error) {
            console.error('Failed to get conversation by ID:', error);
            return null;
        }
    }

    /**
     * Search conversations with filtering (admin access)
     */
    async searchConversations(options: ConversationSearchOptions): Promise<{
        conversations: ConversationRecord[];
        total: number;
        hasMore: boolean;
    }> {
        try {
            const where: any = {};

            // Apply filters
            if (options.sessionId) {
                where.sessionId = options.sessionId;
            }

            if (options.reflinkId) {
                where.reflinkId = options.reflinkId;
            }

            if (options.dateRange) {
                where.startedAt = {
                    gte: options.dateRange.start,
                    lte: options.dateRange.end
                };
            }

            if (options.hasErrors !== undefined) {
                where.metadata = {
                    path: ['errorCount'],
                    gt: options.hasErrors ? 0 : undefined,
                    equals: options.hasErrors ? undefined : 0
                };
            }

            if (options.minTokens || options.maxTokens) {
                where.totalTokens = {};
                if (options.minTokens) where.totalTokens.gte = options.minTokens;
                if (options.maxTokens) where.totalTokens.lte = options.maxTokens;
            }

            // Content search in messages
            if (options.contentSearch) {
                where.messages = {
                    some: {
                        content: {
                            contains: options.contentSearch,
                            mode: 'insensitive'
                        }
                    }
                };
            }

            // Transport mode filter
            if (options.transportMode) {
                where.messages = {
                    some: {
                        transportMode: options.transportMode
                    }
                };
            }

            // Model filter
            if (options.modelUsed) {
                where.messages = {
                    some: {
                        modelUsed: options.modelUsed
                    }
                };
            }

            // Get total count
            const total = await prisma.aIConversation.count({ where });

            // Get conversations with pagination
            const conversations = await prisma.aIConversation.findMany({
                where,
                include: {
                    messages: {
                        orderBy: { timestamp: 'asc' }
                    }
                },
                orderBy: {
                    [this.mapSortByField(options.sortBy) || 'startedAt']: options.sortOrder || 'desc'
                },
                take: options.limit || 50,
                skip: options.offset || 0
            });

            const records = conversations.map(conv => this.mapPrismaConversationToRecord(conv));
            const hasMore = (options.offset || 0) + conversations.length < total;

            return {
                conversations: records,
                total,
                hasMore
            };
        } catch (error) {
            console.error('Failed to search conversations:', error);
            throw new Error('Failed to search conversations');
        }
    }

    /**
     * Get conversation statistics (admin access)
     */
    async getConversationStats(dateRange?: { start: Date; end: Date }): Promise<ConversationStats> {
        try {
            const where: any = {};
            if (dateRange) {
                where.startedAt = {
                    gte: dateRange.start,
                    lte: dateRange.end
                };
            }

            const [
                totalConversations,
                totalMessages,
                tokenStats,
                costStats,
                transportStats,
                modelStats,
                errorStats
            ] = await Promise.all([
                // Total conversations
                prisma.aIConversation.count({ where }),

                // Total messages
                prisma.aIConversationMessage.count({
                    where: dateRange ? {
                        conversation: {
                            startedAt: {
                                gte: dateRange.start,
                                lte: dateRange.end
                            }
                        }
                    } : undefined
                }),

                // Token statistics
                prisma.aIConversation.aggregate({
                    where,
                    _sum: { totalTokens: true },
                    _avg: { totalTokens: true }
                }),

                // Cost statistics
                prisma.aIConversation.aggregate({
                    where,
                    _sum: { totalCost: true },
                    _avg: { totalCost: true }
                }),

                // Transport mode breakdown
                prisma.aIConversationMessage.groupBy({
                    by: ['transportMode'],
                    _count: true,
                    where: dateRange ? {
                        conversation: {
                            startedAt: {
                                gte: dateRange.start,
                                lte: dateRange.end
                            }
                        }
                    } : undefined
                }),

                // Model usage breakdown
                prisma.aIConversationMessage.groupBy({
                    by: ['modelUsed'],
                    _count: true,
                    where: dateRange ? {
                        conversation: {
                            startedAt: {
                                gte: dateRange.start,
                                lte: dateRange.end
                            }
                        }
                    } : undefined
                }),

                // Error statistics
                prisma.aIConversation.aggregate({
                    where: {
                        ...where,
                        metadata: {
                            path: ['errorCount'],
                            gt: 0
                        }
                    },
                    _count: true
                })
            ]);

            // Calculate transport mode breakdown
            const transportModeBreakdown = {
                text: 0,
                voice: 0,
                hybrid: 0
            };

            transportStats.forEach(stat => {
                if (stat.transportMode && stat.transportMode in transportModeBreakdown) {
                    transportModeBreakdown[stat.transportMode as keyof typeof transportModeBreakdown] = stat._count;
                }
            });

            // Calculate model usage breakdown
            const modelUsageBreakdown: Record<string, number> = {};
            modelStats.forEach(stat => {
                if (stat.modelUsed) {
                    modelUsageBreakdown[stat.modelUsed] = stat._count;
                }
            });

            return {
                totalConversations,
                totalMessages,
                totalTokensUsed: tokenStats._sum.totalTokens || 0,
                totalCost: Number(costStats._sum.totalCost) || 0,
                averageMessagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0,
                averageTokensPerMessage: totalMessages > 0 ? (tokenStats._sum.totalTokens || 0) / totalMessages : 0,
                averageCostPerConversation: Number(costStats._avg.totalCost) || 0,
                transportModeBreakdown,
                modelUsageBreakdown,
                errorRate: totalConversations > 0 ? (errorStats._count / totalConversations) * 100 : 0,
                averageResponseTime: 0 // Would need to calculate from performance metrics
            };
        } catch (error) {
            console.error('Failed to get conversation stats:', error);
            throw new Error('Failed to get conversation statistics');
        }
    }

    /**
     * Export conversations in various formats (admin access)
     */
    async exportConversations(options: ConversationExportOptions): Promise<string> {
        try {
            const searchOptions: ConversationSearchOptions = {
                dateRange: options.dateRange,
                limit: 10000 // Large limit for export
            };

            if (options.sessionIds && options.sessionIds.length > 0) {
                // Export specific sessions - we'll need to modify search to handle this
                // For now, we'll export all and filter
            }

            const { conversations } = await this.searchConversations(searchOptions);

            // Filter by session IDs if provided
            const filteredConversations = options.sessionIds && options.sessionIds.length > 0
                ? conversations.filter(conv => options.sessionIds!.includes(conv.sessionId))
                : conversations;

            switch (options.format) {
                case 'json':
                    return this.exportAsJSON(filteredConversations, options);
                case 'csv':
                    return this.exportAsCSV(filteredConversations, options);
                case 'txt':
                    return this.exportAsText(filteredConversations, options);
                default:
                    throw new Error('Unsupported export format');
            }
        } catch (error) {
            console.error('Failed to export conversations:', error);
            throw new Error('Failed to export conversations');
        }
    }

    /**
     * Delete conversation (admin access)
     */
    async deleteConversation(conversationId: string): Promise<void> {
        try {
            await prisma.aIConversation.delete({
                where: { id: conversationId }
            });
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            throw new Error('Failed to delete conversation');
        }
    }

    /**
     * Clear old conversations (cleanup utility)
     */
    async clearOldConversations(olderThanDays: number): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const result = await prisma.aIConversation.deleteMany({
                where: {
                    startedAt: {
                        lt: cutoffDate
                    }
                }
            });

            return result.count;
        } catch (error) {
            console.error('Failed to clear old conversations:', error);
            throw new Error('Failed to clear old conversations');
        }
    }

    // Private helper methods

    private mapSortByField(sortBy?: string): string {
        switch (sortBy) {
            case 'timestamp':
                return 'startedAt';
            case 'tokens':
                return 'totalTokens';
            case 'cost':
                return 'totalCost';
            case 'duration':
                return 'startedAt'; // We don't have a duration field, so use startedAt
            default:
                return sortBy || 'startedAt';
        }
    }

    private mapPrismaConversationToRecord(conversation: any): ConversationRecord {
        return {
            id: conversation.id,
            sessionId: conversation.sessionId,
            reflinkId: conversation.reflinkId,
            messageCount: conversation.messageCount,
            totalTokens: conversation.totalTokens,
            totalCost: Number(conversation.totalCost),
            startedAt: conversation.startedAt,
            lastMessageAt: conversation.lastMessageAt,
            latestState: (conversation.latestState as LatestStateSnapshot | null) ?? null,
            metadata: conversation.metadata as ConversationMetadata,
            messages: conversation.messages?.map((msg: any) => this.mapPrismaMessageToRecord(msg)) || [],
            legs: conversation.legs?.map((leg: any) => leg as ConversationLegRecord)
        };
    }

    private mapPrismaMessageToRecord(message: any): ConversationMessageRecord {
        return {
            id: message.id,
            conversationId: message.conversationId,
            legId: message.legId ?? undefined,
            role: message.role,
            content: message.content,
            tokensUsed: message.tokensUsed,
            costUsd: message.costUsd ? Number(message.costUsd) : undefined,
            modelUsed: message.modelUsed,
            transportMode: message.transportMode,
            timestamp: message.timestamp,
            metadata: message.metadata as MessageMetadata
        };
    }

    private exportAsJSON(conversations: ConversationRecord[], options: ConversationExportOptions): string {
        const exportData = conversations.map(conv => ({
            id: conv.id,
            sessionId: conv.sessionId,
            reflinkId: conv.reflinkId,
            messageCount: conv.messageCount,
            totalTokens: conv.totalTokens,
            totalCost: conv.totalCost,
            startedAt: conv.startedAt,
            lastMessageAt: conv.lastMessageAt,
            metadata: options.includeMetadata ? conv.metadata : undefined,
            messages: conv.messages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                tokensUsed: msg.tokensUsed,
                costUsd: msg.costUsd,
                modelUsed: msg.modelUsed,
                transportMode: msg.transportMode,
                timestamp: msg.timestamp,
                metadata: options.includeMetadata ? msg.metadata : undefined,
                voiceData: options.includeVoiceData ? msg.metadata.voiceData : undefined,
                debugInfo: options.includeDebugData ? msg.metadata.debugInfo : undefined
            }))
        }));

        return JSON.stringify(exportData, null, 2);
    }

    private exportAsCSV(conversations: ConversationRecord[], options: ConversationExportOptions): string {
        const headers = [
            'Conversation ID',
            'Session ID',
            'Reflink ID',
            'Message Count',
            'Total Tokens',
            'Total Cost',
            'Started At',
            'Last Message At',
            'Message ID',
            'Role',
            'Content',
            'Tokens Used',
            'Cost USD',
            'Model Used',
            'Transport Mode',
            'Message Timestamp'
        ];

        if (options.includeMetadata) {
            headers.push('Processing Time', 'Navigation Commands', 'Context Used');
        }

        if (options.includeVoiceData) {
            headers.push('Voice Duration', 'Voice Model', 'Audio URL');
        }

        const rows = [headers.join(',')];

        conversations.forEach(conv => {
            conv.messages.forEach(msg => {
                const row = [
                    conv.id,
                    conv.sessionId,
                    conv.reflinkId || '',
                    conv.messageCount,
                    conv.totalTokens,
                    conv.totalCost,
                    conv.startedAt.toISOString(),
                    conv.lastMessageAt?.toISOString() || '',
                    msg.id,
                    msg.role,
                    `"${msg.content.replace(/"/g, '""')}"`, // Escape quotes
                    msg.tokensUsed || '',
                    msg.costUsd || '',
                    msg.modelUsed || '',
                    msg.transportMode || '',
                    msg.timestamp.toISOString()
                ];

                if (options.includeMetadata) {
                    row.push(
                        msg.metadata.processingTime?.toString() || '',
                        msg.metadata.navigationCommands ? JSON.stringify(msg.metadata.navigationCommands) : '',
                        msg.metadata.contextUsed ? msg.metadata.contextUsed.join(';') : ''
                    );
                }

                if (options.includeVoiceData && msg.metadata.voiceData) {
                    row.push(
                        msg.metadata.voiceData.duration?.toString() || '',
                        msg.metadata.voiceData.voiceModel || '',
                        msg.metadata.voiceData.audioUrl || ''
                    );
                }

                rows.push(row.join(','));
            });
        });

        return rows.join('\n');
    }

    private exportAsText(conversations: ConversationRecord[], options: ConversationExportOptions): string {
        const lines: string[] = [];

        conversations.forEach(conv => {
            lines.push(`=== Conversation ${conv.id} ===`);
            lines.push(`Session: ${conv.sessionId}`);
            lines.push(`Started: ${conv.startedAt.toISOString()}`);
            lines.push(`Messages: ${conv.messageCount}`);
            lines.push(`Tokens: ${conv.totalTokens}`);
            lines.push(`Cost: $${conv.totalCost.toFixed(4)}`);
            lines.push('');

            conv.messages.forEach(msg => {
                lines.push(`[${msg.timestamp.toISOString()}] ${msg.role.toUpperCase()} (${msg.transportMode || 'text'})`);
                if (msg.modelUsed) {
                    lines.push(`Model: ${msg.modelUsed}`);
                }
                if (msg.tokensUsed) {
                    lines.push(`Tokens: ${msg.tokensUsed}`);
                }
                lines.push(msg.content);
                lines.push('');
            });

            lines.push('');
        });

        return lines.join('\n');
    }
}

// Export singleton instance
export const conversationHistoryManager = ConversationHistoryManager.getInstance();