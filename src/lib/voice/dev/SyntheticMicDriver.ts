/**
 * SyntheticMicDriver (D53 / verification task 4.4) — a dev/test-only emulated
 * microphone. TTS-generated speech (from /api/dev/fake-mic/tts) is decoded and
 * played into a MediaStreamAudioDestinationNode whose stream is handed to the
 * voice adapter as its input track — the REAL provider hears real speech and the
 * full native path runs (mic track → provider STT → model → TTS out).
 *
 * Distinct from FakeVoiceAdapter (verification 4.3): nothing here bypasses the
 * provider. The stream is silent between utterances, so server-side VAD sees
 * natural speech boundaries.
 *
 * Availability is decided by the server route (404 in production, admin/dev
 * only) — `SyntheticMicDriver.isAvailable()` just asks it.
 */

export interface SpeakResult {
  durationMs: number;
}

export class SyntheticMicDriver {
  private ctx: AudioContext;
  private dest: MediaStreamAudioDestinationNode;
  private noiseSource: AudioBufferSourceNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private _speaking = false;

  constructor() {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.dest = this.ctx.createMediaStreamDestination();
    this.startNoiseFloor();
  }

  /**
   * A perpetual, inaudible noise floor (~-66 dB). Digital silence lets Opus DTX
   * stop sending packets entirely, and the provider's server VAD then never sees
   * the trailing silence it needs to emit speech_stopped — observed live 2026-07-07:
   * speech_started with no speech_stopped, turn never closed. Real microphones
   * always carry a noise floor; emulate that.
   */
  private startNoiseFloor(): void {
    const seconds = 2;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.0005;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.dest);
    source.start();
    this.noiseSource = source;
  }

  /** The emulated microphone track — pass as ConnectOptions.syntheticInputStream. */
  get stream(): MediaStream {
    return this.dest.stream;
  }

  get speaking(): boolean {
    return this._speaking;
  }

  static async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('/api/dev/fake-mic/tts', { method: 'GET' });
      if (!res.ok) return false;
      const body = await res.json();
      return body?.available === true;
    } catch {
      return false;
    }
  }

  /**
   * Synthesize `text` and play it into the emulated mic track. Resolves when
   * the audio finishes playing (plus a short tail of silence so VAD endpoints).
   */
  async speak(text: string, options?: { voice?: string; tailSilenceMs?: number }): Promise<SpeakResult> {
    if (this._speaking) {
      throw new Error('SyntheticMicDriver: already speaking');
    }
    const res = await fetch('/api/dev/fake-mic/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: options?.voice }),
    });
    if (!res.ok) {
      let detail = `${res.status}`;
      try {
        const err = await res.json();
        detail = err?.error ?? detail;
      } catch { /* binary/empty */ }
      throw new Error(`SyntheticMicDriver: TTS request failed (${detail})`);
    }
    const bytes = await res.arrayBuffer();
    // Autoplay policies can leave a fresh context suspended until a user gesture;
    // resume defensively — automated drivers click a button first anyway.
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    const buffer = await this.ctx.decodeAudioData(bytes);

    this._speaking = true;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.dest);
    this.activeSource = source;

    const durationMs = Math.ceil(buffer.duration * 1000);
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
    this.activeSource = null;
    this._speaking = false;

    const tail = options?.tailSilenceMs ?? 300;
    if (tail > 0) {
      await new Promise((r) => setTimeout(r, tail));
    }
    return { durationMs };
  }

  /** Stop any in-flight utterance (the track goes silent immediately). */
  stop(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
      } catch { /* already stopped */ }
      this.activeSource = null;
    }
    this._speaking = false;
  }

  async close(): Promise<void> {
    this.stop();
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
      } catch { /* already stopped */ }
      this.noiseSource = null;
    }
    try {
      await this.ctx.close();
    } catch { /* already closed */ }
  }
}
