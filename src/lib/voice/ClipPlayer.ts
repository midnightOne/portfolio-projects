/**
 * D50 client-side clip player (ai-assistant task 9b.3) — adapter-INDEPENDENT
 * by design: connection-state clips must play precisely when no adapter
 * connection exists (Req 13.2).
 *
 * Caching strategy (owner, 2026-07-08): after the manifest loads, clips are
 * decoded in the background in PRIORITY order — most-used category first,
 * interleaved round-robin across categories (filler[0], disruption[0],
 * resume_failed[0], greeting[0], filler[1], …) — so something playable exists
 * for every trigger as early as possible. play() RANDOMIZES among the clips
 * of that tag that are ALREADY loaded; if none are loaded yet it awaits the
 * first one. Cutoff is INSTANT on demand (Req 13.1 — the moment real model
 * audio arrives).
 *
 * Every playback reports through the injected `onClipPlayed` callback so the
 * host can log an honest `clip_played` history event (Req 13.5) — a clip is
 * not model speech and must never be mistaken for it in replay.
 */

export type ClipTag = 'filler' | 'disruption' | 'resume_failed' | 'greeting';

/** Preload priority: most-used category first (fillers fire every tool call). */
const TAG_PRIORITY: ClipTag[] = ['filler', 'disruption', 'resume_failed', 'greeting'];

interface ManifestClip {
  phraseId: string;
  tag: string;
  text: string;
  url: string;
}

export interface ClipPlayedInfo {
  phraseId: string;
  tag: ClipTag;
  text: string;
  voiceId: string;
  durationMs: number;
  /** True when playback was cut off before the clip finished. */
  cutOff: boolean;
}

export class ClipPlayer {
  private _provider: string | null = null;
  private _manifest: { voiceId: string; clips: ManifestClip[] } | null = null;
  private _manifestPromise: Promise<void> | null = null;
  private _buffers = new Map<string, AudioBuffer>(); // keyed by clip url
  private _context: AudioContext | null = null;
  private _current: { source: AudioBufferSourceNode; startedAt: number; info: Omit<ClipPlayedInfo, 'durationMs' | 'cutOff'> } | null = null;
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
        if (data?.success && data.voiceId && Array.isArray(data.clips)) {
          this._manifest = { voiceId: data.voiceId, clips: data.clips };
          void this._preloadInPriorityOrder(run);
        }
      })
      .catch((err) => console.warn('[ClipPlayer] manifest load failed:', err));
    return this._manifestPromise;
  }

  hasClips(tag: ClipTag): boolean {
    return !!this._manifest?.clips.some((c) => c.tag === tag);
  }

  get isPlaying(): boolean {
    return this._current !== null;
  }

  /**
   * Play a random clip of the tag from the ALREADY-LOADED pool (falling back
   * to awaiting the first fetch when nothing is cached yet). No-ops when the
   * manifest has nothing for the tag — clips are progressive enhancement,
   * never a dependency. Any playing clip is cut off first (never overlap).
   */
  async play(tag: ClipTag): Promise<boolean> {
    if (this._manifestPromise) await this._manifestPromise;
    const manifest = this._manifest;
    if (!manifest) return false;
    const pool = manifest.clips.filter((c) => c.tag === tag);
    if (pool.length === 0) return false;

    const loaded = pool.filter((c) => this._buffers.has(c.url));
    const clip = loaded.length > 0
      ? loaded[Math.floor(Math.random() * loaded.length)]
      : pool[0]; // nothing cached yet — take the first and await its fetch

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

  /**
   * Background decode, one clip at a time: categories in usage-priority
   * order, one clip per category per round, so the FIRST clip of every
   * category is available before any category's second variant.
   */
  private async _preloadInPriorityOrder(run: number): Promise<void> {
    const manifest = this._manifest;
    if (!manifest) return;
    const byTag = TAG_PRIORITY.map((tag) => manifest.clips.filter((c) => c.tag === tag));
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
      this._onClipPlayed?.({ ...entry.info, durationMs: Date.now() - entry.startedAt, cutOff });
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
