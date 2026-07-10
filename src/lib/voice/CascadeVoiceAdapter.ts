/**
 * CascadeVoiceAdapter (D45, ai-assistant task 9.2) — the cascade voice family
 * behind the same IConversationalAgentAdapter as the native s2s providers.
 *
 *   mic ──► conservative energy VAD ──► POST /api/ai/cascade/stt
 *        ──► POST /api/ai/chat  (the SAME text pipeline as text chat: reasoning
 *             adapter + UnifiedToolRegistry server-side — "one brain")
 *        ──► POST /api/ai/cascade/tts ──► AudioContext playback
 *
 * Design (design-voice-adapters §2b):
 * - Turn-taking v1 is deliberately simple: endpoint on silence, half-duplex
 *   (VAD is suspended while the assistant speaks/processes — barge-in is v2).
 * - Persistence is owned by the chat route (modality:'voice' labels, debugInfo
 *   with tool traces, ledger cross-refs) — the adapter posts no transcript
 *   items itself, so nothing is double-written. The chat response returns the
 *   DB conversationId for the debug chip.
 * - Models/voices come from the cascade VoiceProviderConfig row, resolved
 *   SERVER-side (D3/D4) — this client never names a model.
 * - Works with the D53 SyntheticMicDriver (options.syntheticInputStream), so
 *   the C0 fake-mic driver e2e-covers this family too.
 *
 * DESIGN PHILOSOPHY — WE ASSEMBLE EVERY TURN (conversation-engine notes §4;
 * doc-comment mandated by task A2.4, owner 2026-07-09):
 * There is no standing provider session — every turn's prompt is assembled
 * from scratch SERVER-side inside /api/ai/chat from ground truth
 * (latestState, conversation history, the D55 buffer's server-side sources).
 * All context invariants therefore hold trivially and exactly: the floating
 * block is literal message ordering at assembly, pruning is assembly-time
 * windowing, instruction/tool/model changes are pure data for the next turn.
 * `updateSession` here reports `applied` while sending nothing — the truth
 * the result encodes is "the next turn's assembly WILL reflect this", because
 * the server re-derives everything and never consults client state (engine
 * directives are not even returned to cascade clients — notes §2.2.9).
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AdapterInitOptions,
  TranscriptItem,
  VoiceAgentError,
} from '@/types/voice-agent';
import {
  BaseConversationalAgentAdapter,
  ConnectOptions,
} from './IConversationalAgentAdapter';
import type { CascadeConfig } from '@/types/voice-config';

const MAX_HISTORY_TURNS = 12;
/** A recorder segment with no speech at all is dropped and restarted this often. */
const IDLE_SEGMENT_RESET_MS = 45_000;

export class CascadeVoiceAdapter extends BaseConversationalAgentAdapter {
  private _config: CascadeConfig | null = null;
  private _conversationId: string | null = null;
  private _resumeSessionId: string | null = null;

  // Input side
  private _inputStream: MediaStream | null = null;
  private _ownsInputStream = false; // true when we called getUserMedia ourselves
  private _recorder: MediaRecorder | null = null;
  private _recorderChunks: Blob[] = [];
  private _recorderStartedAt = 0;
  private _vadContext: AudioContext | null = null;
  private _vadAnalyser: AnalyserNode | null = null;
  private _vadSource: MediaStreamAudioSourceNode | null = null;
  private _vadTimer: ReturnType<typeof setInterval> | null = null;
  private _speechStartedAt: number | null = null;
  private _lastSpeechAt = 0;

  // Output side
  private _playbackContext: AudioContext | null = null;
  private _gainNode: GainNode | null = null;
  private _currentSource: AudioBufferSourceNode | null = null;

  /** Half-duplex guard: while true, VAD detection is suspended. */
  private _busy = false;

