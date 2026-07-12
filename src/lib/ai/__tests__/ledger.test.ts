/**
 * Unified usage ledger + global spend watchdog (access-and-cost Req 5/6, D32).
 *
 * The load-bearing behaviors: every write lands one ledger row with a D38
 * estimated cost, the watchdog counters roll over lazily, a cap crossing
 * trips INSIDE the transaction that crossed it (with history + notifier),
 * and a trip never auto-clears.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    aIGlobalLimits: { findUnique: jest.fn(), update: jest.fn() },
    // F1: recordUsage resolves metadata.test through the sessionId join
    aIConversation: { findUnique: jest.fn() },
  },
}));

jest.mock('../pricing', () => ({
  estimateCost: jest.fn(async () => 0.5),
}));

const notifyWarning = jest.fn();
jest.mock('@/lib/services/ai/security-notifier', () => ({
  securityNotifier: { notifyWarning: (...args: unknown[]) => notifyWarning(...args) },
}));

import { prisma } from '@/lib/prisma';
import { recordUsage, getKillSwitchState, __clearKillSwitchCache } from '../ledger';

const mockPrisma = prisma as unknown as {
  $transaction: jest.Mock;
  aIGlobalLimits: { findUnique: jest.Mock; update: jest.Mock };
  aIConversation: { findUnique: jest.Mock };
};

const today = new Date().toISOString().slice(0, 10);
const month = new Date().toISOString().slice(0, 7);

/** Build the tx object recordUsage's transaction callback runs against. */
function makeTx(globalRow: Partial<Record<string, unknown>> = {}) {
  const tx = {
    aIUsageLog: { create: (jest.fn() as jest.Mock).mockResolvedValue({ id: 'ledger-row-1' }) },
    aIReflink: { update: (jest.fn() as jest.Mock).mockResolvedValue({}) },
    aIGlobalLimits: { update: (jest.fn() as jest.Mock).mockResolvedValue({}) },
    $queryRaw: (jest.fn() as jest.Mock).mockResolvedValue([
      {
        status: 'active',
        day_spend_usd: 0,
        month_spend_usd: 0,
        day_key: today,
        month_key: month,
        daily_spend_cap_usd: 10,
        monthly_spend_cap_usd: 100,
        trip_history: [],
        ...globalRow,
      },
    ]),
  };
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(tx));
  return tx;
}

beforeEach(() => {
  jest.clearAllMocks();
  __clearKillSwitchCache();
});

