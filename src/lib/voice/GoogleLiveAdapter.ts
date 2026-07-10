/**
 * Google Gemini Live Adapter (D22, ai-assistant task 6)
 *
 * Native speech-to-speech over the Gemini Live WebSocket protocol
 * (BidiGenerateContentConstrained + ephemeral auth token, D3: the real
 * GOOGLE_API_KEY never reaches the browser). Unlike OpenAI (WebRTC) and
 * ElevenLabs (SDK-managed WebRTC/WebSocket), there is no client SDK for the
 * Live API's raw protocol, so this adapter owns the wire format directly:
 * JSON text frames, PCM16 audio in/out, and manual audio capture/playback
 * via the Web Audio API.
 *
 * Scope note (task 6, feeds D41): resume/leg-lifecycle wiring here is
 * baseline-compatible (resumeFromSessionId is accepted and forwarded to the
 * mint route so a resumed leg gets the ground-truth briefing; connection
 * events are leg-tagged) but the disruption-watcher + auto-reconnect drill
 * built for OpenAI in 5b is NOT replicated here — see task 6.3 gap notes.
 *
 * DESIGN PHILOSOPHY — an APPEND-ONLY STREAM with provider-side memory
 * management (conversation-engine notes §4; doc-comment mandated by task
 * A2.4, owner 2026-07-09):
 * Nothing sent into a Gemini Live session can ever be deleted — including our
 * own passive-context blocks. `systemInstruction` and the tool set are locked
 * into the ephemeral token at mint and have no mid-session reconfiguration
 * message; the provider offers native sliding-window compression instead of
 * item control. The harness can only ADD and SUPERSEDE, never retract:
 * mid-session guidance folds into superseding context text (fidelity
 * `degraded`), the D55 floating block degrades to VERSIONED SUPERSESSION —
 * sent only on change, labeled as replacing all previous copies, with stale
 * copies billing until compression evicts them (P27) — and tool-set changes
 * are `unsupported` mid-session (the documented fallback is a D49 re-mint).
 * When working on this adapter, reason from "we can never take anything
 * back" — the opposite of OpenAIRealtimeAdapter's mutable conversation.
 * Verify provider behavior by DRIVING it, never from docs alone (D22).
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AdapterInitOptions,
  TranscriptItem,
  ProviderMetadata,
  VoiceAgentError,
  ConnectionError,
  AudioError
} from '@/types/voice-agent';
import { BaseConversationalAgentAdapter, ConnectOptions, SessionUpdateFieldResult } from './IConversationalAgentAdapter';
import type { ContextBlock } from '@/lib/ai/context-buffer';
import { GoogleLiveConfig } from '@/types/voice-config';

// Global reference for debugging (temporary for testing, matches OpenAIRealtimeAdapter's pattern)
let globalGoogleLiveAdapter: GoogleLiveAdapter | null = null;

export function getGlobalGoogleLiveAdapter(): GoogleLiveAdapter | null {
  return globalGoogleLiveAdapter;
}

interface GoogleSessionResponse {
  access_token: string;
  session_id: string;
  expires_at: string;
  model: string;
  voice: string;
  responseModality: 'AUDIO' | 'TEXT';
}

/** Gemini Live output audio: 16-bit PCM, mono, 24kHz (documented convention). */
const OUTPUT_SAMPLE_RATE = 24000;
/** Gemini Live input audio: 16-bit PCM, mono, 16kHz. */
const INPUT_SAMPLE_RATE = 16000;
const INPUT_CHUNK_SIZE = 4096;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === INPUT_SAMPLE_RATE) return input;
  const ratio = inputRate / INPUT_SAMPLE_RATE;
  const outLength = Math.round(input.length / ratio);
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    output[i] = input[Math.min(input.length - 1, Math.round(i * ratio))];
  }
  return output;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

