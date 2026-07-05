/**
 * Unified usage ledger + global spend watchdog (access-and-cost Req 5/6, D32).
 *
 * Every AI spend lands here as one `AIUsageLog` row; watchdog counters on the
 * single `AIGlobalLimits` row update atomically in the same transaction, and the
 * cap re-check runs post-write so a burst crossing the cap trips inside the request
 * that crossed it. Reflink `spendUsed`/`tokensUsed` increment here too — ledger-derived,
 * no parallel cost systems.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { estimateCost } from './pricing';

export type LedgerFeature = 'chat' | 'voice' | 'tools' | 'semantic' | 'mcp' | 'admin-edit';

export interface UsageEntry {
  feature: LedgerFeature;
  usageType: string;           // e.g. 'chat_completion', 'embedding', 'voice_session_mint'
  provider?: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** When omitted, computed via estimateCost(modelId, tokens) (D38). */
  costUsd?: number;
  endpoint?: string;
  requestId?: string;
  sessionId?: string;
  reflinkId?: string;
  hashedIp?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface LedgerWriteResult {
  ledgerId: string;
  costUsd: number;
  tripped: boolean;
  tripReason?: string;
}

export interface GlobalLimitsState {
  status: 'active' | 'tripped';
  publicAIEnabled: boolean;
  disableReflinksOnTrip: boolean;
  dailySpendCapUsd: number;
  monthlySpendCapUsd: number;
  daySpendUsd: number;
  monthSpendUsd: number;
  trippedAt: Date | null;
  tripReason: string | null;
}

function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

const KILL_SWITCH_TTL_MS = 30_000;
let killSwitchCache: { at: number; state: GlobalLimitsState } | null = null;

function toState(row: {
  status: string;
  publicAIEnabled: boolean;
  disableReflinksOnTrip: boolean;
  dailySpendCapUsd: Prisma.Decimal;
  monthlySpendCapUsd: Prisma.Decimal;
  daySpendUsd: Prisma.Decimal;
  monthSpendUsd: Prisma.Decimal;
  dayKey: string;
  monthKey: string;
  trippedAt: Date | null;
  tripReason: string | null;
}): GlobalLimitsState {
  const today = dayKey();
  const month = monthKey();
  return {
    status: row.status === 'tripped' ? 'tripped' : 'active',
    publicAIEnabled: row.publicAIEnabled,
    disableReflinksOnTrip: row.disableReflinksOnTrip,
    dailySpendCapUsd: Number(row.dailySpendCapUsd),
    monthlySpendCapUsd: Number(row.monthlySpendCapUsd),
    // Rollover is lazy: counters from a previous day/month read as zero. A trip never
    // auto-clears on rollover (Req 6.3) — only status drives that.
    daySpendUsd: row.dayKey === today ? Number(row.daySpendUsd) : 0,
    monthSpendUsd: row.monthKey === month ? Number(row.monthSpendUsd) : 0,
    trippedAt: row.trippedAt,
    tripReason: row.tripReason,
  };
}

/**
 * Pre-call kill-switch check (gateway step 1). Cached ≤30s per instance, best-effort;
 * the post-write check in recordUsage is the authoritative trip. Throws on DB failure —
 * the gateway maps that to fail-closed for public tiers.
 */
export async function getKillSwitchState(opts?: { fresh?: boolean }): Promise<GlobalLimitsState> {
  const now = Date.now();
  if (!opts?.fresh && killSwitchCache && now - killSwitchCache.at < KILL_SWITCH_TTL_MS) {
    return killSwitchCache.state;
  }
  const row = await prisma.aIGlobalLimits.findUnique({ where: { id: 'global' } });
  if (!row) {
    throw new Error('AIGlobalLimits row missing — run the seed');
  }
  const state = toState(row);
  killSwitchCache = { at: now, state };
  return state;
}

export function __clearKillSwitchCache(): void {
  killSwitchCache = null;
}

/**
 * Write a ledger row + update watchdog counters atomically; re-check caps post-write
 * and trip inside the same transaction when crossed. Never throws on notifier failure.
 */
