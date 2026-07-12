/**
 * Agent output-level meter (ui-system task 3.6, owner revision 2026-07-12:
 * the ambient speech glow must "actually oscillate with the intensity of the
 * audio", not just be present while the model speaks).
 *
 * A tiny provider-agnostic singleton: each voice adapter taps its audio
 * OUTPUT path into an AnalyserNode here (OpenAI = the WebRTC audio element's
 * MediaStream; Google Live / cascade = their playback GainNodes), and visual
 * surfaces poll `getAgentOutputLevel()` per ambient-clock frame — no React
 * state, no events, no per-frame allocation.
 *
 * Analysers are pull-based and never join the audible graph, so tapping is
 * side-effect-free for playback. A tap on a dead/closed context just reads
 * silence until detached.
 */

interface MeterTap {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
}

const taps = new Set<MeterTap>();

/** Lazy shared context for MediaStream taps (element-played WebRTC audio). */
let streamTapContext: AudioContext | null = null;

/** Release-smoothed level state (attack is instant — speech onsets must land). */
let smoothedLevel = 0;
let lastReadAt = 0;

/** Exponential release time constant, seconds. */
const RELEASE_SECONDS = 0.18;

function registerTap(analyser: AnalyserNode): MeterTap {
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.4;
  const tap: MeterTap = { analyser, data: new Uint8Array(analyser.fftSize) };
  taps.add(tap);
  return tap;
}

/**
 * Tap an audio node (e.g. a playback GainNode) inside the adapter's own
 * AudioContext. Returns a detach function — call it when the playback
 * context is torn down.
 */
export function meterAudioNode(ctx: AudioContext, node: AudioNode): () => void {
  const analyser = ctx.createAnalyser();
  const tap = registerTap(analyser);
  node.connect(analyser);
  return () => {
    taps.delete(tap);
    try {
      node.disconnect(analyser);
    } catch {
      /* node/context already gone */
    }
  };
}

/**
 * Tap a MediaStream (WebRTC remote audio playing through an <audio> element).
 * Uses a shared meter-only AudioContext; playback itself is untouched.
 * Returns a detach function.
 */
export function meterMediaStream(stream: MediaStream): () => void {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!streamTapContext || streamTapContext.state === 'closed') {
    streamTapContext = new Ctor();
  }
  if (streamTapContext.state === 'suspended') {
    void streamTapContext.resume().catch(() => {});
  }
  const source = streamTapContext.createMediaStreamSource(stream);
  const detach = meterAudioNode(streamTapContext, source);
  return () => {
    detach();
    try {
      source.disconnect();
    } catch {
      /* already disconnected */
    }
  };
}

/**
 * Current agent output level, 0..~1 (speech RMS is typically 0.05–0.3 —
 * consumers apply their own gain). Instant attack, ~180ms exponential
 * release so pauses between words read as dips, not flicker.
 *
 * Returns null when NO tap is registered (no live audio path at all) so
 * consumers can fall back to a synthetic breath.
 */
export function getAgentOutputLevel(): number | null {
  if (taps.size === 0) return null;

  let peak = 0;
  for (const tap of taps) {
    if (tap.analyser.context.state === 'closed') continue;
    tap.analyser.getByteTimeDomainData(tap.data);
    let sum = 0;
    for (let i = 0; i < tap.data.length; i++) {
      const v = (tap.data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / tap.data.length);
    if (rms > peak) peak = rms;
  }

  const now = performance.now();
  const dt = lastReadAt ? Math.min(0.2, (now - lastReadAt) / 1000) : 0.016;
  lastReadAt = now;
  smoothedLevel =
    peak >= smoothedLevel
      ? peak
      : smoothedLevel + (peak - smoothedLevel) * Math.min(1, dt / RELEASE_SECONDS);
  return smoothedLevel;
}