export class GoogleLiveAdapter extends BaseConversationalAgentAdapter {
  private _config: GoogleLiveConfig | null = null;
  private _ws: WebSocket | null = null;
  private _setupComplete = false;
  private _setupCompleteResolve: (() => void) | null = null;
  private _conversationId: string | null = null;
  private _resumeSessionId: string | null = null;
  private _sessionModel: string | null = null;

  // Capture pipeline
  private _inputStream: MediaStream | null = null;
  private _captureContext: AudioContext | null = null;
  private _captureProcessor: ScriptProcessorNode | null = null;
  private _capturing = false;

  // Playback pipeline
  private _playbackContext: AudioContext | null = null;
  private _playbackGain: GainNode | null = null;
  private _nextPlayTime = 0;
  private _activeSources: AudioBufferSourceNode[] = [];
  /** 9b.5: when the current assistant turn's FIRST audio chunk became audible. */
  private _turnFirstAudioAt: Date | null = null;

  /** Monotonic counter labeling superseding guidance texts (append-only stream — see header). */
  private _guidanceVersion = 0;

  // Streaming input/output transcript accumulation (Gemini streams transcription in chunks)
  private _pendingInputText = '';
  /** When the user's current utterance began transcribing — becomes the row timestamp. */
  private _pendingInputStartedAt: Date | null = null;
  private _pendingOutputText = '';
  private _pendingOutputId: string | null = null;
  private _pendingReasoningText = '';

  constructor() {
    const metadata: ProviderMetadata = {
      provider: 'google',
      model: 'gemini-2.5-flash-native-audio-latest',
      version: '1.0.0',
      capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio', 'voiceActivityDetection', 'customInstructions'],
      latency: 400,
      quality: 'high'
    };
    super('google', metadata);

    globalGoogleLiveAdapter = this;
    if (typeof window !== 'undefined') {
      (window as any).getGlobalGoogleLiveAdapter = () => globalGoogleLiveAdapter;
    } else if (typeof globalThis !== 'undefined') {
      (globalThis as any).getGlobalGoogleLiveAdapter = () => globalGoogleLiveAdapter;
    }
  }

  /** Dev/debug only: inspect the playback pipeline state without ears. */
  public getPlaybackDebugInfo(): { contextState: string | null; nextPlayTime: number; activeSourceCount: number; volume: number; muted: boolean } {
    return {
      contextState: this._playbackContext?.state ?? null,
      nextPlayTime: this._nextPlayTime,
      activeSourceCount: this._activeSources.length,
      volume: this._volume,
      muted: this._isMuted
    };
  }

  async init(options: AdapterInitOptions): Promise<void> {
    try {
      this._options = options;
      this._audioElement = options.audioElement;

      await this._loadConfiguration();
      if (options.providerConfig?.google && this._config) {
        this._config = { ...this._config, ...options.providerConfig.google } as GoogleLiveConfig;
      }

      await this._registerStandardTools();
      if (options.tools) options.tools.forEach(tool => this.registerTool(tool));

      this._conversationId = uuidv4();
    } catch (error) {
      const connectionError = new ConnectionError(
        `Failed to initialize Google Live adapter: ${error instanceof Error ? error.message : String(error)}`,
        'google',
        { error }
      );
      this._setError(connectionError);
      throw connectionError;
    }
  }

