/**
 * IConversationalAgentAdapter Interface
 * 
 * Provider-agnostic interface for voice AI implementations.
 * This interface enables dynamic switching between OpenAI Realtime and ElevenLabs
 * while maintaining consistent behavior and state management.
 */

import {
  VoiceProvider,
  AdapterInitOptions,
  ConnectionStatus,
  SessionStatus,
  TranscriptItem,
  ToolCall,
  ToolResult,
  ProviderMetadata,
  VoiceAgentError
} from '@/types/voice-agent';
import { ContextBuffer, ContextBlock, ContextBufferEntrySnapshot } from '@/lib/ai/context-buffer';
import { getAutoNav, subscribeAutoNav, renderAutoNavPolicy } from '@/lib/ai/autonav';
import { isTestSessionEnabled } from '@/lib/ai/test-session';
import {
  EngineDirective,
  EngineDirectiveSchema,
  EngineWindowUpdate,
  EngineWindowUpdateSchema,
} from '@/lib/ai/engine/types';

/**
 * Per-field outcome of an `updateSession` call (D47(d); conversation-engine
 * notes §4 — telemetry must record what ACTUALLY reached the model, P7):
 *
 * - `applied`             — exact semantics on this provider.
 * - `degraded`            — delivered with reduced fidelity (Gemini: fixed
 *                           systemInstruction, so guidance folds into a
 *                           superseding context text instead).
 * - `superseded`          — delivered by versioned supersession on an
 *                           append-only stream (Gemini context block): the new
 *                           content is labeled as replacing all previous
 *                           copies, but stale copies persist until the
 *                           provider's native compression evicts them.
 * - `deferred-to-remint`  — cannot apply mid-session; takes effect at the next
 *                           D49 re-mint (model swaps ride this path, Req 5.3).
 * - `unsupported`         — the provider has no mechanism this session
 *                           (recorded, never silently skipped — P7).
 * - `failed`              — a supported mechanism errored at transport level
 *                           (honest telemetry; the caller may retry at the
 *                           next turn boundary).
 */
export type SessionUpdateFieldResult =
  | 'applied'
  | 'degraded'
  | 'superseded'
  | 'deferred-to-remint'
  | 'unsupported'
  | 'failed';

/**
 * Control-plane update for a LIVE session (D47(d)). Always full snapshots,
 * never deltas (notes P8): `instructions` is the complete assembled string,
 * `tools` the complete provider-ready schema array, `contextBlock` the
 * complete merged floating block. Assembly happens server-side — the client
 * never composes policy (D47(e)); it only applies what it is handed.
 */
export interface SessionUpdate {
  instructions?: string;
  tools?: Array<Record<string, unknown>>;
  contextBlock?: ContextBlock;
}

export interface SessionUpdateResult {
  fields: {
    instructions?: SessionUpdateFieldResult;
    tools?: SessionUpdateFieldResult;
    contextBlock?: SessionUpdateFieldResult;
  };
}

/**
 * How the session takes user input.
 * 'microphone' — normal voice session, mic captured.
 * 'text-only'  — session established without microphone access (silent input track);
 *                the user types, the model may still speak. Required for clients
 *                without a mic, denied permissions, and automated e2e drivers.
 * 'synthetic'  — dev/test only (D53): an emulated microphone track carrying
 *                TTS-generated speech (SyntheticMicDriver) drives the REAL
 *                provider voice path with no human speaker.
 */
export type AudioInputMode = 'microphone' | 'text-only' | 'synthetic';

export interface ConnectOptions {
  /** Capture microphone input. Defaults to true (voice session). Pass false for a text-only session. */
  audioInput?: boolean;
  /**
   * Dev/test only (D53, verification 4.4): use this MediaStream as the session's
   * input track instead of the microphone (no getUserMedia). Overrides audioInput.
   * Supplied by SyntheticMicDriver so automated agents exercise the real voice path.
   */
  syntheticInputStream?: MediaStream;
  /**
   * D49 resume: continue the logical conversation identified by this adapter
   * session id. The adapter adopts the id (history continues in the same
   * conversation) and asks the mint route for a harness briefing
   * (`resumeSessionId` param). One code path serves connection recovery and
   * deliberate provider/model switches.
   */
  resumeFromSessionId?: string;
}

export interface IConversationalAgentAdapter {
  // Provider identification
  readonly provider: VoiceProvider;
  readonly metadata: ProviderMetadata;

