/**
 * tool-latency (D50 latency-aware filler, ai-assistant 6.7) — the guidance
 * block steers per-tool narration from measured medians, so the bucketing
 * thresholds and the fail-quiet default are load-bearing prompt inputs.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}));

import { prisma } from '@/lib/prisma';
import {
  getToolLatencyStats,
  buildToolLatencyGuidance,
  __clearToolLatencyCache,
} from '../tool-latency';

const queryRaw = (prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw;

beforeEach(() => {
  queryRaw.mockReset();
  __clearToolLatencyCache();
});

describe('getToolLatencyStats', () => {
  it('maps rows to rounded numbers (bigint samples included)', async () => {
    queryRaw.mockResolvedValue([
      { tool_name: 'ui_intent', median_ms: 412.4, avg_ms: 500.6, samples: BigInt(7) },
    ]);

    const stats = await getToolLatencyStats();
    expect(stats).toEqual([
      { toolName: 'ui_intent', medianMs: 412, avgMs: 501, samples: 7 },
    ]);
  });

  it('caches results — the second call within the TTL runs no query', async () => {
    queryRaw.mockResolvedValue([]);
    await getToolLatencyStats();
    await getToolLatencyStats();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('buildToolLatencyGuidance', () => {
  it('buckets tools at the 600ms / 1500ms thresholds', async () => {
    queryRaw.mockResolvedValue([
      { tool_name: 'instant_tool', median_ms: 300, avg_ms: 300, samples: BigInt(5) },
      { tool_name: 'fast_tool', median_ms: 900, avg_ms: 900, samples: BigInt(5) },
      { tool_name: 'slow_tool', median_ms: 2400, avg_ms: 2400, samples: BigInt(5) },
    ]);

    const guidance = await buildToolLatencyGuidance();

    const instantLine = guidance.split('\n').find((l) => l.includes('INSTANT ('));
    const fastLine = guidance.split('\n').find((l) => l.includes('FAST ('));
    const slowLine = guidance.split('\n').find((l) => l.includes('SLOWER ('));

    expect(instantLine).toContain('instant_tool (~300ms)');
    expect(instantLine).not.toContain('fast_tool');
    expect(fastLine).toContain('fast_tool (~900ms)');
    expect(slowLine).toContain('slow_tool (~2400ms)');
  });

  it('boundary medians land in the higher bucket (600 → FAST, 1500 → SLOWER)', async () => {
    queryRaw.mockResolvedValue([
      { tool_name: 'at_600', median_ms: 600, avg_ms: 600, samples: BigInt(2) },
      { tool_name: 'at_1500', median_ms: 1500, avg_ms: 1500, samples: BigInt(2) },
    ]);

    const guidance = await buildToolLatencyGuidance();
    expect(guidance.split('\n').find((l) => l.includes('FAST ('))).toContain('at_600');
    expect(guidance.split('\n').find((l) => l.includes('SLOWER ('))).toContain('at_1500');
  });

  it('fails quiet: a stats query error still yields the default rules', async () => {
    queryRaw.mockRejectedValue(new Error('db down'));

    const guidance = await buildToolLatencyGuidance();

    // No measured buckets, but the unlisted-tools default (treat as instant,
    // clips cover overruns) must survive — the mint prompt depends on it.
    expect(guidance).toContain('TOOL LATENCY AWARENESS');
    expect(guidance).toContain('Tools not listed: treat as INSTANT');
    expect(guidance).not.toContain('- INSTANT (');
  });
});
