/**
 * Spend reconciliation against provider ground truth (ai-assistant 7.23,
 * owner ask 2026-07-18: "the ground truth is the spending reported by OpenAI").
 *
 * Compares the internal ledger (`ai_usage_logs`, provider='openai') against
 * OpenAI's own Costs API, per UTC day. The provider number is authoritative —
 * drift is a defect signal in OUR metering (missed call sites, wrong pricing
 * rows, unpriced audio tokens), never the other way around.
 *
 * Requirements: the org Costs/Usage endpoints need an ADMIN API key
 * (`sk-admin-…`, created in the OpenAI console under Organization → Admin
 * keys) — a regular project key gets 401. Configure `OPENAI_ADMIN_API_KEY`;
 * absent → honest `unconfigured` state, never a guess. The endpoint costs no
 * tokens (metadata API — same class as test-connection).
 *
 * Caveat recorded honestly in the response: the Costs API reports at the
 * ORGANIZATION level per project, not per API key. If other consumers share
 * the org, provider-side numbers include them; scope the admin key's org (or
 * a dedicated project) to make the comparison exact.
 */

import { prisma } from '@/lib/prisma';

export interface ReconciliationDay {
  /** UTC date, YYYY-MM-DD. */
  date: string;
  ledgerUsd: number;
  openaiUsd: number;
  driftUsd: number;
}

export interface ReconciliationReport {
  configured: boolean;
  /** Present when configured=false or the provider call failed. */
  error?: string;
  days: ReconciliationDay[];
  totals: { ledgerUsd: number; openaiUsd: number; driftUsd: number };
  /** Ledger rows in the window that carried NO provider (unattributable). */
  unattributedRows: number;
  notes: string[];
}

const COSTS_URL = 'https://api.openai.com/v1/organization/costs';

interface CostsBucket {
  start_time: number;
  results?: Array<{ amount?: { value?: number; currency?: string } }>;
}

async function fetchOpenAICostsByDay(
  adminKey: string,
  startUnix: number
): Promise<Map<string, number>> {
  const byDay = new Map<string, number>();
  let page: string | undefined;
  for (let i = 0; i < 10; i++) {
    const url = new URL(COSTS_URL);
    url.searchParams.set('start_time', String(startUnix));
    url.searchParams.set('limit', '31');
    if (page) url.searchParams.set('page', page);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${adminKey}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI Costs API ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: CostsBucket[]; has_more?: boolean; next_page?: string };
    for (const bucket of json.data ?? []) {
      const date = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
      const amount = (bucket.results ?? []).reduce((s, r) => s + (r.amount?.value ?? 0), 0);
      byDay.set(date, (byDay.get(date) ?? 0) + amount);
    }
    if (!json.has_more || !json.next_page) break;
    page = json.next_page;
  }
  return byDay;
}

export async function reconcileOpenAISpend(days = 7): Promise<ReconciliationReport> {
  const boundedDays = Math.max(1, Math.min(days, 30));
  const notes: string[] = [
    'Provider numbers come from the OpenAI Costs API (organization level, per UTC day) — they are the ground truth; drift means OUR metering is off.',
    'The Costs API cannot filter to one API key; if other consumers share the organization, their spend appears in the provider column.',
  ];

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (boundedDays - 1));

  // Ledger side: per-UTC-day openai spend + unattributable rows in-window.
  const ledgerRows = await prisma.$queryRaw<Array<{ day: Date; total: number }>>`
    SELECT date_trunc('day', timestamp AT TIME ZONE 'UTC') AS day, sum(cost_usd)::float AS total
    FROM ai_usage_logs
    WHERE provider = 'openai' AND timestamp >= ${start}
    GROUP BY 1
  `;
  const unattributed = await prisma.aIUsageLog.count({
    where: { provider: null, timestamp: { gte: start }, costUsd: { gt: 0 } },
  });
  const ledgerByDay = new Map<string, number>();
  for (const r of ledgerRows) {
    ledgerByDay.set(new Date(r.day).toISOString().slice(0, 10), r.total);
  }

  const adminKey = process.env.OPENAI_ADMIN_API_KEY?.trim();
  if (!adminKey) {
    return {
      configured: false,
      error:
        'OPENAI_ADMIN_API_KEY is not configured. The org Costs API requires an Admin key (OpenAI console → Organization → Admin keys) — a project API key gets 401 there.',
      days: [],
      totals: { ledgerUsd: 0, openaiUsd: 0, driftUsd: 0 },
      unattributedRows: unattributed,
      notes,
    };
  }

  let openaiByDay: Map<string, number>;
  try {
    openaiByDay = await fetchOpenAICostsByDay(adminKey, Math.floor(start.getTime() / 1000));
  } catch (error) {
    return {
      configured: true,
      error: error instanceof Error ? error.message : String(error),
      days: [],
      totals: { ledgerUsd: 0, openaiUsd: 0, driftUsd: 0 },
      unattributedRows: unattributed,
      notes,
    };
  }

  const out: ReconciliationDay[] = [];
  for (let i = 0; i < boundedDays; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const ledgerUsd = ledgerByDay.get(date) ?? 0;
    const openaiUsd = openaiByDay.get(date) ?? 0;
    out.push({
      date,
      ledgerUsd: Math.round(ledgerUsd * 1e6) / 1e6,
      openaiUsd: Math.round(openaiUsd * 1e6) / 1e6,
      driftUsd: Math.round((openaiUsd - ledgerUsd) * 1e6) / 1e6,
    });
  }
  const totals = out.reduce(
    (acc, d) => ({
      ledgerUsd: acc.ledgerUsd + d.ledgerUsd,
      openaiUsd: acc.openaiUsd + d.openaiUsd,
      driftUsd: acc.driftUsd + d.driftUsd,
    }),
    { ledgerUsd: 0, openaiUsd: 0, driftUsd: 0 }
  );
  return {
    configured: true,
    days: out,
    totals: {
      ledgerUsd: Math.round(totals.ledgerUsd * 1e6) / 1e6,
      openaiUsd: Math.round(totals.openaiUsd * 1e6) / 1e6,
      driftUsd: Math.round(totals.driftUsd * 1e6) / 1e6,
    },
    unattributedRows: unattributed,
    notes,
  };
}
