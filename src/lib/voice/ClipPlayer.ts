/**
 * D50 client-side clip player (ai-assistant task 9b.3) — adapter-INDEPENDENT
 * by design: connection-state clips must play precisely when no adapter
 * connection exists (Req 13.2).
 *
 * Anticipatory filler (owner, 2026-07-08): the manifest carries measured
 * per-tool median latencies AND per-clip durations, so the host can play a
 * filler THE INSTANT a slow tool call starts — picking a clip whose LENGTH
 * FITS the expected gap ("that length and shorter"); when nothing fits, a
 * few hundred ms of silence beats a clip that gets chopped. One clip per
 * silence gap — staggered back-to-back clips are worse than silence.
 *
 * Caching: clips decode in the background in priority order (most-used
 * category first, round-robin across categories); play() selects among
 * ALREADY-LOADED variants. Cutoff is INSTANT on demand (Req 13.1).
 *
 * Every playback reports through `onClipPlayed` so the host can log an honest
 * `clip_played` history event (Req 13.5) with played-vs-total durations.
 */

export type ClipTag = 'filler' | 'disruption' | 'resume_failed' | 'greeting';

/** Preload priority: most-used category first (fillers fire every slow tool call). */
const TAG_PRIORITY: ClipTag[] = ['filler', 'disruption', 'resume_failed', 'greeting'];

interface ManifestClip {
  phraseId: string;
  tag: string;
  text: string;
  url: string;
  durationMs: number | null;
}

export interface ClipPlayedInfo {
  phraseId: string;
  tag: ClipTag;
  text: string;
  voiceId: string;
  /** How long the clip actually played. */
  playedMs: number;
  /** Full clip length (decoded), when known. */
  clipLengthMs: number | null;
  /** True when playback was cut off before the clip finished. */
  cutOff: boolean;
}

export interface PlayOptions {
  /**
   * Only pick clips whose known length ≤ this (+ nothing at all when none
   * fit) — the anticipatory path passes the expected tool gap here.
   */
  maxDurationMs?: number;
  /** Pick only among already-decoded clips (the instant path). Default true. */
  loadedOnly?: boolean;
}

export class ClipPlayer {
  private _provider: string | null = null;
  private _manifest: { voiceId: string; clips: ManifestClip[] } | null = null;
  private _manifestPromise: Promise<void> | null = null;
  private _toolLatencies: Record<string, number> = {};
  private _buffers = new Map<string, AudioBuffer>(); // keyed by clip url
  private _context: AudioContext | null = null;
  private _current: { source: AudioBufferSourceNode; startedAt: number; lengthMs: number | null; info: Omit<ClipPlayedInfo, 'playedMs' | 'clipLengthMs' | 'cutOff'> } | null = null;
  private _onClipPlayed?: (info: ClipPlayedInfo) => void;
  private _preloadRun = 0; // invalidates a background preload when the provider changes

  constructor(onClipPlayed?: (info: ClipPlayedInfo) => void) {
    this._onClipPlayed = onClipPlayed;
  }

  /**
   * (Re)load the manifest for a session provider and start the prioritized
   * background decode. Clips are strictly voice-matched server-side, so a
   * provider switch invalidates the old set.
   */
  setProvider(provider: string): Promise<void> {
    if (provider === this._provider && this._manifestPromise) return this._manifestPromise;
    this._provider = provider;
    this._manifest = null;
    this._buffers.clear();
    this._preloadRun++;
    const run = this._preloadRun;

    this._manifestPromise = fetch(`/api/ai/voice-clips/manifest?provider=${encodeURIComponent(provider)}`)
      .then((r) => r.json())
      .then((data) => {
        if (run !== this._preloadRun) return;
        if (data?.success) {
          this._toolLatencies = data.toolLatencies ?? {};
          if (data.voiceId && Array.isArray(data.clips)) {
            this._manifest = { voiceId: data.voiceId, clips: data.clips };
            void this._preloadInPriorityOrder(run);
          }
        }
      })
      .catch((err) => console.warn('[ClipPlayer] manifest load failed:', err));
    return this._manifestPromise;
  }

  /** Measured median execution ms for a tool, when known (from the manifest). */
  getExpectedToolMs(toolName: string): number | null {
    return this._toolLatencies[toolName] ?? null;
  }

  hasClips(tag: ClipTag): boolean {
    return !!this._manifest?.clips.some((c) => c.tag === tag);
  }

  get isPlaying(): boolean {
    return this._current !== null;
  }