  private async _loadConfiguration(): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        const { getClientAIModelManager } = await import('./ClientAIModelManager');
        const configWithMetadata = await getClientAIModelManager().getProviderConfig('google');
        this._config = configWithMetadata.config as GoogleLiveConfig;
      } else {
        const response = await fetch('/api/ai/voice-config?provider=google');
        if (!response.ok) throw new Error(`voice-config API returned ${response.status}`);
        const data = await response.json();
        if (!data.success || !data.config) throw new Error(data.error || 'voice-config API returned no config');
        this._config = data.config as GoogleLiveConfig;
      }
      this._metadata = {
        provider: 'google',
        model: this._config.model,
        capabilities: this._config.capabilities,
        quality: 'high'
      };
    } catch (error) {
      console.error('Failed to load Google Live configuration, using fallback defaults:', error);
      const { getSerializerForProvider } = await import('./config-serializers');
      this._config = getSerializerForProvider('google').getDefaultConfig() as GoogleLiveConfig;
    }
  }

  async connect(options?: ConnectOptions): Promise<void> {
    // Must run synchronously, before any `await`, so browsers associate the
    // AudioContext with the click that invoked connect() — created lazily
    // inside the (async) WebSocket message handler, it starts 'suspended'
    // under autoplay policy and every scheduled buffer plays silently with
    // no error. This is why audio worked for input (mic capture, gated by
    // the getUserMedia permission grant instead) but never for output.
    this._ensurePlaybackContext();

    if (options?.resumeFromSessionId) {
      this._conversationId = options.resumeFromSessionId;
      this._resumeSessionId = options.resumeFromSessionId;
    }

    try {
      this._setConnectionStatus('connecting');

      let inputStream: MediaStream | null = null;
      let inputMode: 'microphone' | 'text-only' | 'synthetic';
      if (options?.syntheticInputStream) {
        inputMode = 'synthetic';
        inputStream = options.syntheticInputStream;
      } else if (options?.audioInput === false) {
        inputMode = 'text-only';
      } else {
        inputMode = 'microphone';
        inputStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
        });
      }
      this._inputStream = inputStream;

      const sessionData = await this._mintSession();
      this._sessionModel = sessionData.model;

      await this._openSocket(sessionData);

      this._audioInputMode = inputMode;
      if (inputStream) {
        this._startCapture(inputStream);
      }

      this._logConnectionEvent('session_start', {
        provider: 'google',
        modelId: sessionData.model,
        resumed: !!options?.resumeFromSessionId
      });

      this._setConnectionStatus('connected');
      this._handleConnectionEvent({ type: 'connected', provider: 'google', timestamp: new Date() });
    } catch (error) {
      this._setConnectionStatus('error');
      const connectionError = new ConnectionError(
        `Failed to connect to Google Live: ${error instanceof Error ? error.message : String(error)}`,
        'google',
        { error }
      );
      this._setError(connectionError);
      this._handleConnectionEvent({ type: 'error', provider: 'google', error: connectionError.message, timestamp: new Date() });
      throw connectionError;
    }
  }

  private async _mintSession(): Promise<GoogleSessionResponse> {
    const params = new URLSearchParams();
    if (this._options?.contextId) params.set('contextId', this._options.contextId);
    if (this._options?.reflinkId) params.set('reflinkId', this._options.reflinkId);
    if (this._resumeSessionId) params.set('resumeSessionId', this._resumeSessionId);

    const response = await fetch(`/api/ai/google/session?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to mint Google session: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  private _openSocket(sessionData: GoogleSessionResponse): Promise<void> {
    // Reset per-socket setup state HERE, not only in disconnect(): after a
    // provider-side close (e.g. protocol violation) the stale true value made
    // every subsequent connect time out waiting for setupComplete (found by
    // the Block A second-setup probe drill, 2026-07-09).
    this._setupComplete = false;
    return new Promise((resolve, reject) => {
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(sessionData.access_token)}`;
      const ws = new WebSocket(url);
      this._ws = ws;

      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for Google Live setupComplete'));
      }, 15000);

      ws.onopen = () => {
        // Client's own setup message: locked fields (systemInstruction, tools,
        // generationConfig) are enforced server-side from the ephemeral token
        // regardless of what's sent here — the model id is echoed for parity.
        ws.send(JSON.stringify({ setup: { model: sessionData.model.startsWith('models/') ? sessionData.model : `models/${sessionData.model}` } }));
      };

      this._setupCompleteResolve = () => {
        clearTimeout(timeout);
        resolve();
      };

      ws.onmessage = (event) => {
        this._handleServerMessage(event.data).catch(err => console.error('Error handling Google Live message:', err));
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        const connectionError = new ConnectionError('Google Live WebSocket error', 'google');
        this._setError(connectionError);
        reject(connectionError);
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.warn(`Google Live WebSocket closed: code=${event.code} reason=${event.reason || '(none)'}`);
        if (this._connectionStatus === 'connected') {
          this._logConnectionEvent('session_end', { endReason: 'provider_closed', closeCode: event.code, closeReason: event.reason });
          this._logEvent('error', `Google Live connection closed unexpectedly (code ${event.code})`, { code: event.code, reason: event.reason });
          this._setConnectionStatus('disconnected');
          this._handleConnectionEvent({
            type: 'disconnected',
            provider: 'google',
            error: event.code !== 1000 ? `Connection closed (code ${event.code}): ${event.reason || 'no reason given'}` : undefined,
            timestamp: new Date()
          });
        }
      };
    });
  }

  private async _handleServerMessage(raw: unknown): Promise<void> {
    // Gemini Live delivers JSON as the frame payload, but browsers hand binary
    // WebSocket frames back as Blob (or ArrayBuffer with binaryType set) rather
    // than a string — normalize before parsing.
    let text: string;
    if (typeof raw === 'string') {
      text = raw;
    } else if (raw instanceof Blob) {
      text = await raw.text();
    } else if (raw instanceof ArrayBuffer) {
      text = new TextDecoder().decode(raw);
    } else {
      return;
    }

    let msg: any;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    if (msg.setupComplete && !this._setupComplete) {
      this._setupComplete = true;
      this._setupCompleteResolve?.();
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;

      if (sc.interrupted) {
        this._stopPlayback();
        this._setSessionStatus('interrupted');
      }

      if (sc.inputTranscription?.text) {
        // Streams word-by-word while the user speaks — accumulate and flush
        // as one row once the model starts responding (see below), rather
        // than emitting a transcript item per fragment.
        if (!this._pendingInputText) this._pendingInputStartedAt = new Date();
        this._pendingInputText += sc.inputTranscription.text;
      }

      const modelStartedResponding = !!(sc.outputTranscription?.text || sc.modelTurn?.parts?.length);
      if (modelStartedResponding && this._pendingInputText.trim()) {
        this._emitTranscript('user_speech', this._pendingInputText, { confidence: 1.0 }, undefined, this._pendingInputStartedAt ?? undefined);
        this._pendingInputText = '';
        this._pendingInputStartedAt = null;
      }

      if (sc.outputTranscription?.text) {
        this._pendingOutputId = this._pendingOutputId ?? uuidv4();
        this._pendingOutputText += sc.outputTranscription.text;
        this._setSessionStatus('speaking');
      }

      for (const part of sc.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) {
          this._playAudioChunk(part.inlineData.data);
        } else if (part.thought && typeof part.text === 'string') {
          // Internal reasoning trace (generationConfig.thinkingConfig) — arrives
          // in its own serverContent messages (no outputTranscription alongside
          // it), never the spoken/transcribed answer. Captured separately so it
          // can be stored and displayed as labeled, collapsible reasoning rather
          // than leaking into the visible response.
          this._pendingReasoningText += part.text;
        } else if (typeof part.text === 'string' && !sc.outputTranscription) {
          // Fallback path (TEXT response modality / no transcription configured)
          this._pendingOutputId = this._pendingOutputId ?? uuidv4();
          this._pendingOutputText += part.text;
        }
      }

      if (sc.turnComplete) {
        if (this._pendingInputText.trim()) {
          // Model never produced output (e.g. interrupted before responding) —
          // still flush the user's question so it isn't lost.
          this._emitTranscript('user_speech', this._pendingInputText, { confidence: 1.0 }, undefined, this._pendingInputStartedAt ?? undefined);
          this._pendingInputText = '';
          this._pendingInputStartedAt = null;
        }
        if (this._pendingOutputText.trim()) {
          this._emitTranscript(
            'ai_response',
            this._pendingOutputText,
            {
              ...(this._pendingReasoningText.trim() ? { reasoning: this._pendingReasoningText.trim() } : {}),
              // 9b.5 turn onset: first-audio time; the item timestamp is turn-END.
              ...(this._turnFirstAudioAt ? { firstAudioAt: this._turnFirstAudioAt.toISOString() } : {}),
            },
            this._pendingOutputId ?? undefined
          );
        }
        this._pendingOutputText = '';
        this._pendingOutputId = null;
        this._pendingReasoningText = '';
        this._turnFirstAudioAt = null;
        this._setSessionStatus(this._audioInputMode === 'text-only' ? 'idle' : 'listening');
        // Turn boundary (P19): apply any queued engine directive; the floating
        // block flushes on change only here (versioned supersession — header).
        this._onTurnBoundary();
      }
    }

    if (msg.toolCall?.functionCalls) {
      for (const call of msg.toolCall.functionCalls) {
        await this._handleToolCall(call);
      }
    }
  }

  private async _handleToolCall(call: { id: string; name: string; args: any }): Promise<void> {
    const callId = call.id || `${call.name}-${Date.now()}`;
    // Live local transcript update only here — persistence (_logToolCall) happens once
    // below, after execution, since the /log route dedupes by id and only persists a
    // tool row once (matching the batch format's phase==='complete'-only persistence).
    this._emitTranscript('tool_call', `Calling ${call.name}`, { toolName: call.name, toolArgs: call.args }, `tool-call-${callId}`);

    const startTime = Date.now();
    let responsePayload: unknown;
    let success = true;
    try {
      responsePayload = await this._executeUnifiedTool(call.name, call.args ?? {});
      // Tool output re-bills as input on every later turn — drop the timing
      // breakdowns the model has no use for (same trim as the OpenAI path).
      if (responsePayload && typeof responsePayload === 'object' && 'searchMetadata' in (responsePayload as Record<string, unknown>)) {
        const { searchMetadata: _dropped, ...slim } = responsePayload as Record<string, unknown>;
        responsePayload = slim;
      }
    } catch (error) {
      success = false;
      responsePayload = { error: error instanceof Error ? error.message : String(error) };
    }
    const executionTime = Date.now() - startTime;

    this._emitTranscript(
      'tool_result',
      success ? 'Tool executed successfully' : `Error: ${(responsePayload as any)?.error}`,
      { toolName: call.name, toolResult: responsePayload, duration: executionTime },
      `tool-result-${callId}`
    );
    this._logToolCall(call.name, call.args, { success, result: responsePayload, executionTime }, callId, startTime);

    this._ws?.send(JSON.stringify({
      toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { result: responsePayload } }] }
    }));
  }

  private _emitTranscript(
    type: 'user_speech' | 'ai_response' | 'tool_call' | 'tool_result',
    content: string,
    metadata?: TranscriptItem['metadata'],
    id?: string,
    timestamp?: Date
  ): void {
    const item: TranscriptItem = {
      id: id ?? uuidv4(),
      type,
      content,
      // Caller-supplied timestamps keep rows in true conversational order —
      // user rows are stamped at first transcription fragment, not at flush.
      timestamp: timestamp ?? new Date(),
      provider: 'google',
      metadata
    };
    this._addTranscriptItem(item);
    this._handleTranscriptEvent({ type: 'transcript_update', item, timestamp: new Date() });

    if (type === 'user_speech' || type === 'ai_response') {
      this._reportTranscriptToServer(item);
    }
  }

  // ---- Audio capture (mic or synthetic -> realtimeInput.audio) ----

  private _startCapture(stream: MediaStream): void {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextCtor();
      this._captureContext = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(INPUT_CHUNK_SIZE, 1, 1);
      const silentGain = ctx.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (e) => {
        if (!this._capturing || this._isMuted || this._ws?.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16k(input, ctx.sampleRate);
        const pcm16 = floatTo16BitPCM(downsampled);
        this._ws.send(JSON.stringify({
          realtimeInput: { audio: { data: arrayBufferToBase64(pcm16.buffer), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` } }
        }));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(ctx.destination);
      this._captureProcessor = processor;
      this._capturing = true;
      this._setSessionStatus('listening');
      this._handleAudioEvent({ type: 'audio_start', timestamp: new Date() });
    } catch (error) {
      const audioError = new AudioError(`Failed to start Google Live audio capture: ${error instanceof Error ? error.message : String(error)}`, 'google');
      this._setError(audioError);
      this._handleAudioEvent({ type: 'audio_error', error: audioError.message, timestamp: new Date() });
    }
  }

  private _stopCapture(): void {
    this._capturing = false;
    this._captureProcessor?.disconnect();
    this._captureProcessor = null;
    if (this._captureContext && this._captureContext.state !== 'closed') {
      this._captureContext.close().catch(() => {});
    }
    this._captureContext = null;
  }

  // ---- Audio playback (serverContent.modelTurn inlineData -> speakers) ----

  /** Must be called synchronously from a user-gesture call stack (see connect()). */
  private _ensurePlaybackContext(): void {
    if (this._playbackContext) return;
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextCtor();
    this._playbackContext = ctx;
    const gain = ctx.createGain();
    gain.gain.value = this._isMuted ? 0 : this._volume;
    gain.connect(ctx.destination);
    this._playbackGain = gain;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(err => console.warn('Google Live playback AudioContext resume failed:', err));
    }
  }

  private _playAudioChunk(base64Data: string): void {
    try {
      this._ensurePlaybackContext();
      const ctx = this._playbackContext!;
      const pcm16 = new Int16Array(base64ToArrayBuffer(base64Data));
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

      const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
      buffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this._playbackGain!);

      // Model speech becoming audible after silence: drives the D50 clip
      // cutoff and, once per turn, the 9b.5 turn-onset timestamp (the honest
      // latency signal — the flushed transcript timestamp is turn-END).
      if (this._activeSources.length === 0) {
        if (!this._turnFirstAudioAt) this._turnFirstAudioAt = new Date();
        this._handleAudioEvent({ type: 'speech_start', timestamp: new Date() });
      }

      const startAt = Math.max(ctx.currentTime, this._nextPlayTime);
      source.start(startAt);
      this._nextPlayTime = startAt + buffer.duration;
      this._activeSources.push(source);
      source.onended = () => {
        this._activeSources = this._activeSources.filter(s => s !== source);
        if (this._activeSources.length === 0) {
          this._handleAudioEvent({ type: 'speech_end', timestamp: new Date() });
        }
      };
    } catch (error) {
      console.error('Failed to play Google Live audio chunk:', error);
    }
  }

  private _stopPlayback(): void {
    for (const source of this._activeSources) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    this._activeSources = [];
    if (this._playbackContext) {
      this._nextPlayTime = this._playbackContext.currentTime;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this._setConnectionStatus('disconnected');
      this._stopCapture();
      this._stopPlayback();

      if (this._playbackContext && this._playbackContext.state !== 'closed') {
        await this._playbackContext.close().catch(() => {});
      }
      this._playbackContext = null;
      this._playbackGain = null;

      if (this._ws) {
        this._logConnectionEvent('session_end', { endReason: 'user_disconnect' });
        this._ws.close(1000, 'client disconnect');
        this._ws = null;
      }
      this._setupComplete = false;
      this._setupCompleteResolve = null;

      this._handleConnectionEvent({ type: 'disconnected', provider: 'google', timestamp: new Date() });
    } catch (error) {
      const connectionError = new ConnectionError(`Error during disconnect: ${error instanceof Error ? error.message : String(error)}`, 'google', { error });
      this._setError(connectionError);
      throw connectionError;
    }
  }

  async cleanup(): Promise<void> {
    await this.disconnect();
    this._releaseBaseSubscriptions();
    this._transcript = [];
    this._tools.clear();
    this._lastError = null;
  }

  async startAudioInput(): Promise<void> {
    if (this._capturing) return;
    if (this._inputStream) {
      this._startCapture(this._inputStream);
    }
  }

  async stopAudioInput(): Promise<void> {
    if (!this._capturing) return;
    this._stopCapture();
    this._setSessionStatus('idle');
    this._handleAudioEvent({ type: 'audio_end', timestamp: new Date() });
  }

  async sendMessage(message: string): Promise<void> {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new VoiceAgentError('No active Google Live session', 'google');
    }
    this._emitTranscript('user_speech', message, { confidence: 1.0 });
    // realtimeInput.text, not clientContent: Gemini 3.1 Live restricts
    // clientContent to seeding initial history — mid-conversation text updates
    // must ride the realtime input channel (works on 2.5 too).
    this._ws.send(JSON.stringify({
      realtimeInput: { text: message }
    }));
  }

  async sendAudioData(audioData: ArrayBuffer): Promise<void> {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new AudioError('No active Google Live session for audio data', 'google');
    }
    this._ws.send(JSON.stringify({
      realtimeInput: { audio: { data: arrayBufferToBase64(audioData), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` } }
    }));
  }

  // Playback here is raw Web Audio API (no HTMLAudioElement), so mute/volume
  // must drive the playback gain node directly rather than the base class's
  // _audioElement-based defaults.
  mute(): void {
    this._isMuted = true;
    if (this._playbackGain) this._playbackGain.gain.value = 0;
  }

  unmute(): void {
    this._isMuted = false;
    if (this._playbackGain) this._playbackGain.gain.value = this._volume;
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._playbackGain && !this._isMuted) this._playbackGain.gain.value = this._volume;
  }

  async interrupt(): Promise<void> {
    this._stopPlayback();
    this._setSessionStatus('idle');
  }

  async updateConfig(config: Partial<AdapterInitOptions>): Promise<void> {
    this._options = { ...this._options!, ...config };
    if (config.providerConfig?.google && this._config) {
      this._config = { ...this._config, ...config.providerConfig.google };
    }
  }

  /** D49: the logical-conversation session id this adapter writes history under. */
  public getConversationSessionId(): string | null {
    return this._conversationId;
  }

  // ---- D47(d) updateSession mechanics (conversation-engine task A2.2) ----
  // Fidelity here is DEGRADED by design — see the header philosophy comment
  // and the notes §4 matrix. Results are recorded honestly, never silently
  // skipped (P7).

  /** Floating block cadence: send only on change — re-sending unchanged blocks
   *  on an append-only stream multiplies copies with zero benefit (P27). */
  protected _contextFlushMode(): 'every-turn' | 'on-change' | 'none' {
    return 'on-change';
  }

  protected _isModelResponding(): boolean {
    return this._sessionStatus === 'speaking';
  }

  /**
   * systemInstruction is locked into the ephemeral token at mint (P7) — there
   * is no protocol message to change it. Fold the new guidance into a
   * superseding realtimeInput.text and record `degraded`.
   */
  protected async _applyInstructions(instructions: string): Promise<SessionUpdateFieldResult> {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return 'failed';
    const version = ++this._guidanceVersion;
    this._ws.send(JSON.stringify({
      realtimeInput: {
        text: `[UPDATED GUIDANCE v${version} — supersedes all previous guidance]\n${instructions}`
      }
    }));
    return 'degraded';
  }

  /**
   * MID-SESSION TOOL CHANGES ARE UNSUPPORTED ON GEMINI LIVE — and the
   * adaptation strategy is decided (owner, 2026-07-09):
   *
   * Tool declarations are locked into the ephemeral token's
   * bidiGenerateContentSetup at mint; the Live protocol has no post-setup
   * tool-update message. Verified by DRIVING it (D22; Block A drill,
   * 2026-07-09): sending a second `setup` frame mid-session closes the socket
   * with code 1007 "setup must be the first message and only the first".
   *
   * How the conversation engine adapts (owner decision — do NOT re-mint per
   * node transition here): Gemini sessions mint with the FULL tool surface
   * and full base guidance, and node state reaches the model as STRONG
   * appended guidance instead — the superseding `realtimeInput.text` sends
   * (`_applyInstructions`/`_applyContextBlock` below) tell the model which
   * capabilities the current state wants used or left alone. Model-side tool
   * narrowing is therefore advisory on this provider; the REAL enforcement of
   * a node's allowlist is server-side in /api/ai/tools/execute
   * (tier ∩ session ∩ node — Req 4.1), which no provider limitation can
   * bypass. A D49 re-mint remains the fallback only where a tool-set change
   * is truly structural (rides the Req 5.3 model-swap path).
   */
  protected async _applyToolSchema(_tools: Array<Record<string, unknown>>): Promise<SessionUpdateFieldResult> {
    return 'unsupported';
  }

  /**
   * Floating block by VERSIONED SUPERSESSION (P27): nothing we sent can be
   * deleted — including our own previous blocks — so each changed block is
   * sent labeled as replacing all prior copies, trusting the model to prefer
   * the latest and native compression to evict stale ones eventually.
   */
  protected async _applyContextBlock(block: ContextBlock): Promise<SessionUpdateFieldResult> {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return 'failed';
    const body = block.text
      ? `[CURRENT CONTEXT v${block.version} — supersedes all previous context blocks]\n${block.text}`
      : `[CURRENT CONTEXT v${block.version} — supersedes all previous context blocks]\n(no active context)`;
    this._ws.send(JSON.stringify({ realtimeInput: { text: body } }));
    return 'superseded';
  }

  // ---- Standard tool registration (mirrors ElevenLabsAdapter/OpenAI pattern) ----

  private async _registerStandardTools(): Promise<void> {
    const { unifiedToolRegistry } = await import('@/lib/ai/tools/UnifiedToolRegistry');
    unifiedToolRegistry.getModelExposedToolDefinitions().forEach(toolDef => {
      this.registerTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        handler: async (args: any) => this._executeUnifiedTool(toolDef.name, args)
      });
    });
  }

  // ---- D49 leg lifecycle + persistence (baseline; see task 6.3 gap notes) ----

  private _logConnectionEvent(eventType: 'session_start' | 'session_end' | 'disruption', data: Record<string, unknown>): void {
    this._postConversationLog({
      sessionId: this._conversationId,
      provider: 'google',
      reflinkId: this._options?.reflinkId,
      conversationData: {
        startTime: new Date().toISOString(),
        entries: [{
          id: `conn_${eventType}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'connection_event',
          provider: 'google',
          data: { eventType, ...data }
        }],
        toolCallSummary: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, clientCalls: 0, serverCalls: 0, averageExecutionTime: 0 },
        conversationMetrics: { totalTranscriptItems: 0, totalConnectionEvents: 1, totalContextRequests: 0 }
      }
    });
  }

  private _reportTranscriptToServer(item: TranscriptItem): void {
    this._postConversationLog({
      transcriptItem: { ...item, timestamp: item.timestamp.toISOString() },
      sessionId: this._conversationId,
      contextId: this._options?.contextId,
      reflinkId: this._options?.reflinkId,
      provider: 'google',
      timestamp: new Date().toISOString()
    });
  }

  private _logToolCall(
    toolName: string,
    args: unknown,
    result: { success: boolean; result: unknown; executionTime: number } | undefined,
    callId: string,
    startedAt?: number
  ): void {
    this._postConversationLog({
      sessionId: this._conversationId,
      provider: 'google',
      reflinkId: this._options?.reflinkId,
      toolName,
      toolArgs: args,
      // Persist the RESULT too — absent until 2026-07-08, which made every
      // Gemini tool row replay as result:"null" (the model saw the real data;
      // the log didn't). The route slices to 8KB.
      toolResult: result?.result,
      // Execution-START stamp keeps transcript rows in invocation order
      // (completion-time stamps read as "shuffled" — owner, 2026-07-08).
      timestamp: new Date(startedAt ?? Date.now()).toISOString(),
      metadata: {
        toolCallId: callId,
        success: result?.success,
        executionTime: result?.executionTime
      }
    });
  }
}