  /** Task 8 duration cap: auto-disconnect at the configured bound (the
   *  per-request gateway budgets are the server-side backstop here). */
  private _durationCapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super('cascade', {
      provider: 'cascade',
      capabilities: ['toolCalling', 'voiceActivityDetection', 'customInstructions'],
      quality: 'high',
    });
  }

  // ---- D47(d) updateSession mechanics (conversation-engine task A2.3) ----
  // Explicit next-turn-assembly application, not silent absence: every field
  // reports `applied` because /api/ai/chat re-derives instructions, tools,
  // and context server-side each turn — there is no live session to mutate
  // and nothing client-held to update (header philosophy comment).

  protected async _applyInstructions(_instructions: string): Promise<import('./IConversationalAgentAdapter').SessionUpdateFieldResult> {
    return 'applied'; // next-turn server-side assembly
  }

  protected async _applyToolSchema(_tools: Array<Record<string, unknown>>): Promise<import('./IConversationalAgentAdapter').SessionUpdateFieldResult> {
    return 'applied'; // next-turn server-side assembly
  }

  protected async _applyContextBlock(_block: import('@/lib/ai/context-buffer').ContextBlock): Promise<import('./IConversationalAgentAdapter').SessionUpdateFieldResult> {
    return 'applied'; // the block is literal message ordering at next-turn assembly
  }

  // ---- lifecycle -----------------------------------------------------------

  async init(options: AdapterInitOptions): Promise<void> {
    this._options = options;
    this._audioElement = options.audioElement;
    await this._loadConfiguration();
    this._conversationId = uuidv4();
  }

  private async _loadConfiguration(): Promise<void> {
    try {
      const response = await fetch('/api/ai/voice-config?provider=cascade');
      if (!response.ok) throw new Error(`voice-config API returned ${response.status}`);
      const data = await response.json();
      if (!data.success || !data.config) throw new Error(data.error || 'voice-config API returned no config');
      this._config = data.config as CascadeConfig;
    } catch (error) {
      console.error('Failed to load cascade configuration, using fallback defaults:', error);
      const { getSerializerForProvider } = await import('./config-serializers');
      this._config = getSerializerForProvider('cascade').getDefaultConfig() as CascadeConfig;
    }
    this._metadata = {
      provider: 'cascade',
      model: `${this._config.sttModel} → chat → ${this._config.ttsModel}`,
      capabilities: this._config.capabilities,
      quality: 'high',
    };
  }

  async connect(options?: ConnectOptions): Promise<void> {
    // Playback context must be born inside the user-gesture call stack, or
    // autoplay policy leaves it suspended and everything plays silently
    // (hard-won Gemini Live lesson — see design-voice-adapters §2c).
    this._ensurePlaybackContext();

    if (options?.resumeFromSessionId) {
      this._conversationId = options.resumeFromSessionId;
      this._resumeSessionId = options.resumeFromSessionId;
    }

    try {
      this._setConnectionStatus('connecting');

      // Public tier needs the chat-session cookie (same one text chat uses).
      // Best-effort: admin/reflink tiers pass the gateway without it.
      await this._mintChatSession();

      if (options?.syntheticInputStream) {
        this._audioInputMode = 'synthetic';
        this._inputStream = options.syntheticInputStream;
        this._ownsInputStream = false;
      } else if (options?.audioInput === false) {
        this._audioInputMode = 'text-only';
        this._inputStream = null;
      } else {
        this._audioInputMode = 'microphone';
        this._inputStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        this._ownsInputStream = true;
      }

      if (this._inputStream) {
        this._startListening(this._inputStream);
      }

      this._setConnectionStatus('connected');
      this._setSessionStatus(this._inputStream ? 'listening' : 'idle');
      this._handleConnectionEvent({ type: 'connected', provider: 'cascade', timestamp: new Date() });

      // Duration cap (task 8 / Req 2.4): older DB rows may predate the field.
      const capSeconds = this._config?.maxSessionSeconds || 900;
      this._durationCapTimer = setTimeout(() => {
        if (!this.isConnected()) return;
        console.warn(`CascadeVoiceAdapter: session duration cap (${capSeconds}s) reached — disconnecting`);
        void this.disconnect().catch((err) => console.error('Cascade duration-cap disconnect failed:', err));
      }, capSeconds * 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._setConnectionStatus('error');
      this._setError(new VoiceAgentError(`Cascade connect failed: ${message}`, 'cascade'));
      this._handleConnectionEvent({ type: 'error', provider: 'cascade', error: message, timestamp: new Date() });
      throw error;
    }
  }

  private async _mintChatSession(): Promise<void> {
    try {
      await fetch('/api/ai/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Dev runs Cloudflare's always-pass Turnstile test keys (CLAUDE.md);
        // deploy-time swap renders the real widget.
        body: JSON.stringify({ turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' }),
      });
    } catch {
      // Non-fatal: admin/reflink tiers don't need this cookie.
    }
  }

  async disconnect(): Promise<void> {
    if (this._durationCapTimer) {
      clearTimeout(this._durationCapTimer);
      this._durationCapTimer = null;
    }
    this._stopListening();
    this._stopPlayback();
    if (this._ownsInputStream && this._inputStream) {
      this._inputStream.getTracks().forEach((t) => t.stop());
    }
    this._inputStream = null;
    this._ownsInputStream = false;
    this._audioInputMode = null;
    this._setConnectionStatus('disconnected');
    this._setSessionStatus('idle');
    this._handleConnectionEvent({ type: 'disconnected', provider: 'cascade', timestamp: new Date() });
  }

  async cleanup(): Promise<void> {
    await this.disconnect().catch(() => {});
    if (this._playbackContext && this._playbackContext.state !== 'closed') {
      await this._playbackContext.close().catch(() => {});
    }
    this._playbackContext = null;
    this._gainNode = null;
  }

  // ---- input: VAD + recorder -----------------------------------------------

  private _startListening(stream: MediaStream): void {
    this._vadContext = new AudioContext();
    void this._vadContext.resume().catch(() => {});
    this._vadSource = this._vadContext.createMediaStreamSource(stream);
    this._vadAnalyser = this._vadContext.createAnalyser();
    this._vadAnalyser.fftSize = 2048;
    this._vadSource.connect(this._vadAnalyser);

    this._startRecorderSegment(stream);

    const frame = new Float32Array(this._vadAnalyser.fftSize);
    const vad = this._config!.vad;
    this._vadTimer = setInterval(() => {
      if (!this._vadAnalyser || !this._recorder) return;
      if (this._busy) return; // half-duplex: no detection while processing/speaking

      this._vadAnalyser.getFloatTimeDomainData(frame);
      let sum = 0;
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
      const rms = Math.sqrt(sum / frame.length);
      const now = Date.now();

      if (rms >= vad.threshold) {
        if (this._speechStartedAt === null) {
          this._speechStartedAt = now;
          this._setSessionStatus('listening');
        }
        this._lastSpeechAt = now;
      }

      const speechDuration = this._speechStartedAt ? this._lastSpeechAt - this._speechStartedAt : 0;

      if (this._speechStartedAt !== null && now - this._lastSpeechAt >= vad.silenceMs) {
        // Utterance endpoint: silence long enough after speech.
        const hadEnoughSpeech = speechDuration >= vad.minSpeechMs;
        this._speechStartedAt = null;
        this._finishRecorderSegment(hadEnoughSpeech);
      } else if (this._speechStartedAt !== null && now - this._speechStartedAt >= vad.maxUtteranceMs) {
        // Hard cap: force the endpoint.
        this._speechStartedAt = null;
        this._finishRecorderSegment(true);
      } else if (this._speechStartedAt === null && now - this._recorderStartedAt >= IDLE_SEGMENT_RESET_MS) {
        // Nothing but silence — drop the segment so blobs stay bounded.
        this._finishRecorderSegment(false);
      }
    }, 100);
  }

  private _recorderMimeType(): string {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus';
    }
    return 'audio/webm';
  }

  private _startRecorderSegment(stream: MediaStream): void {
    this._recorderChunks = [];
    this._recorderStartedAt = Date.now();
    const recorder = new MediaRecorder(stream, { mimeType: this._recorderMimeType() });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this._recorderChunks.push(e.data);
    };
    recorder.start(250);
    this._recorder = recorder;
  }

  /** Stop the current segment; when `process` is true, run it through STT → chat → TTS. */
  private _finishRecorderSegment(process: boolean): void {
    const recorder = this._recorder;
    const stream = this._inputStream;
    if (!recorder || !stream) return;
    this._recorder = null;

    recorder.onstop = () => {
      const blob = new Blob(this._recorderChunks, { type: recorder.mimeType || 'audio/webm' });
      this._recorderChunks = [];
      if (process && blob.size > 0) {
        void this._handleUtterance(blob);
      }
      // Keep listening unless we're mid-turn (the turn restarts the recorder when done).
      if (!this._busy && this.isConnected() && this._inputStream) {
        this._startRecorderSegment(this._inputStream);
      }
    };
    try {
      recorder.stop();
    } catch {
      // recorder already inactive — nothing to flush
    }
  }

  private _stopListening(): void {
    if (this._vadTimer) {
      clearInterval(this._vadTimer);
      this._vadTimer = null;
    }
    if (this._recorder && this._recorder.state !== 'inactive') {
      this._recorder.onstop = null;
      try { this._recorder.stop(); } catch { /* already stopped */ }
    }
    this._recorder = null;
    this._recorderChunks = [];
    this._speechStartedAt = null;
    this._vadSource?.disconnect();
    this._vadSource = null;
    this._vadAnalyser = null;
    if (this._vadContext && this._vadContext.state !== 'closed') {
      void this._vadContext.close().catch(() => {});
    }
    this._vadContext = null;
  }

  // ---- the cascade turn ------------------------------------------------------

  private async _handleUtterance(blob: Blob): Promise<void> {
    this._busy = true;
    this._setSessionStatus('processing');
    try {
      const sttRes = await fetch('/api/ai/cascade/stt', {
        method: 'POST',
        headers: { 'Content-Type': blob.type.split(';')[0] || 'audio/webm' },
        body: blob,
      });
      const stt = await sttRes.json().catch(() => null);
      if (!sttRes.ok || !stt?.success) {
        throw new Error(stt?.error || `STT failed (${sttRes.status})`);
      }
      const text = (stt.text as string).trim();
      if (!text) return; // noise — nothing to do

      await this._runTurn(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._setError(new VoiceAgentError(`Cascade turn failed: ${message}`, 'cascade'));
      this._emitTranscript({
        id: `error_${Date.now()}`,
        type: 'error',
        content: message,
        timestamp: new Date(),
        provider: 'cascade',
      });
    } finally {
      this._busy = false;
      this._setSessionStatus(this._inputStream ? 'listening' : 'idle');
      if (this.isConnected() && this._inputStream && !this._recorder) {
        this._startRecorderSegment(this._inputStream);
      }
    }
  }

  /** Shared by voice utterances and typed messages (D58: input modality is the caller's). */
  private async _runTurn(userText: string): Promise<void> {
    this._emitTranscript({
      id: `user_${Date.now()}`,
      type: 'user_speech',
      content: userText,
      timestamp: new Date(),
      provider: 'cascade',
    });

    const history = this._transcript
      .filter((t) => t.type === 'user_speech' || t.type === 'ai_response')
      .slice(-MAX_HISTORY_TURNS, -1) // everything before the turn we just added
      .map((t) => ({ role: t.type === 'user_speech' ? 'user' : 'assistant', content: t.content }));

    const doSend = () =>
      fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history,
          sessionId: this._conversationId,
          modality: 'voice',
        }),
      });

    let chatRes = await doSend();
    if (chatRes.status === 401) {
      // session cookie expired — one re-mint + retry (same policy as text chat)
      await this._mintChatSession();
      chatRes = await doSend();
    }
    const chat = await chatRes.json().catch(() => null);
    if (!chatRes.ok || typeof chat?.reply !== 'string') {
      throw new Error(chat?.error || `chat failed (${chatRes.status})`);
    }

    // The chat route persisted both turns — capture the DB conversation id for
    // the debug chip (same contract as the /log response).
    const cid = chat.conversationId;
    if (typeof cid === 'string' && cid) {
      this._persistedConversationId = cid;
      this._options?.onConversationPersisted?.(cid);
    }

    this._emitTranscript({
      id: `assistant_${Date.now()}`,
      type: 'ai_response',
      content: chat.reply,
      timestamp: new Date(),
      provider: 'cascade',
    });

    if (chat.reply.trim()) {
      await this._speak(chat.reply);
    }
  }

  private async _speak(text: string): Promise<void> {
    this._setSessionStatus('speaking');
    const ttsRes = await fetch('/api/ai/cascade/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!ttsRes.ok) {
      const detail = await ttsRes.json().catch(() => null);
      throw new Error(detail?.error || `TTS failed (${ttsRes.status})`);
    }
    const encoded = await ttsRes.arrayBuffer();

    const ctx = this._ensurePlaybackContext();
    const buffer = await ctx.decodeAudioData(encoded.slice(0));

    await new Promise<void>((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this._gainNode!);
      this._currentSource = source;
      // speech_* not audio_* — these are MODEL SPEECH events (clip cutoff,
      // isPlaying), not mic-capture lifecycle.
      this._handleAudioEvent({ type: 'speech_start', timestamp: new Date() });
      source.onended = () => {
        if (this._currentSource === source) this._currentSource = null;
        this._handleAudioEvent({ type: 'speech_end', timestamp: new Date() });
        resolve();
      };
      source.start();
    });
  }

  private _ensurePlaybackContext(): AudioContext {
    if (!this._playbackContext || this._playbackContext.state === 'closed') {
      this._playbackContext = new AudioContext();
      this._gainNode = this._playbackContext.createGain();
      this._gainNode.connect(this._playbackContext.destination);
      this._applyGain();
    }
    if (this._playbackContext.state === 'suspended') {
      void this._playbackContext.resume().catch(() => {});
    }
    return this._playbackContext;
  }

  private _applyGain(): void {
    if (this._gainNode) {
      this._gainNode.gain.value = this._isMuted ? 0 : this._volume;
    }
  }

  private _stopPlayback(): void {
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch { /* already stopped */ }
      this._currentSource = null;
    }
  }

  private _emitTranscript(item: TranscriptItem): void {
    this._handleTranscriptEvent({ type: 'transcript_complete', item, timestamp: new Date() });
  }

  // ---- adapter surface --------------------------------------------------------

  async startAudioInput(): Promise<void> {
    if (this._inputStream) return;
    this._inputStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this._ownsInputStream = true;
    this._audioInputMode = 'microphone';
    this._startListening(this._inputStream);
    this._setSessionStatus('listening');
  }

  async stopAudioInput(): Promise<void> {
    this._stopListening();
    if (this._ownsInputStream && this._inputStream) {
      this._inputStream.getTracks().forEach((t) => t.stop());
    }
    this._inputStream = null;
    this._ownsInputStream = false;
    this._audioInputMode = this.isConnected() ? 'text-only' : null;
    this._setSessionStatus('idle');
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.isConnected()) {
      throw new VoiceAgentError('Not connected', 'cascade');
    }
    const text = message.trim();
    if (!text) return;
    this._busy = true;
    this._setSessionStatus('processing');
    try {
      await this._runTurn(text);
    } finally {
      this._busy = false;
      this._setSessionStatus(this._inputStream ? 'listening' : 'idle');
    }
  }

  async sendAudioData(): Promise<void> {
    throw new VoiceAgentError('sendAudioData is not supported by the cascade adapter (mic/synthetic stream only)', 'cascade');
  }

  async interrupt(): Promise<void> {
    this._stopPlayback();
    this._setSessionStatus(this._inputStream ? 'listening' : 'idle');
  }

  mute(): void {
    this._isMuted = true;
    this._applyGain();
  }

  unmute(): void {
    this._isMuted = false;
    this._applyGain();
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    this._applyGain();
  }

  async updateConfig(config: Partial<AdapterInitOptions>): Promise<void> {
    if (this._options) {
      this._options = { ...this._options, ...config };
    }
  }

  getConversationSessionId(): string | null {
    return this._conversationId;
  }
}