  // Lifecycle management
  init(options: AdapterInitOptions): Promise<void>;
  connect(options?: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  cleanup(): Promise<void>;

  // Connection state
  getConnectionStatus(): ConnectionStatus;
  getSessionStatus(): SessionStatus;
  isConnected(): boolean;
  getAudioInputMode(): AudioInputMode | null;
  
  // Audio management
  startAudioInput(): Promise<void>;
  stopAudioInput(): Promise<void>;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  
  // Conversation management
  sendMessage(message: string): Promise<void>;
  /** G1 (Req 13.1, P22): chip tap → normal visitor turn + deterministic chipId evidence. */
  sendChipTap(chip: { id: string; text: string }): Promise<void>;
  /** G3/D55: publish app-layer context into the session's floating block. */
  publishAssistantContext(key: string, text: string, opts?: { ttlMs?: number }): void;
  sendAudioData(audioData: ArrayBuffer): Promise<void>;
  interrupt(): Promise<void>;

  // Tool calling
  registerTool(tool: import('@/types/voice-agent').ToolDefinition): void;
  unregisterTool(toolName: string): void;
  getAvailableTools(): string[];
  
  // Transcript and history
  getTranscript(): TranscriptItem[];
  clearTranscript(): void;
  exportTranscript(): Promise<string>;
  
  // Configuration
  updateConfig(config: Partial<AdapterInitOptions>): Promise<void>;
  getConfig(): AdapterInitOptions;

  /**
   * D47(d): non-disruptive mid-session reconfiguration — instructions,
   * context, tools — applied to the LIVE provider session without
   * reconnecting. The single control-plane seam the conversation engine (and
   * the D55 buffer injector) drives; per-field results record what actually
   * reached the model (notes §4 fidelity matrix, P7). Model changes never
   * travel here — they are D49 re-mints (Req 5.3).
   */
  updateSession(update: SessionUpdate): Promise<SessionUpdateResult>;
  
  // Error handling
  getLastError(): VoiceAgentError | null;
  clearErrors(): void;
  
  // Provider-specific methods (optional)
  getProviderSpecificState?(): any;
  executeProviderSpecificAction?(action: string, params?: any): Promise<any>;

  /**
   * D49: the adapter's logical-conversation session id (the key the
   * conversation store is written under), or null before first use. A resume —
   * same or different provider — passes this id as ConnectOptions.resumeFromSessionId.
   */
  getConversationSessionId?(): string | null;

  /**
   * DB conversation id (cuid) the session persists under, captured from the
   * /log response — for debug display and later lookup. Null before the first
   * successful persistence. Distinct from the logical `session_…` id above.
   */
  getPersistedConversationId?(): string | null;

  /**
   * Task 7.0: the mint-route tracking id (`session_…`) from the token-mint
   * response — the key the server stashes this session's assembled
   * instructions under for the admin context-mint debug endpoint. Null before
   * connect and on providers without a mint (cascade).
   */
  getMintSessionId?(): string | null;

  /**
   * Task 7.0c: read-only context-state snapshot for the admin context-debug
   * panel — buffer entries, last flush telemetry, rolling-window state.
   * MUST never mutate the buffer or trigger a push (observer contract).
   */
  getContextDebugSnapshot?(): ContextDebugSnapshot;

  // Event handling (internal - called by the adapter implementation)
  _handleConnectionEvent(event: import('@/types/voice-agent').ConnectionEvent): void;
  _handleTranscriptEvent(event: import('@/types/voice-agent').TranscriptEvent): void;
  _handleAudioEvent(event: import('@/types/voice-agent').AudioEvent): void;
  _handleToolEvent(event: import('@/types/voice-agent').ToolEvent): void;
}

/** Telemetry of the last _applyContextBlock attempt (task 7.0b cadence ledger). */
export interface ContextFlushInfo {
  at: number;
  version: number;
  keys: string[];
  dropped: string[];
  tokens: number;
  chars: number;
  reason: string;
  result: SessionUpdateFieldResult;
  /** False = bit-identical every-turn re-append (still re-pays tokens on OpenAI). */
  changed: boolean;
}

/** Read-only context state handed to the admin context-debug panel (task 7.0). */
export interface ContextDebugSnapshot {
  provider: VoiceProvider;
  entries: ContextBufferEntrySnapshot[];
  lastFlush: ContextFlushInfo | null;
  windowState: EngineWindowUpdate | null;
}

/**
 * Base adapter class that provides common functionality
 * for all voice agent implementations
 */
export abstract class BaseConversationalAgentAdapter implements IConversationalAgentAdapter {
  protected _provider: VoiceProvider;
  protected _metadata: ProviderMetadata;
  protected _options: AdapterInitOptions | null = null;
  protected _connectionStatus: ConnectionStatus = 'disconnected';
  protected _sessionStatus: SessionStatus = 'idle';
  protected _transcript: TranscriptItem[] = [];
  protected _tools: Map<string, import('@/types/voice-agent').ToolDefinition> = new Map();
  protected _lastError: VoiceAgentError | null = null;
  protected _audioElement?: HTMLAudioElement;
  protected _isMuted: boolean = false;
  protected _volume: number = 1.0;
  protected _audioInputMode: AudioInputMode | null = null;
  /** DB conversation id (cuid), captured from the /log response so debug UIs can
   *  display it and the owner can look the conversation up. Distinct from the
   *  logical `session_…` id the adapter writes under. */
  protected _persistedConversationId: string | null = null;

