/**
 * Per-tool latency statistics → latency-aware filler guidance (owner,
 * 2026-07-08; transcript cmrblgxuc0008w5hsnmadcyy9 is the motivating case:
 * ui_intent completes in well under a second, so the model narrating "give me
 * a moment" around it PROLONGS the interaction instead of smoothing it).
 *
 * Source of truth: persisted tool rows in the conversation store — they cover
 * BOTH server tools (content_search…) and client tools (ui_intent — which
 * never touches the tools/execute ledger). Medians are injected into the
 * voice mint prompts so the model knows which calls are instant (act silently)
 * and which deserve a short, context-relevant lead-in. The D50 clip player
 * independently covers anything that overruns (~1.2s) — the model NEVER needs
 * to cover long silences itself.
 */

import { prisma } from '@/lib/prisma';

export interface ToolLatencyStat {
  toolName: string;
  medianMs: number;
  avgMs: number;
  samples: number;
}

/** Below this a call is imperceptible — narration only adds delay. */
const INSTANT_MS = 600;
/** Above this a short spoken lead-in genuinely helps. */
const SLOW_MS = 1500;

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; stats: ToolLatencyStat[] } | null = null;

/**
 * Median/avg execution time per tool over the last 30 days of persisted tool
 * rows (metadata.processingTime, set by every adapter's tool logging).
 */
export async function getToolLatencyStats(): Promise<ToolLatencyStat[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.stats;

  const rows = await prisma.$queryRaw<Array<{ tool_name: string; median_ms: number; avg_ms: number; samples: bigint }>>`
    SELECT
      metadata->'debugInfo'->'aiRequest'->>'toolName' AS tool_name,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY (metadata->>'processingTime')::numeric) AS median_ms,
      avg((metadata->>'processingTime')::numeric) AS avg_ms,
      count(*) AS samples
    FROM ai_conversation_messages
    WHERE role = 'system'
      AND metadata->'debugInfo'->'aiRequest'->>'toolName' IS NOT NULL
      AND (metadata->>'processingTime') ~ '^[0-9]+(\\.[0-9]+)?$'
      AND timestamp > now() - interval '30 days'
    GROUP BY 1
    HAVING count(*) >= 2
  `;

  const stats = rows.map((r) => ({
    toolName: r.tool_name,
    medianMs: Math.round(Number(r.median_ms)),
    avgMs: Math.round(Number(r.avg_ms)),
    samples: Number(r.samples),
  }));
  cache = { at: now, stats };
  return stats;
}

export function __clearToolLatencyCache(): void {
  cache = null;
}

/**
 * Prompt block for the voice mints. Buckets each measured tool and spells out
 * the behavioral rule per bucket; tools without data default to the fast-tool
 * rule (silence is the safe default — the D50 clips catch true overruns).
 */
export async function buildToolLatencyGuidance(): Promise<string> {
  let stats: ToolLatencyStat[] = [];
  try {
    stats = await getToolLatencyStats();
  } catch (error) {
    console.error('[tool-latency] stats query failed (continuing with defaults):', error);
  }

  const instant = stats.filter((s) => s.medianMs < INSTANT_MS);
  const fast = stats.filter((s) => s.medianMs >= INSTANT_MS && s.medianMs < SLOW_MS);
  const slow = stats.filter((s) => s.medianMs >= SLOW_MS);

  const list = (items: ToolLatencyStat[]) =>
    items.map((s) => `${s.toolName} (~${s.medianMs}ms)`).join(', ');

  const lines = [
    '\n\nTOOL LATENCY AWARENESS (measured medians — follow these, not habit):',
  ];
  if (instant.length) {
    lines.push(
      `- INSTANT (${list(instant)}): finish in a blink. NEVER announce or narrate these — no "let me", no "one moment". Call silently, then speak about the RESULT (what the visitor now sees, what you found).`
    );
  }
  if (fast.length) {
    lines.push(
      `- FAST (${list(fast)}): at most a few natural words of lead-in, only when it fits the sentence you were already saying.`
    );
  }
  if (slow.length) {
    lines.push(
      `- SLOWER (${list(slow)}): start a short, context-relevant lead-in first — one that references what the visitor asked (e.g. "3D work — good question, there are a couple of projects like that…"), never a canned "let me look that up".`
    );
  }
  lines.push(
    '- Tools not listed: treat as INSTANT (call silently). The system plays its own short pre-recorded filler the moment a slow call starts — generic filler is COVERED for you; you never need to fill silence yourself.',
    '- Style: when you do speak before a slower call, prefer something CONTEXT-RELEVANT over generic filler (the generic kind is what the pre-recorded clips are for) — tie it to the topic, vary it, keep it to one short clause. Speak like someone who already knows this portfolio, not like a system doing a lookup.'
  );

  return lines.join('\n');
}