export async function recordUsage(entry: UsageEntry): Promise<LedgerWriteResult> {
  const costUsd =
    entry.costUsd ??
    (entry.modelId
      ? await estimateCost(entry.modelId, {
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
        })
      : 0);
  const tokensUsed = (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0);
  const today = dayKey();
  const month = monthKey();

  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.aIUsageLog.create({
      data: {
        feature: entry.feature,
        usageType: entry.usageType,
        provider: entry.provider,
        modelUsed: entry.modelId,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        tokensUsed,
        costUsd,
        endpoint: entry.endpoint,
        requestId: entry.requestId,
        sessionId: entry.sessionId,
        reflinkId: entry.reflinkId,
        hashedIp: entry.hashedIp,
        metadata: entry.metadata ?? {},
      },
    });

    if (entry.reflinkId) {
      await tx.aIReflink.update({
        where: { id: entry.reflinkId },
        data: {
          tokensUsed: { increment: tokensUsed },
          spendUsed: { increment: costUsd },
          lastUsedAt: new Date(),
        },
      });
    }

    // Lock the watchdog row, roll counters over lazily, add spend, re-check caps.
    const rows = await tx.$queryRaw<
      Array<{
        status: string;
        day_spend_usd: Prisma.Decimal;
        month_spend_usd: Prisma.Decimal;
        day_key: string;
        month_key: string;
        daily_spend_cap_usd: Prisma.Decimal;
        monthly_spend_cap_usd: Prisma.Decimal;
        trip_history: Prisma.JsonValue;
      }>
    >`SELECT status, day_spend_usd, month_spend_usd, day_key, month_key, daily_spend_cap_usd, monthly_spend_cap_usd, trip_history FROM ai_global_limits WHERE id = 'global' FOR UPDATE`;
    if (rows.length === 0) {
      throw new Error('AIGlobalLimits row missing — run the seed');
    }
    const g = rows[0];
    const daySpend = (g.day_key === today ? Number(g.day_spend_usd) : 0) + costUsd;
    const monthSpend = (g.month_key === month ? Number(g.month_spend_usd) : 0) + costUsd;
    const dailyCap = Number(g.daily_spend_cap_usd);
    const monthlyCap = Number(g.monthly_spend_cap_usd);

    let tripped = false;
    let tripReason: string | undefined;
    if (g.status !== 'tripped') {
      if (daySpend >= dailyCap) {
        tripped = true;
        tripReason = `daily cap $${dailyCap.toFixed(2)} crossed (day spend $${daySpend.toFixed(4)})`;
      } else if (monthSpend >= monthlyCap) {
        tripped = true;
        tripReason = `monthly cap $${monthlyCap.toFixed(2)} crossed (month spend $${monthSpend.toFixed(4)})`;
      }
    }

    const history = Array.isArray(g.trip_history) ? (g.trip_history as unknown[]) : [];
    await tx.aIGlobalLimits.update({
      where: { id: 'global' },
      data: {
        daySpendUsd: daySpend,
        monthSpendUsd: monthSpend,
        dayKey: today,
        monthKey: month,
        ...(tripped
          ? {
              status: 'tripped',
              trippedAt: new Date(),
              tripReason,
              tripHistory: [
                ...history,
                { at: new Date().toISOString(), reason: tripReason, daySpendUsd: daySpend, monthSpendUsd: monthSpend, ledgerId: log.id },
              ] as Prisma.InputJsonValue,
            }
          : {}),
      },
    });

    return { ledgerId: log.id, costUsd, tripped, tripReason };
  });

  if (result.tripped) {
    killSwitchCache = null; // this instance sees the trip immediately
    try {
      const { securityNotifier } = await import('@/lib/services/ai/security-notifier');
      await securityNotifier.notifyWarning('watchdog', `AI spend watchdog TRIPPED: ${result.tripReason}`, {
        endpoint: entry.endpoint,
        metadata: { feature: entry.feature, ledgerId: result.ledgerId },
      });
    } catch (error) {
      console.error('[ledger] watchdog trip notification failed:', error);
    }
  }

  return result;
}

/** Manual re-enable (Req 6.3) — the only way out of a trip; daily reset never auto-clears. */
export async function reenableGlobalAI(actor: string): Promise<GlobalLimitsState> {
  const row = await prisma.aIGlobalLimits.update({
    where: { id: 'global' },
    data: { status: 'active', tripReason: null, trippedAt: null },
  });
  killSwitchCache = null;
  console.log(`[ledger] global AI re-enabled by ${actor}`);
  return toState(row);
}