  // ---- D55 context buffer + D47 engine directive state (conversation-engine Block A) ----
  /** The per-conversation passive-context buffer this adapter injects from (D55). */
  protected _contextBuffer = new ContextBuffer();
  /** Content version of the last successfully flushed block (change detection). */
  private _lastFlushedContextVersion = 0;
  /** Task 7.0: last _applyContextBlock attempt, for the debug-panel snapshot. */
  private _lastContextFlushInfo: ContextFlushInfo | null = null;
  /** Task 7.0: mint-route tracking id (`session_…`) — set by providers that mint. */
  protected _mintSessionId: string | null = null;
  /** Highest engine-directive seq applied — latest-wins, duplicates dropped (P4). */
  private _lastAppliedDirectiveSeq = 0;
  /** Directive that arrived mid-response, applied at the next turn boundary (P19). Latest wins. */
  private _pendingDirective: EngineDirective | null = null;
  /** UI-state deltas since the last user turn — turn evidence for /log (task A4). */
  private _pendingUiEvidence: Array<Record<string, unknown>> = [];
  // ---- J4 rolling window (Req 20; P28) ----
  /** Latest window update from the /log response — full snapshot, versioned. */
  protected _windowState: EngineWindowUpdate | null = null;
  /** Highest summaryVersion already handed to the provider mechanics (latest-wins gate). */
  private _lastAppliedWindowVersion = 0;
  /** A window update arrived (possibly mid-response) and awaits the next boundary (P19). */
  private _windowDirty = false;
  /** G1 (P22): chip id awaiting attachment to the next user turn's evidence
   *  (/log transcript metadata on native voice; the /chat body on cascade —
   *  F4 live-fire finding: cascade turns never pass through /log user_speech,
   *  so the id must ride its /chat request instead). */
  private _pendingChipId: string | null = null;
  /** G2 (Req 13.8, P36): auto-nav store unsubscribe — released in cleanup(). */
  private _autonavUnsubscribe: (() => void) | null = null;

  constructor(provider: VoiceProvider, metadata: ProviderMetadata) {
    this._provider = provider;
    this._metadata = metadata;

    // G2 (Req 13.8, P36): the auto-navigation consent policy is ALWAYS in the
    // floating block — the model must never guess whether it may move the
    // visitor. The store fans tap/tool flips here; each flip re-publishes the
    // policy line (flushed at the next boundary) and records turn evidence so
    // the server persists ConversationState.prefs.autoNav from ground truth.
    if (typeof window !== 'undefined') {
      this._contextBuffer.publish('autonav', renderAutoNavPolicy(getAutoNav()));
      this._autonavUnsubscribe = subscribeAutoNav((enabled, source) => {
        this._contextBuffer.publish('autonav', renderAutoNavPolicy(enabled));
        this._recordUiEvidence({ event: 'autonav_changed', value: enabled, source });
        if (this.isConnected() && !this._isModelResponding()) {
          void this._flushContextBlock('autonav');
        }
      });
    }
  }

  /** Release base-class subscriptions — concrete adapters call this from cleanup(). */
  protected _releaseBaseSubscriptions(): void {
    this._autonavUnsubscribe?.();
    this._autonavUnsubscribe = null;
  }

  /** DB conversation id (cuid) once the first /log write has resolved, else null. */
  getPersistedConversationId(): string | null {
    return this._persistedConversationId;
  }

  /**
   * POST a body to /api/ai/conversation/log and capture the DB conversationId
   * from the response. Shared by all adapters so the persisted id is available
   * regardless of provider; fire-and-forget, never blocks the voice path.
   */
  protected _postConversationLog(body: Record<string, unknown>): void {
    try {
      // F1 (Req 10.1, P17): sandboxed test sessions — when the owner enabled
      // the test toggle, every /log POST carries the request flag. The server
      // honors it only for admin-authenticated callers and stamps
      // conversation.metadata.test ONCE at creation (the single seam).
      if (isTestSessionEnabled()) {
        body = { ...body, test: true };
      }
      // Task A4 turn evidence: user turns carry the UI-state deltas collected
      // since the last user turn (navigation, F-I-D refreshes) so the engine
      // can evaluate ui_state edge conditions server-side. Small and additive;
      // consumed (cleared) only when actually attached.
      const transcript = body.transcriptItem as { type?: string; metadata?: Record<string, unknown> } | undefined;
      if (transcript?.type === 'user_speech' && this._pendingUiEvidence.length > 0) {
        body = { ...body, uiEvidence: this._pendingUiEvidence.splice(0) };
      }
      // G1 (P22): chip-tap evidence rides THIS user turn's metadata — /log
      // lifts transcriptItem.metadata.chipId into TurnEvidence, and `chip`
      // edges fire deterministically on the id alone. Consumed once; a voice
      // utterance racing the tap could steal it (single-visitor UI, accepted).
      if (transcript?.type === 'user_speech' && this._pendingChipId) {
        body = {
          ...body,
          transcriptItem: {
            ...(body.transcriptItem as Record<string, unknown>),
            metadata: { ...(transcript.metadata ?? {}), chipId: this._pendingChipId },
          },
        };
        this._pendingChipId = null;
      }
      void fetch('/api/ai/conversation/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          const cid = data?.metadata?.conversationId;
          // Fire on EVERY response carrying an id, not only on change: the UI
          // resets its copy on reconnect, while a same-adapter reconnect keeps
          // the same conversation — an on-change guard would never re-sync it.
          // The listener's setState is idempotent, so repeats are free.
          if (typeof cid === 'string' && cid) {
            this._persistedConversationId = cid;
            this._options?.onConversationPersisted?.(cid);
          }
          // Task A4 directive return path (design §1): the /log response may
          // carry an engine directive for this live session; the base adapter
          // owns staleness/queueing and applies it via updateSession.
          if (data?.engineDirective) {
            this._handleEngineDirective(data.engineDirective);
          }
          // J4: rolling-window update (running summary + config) — same
          // delivery rules as directives: versioned, latest-wins, full snapshot.
          if (data?.engineWindow) {
            this._handleEngineWindow(data.engineWindow);
          }
          // Safety enforcement (Req 22.5, P35): the server revoked this
          // session's resources — this is the disconnect directive, and a
          // compliant client hangs up. The provider connection would otherwise
          // idle uselessly until the ephemeral token's duration cap: tools,
          // persistence, and re-mints are already failing closed server-side.
          if (data?.sessionRevoked) {
            console.warn('[conversation/log] session revoked by safety enforcement — disconnecting');
            void this.disconnect().catch(() => undefined);
          }
        })
        .catch((err) => console.warn('[conversation/log] post failed:', err));
    } catch (err) {
      console.warn('[conversation/log] post threw:', err);
    }
  }

