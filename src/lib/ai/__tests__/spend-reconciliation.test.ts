/**
 * Spend reconciliation vs OpenAI (ai-assistant 7.23). Load-bearing behaviors:
 * missing admin key → honest `unconfigured`, never a guess; provider errors
 * surface verbatim; per-UTC-day alignment and drift = openai − ledger (the
 * provider is ground truth); unattributed-spend rows are counted so drift
 * can't hide in provider-less rows.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    aIUsageLog: { count: jest.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { reconcileOpenAISpend } from '../spend-reconciliation';

const mockPrisma = prisma as unknown as {
  $queryRaw: jest.Mock;
  aIUsageLog: { count: jest.Mock };
};

const realFetch = global.fetch;
let savedKey: string | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  savedKey = process.env.OPENAI_ADMIN_API_KEY;
  mockPrisma.$queryRaw.mockResolvedValue([]);
  mockPrisma.aIUsageLog.count.mockResolvedValue(0);
});

afterEach(() => {
  global.fetch = realFetch;
  if (savedKey === undefined) delete process.env.OPENAI_ADMIN_API_KEY;
  else process.env.OPENAI_ADMIN_API_KEY = savedKey;
});

describe('reconcileOpenAISpend', () => {
  it('reports unconfigured honestly when the admin key is absent — no provider call', () => {
    delete process.env.OPENAI_ADMIN_API_KEY;
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as never;
    return reconcileOpenAISpend(7).then((report) => {
      expect(report.configured).toBe(false);
      expect(report.error).toContain('OPENAI_ADMIN_API_KEY');
      expect(report.days).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('aligns per UTC day and computes drift as openai − ledger (provider = ground truth)', async () => {
    process.env.OPENAI_ADMIN_API_KEY = 'sk-admin-test';
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    mockPrisma.$queryRaw.mockResolvedValue([{ day: today, total: 0.1 }]);
    mockPrisma.aIUsageLog.count.mockResolvedValue(3);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            start_time: Math.floor(today.getTime() / 1000),
            results: [{ amount: { value: 0.5, currency: 'usd' } }, { amount: { value: 0.25 } }],
          },
        ],
        has_more: false,
      }),
    }) as never;

    const report = await reconcileOpenAISpend(2);
    expect(report.configured).toBe(true);
    expect(report.days).toHaveLength(2);
    const todayRow = report.days[1];
    expect(todayRow.ledgerUsd).toBeCloseTo(0.1, 6);
    expect(todayRow.openaiUsd).toBeCloseTo(0.75, 6);
    expect(todayRow.driftUsd).toBeCloseTo(0.65, 6); // provider minus ledger — we UNDERSTATE by 0.65
    expect(report.totals.driftUsd).toBeCloseTo(0.65, 6);
    expect(report.unattributedRows).toBe(3);
  });

  it('surfaces the provider error verbatim (401 admin-key rejection is the diagnostic)', async () => {
    process.env.OPENAI_ADMIN_API_KEY = 'sk-not-an-admin-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'insufficient permissions: api.usage.read required',
    }) as never;
    const report = await reconcileOpenAISpend(7);
    expect(report.configured).toBe(true);
    expect(report.error).toContain('401');
    expect(report.error).toContain('insufficient permissions');
    expect(report.days).toEqual([]);
  });
});