  /**
   * Play a clip of the tag, honoring the length constraint: among candidates
   * that FIT (length ≤ maxDurationMs), the LONGEST wins (covers the most gap);
   * when none fit, nothing plays — a short silence beats a chopped clip. With
   * no constraint, a random loaded variant plays. Any playing clip is cut off
   * first (never overlap).
   */
  async play(tag: ClipTag, options?: PlayOptions): Promise<boolean> {
    if (this._manifestPromise) await this._manifestPromise;
    const manifest = this._manifest;
    if (!manifest) return false;
    const loadedOnly = options?.loadedOnly ?? true;

    let pool = manifest.clips.filter((c) => c.tag === tag);
    if (loadedOnly) {
      const loaded = pool.filter((c) => this._buffers.has(c.url));
      // Nothing decoded yet and no length constraint (connection clips):
      // awaiting the first fetch beats silence. The constrained instant path
      // stays loaded-only.
      if (loaded.length === 0 && options?.maxDurationMs !== undefined) return false;
      if (loaded.length > 0) pool = loaded;
    }
    if (pool.length === 0) return false;

    let clip: ManifestClip;
    if (options?.maxDurationMs !== undefined) {
      const fitting = pool.filter((c) => {
        const len = this._knownLengthMs(c);
        return len !== null && len <= options.maxDurationMs!;
      });
      if (fitting.length === 0) return false; // silence beats a chopped clip
      clip = fitting.reduce((a, b) => (this._knownLengthMs(a)! >= this._knownLengthMs(b)! ? a : b));
    } else {
      clip = pool[Math.floor(Math.random() * pool.length)];
    }

    try {
      const buffer = await this._getBuffer(clip);
      if (!buffer) return false;

      this.stop(); // never overlap

      const ctx = this._ensureContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const entry = {
        source,
        startedAt: Date.now(),
        lengthMs: Math.round(buffer.duration * 1000),
        info: { phraseId: clip.phraseId, tag, text: clip.text, voiceId: manifest.voiceId },
      };
      this._current = entry;

      source.onended = () => {
        if (this._current === entry) {
          this._current = null;
          this._report(entry, false);
        }
      };
      source.start();
      return true;
    } catch (err) {
      console.warn('[ClipPlayer] play failed:', err);
      return false;
    }
  }

  /** Instant cutoff (Req 13.1). Safe to call when idle. */
  stop(): void {
    const current = this._current;
    if (!current) return;
    this._current = null;
    current.source.onended = null;
    try { current.source.stop(); } catch { /* already stopped */ }
    this._report(current, true);
  }

  async close(): Promise<void> {
    this.stop();
    this._preloadRun++;
    if (this._context && this._context.state !== 'closed') {
      await this._context.close().catch(() => {});
    }
    this._context = null;
    this._buffers.clear();
  }

  /** Decoded length when cached, else the manifest's provider-reported length. */
  private _knownLengthMs(clip: ManifestClip): number | null {
    const buffer = this._buffers.get(clip.url);
    if (buffer) return Math.round(buffer.duration * 1000);
    return clip.durationMs;
  }

  /**
   * Background decode, one clip at a time: categories in usage-priority
   * order, one clip per category per round, so the FIRST clip of every
   * category is available before any category's second variant. Within
   * filler, shortest first — short clips fit the most gaps.
   */
  private async _preloadInPriorityOrder(run: number): Promise<void> {
    const manifest = this._manifest;
    if (!manifest) return;
    const byTag = TAG_PRIORITY.map((tag) =>
      manifest.clips
        .filter((c) => c.tag === tag)
        .sort((a, b) => (a.durationMs ?? Infinity) - (b.durationMs ?? Infinity))
    );
    const maxLen = Math.max(0, ...byTag.map((l) => l.length));
    for (let round = 0; round < maxLen; round++) {
      for (const list of byTag) {
        if (run !== this._preloadRun) return; // provider changed — abandon
        const clip = list[round];
        if (!clip || this._buffers.has(clip.url)) continue;
        await this._getBuffer(clip).catch(() => null);
      }
    }
  }

  private _report(entry: NonNullable<typeof this._current>, cutOff: boolean): void {
    try {
      this._onClipPlayed?.({
        ...entry.info,
        playedMs: Date.now() - entry.startedAt,
        clipLengthMs: entry.lengthMs,
        cutOff,
      });
    } catch (err) {
      console.warn('[ClipPlayer] onClipPlayed callback failed:', err);
    }
  }

  private _ensureContext(): AudioContext {
    if (!this._context || this._context.state === 'closed') {
      this._context = new AudioContext();
    }
    if (this._context.state === 'suspended') {
      void this._context.resume().catch(() => {});
    }
    return this._context;
  }

  private async _getBuffer(clip: ManifestClip): Promise<AudioBuffer | null> {
    const cached = this._buffers.get(clip.url);
    if (cached) return cached;
    const res = await fetch(clip.url);
    if (!res.ok) return null;
    const encoded = await res.arrayBuffer();
    const buffer = await this._ensureContext().decodeAudioData(encoded);
    this._buffers.set(clip.url, buffer);
    return buffer;
  }
}