describe('recordUsage', () => {
  it('writes one ledger row with the D38-estimated cost and updates counters', async () => {
    const tx = makeTx();

    const result = await recordUsage({
      feature: 'chat',
      usageType: 'chat_completion',
      modelId: 'some/model',
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(tx.aIUsageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'chat',
          usageType: 'chat_completion',
          tokensUsed: 150,
          costUsd: 0.5, // from estimateCost — never trusted from the caller by default
        }),
      })
    );
    expect(result).toMatchObject({ ledgerId: 'ledger-row-1', costUsd: 0.5, tripped: false });
    // Counters updated, but no trip fields written
    const updateData = tx.aIGlobalLimits.update.mock.calls[0][0].data;
    expect(updateData.daySpendUsd).toBeCloseTo(0.5);
    expect(updateData.status).toBeUndefined();
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('trips inside the transaction that crosses the daily cap, with history and notifier', async () => {
    const tx = makeTx({ day_spend_usd: 9.8 }); // + 0.5 crosses the 10 cap

    const result = await recordUsage({
      feature: 'voice',
      usageType: 'voice_session_mint',
      modelId: 'some/model',
      inputTokens: 10,
      outputTokens: 10,
      endpoint: '/api/ai/openai/session',
    });

    expect(result.tripped).toBe(true);
    expect(result.tripReason).toContain('daily cap');

    const updateData = tx.aIGlobalLimits.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('tripped');
    expect(updateData.tripHistory).toEqual([
      expect.objectContaining({ reason: result.tripReason, ledgerId: 'ledger-row-1' }),
    ]);

    expect(notifyWarning).toHaveBeenCalledWith(
      'watchdog',
      expect.stringContaining('TRIPPED'),
      expect.objectContaining({ endpoint: '/api/ai/openai/session' })
    );
  });

  it('does not re-trip (or extend history) when already tripped', async () => {
    const tx = makeTx({ status: 'tripped', day_spend_usd: 50 });

    const result = await recordUsage({
      feature: 'chat',
      usageType: 'chat_completion',
      modelId: 'some/model',
    });

    expect(result.tripped).toBe(false);
    const updateData = tx.aIGlobalLimits.update.mock.calls[0][0].data;
    expect(updateData.status).toBeUndefined();
    expect(updateData.tripHistory).toBeUndefined();
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('rolls counters over lazily: a stale day key restarts the day spend from zero', async () => {
    const tx = makeTx({ day_key: '2000-01-01', day_spend_usd: 9.9 });

    const result = await recordUsage({
      feature: 'chat',
      usageType: 'chat_completion',
      modelId: 'some/model',
    });

    // 9.9 belongs to the stale day — spend restarts at 0.5, no trip
    expect(result.tripped).toBe(false);
    const updateData = tx.aIGlobalLimits.update.mock.calls[0][0].data;
    expect(updateData.daySpendUsd).toBeCloseTo(0.5);
    expect(updateData.dayKey).toBe(today);
  });

  // ---- F1 (Req 10.1, P17): test-session spend excluded from the watchdog ----

  it('test-tagged session spend: full ledger row (stamped test), watchdog untouched, never trips', async () => {
    const tx = makeTx({ day_spend_usd: 9.8 }); // would cross the 10 cap if counted
    mockPrisma.aIConversation.findUnique.mockResolvedValue({ metadata: { test: true } });

    const result = await recordUsage({
      feature: 'chat',
      usageType: 'chat_completion',
      modelId: 'some/model',
      inputTokens: 100,
      outputTokens: 50,
      sessionId: 'sess_test_drill',
    });

    // Fully logged: one honest row, stamped test for legibility
    expect(tx.aIUsageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'sess_test_drill',
          costUsd: 0.5,
          metadata: expect.objectContaining({ test: true }),
        }),
      })
    );
    // Excluded from spend alarms: counters never touched, no trip despite the near-cap state
    expect(tx.aIGlobalLimits.update).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ledgerId: 'ledger-row-1', costUsd: 0.5, tripped: false });
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('engine-internal rows join by metadata.conversationId when sessionId is absent (F4 finding)', async () => {
    const tx = makeTx({ day_spend_usd: 9.8 });
    mockPrisma.aIConversation.findUnique.mockResolvedValue({ metadata: { test: true } });

    const result = await recordUsage({
      feature: 'chat',
      usageType: 'engine_classifier',
      modelId: 'some/model',
      inputTokens: 40,
      outputTokens: 20,
      metadata: { conversationId: 'conv_test_drill' },
    });

    // Joined by conversation ID (the second key onto the ONE flag)
    expect(mockPrisma.aIConversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conv_test_drill' } })
    );
    expect(tx.aIGlobalLimits.update).not.toHaveBeenCalled();
    expect(result.tripped).toBe(false);
    const rowMetadata = tx.aIUsageLog.create.mock.calls[0][0].data.metadata;
    expect(rowMetadata).toEqual(expect.objectContaining({ test: true, conversationId: 'conv_test_drill' }));
  });

  it('untagged session spend counts normally through the same join', async () => {
    const tx = makeTx();
    mockPrisma.aIConversation.findUnique.mockResolvedValue({ metadata: {} });

    await recordUsage({
      feature: 'chat',
      usageType: 'chat_completion',
      modelId: 'some/model',
      sessionId: 'sess_real_visitor',
    });

    expect(tx.aIGlobalLimits.update).toHaveBeenCalled();
    const rowMetadata = tx.aIUsageLog.create.mock.calls[0][0].data.metadata;
    expect(rowMetadata).toEqual({}); // no test stamp on real traffic
  });

  it('fails safe: a conversation-lookup error counts the spend normally (alarms err toward firing)', async () => {
    const tx = makeTx();
    mockPrisma.aIConversation.findUnique.mockRejectedValue(new Error('db down'));

    const result = await recordUsage({
      feature: 'chat',
      usageType: 'chat_completion',
      modelId: 'some/model',
      sessionId: 'sess_whatever',
    });

    expect(result.tripped).toBe(false);
    expect(tx.aIGlobalLimits.update).toHaveBeenCalled(); // counted
  });

  it('increments reflink spend from the same ledger write (no parallel cost system)', async () => {
    const tx = makeTx();

    await recordUsage({
      feature: 'chat',
      usageType: 'chat_completion',
      modelId: 'some/model',
      inputTokens: 10,
      outputTokens: 10,
      reflinkId: 'ref-1',
    });

    expect(tx.aIReflink.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ref-1' },
        data: expect.objectContaining({
          tokensUsed: { increment: 20 },
          spendUsed: { increment: 0.5 },
        }),
      })
    );
  });
});

describe('getKillSwitchState', () => {
  const globalRow = {
    status: 'active',
    publicAIEnabled: true,
    disableReflinksOnTrip: true,
    dailySpendCapUsd: 10,
    monthlySpendCapUsd: 100,
    daySpendUsd: 1,
    monthSpendUsd: 5,
    dayKey: today,
    monthKey: month,
    trippedAt: null,
    tripReason: null,
  };

  it('caches the state between calls (30s TTL) and bypasses with fresh', async () => {
    mockPrisma.aIGlobalLimits.findUnique.mockResolvedValue(globalRow);

    await getKillSwitchState();
    await getKillSwitchState();
    expect(mockPrisma.aIGlobalLimits.findUnique).toHaveBeenCalledTimes(1);

    await getKillSwitchState({ fresh: true });
    expect(mockPrisma.aIGlobalLimits.findUnique).toHaveBeenCalledTimes(2);
  });

  it('throws when the limits row is missing (gateway fails closed)', async () => {
    mockPrisma.aIGlobalLimits.findUnique.mockResolvedValue(null);
    await expect(getKillSwitchState()).rejects.toThrow('AIGlobalLimits row missing');
  });

  it('reads stale-day counters as zero without clearing a trip', async () => {
    mockPrisma.aIGlobalLimits.findUnique.mockResolvedValue({
      ...globalRow,
      status: 'tripped',
      dayKey: '2000-01-01',
      daySpendUsd: 99,
      tripReason: 'daily cap crossed',
    });

    const state = await getKillSwitchState();
    expect(state.daySpendUsd).toBe(0); // lazy rollover
    expect(state.status).toBe('tripped'); // rollover never un-trips (Req 6.3)
  });
});