  // Getters
  get provider(): VoiceProvider {
    return this._provider;
  }

  get metadata(): ProviderMetadata {
    return this._metadata;
  }

  getConnectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  getSessionStatus(): SessionStatus {
    return this._sessionStatus;
  }

  isConnected(): boolean {
    return this._connectionStatus === 'connected';
  }

  getAudioInputMode(): AudioInputMode | null {
    return this._audioInputMode;
  }

  isMuted(): boolean {
    return this._isMuted;
  }

  getVolume(): number {
    return this._volume;
  }

  getTranscript(): TranscriptItem[] {
    return [...this._transcript];
  }

  getAvailableTools(): string[] {
    return Array.from(this._tools.keys());
  }

  getLastError(): VoiceAgentError | null {
    return this._lastError;
  }

  getConfig(): AdapterInitOptions {
    if (!this._options) {
      throw new VoiceAgentError('Adapter not initialized', this._provider);
    }
    return { ...this._options };
  }

  /** Default: no session id. Adapters that support it (D49) override this. */
  getConversationSessionId(): string | null {
    return null;
  }

  // Common implementations
  registerTool(tool: import('@/types/voice-agent').ToolDefinition): void {
    this._tools.set(tool.name, tool);
  }

  unregisterTool(toolName: string): void {
    this._tools.delete(toolName);
  }

  clearTranscript(): void {
    this._transcript = [];
  }

  clearErrors(): void {
    this._lastError = null;
  }

  mute(): void {
    this._isMuted = true;
    if (this._audioElement) {
      this._audioElement.muted = true;
    }
  }

