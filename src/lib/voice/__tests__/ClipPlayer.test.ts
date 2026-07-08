/**
 * D50 ClipPlayer (ai-assistant 9b.3 / 6.8) — length-fitted anticipatory
 * selection: among clips that FIT the expected gap the LONGEST wins; when
 * none fit, silence beats a chopped clip; cutoff is instant and reported
 * honestly (played-vs-total, cutOff flag); a missing manifest (offline dev)
 * is a graceful no-op.
 */

import { ClipPlayer, ClipPlayedInfo } from '../ClipPlayer';

// ---- Web Audio fakes: duration is encoded as the fetched buffer's byteLength (ms)

class FakeSourceNode {
  buffer: FakeAudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect = jest.fn();
  start = jest.fn();
  stop = jest.fn();
}

class FakeAudioBuffer {
  constructor(public duration: number) {}
}

class FakeAudioContext {
  state = 'running';
  destination = {};
  createBufferSource() {
    return new FakeSourceNode();
  }
  async decodeAudioData(encoded: ArrayBuffer) {
    return new FakeAudioBuffer(encoded.byteLength / 1000); // bytes → ms → s
  }
  resume = jest.fn(async () => {});
  close = jest.fn(async () => {});
}

(globalThis as any).AudioContext = FakeAudioContext;

const clip = (phraseId: string, durationMs: number, tag = 'filler') => ({
  phraseId,
  tag,
  text: `clip ${phraseId}`,
  url: `https://cdn/${phraseId}.mp3`,
  durationMs,
});

function mockManifest(clips: Array<ReturnType<typeof clip>>, toolLatencies: Record<string, number> = {}) {
  (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
    if (String(url).includes('/api/ai/voice-clips/manifest')) {
      return {
        ok: true,
        json: async () => ({ success: true, voiceId: 'alloy', clips, toolLatencies }),
      };
    }
    // Clip audio: byteLength encodes the clip's duration in ms
    const found = clips.find((c) => c.url === String(url));
    if (!found) return { ok: false };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(found.durationMs) };
  });
}

/** Let the background preload's sequential decodes drain. */
async function flush(times = 10) {
  for (let i = 0; i < times; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('ClipPlayer', () => {
  let played: ClipPlayedInfo[];
  let player: ClipPlayer;

  beforeEach(() => {
    jest.clearAllMocks();
    played = [];
    player = new ClipPlayer((info) => played.push(info));
  });

  afterEach(async () => {
    await player.close();
  });

  it('picks the LONGEST clip that fits the expected gap', async () => {
    mockManifest([clip('short', 800), clip('medium', 1500), clip('long', 3000)]);
    await player.setProvider('openai');
    await flush();

    const playedOk = await player.play('filler', { maxDurationMs: 2000 });

    expect(playedOk).toBe(true);
    // 3000 doesn't fit; 1500 beats 800 (covers more of the gap)
    expect(played).toHaveLength(0); // still playing — nothing reported yet
    player.stop();
    expect(played[0].phraseId).toBe('medium');
  });

  it('plays NOTHING when no clip fits the gap (silence beats a chopped clip)', async () => {
    mockManifest([clip('a', 2500), clip('b', 3000)]);
    await player.setProvider('openai');
    await flush();

    const playedOk = await player.play('filler', { maxDurationMs: 1000 });

    expect(playedOk).toBe(false);
    expect(player.isPlaying).toBe(false);
  });

  it('reports an honest cutoff with played-vs-total durations', async () => {
    mockManifest([clip('only', 2000)]);
    await player.setProvider('openai');
    await flush();

    await player.play('filler', { maxDurationMs: 2500 });
    expect(player.isPlaying).toBe(true);

    player.stop(); // the speech_start cutoff path

    expect(player.isPlaying).toBe(false);
    expect(played).toHaveLength(1);
    expect(played[0]).toMatchObject({
      phraseId: 'only',
      tag: 'filler',
      voiceId: 'alloy',
      clipLengthMs: 2000,
      cutOff: true,
    });
  });

  it('never overlaps: a second play cuts the first clip off', async () => {
    mockManifest([clip('one', 1000), clip('two', 1000, 'greeting')]);
    await player.setProvider('openai');
    await flush();

    await player.play('greeting');
    await player.play('filler');

    // The greeting was cut off by the filler
    expect(played).toHaveLength(1);
    expect(played[0]).toMatchObject({ phraseId: 'two', cutOff: true });
    expect(player.isPlaying).toBe(true);
  });

  it('exposes measured tool medians from the manifest', async () => {
    mockManifest([clip('a', 500)], { ui_intent: 1356, content_search: 721 });
    await player.setProvider('openai');

    expect(player.getExpectedToolMs('ui_intent')).toBe(1356);
    expect(player.getExpectedToolMs('unknown_tool')).toBeNull();
  });

  it('is a graceful no-op when the manifest fetch fails (offline dev)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    await player.setProvider('openai');

    expect(await player.play('filler')).toBe(false);
    expect(player.hasClips('filler')).toBe(false);
  });

  it('invalidates the clip set on provider switch (strict voice match)', async () => {
    mockManifest([clip('openai-clip', 1000)]);
    await player.setProvider('openai');
    await flush();
    expect(player.hasClips('filler')).toBe(true);

    // New provider serves no clips
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (String(url).includes('/manifest')) {
        return { ok: true, json: async () => ({ success: true, voiceId: null, clips: [] }) };
      }
      return { ok: false };
    });
    await player.setProvider('google');

    expect(player.hasClips('filler')).toBe(false);
    expect(await player.play('filler')).toBe(false);
  });
});