  unmute(): void {
    this._isMuted = false;
    if (this._audioElement) {
      this._audioElement.muted = false;
    }
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._audioElement) {
      this._audioElement.volume = this._volume;
    }
  }

  async exportTranscript(): Promise<string> {
    const transcript = this._transcript.map(item => ({
      timestamp: item.timestamp.toISOString(),
      type: item.type,
      content: item.content,
      provider: item.provider,
      metadata: item.metadata
    }));
    
    return JSON.stringify(transcript, null, 2);
  }

  // Event handlers
  _handleConnectionEvent(event: import('@/types/voice-agent').ConnectionEvent): void {
    this._connectionStatus = event.type === 'connected' ? 'connected' :
                           event.type === 'disconnected' ? 'disconnected' :
                           event.type === 'reconnecting' ? 'reconnecting' : 'error';

    if (event.error) {
      this._lastError = new VoiceAgentError(event.error, this._provider);
      this._logEvent('error', event.error, { connectionEvent: true });
    }

    this._options?.onConnectionEvent(event);
  }

  _handleTranscriptEvent(event: import('@/types/voice-agent').TranscriptEvent): void {
    this._transcript.push(event.item);
    this._options?.onTranscriptEvent(event);
  }

  _handleAudioEvent(event: import('@/types/voice-agent').AudioEvent): void {
    this._options?.onAudioEvent(event);
  }

  _handleToolEvent(event: import('@/types/voice-agent').ToolEvent): void {
    this._options?.onToolEvent(event);
  }

  // Protected helper methods
  protected _setConnectionStatus(status: ConnectionStatus): void {
    this._connectionStatus = status;
  }

  protected _setSessionStatus(status: SessionStatus): void {
    this._sessionStatus = status;
  }

  protected _addTranscriptItem(item: TranscriptItem): void {
    this._transcript.push(item);
  }

  protected _setError(error: VoiceAgentError): void {
    this._lastError = error;
  }

  /**
   * Persist a labeled navigation/error event to the unified conversation store,
   * distinct from the raw tool_call/tool_result rows — a human-readable record
   * ("Navigated to: projects", "Tool ui_intent failed: ...") for the admin
   * replay timeline (owner, 2026-07-07). Shared across all adapters since it
   * lives in the base class; fire-and-forget, never blocks the voice path.
   */
  protected _logEvent(eventType: 'navigation' | 'error' | 'context_flush' | 'engine_directive' | 'window_prune', label: string, detail?: unknown): void {
    const sessionId = this.getConversationSessionId?.();
    if (!sessionId) return;
    this._postConversationLog({
      sessionId,
      provider: this._provider,
      reflinkId: this._options?.reflinkId,
      event: { type: eventType, label, detail },
      timestamp: new Date().toISOString(),
    });
  }

  /** Best-effort human label for a ui_intent call, tolerant of schema drift (D41 §2c). */
  private _describeNavigationIntent(args: any, result: any): string {
    const target = args?.target ?? {};
    const dest = target.id ?? target.route ?? target.type ?? JSON.stringify(target);
    const ok = result && !(typeof result === 'object' && result.success === false);
    return ok ? `Navigated to: ${dest}` : `Navigation to "${dest}" did not resolve`;
  }

  protected async _executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this._tools.get(toolCall.name);
    if (!tool) {
      throw new Error(`Tool '${toolCall.name}' not found`);
    }

    const startTime = Date.now();
    try {
      const result = await tool.handler(toolCall.arguments);
      const executionTime = Date.now() - startTime;
      
      return {
        id: toolCall.id,
        result,
        timestamp: new Date(),
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        id: toolCall.id,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        executionTime
      };
    }
  }

  /**
   * Unified Tool Execution Pipeline
   * 
   * Provides single, predictable execution path for all tools regardless of provider.
   * Routes client tools to UINavigationTools and server tools to /api/ai/tools/execute.
   * Includes comprehensive debug event emission with toolCallId correlation.
   */
  protected async _executeUnifiedTool(toolName: string, args: any): Promise<any> {
    // Import dependencies dynamically to avoid circular imports
    const { unifiedToolRegistry } = await import('@/lib/ai/tools/UnifiedToolRegistry');
    const { debugEventEmitter } = await import('@/lib/debug/debugEventEmitter');
    const { v4: uuidv4 } = await import('uuid');

    const toolDef = unifiedToolRegistry.getToolDefinition(toolName);
    if (!toolDef) {
      throw new Error(`Tool '${toolName}' not found in unified registry.`);
    }

    const toolCallId = uuidv4();
    const sessionId = this._options?.contextId || 'unknown-session';
    const startTime = Date.now();
    
    // Emit debug event for tool call start with correlation ID
    debugEventEmitter.emit('tool_call_start', {
      toolName,
      args,
      sessionId,
      toolCallId,
      executionContext: toolDef.executionContext,
      provider: this._provider
    }, `${this._provider}-adapter`);

    try {
      let result: any;
      
      if (toolDef.executionContext === 'client') {
        // Execute client-side tools using UINavigationTools
        if (typeof window === 'undefined') {
          throw new Error(`Client-side tool '${toolName}' cannot be executed in server environment`);
        }

        const { uiNavigationTools } = await import('@/lib/ai/tools/client-tools');
        const uiToolHandler = (uiNavigationTools as any)[toolName];
        
        if (typeof uiToolHandler === 'function') {
          // Call the method with proper 'this' context and pass sessionId
          const uiResult = await uiToolHandler.call(uiNavigationTools, args, sessionId);
          // HONESTY: NavigationResult.success must reach the model. The old
          // `data || message` laundered failed navigations into truthy blobs —
          // the model then narrated success over a no-op (owner report,
          // 2026-07-08). Failure throws so the model sees WHY and can adjust.
          if (uiResult && uiResult.success === false) {
            throw new Error(uiResult.message || uiResult.error || `${toolName} failed`);
          }
          // The human-readable message is what the model should build on
          // ("Scrolled to section X inside the open project"), with the data
          // payload alongside for ids. Arrays go under a named key — spreading
          // an array produced {"0":"open_project…","1":"delay…"} numeric-key
          // junk the model had to puzzle out (owner, 2026-07-08).
          if (uiResult.message) {
            const data = uiResult.data;
            result = Array.isArray(data)
              ? { message: uiResult.message, steps: data }
              : { message: uiResult.message, ...(typeof data === 'object' && data !== null ? data : {}) };
          } else {
            result = uiResult.data ?? uiResult;
          }
        } else {
          throw new Error(`Client-side UI tool handler for '${toolName}' not found.`);
        }
      } else if (toolDef.executionContext === 'server') {
        // Execute server-side tools via unified API endpoint
        const response = await fetch('/api/ai/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: toolName,
            parameters: args,
            sessionId: sessionId,
            toolCallId: toolCallId,
            reflinkId: this._options?.reflinkId
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server tool '${toolName}' failed: ${response.status} - ${errorText}`);
        }

        const serverResult = await response.json();
        if (!serverResult.success) {
          throw new Error(serverResult.error || 'Server tool execution failed');
        }
        
        result = serverResult.data;
      } else {
        throw new Error(`Invalid execution context '${toolDef.executionContext}' for tool '${toolName}'`);
      }

      const executionTime = Date.now() - startTime;

      // Emit debug event for successful tool call completion
      debugEventEmitter.emit('tool_call_complete', {
        toolName,
        result,
        executionTime,
        success: true,
        sessionId,
        toolCallId,
        executionContext: toolDef.executionContext,
        provider: this._provider
      }, `${this._provider}-adapter`);

      if (toolName === 'ui_intent') {
        this._logEvent('navigation', this._describeNavigationIntent(args, result), { args, result });
        this._recordUiEvidence({ type: 'navigation', target: (args as { target?: unknown })?.target });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit debug event for failed tool call completion
      debugEventEmitter.emit('tool_call_complete', {
        toolName,
        result: null,
        error: errorMessage,
        executionTime,
        success: false,
        sessionId,
        toolCallId,
        executionContext: toolDef.executionContext,
        provider: this._provider
      }, `${this._provider}-adapter`);

      this._logEvent('error', `Tool ${toolName} failed: ${errorMessage}`, { toolName, args, error: errorMessage });

      throw error;
    }
  }

  // ==========================================================================
  // D47(d) updateSession + D55 buffer injector + engine-directive application
  // (conversation-engine Block A tasks A2/A3/A4)
  // ==========================================================================

  /**
   * Apply a control-plane update to the live session. Orchestration lives
   * here; provider mechanics live in the `_apply*` hooks each adapter
   * overrides. Per-field failures are isolated — one field erroring records
   * `failed` for that field and never blocks the others (a broken control
   * plane must degrade to "the engine stopped steering", never to a broken
   * conversation — P1 spirit).
   */
  async updateSession(update: SessionUpdate): Promise<SessionUpdateResult> {
    const fields: SessionUpdateResult['fields'] = {};
    if (update.instructions !== undefined) {
      try {
        fields.instructions = await this._applyInstructions(update.instructions);
      } catch (err) {
        console.warn(`[${this._provider}] updateSession instructions failed:`, err);
        fields.instructions = 'failed';
      }
    }
    if (update.tools !== undefined) {
      try {
        fields.tools = await this._applyToolSchema(update.tools);
      } catch (err) {
        console.warn(`[${this._provider}] updateSession tools failed:`, err);
        fields.tools = 'failed';
      }
    }
    if (update.contextBlock !== undefined) {
      try {
        fields.contextBlock = await this._applyContextBlock(update.contextBlock);
      } catch (err) {
        console.warn(`[${this._provider}] updateSession contextBlock failed:`, err);
        fields.contextBlock = 'failed';
      }
    }
    return { fields };
  }

  /** Provider mechanics for a FULL instruction replacement. Default: no mechanism (P7 — recorded, not skipped). */
  protected async _applyInstructions(_instructions: string): Promise<SessionUpdateFieldResult> {
    return 'unsupported';
  }

  /** Provider mechanics for a FULL tool-schema replacement. */
  protected async _applyToolSchema(_tools: Array<Record<string, unknown>>): Promise<SessionUpdateFieldResult> {
    return 'unsupported';
  }

  /** Provider mechanics for delivering the merged floating block (P27). */
  protected async _applyContextBlock(_block: ContextBlock): Promise<SessionUpdateFieldResult> {
    return 'unsupported';
  }

  /**
   * Floating-block delivery cadence (notes P27):
   *  - 'every-turn': exact invariant — remove + re-append at each turn
   *    boundary even when bit-identical (OpenAI, where items are addressable).
   *  - 'on-change' : versioned supersession — send only when content changed
   *    (Gemini, append-only stream; re-sending unchanged blocks would multiply
   *    copies with zero benefit — the inverse economics).
   *  - 'none'      : no live-session delivery; server-side per-turn prompt
   *    assembly owns the block (cascade — and the default, so an adapter that
   *    hasn't opted in never gets surprise injections).
   */
  protected _contextFlushMode(): 'every-turn' | 'on-change' | 'none' {
    return 'none';
  }

  /** True while the model is mid-response — directives/flushes queue until the boundary (P19). */
  protected _isModelResponding(): boolean {
    return false;
  }

  /**
   * Publish a passive-context item into the D55 buffer (last-write-wins per
   * source key) and deliver it: immediately when the model is idle (predictive
   * push — state arrives BEFORE the follow-up question), else at the next turn
   * boundary (P19 — never mid-response). F-I-D publishes under key 'fid';
   * the engine's directive items land under their own keys via
   * `_handleEngineDirective`.
   */
  publishPassiveContext(key: string, value: unknown, opts?: { ttlMs?: number; priority?: number }): void {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    this._contextBuffer.publish(key, text, { priority: key === 'fid' ? 10 : 50, ...opts });
    if (key === 'fid') {
      const v = value as { index?: { route?: string; currentProject?: unknown } } | null;
      this._recordUiEvidence({
        type: 'ui_state',
        route: v?.index?.route,
        project: v?.index?.currentProject ?? undefined,
      });
    }
    if (!this._isModelResponding()) {
      void this._flushContextBlock('publish');
    }
  }

  /** Remove a source key from the buffer (delivered at the next flush). */
  removePassiveContext(key: string): void {
    this._contextBuffer.remove(key);
    if (!this._isModelResponding()) {
      void this._flushContextBlock('remove');
    }
  }

  /** Task 7.0: mint tracking id for the admin context-mint stash lookup. */
  getMintSessionId(): string | null {
    return this._mintSessionId;
  }

  /**
   * Task 7.0c: read-only context state for the admin context-debug panel.
   * Uses the buffer's side-effect-free inspector — never evicts, never bumps
   * the content version, never pushes.
   */
  getContextDebugSnapshot(): ContextDebugSnapshot {
    return {
      provider: this._provider,
      entries: this._contextBuffer.inspect(),
      lastFlush: this._lastContextFlushInfo,
      windowState: this._windowState,
    };
  }

  /**
   * Flush the merged floating block through the provider mechanics per this
   * adapter's cadence. Failures leave the buffer dirty; the next turn
   * boundary retries — passive context is eventually consistent, never
   * turn-blocking (D55 race contract).
   *
   * Every content CHANGE is a D49 history event (D55/Req 7.4) so replay shows
   * what the model knew and when; bit-identical every-turn re-appends are not
   * logged — between change events the block is constant, so replay fidelity
   * costs no extra rows.
   */
  protected async _flushContextBlock(reason: string): Promise<void> {
    const mode = this._contextFlushMode();
    if (mode === 'none' || !this.isConnected()) return;

    const block = this._contextBuffer.getBlock();
    const changed = block.version !== this._lastFlushedContextVersion;
    if (!changed && (mode === 'on-change' || block.keys.length === 0)) return;

    try {
      const result = await this._applyContextBlock(block);
      // Task 7.0b observer tap: EVERY apply attempt — including bit-identical
      // every-turn re-appends, which the change-gated /log event below never
      // records but which still re-pay tokens on OpenAI — reaches the admin
      // context-debug panel via the client debug bus. Adds nothing
      // model-visible; fire-and-forget.
      const flushInfo: ContextFlushInfo = {
        at: Date.now(),
        version: block.version,
        keys: block.keys,
        dropped: block.dropped,
        tokens: block.tokens,
        chars: block.text.length,
        reason,
        result,
        changed,
      };
      this._lastContextFlushInfo = flushInfo;
      import('@/lib/debug/debugEventEmitter')
        .then(({ debugEventEmitter }) => {
          debugEventEmitter.emit(
            'context_flush',
            { provider: this._provider, ...flushInfo, blockText: block.text },
            'voice-adapter',
            undefined,
            this.getConversationSessionId?.() ?? undefined
          );
        })
        .catch(() => {});
      if (result === 'failed' || result === 'unsupported') return; // stays dirty → retried at next boundary
      if (changed) {
        this._lastFlushedContextVersion = block.version;
        this._logEvent(
          'context_flush',
          `Context block v${block.version} → model (${block.keys.join('+') || 'empty'})`,
          {
            version: block.version,
            keys: block.keys,
            dropped: block.dropped,
            tokens: block.tokens,
            fidelity: result,
            reason,
            // Owner 2026-07-11: the FULL merged block text per flush — replay
            // must show exactly what the model remembered at this turn
            // (capped; blocks are token-budgeted well below this anyway).
            blockText: block.text.slice(0, 16_000),
          }
        );
      }
    } catch (err) {
      console.warn(`[${this._provider}] context flush failed (retried at next turn boundary):`, err);
    }
  }

  /**
   * Engine directive intake (task A4, notes P4/P19): Zod-validated,
   * latest-wins by `seq` (stale and duplicate directives — e.g. from a
   * retried /log POST returning the same payload twice — are dropped), queued
   * while the model is mid-response and applied at the boundary. Every
   * directive is a full snapshot, so dropping is always safe.
   */
  protected _handleEngineDirective(raw: unknown): void {
    const parsed = EngineDirectiveSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`[${this._provider}] invalid engine directive dropped:`, parsed.error.message);
      return;
    }
    const directive = parsed.data;
    if (directive.seq <= this._lastAppliedDirectiveSeq) return; // stale/duplicate (P4)
    if (this._pendingDirective && directive.seq <= this._pendingDirective.seq) return;

    if (this._isModelResponding()) {
      this._pendingDirective = directive; // latest wins at the boundary (P19)
      return;
    }
    void this._applyEngineDirective(directive);
  }

  private async _applyEngineDirective(directive: EngineDirective): Promise<void> {
    if (directive.seq <= this._lastAppliedDirectiveSeq) return;
    // Claim the seq BEFORE any await so a concurrent duplicate can't double-apply.
    this._lastAppliedDirectiveSeq = directive.seq;

    try {
      // G1 (Req 13.1/13.3): the visitor surface swaps at application time —
      // the same boundary discipline as the model-facing payload (P19), so
      // chips never advertise a state the model isn't in yet.
      if (directive.ux) {
        this._options?.onEngineUx?.(directive.ux);
      }
      for (const item of directive.contextItems ?? []) {
        this._contextBuffer.publish(item.key, item.text, { ttlMs: item.ttlMs });
      }
      const result = await this.updateSession({
        ...(directive.instructions !== undefined ? { instructions: directive.instructions } : {}),
        ...(directive.tools !== undefined ? { tools: directive.tools } : {}),
      });
      await this._flushContextBlock('directive');
      // Durable telemetry: exactly one row per applied seq — the in-session
      // assertion that a retried /log POST applied nothing twice (task A4).
      this._logEvent('engine_directive', `Engine directive seq ${directive.seq} applied`, {
        seq: directive.seq,
        results: result.fields,
        contextKeys: (directive.contextItems ?? []).map((i) => i.key),
      });
    } catch (err) {
      console.warn(`[${this._provider}] engine directive seq ${directive.seq} application failed:`, err);
    }
  }

  /**
   * Rolling-window intake (task J4): Zod-validated, latest-wins by
   * `summaryVersion` (a retried /log POST returning the same snapshot twice
   * applies once), applied immediately when idle, else at the next turn
   * boundary (P19 — never mid-response). Every update is a full snapshot, so
   * dropping stale/duplicate ones is always safe.
   */
  protected _handleEngineWindow(raw: unknown): void {
    const parsed = EngineWindowUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`[${this._provider}] invalid engine window update dropped:`, parsed.error.message);
      return;
    }
    if (parsed.data.summaryVersion <= this._lastAppliedWindowVersion) return;
    this._lastAppliedWindowVersion = parsed.data.summaryVersion;
    this._windowState = parsed.data;
    this._windowDirty = true;
    if (!this._isModelResponding()) {
      void this._applyWindowState('window-update');
    }
  }

  /**
   * Hand the current window state to the provider mechanics (never
   * mid-response — call sites are the intake above and the turn boundary).
   * Default mechanics: the running summary joins the floating block under
   * source key 'summary' at the highest merge priority — on Gemini's
   * on-change cadence that is versioned supersession (one send per summary
   * refresh, P27's economics); providers with item control (OpenAI) override
   * `_applyWindowMechanics` with true pruning (P28). Cascade never receives
   * window updates (server-side assembly owns its window).
   */
  protected async _applyWindowState(reason: string): Promise<void> {
    const window = this._windowState;
    if (!window) return;
    this._windowDirty = false;
    try {
      await this._applyWindowMechanics(window, reason);
    } catch (err) {
      this._windowDirty = true; // stays dirty → retried at the next boundary
      console.warn(`[${this._provider}] window application failed (retried at next boundary):`, err);
    }
  }

  /** Provider mechanics for the rolling window. Default: summary rides the floating block. */
  protected async _applyWindowMechanics(window: EngineWindowUpdate, _reason: string): Promise<void> {
    // Priority 1 puts the summary at the TOP of the merged block: memory
    // first, then live UI state, then node guidance/profile.
    this._contextBuffer.publish('summary', window.summaryText, { priority: 1 });
    if (!this._isModelResponding()) {
      await this._flushContextBlock('window-summary');
    }
  }

  /**
   * Turn-boundary hook — concrete adapters call this when a model response
   * completes. Applies the queued directive (which flushes) or re-appends the
   * floating block (P27: every turn, even unchanged, where the provider
   * permits), then gives the rolling window its boundary slot (J4: prune
   * checks are boundary-only — deleting items mid-response would yank context
   * from under an in-flight answer).
   */
  protected _onTurnBoundary(): void {
    const pending = this._pendingDirective;
    if (pending) {
      this._pendingDirective = null;
      void this._applyEngineDirective(pending);
    } else {
      void this._flushContextBlock('turn-end');
    }
    if (this._windowState && (this._windowDirty || this._windowNeedsBoundaryCheck())) {
      void this._applyWindowState('turn-boundary');
    }
  }

  /**
   * True when the provider mechanics want a look at EVERY boundary even
   * without a new summary (OpenAI: age-based prune candidates accrue with
   * time). Default false — summary-in-block providers only act on change.
   */
  protected _windowNeedsBoundaryCheck(): boolean {
    return false;
  }

  /**
   * G3/D55: publish app-layer context (e.g. the JD-analysis completion note)
   * into this session's floating block under a source key — the same bus every
   * passive source uses; flushed at the next safe boundary (P19).
   */
  publishAssistantContext(key: string, text: string, opts?: { ttlMs?: number }): void {
    this._contextBuffer.publish(key, text, opts);
    if (this.isConnected() && !this._isModelResponding()) {
      void this._flushContextBlock('app-context');
    }
  }

  /**
   * G1 (Req 13.1, P22): send a chip tap as a normal visitor turn. The text
   * enters the live session exactly like a typed message (it appears in the
   * transcript as the visitor's own — owner 2026-07-10) while the chip id
   * rides the turn's /log metadata as deterministic edge evidence. The model
   * sees ordinary text; only the engine sees the id.
   */
  async sendChipTap(chip: { id: string; text: string }): Promise<void> {
    this._pendingChipId = chip.id;
    try {
      await this.sendMessage(chip.text);
    } catch (err) {
      this._pendingChipId = null; // don't let a failed send poison the next real turn
      throw err;
    }
  }

  /**
   * G1 (P22): one-shot read of the pending chip id for adapters whose user
   * turns do NOT flow through /log user_speech (cascade → /chat body). Same
   * consume-once semantics as the /log path above.
   */
  protected _consumePendingChipId(): string | null {
    const id = this._pendingChipId;
    this._pendingChipId = null;
    return id;
  }

  /** Record a UI-state delta as turn evidence for the next user-turn /log POST (task A4). */
  protected _recordUiEvidence(event: Record<string, unknown>): void {
    this._pendingUiEvidence.push({ ...event, at: new Date().toISOString() });
    if (this._pendingUiEvidence.length > 20) this._pendingUiEvidence.shift();
  }

  // Abstract methods that must be implemented by concrete adapters
  abstract init(options: AdapterInitOptions): Promise<void>;
  abstract connect(options?: ConnectOptions): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract cleanup(): Promise<void>;
  abstract startAudioInput(): Promise<void>;
  abstract stopAudioInput(): Promise<void>;
  abstract sendMessage(message: string): Promise<void>;
  abstract sendAudioData(audioData: ArrayBuffer): Promise<void>;
  abstract interrupt(): Promise<void>;
  abstract updateConfig(config: Partial<AdapterInitOptions>): Promise<void>;
}

/**
 * Factory function to create adapter instances
 */
export type AdapterFactory = (provider: VoiceProvider) => Promise<IConversationalAgentAdapter>;

/**
 * Registry for adapter factories
 */
export class AdapterRegistry {
  private static _factories: Map<VoiceProvider, AdapterFactory> = new Map();

  static register(provider: VoiceProvider, factory: AdapterFactory): void {
    this._factories.set(provider, factory);
  }

  static async create(provider: VoiceProvider): Promise<IConversationalAgentAdapter> {
    const factory = this._factories.get(provider);
    if (!factory) {
      throw new VoiceAgentError(`No adapter factory registered for provider: ${provider}`, provider);
    }
    return factory(provider);
  }

  static getAvailableProviders(): VoiceProvider[] {
    return Array.from(this._factories.keys());
  }

  static isProviderSupported(provider: VoiceProvider): boolean {
    return this._factories.has(provider);
  }
}