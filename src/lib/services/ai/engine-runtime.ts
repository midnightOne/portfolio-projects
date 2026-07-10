/**
 * Conversation-engine runtime composition (Block B) — where the D48-clean
 * core gets its real dependencies: the Prisma GraphSource, the
 * conversation-history state store (CAS + markers), the metered
 * `default-cheap` classifier (P10/P26, D33), pinned-model embeddings (P11),
 * the typed context-set resolver (B4 — visibility-filtered, budgeted), and
 * the registry-backed provider tool arrays (B5/P8).
 *
 * Route-facing helpers live here too; every one of them is swallow-all (P1):
 * a graph bug degrades to "the engine stopped steering", never to a failed
 * mint, turn, or tool call.
 */

import { prisma } from '@/lib/prisma';
import { ConversationEngine, EngineStateStore, type ProcessTurnDebug } from '@/lib/ai/engine/engine';
import type {
  ContextItemSpec,
  EngineDirective,
  EngineState,
  EngineUx,
  EngineWindowUpdate,
  StartDirective,
  TurnEvidence,
} from '@/lib/ai/engine/types';
import { buildCheapCallPrompt, parseCheapCallResponse, CheapCallInput, CheapCallResult } from '@/lib/ai/engine/cheap-call';
import {
  buildSummarizerPrompt,
  parseSummarizerResponse,
  summarizerNeeded,
  applySummarizerProfile,
} from '@/lib/ai/engine/summarizer';
import { renderProfileText, flagsEqual } from '@/lib/ai/engine/profile';
import { DEFAULT_WINDOW_CONFIG, renderSummaryText, type WindowConfig } from '@/lib/ai/engine/window';
import { prismaGraphSource } from './graph-store';
import { conversationHistoryManager } from './conversation-history-manager';
import { getReasoningAdapter } from '@/lib/ai/reasoning';
import { generateEmbeddingsForModel } from '@/lib/ai/embeddings';
import { recordUsage } from '@/lib/ai/ledger';
import { estimateTokensFromChars } from '@/lib/ai/pricing';
import { resolveModelAlias, type ModelAliasName } from '@/lib/ai/model-registry';
import { ContentSearchService } from '@/lib/content/ContentSearchService';

/** P10: hard classifier timeout — no transition beats a wrong one. */
const CLASSIFIER_TIMEOUT_MS = 2000;

// ---------------------------------------------------------------------------
// Context-lifecycle config (Block J). Env-overridable so drills and the owner
// can tighten the window without code changes (Req 20.1 "configurable");
// invalid values fall back to the spec defaults.
// ---------------------------------------------------------------------------

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Req 19.3: behavior summarizer at most once per interval (default 60s). */
const SUMMARIZER_INTERVAL_MS = envInt('ENGINE_SUMMARIZER_INTERVAL_MS', 60_000);
/** A crashed invocation's in-flight stamp goes stale after this (self-healing guard, P29). */
const SUMMARIZER_IN_FLIGHT_STALE_MS = 120_000;

function windowConfig(): WindowConfig {
  return {
    maxVerbatimAgeMs: envInt('ENGINE_WINDOW_MAX_AGE_MS', DEFAULT_WINDOW_CONFIG.maxVerbatimAgeMs),
    maxVerbatimTurns: envInt('ENGINE_WINDOW_MAX_TURNS', DEFAULT_WINDOW_CONFIG.maxVerbatimTurns),
  };
}

/**
 * v1 probe patterns (Req 18.2 "pattern + classifier"). Conservative, injected
 * into the core as config (D48 — never hardcoded there); owner-tunable lists
 * arrive with the safety module (Block L) / graph authoring (Block D).
 */
const DEFAULT_PROBE_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|your\s+|previous\s+|the\s+)?(instructions|rules|prompts?)/i,
  /system\s+prompt/i,
  /\bjailbreak\b/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /you\s+are\s+now\s+(a|an|in)\b/i,
];

// ---------------------------------------------------------------------------
// Classifier + embeddings deps (metered internal calls — same recordUsage
// pattern as ContentSearchService/batch services; D33)
// ---------------------------------------------------------------------------

async function runCheapCallMetered(input: CheapCallInput): Promise<CheapCallResult | null> {
  const prompt = buildCheapCallPrompt(input);
  const adapter = await getReasoningAdapter('default-cheap');
  const chatPromise = adapter.chat([{ role: 'user', content: prompt }], {
    temperature: 0,
    maxOutputTokens: 400,
  });
  // Meter on completion even when the race below times out first — the spend
  // happened regardless (D33 honesty).
  void chatPromise
    .then((res) =>
      recordUsage({
        feature: 'chat',
        usageType: 'engine_classifier',
        provider: res.provider,
        modelId: res.modelId,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
      })
    )
    .catch(() => undefined);

  const result = await Promise.race([
    chatPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), CLASSIFIER_TIMEOUT_MS)),
  ]);
  if (!result) return null; // timeout → classifier conditions evaluate false this turn (P10)
  return parseCheapCallResponse(result.content);
}

async function embedUtterancePinned(text: string, modelId: string): Promise<number[] | null> {
  try {
    const result = await generateEmbeddingsForModel([text], modelId, { taskType: 'query' });
    void recordUsage({
      feature: 'semantic',
      usageType: 'engine_intent_embedding',
      provider: result.provider,
      modelId: result.modelId,
      inputTokens: result.tokensUsed,
      outputTokens: 0,
    }).catch(() => undefined);
    return result.vectors[0] ?? null;
  } catch (err) {
    console.warn('[engine] utterance embedding failed — intent degrades to classifier-only (P11):', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// B4: typed context-set resolution — single assembly point, server-side only
// (D47(a)); PRIVATE visibility excluded AT RUNTIME for public sessions (P13);
// budget drops WHOLE items in authored order and reports them (P12, notes §6)
// ---------------------------------------------------------------------------

const searchService = new ContentSearchService();

async function isProjectEntityPublic(entityId: string): Promise<boolean> {
  const entity = await prisma.contentEntity.findUnique({
    where: { id: entityId },
    select: { entityType: true, slug: true },
  });
  if (!entity) return false;
  if (entity.entityType !== 'PROJECT') return true; // BIO/SKILLS/… are always public
  const project = await prisma.project.findUnique({
    where: { slug: entity.slug },
    select: { visibility: true },
  });
  return project?.visibility === 'PUBLIC';
}

async function resolveOneItem(item: ContextItemSpec, isPublic: boolean): Promise<string | null> {
  switch (item.type) {
    case 'static':
      return item.text;
    case 'fid-scope':
      // Narrows an existing budget rather than adding to it (notes §6) — a
      // focus directive for the model, ~0 tokens.
      return `Focus your on-screen context on project "${item.projectId}"${item.sectionAnchor ? `, section ${item.sectionAnchor}` : ''}.`;
    case 'entity': {
      if (isPublic && !(await isProjectEntityPublic(item.entityId))) return null; // P13
      const t1 = await prisma.contextChunk.findFirst({
        where: { entityId: item.entityId, tier: 1 },
        select: { content: true, title: true, entity: { select: { slug: true } } },
      });
      if (!t1) return null;
      return `[${t1.entity.slug}] ${t1.title ? `${t1.title}: ` : ''}${t1.content}`;
    }
    case 'chunk': {
      // getContent handles DB ids, semantic chunkIds, and visibility (publicOnly)
      const result = await searchService.getContent({ ids: [item.chunkId], publicOnly: isPublic, maxTokens: 900 });
      const first = (result as { items?: Array<{ title?: string; content?: string }> }).items?.[0];
      if (!first?.content) return null;
      return `${first.title ? `${first.title}: ` : ''}${first.content}`;
    }
    case 'search': {
      const result = await searchService.searchContent({
        query: item.query,
        k: item.limit ?? 3,
        publicOnly: isPublic,
      });
      if (!result.items.length) return null;
      return result.items
        .map((r) => `- ${r.title}${r.oneLiner ? `: ${r.oneLiner}` : ''}${r.navTarget ? ` (${r.navTarget})` : ''}`)
        .join('\n');
    }
  }
}

async function resolveContextSet(
  items: ContextItemSpec[],
  opts: { isPublic: boolean; budgetTokens: number }
): Promise<{ text: string | null; drops: string[] }> {
  const kept: string[] = [];
  const drops: string[] = [];
  let tokens = 0;
  for (const item of items) {
    const label = item.type === 'search' ? `search:${item.query.slice(0, 40)}` : item.type === 'static' ? 'static' : item.type === 'entity' ? `entity:${item.entityId}` : item.type === 'chunk' ? `chunk:${item.chunkId}` : `fid-scope:${item.projectId}`;
    let resolved: string | null = null;
    try {
      resolved = await resolveOneItem(item, opts.isPublic);
    } catch (err) {
      console.warn(`[engine] context item ${label} failed to resolve (dropped):`, err);
    }
    if (resolved === null) {
      drops.push(label);
      continue;
    }
    const itemTokens = estimateTokensFromChars(resolved.length);
    // Drop WHOLE items once over budget — never truncate inside one (notes §6)
    if (kept.length > 0 && tokens + itemTokens > opts.budgetTokens) {
      drops.push(`${label} (budget)`);
      continue;
    }
    kept.push(resolved);
    tokens += itemTokens;
  }
  return { text: kept.length ? kept.join('\n\n') : null, drops };
}

// ---------------------------------------------------------------------------
// B5: model-side tool surface — OWNER DECISION (2026-07-09, confirmed twice):
// ALL sessions mint with the FULL tool set ("we don't have that many tools");
// node state reaches the model as appended guidance only, on every provider.
// Transitions therefore carry NO tool arrays — the node allowlist's real
// enforcement is server-side in /api/ai/tools/execute (getNodeToolAllowlist
// below), which no provider or model behavior can bypass. The adapter-level
// tool replacement (updateSession.tools, drilled in Block A) and the engine
// core's buildProviderTools seam both REMAIN as capabilities for a future
// decision; this composition simply doesn't wire them.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// State store over conversation-history-manager (P2/P3/P18 live there)
// ---------------------------------------------------------------------------

const stateStore: EngineStateStore = {
  readEngineState: async (conversationId) =>
    ConversationEngine.parseEngineState(await conversationHistoryManager.readEngineStateRaw(conversationId)),
  mergeEngineState: (conversationId, patch) =>
    conversationHistoryManager.mergeEngineState(conversationId, patch as Record<string, unknown>),
  claimTurn: (conversationId, expected, turnId) =>
    conversationHistoryManager.claimEngineTurn(conversationId, expected, turnId),
  recordTransition: (conversationId, record) =>
    conversationHistoryManager.recordSessionMarker(conversationId, {
      type: 'node_transition',
      fromNode: record.fromNode,
      toNode: record.toNode,
      edgeId: record.edgeId,
      conditionType: record.conditionType,
      evidence: record.evidence,
      graphVersionId: record.graphVersionId,
      turnMessageId: record.turnMessageId,
    }),
  recordEvaluated: (conversationId, turnMessageId, rows) =>
    conversationHistoryManager.recordSessionMarker(conversationId, {
      type: 'edge_evaluated',
      turnMessageId,
      evaluated: rows,
    }),
};

// ---------------------------------------------------------------------------
// J3: behavior summarizer + running summary — ONE cheap-LLM job, two outputs
// (profile assessment from USER turns, Req 19.3; running conversation summary,
// Req 20.5), staleness-triggered at turn boundaries via an atomic claim (P29),
// fully async (never blocks a turn), gateway-metered like every internal call
// (D33). The Block I2 batch reuses runSummarizerJob directly — one pipeline,
// two triggers.
// ---------------------------------------------------------------------------

async function readEngineState(conversationId: string): Promise<EngineState | null> {
  return ConversationEngine.parseEngineState(
    await conversationHistoryManager.readEngineStateRaw(conversationId)
  );
}

/**
 * Produce/refresh the running summary + profile for one conversation. Exported
 * for the Block I2 batch (admin/cron backfill); in-session callers go through
 * maybeRunSummarizer, which owns the staleness claim. Assumes the caller holds
 * the in-flight claim; always clears it, success or failure.
 */
export async function runSummarizerJob(conversationId: string): Promise<void> {
  const finishedAt = () => new Date().toISOString();
  try {
    const state = await readEngineState(conversationId);
    if (!state) {
      // Claim raced an engine-off rewrite — nothing to do.
      await conversationHistoryManager.mergeEngineState(conversationId, { summarizerInFlightSince: null });
      return;
    }
    const previous = await conversationHistoryManager.getLatestConversationSummary(conversationId);
    const turns = await conversationHistoryManager.getTurnsSince(
      conversationId,
      previous?.upToMessageId ?? null,
      60
    );
    const input = {
      previousSummary: previous?.summaryText ?? null,
      turns: turns.map((t) => ({ role: t.role, content: t.content })),
    };
    if (!summarizerNeeded(input)) {
      // No new user turns since the last summary — count it as a run so the
      // staleness check stays quiet for another interval.
      await conversationHistoryManager.mergeEngineState(conversationId, {
        summarizerInFlightSince: null,
        lastSummarizerRunAt: finishedAt(),
      });
      return;
    }

    const adapter = await getReasoningAdapter('default-cheap');
    const result = await adapter.chat([{ role: 'user', content: buildSummarizerPrompt(input) }], {
      temperature: 0.2,
      maxOutputTokens: 700,
    });
    void recordUsage({
      feature: 'chat',
      usageType: 'engine_summarizer',
      provider: result.provider,
      modelId: result.modelId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    }).catch(() => undefined);

    const parsed = parseSummarizerResponse(result.content);
    if (!parsed || !parsed.summary.trim()) {
      throw new Error('summarizer returned no parseable summary');
    }

    const summaryVersion = state.summaryVersion + 1;
    const upToMessageId = turns.length > 0 ? turns[turns.length - 1].itemId : previous?.upToMessageId ?? null;
    // Row FIRST, state pointer after — a crash between the two leaves an
    // unreferenced row, never a dangling pointer.
    await conversationHistoryManager.recordSessionMarker(conversationId, {
      type: 'conversation_summary',
      summaryText: parsed.summary,
      summaryVersion,
      upToMessageId,
      profile: parsed.profile as Record<string, unknown>,
    });

    // P30: the summarizer's profile REPLACES the previous one wholesale —
    // stale judgments decay by omission ("rude five minutes ago" is gone
    // unless it is still the current read). startedAt survives (an anchor,
    // not an assessment).
    const flags = applySummarizerProfile(state.flags, parsed.profile);
    const profileChanged = !flagsEqual(state.flags, flags);
    await conversationHistoryManager.mergeEngineState(conversationId, {
      flags,
      ...(profileChanged ? { profileVersion: state.profileVersion + 1 } : {}),
      summaryVersion,
      lastSummarizerRunAt: finishedAt(),
      summarizerInFlightSince: null,
    });
  } catch (err) {
    console.error('[engine] summarizer run failed (guard cleared; retried after next interval):', err);
    // lastSummarizerRunAt is stamped even on failure so a persistently broken
    // summarizer costs one attempt per interval, never one per turn.
    await conversationHistoryManager
      .mergeEngineState(conversationId, { summarizerInFlightSince: null, lastSummarizerRunAt: finishedAt() })
      .catch(() => undefined);
  }
}

/** Turn-boundary staleness check (P29): claim atomically, then fire-and-forget. */
async function maybeRunSummarizer(conversationId: string): Promise<void> {
  try {
    const claimed = await conversationHistoryManager.claimSummarizerRun(
      conversationId,
      SUMMARIZER_INTERVAL_MS,
      SUMMARIZER_IN_FLIGHT_STALE_MS
    );
    if (!claimed) return;
    void runSummarizerJob(conversationId).catch((err) =>
      console.error('[engine] summarizer job crashed (P29 guard goes stale in 2min):', err)
    );
  } catch (err) {
    console.warn('[engine] summarizer claim failed (turn unaffected):', err);
  }
}

// ---------------------------------------------------------------------------
// J4: rolling-window delivery for native voice. The server owns the POLICY
// (window config + the framed summary text — assembly is server-side,
// D47(e)); the adapters own the MECHANICS (OpenAI item surgery / Gemini
// superseded block). Versioned like directives: sent when the persisted
// summaryVersion is ahead of what the live session last received; every
// update is a full snapshot, so a lost response just re-sends next turn.
// ---------------------------------------------------------------------------

async function resolveWindowUpdate(conversationId: string): Promise<EngineWindowUpdate | null> {
  const state = await readEngineState(conversationId);
  if (!state?.nodeId || state.summaryVersion <= state.deliveredSummaryVersion) return null;
  const summary = await conversationHistoryManager.getLatestConversationSummary(conversationId);
  if (!summary) return null;
  await conversationHistoryManager.mergeEngineState(conversationId, {
    deliveredSummaryVersion: state.summaryVersion,
  });
  return {
    summaryVersion: summary.summaryVersion,
    summaryText: renderSummaryText(summary.summaryText, summary.summaryVersion),
    upToItemId: summary.upToMessageId,
    config: windowConfig(),
  };
}

// ---------------------------------------------------------------------------
// Singleton + route helpers
// ---------------------------------------------------------------------------

let engineSingleton: ConversationEngine | null = null;

export function getConversationEngine(): ConversationEngine {
  if (!engineSingleton) {
    engineSingleton = new ConversationEngine({
      graphSource: prismaGraphSource,
      stateStore,
      evaluator: {
        embedUtterance: embedUtterancePinned,
        runCheapCall: runCheapCallMetered,
        probePatterns: DEFAULT_PROBE_PATTERNS,
        log: (msg, data) => console.warn(`[engine] ${msg}`, data ?? ''),
      },
      resolveContextSet,
      // buildProviderTools deliberately NOT wired (owner decision above): the
      // core seam remains, this composition delivers node state as guidance only.
      log: (msg, data) => console.warn(`[engine] ${msg}`, data ?? ''),
    });
  }
  return engineSingleton;
}

/** Debug-telemetry gate for evaluated-but-not-taken rows (Req 7.3) — dev only until F1's test tagging. */
function debugTelemetryOn(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_VERIFICATION === 'true';
}

const ENGINE_SUFFIX_HEADER = '\n\n======== CONVERSATION-STATE GUIDANCE ========\n';

/** Mint-time engine inputs for the native session routes (notes §2.1.4). */
export interface EngineMintPolicy {
  /** Appended AFTER base instructions; '' when no graph is active — the static path stays byte-identical (Req 2.7). */
  suffix: string;
  /** Start (or, on resume, persisted — Req 2.6) node's D4 alias: mint-time model input on native (Req 5.4); null = config default. */
  modelAlias: string | null;
}

/**
 * Mint/first-turn engine policy (notes §2.1.4): the start node's (or, on
 * resume, the PERSISTED node's — Req 2.6) guidance + prepared context, plus
 * the node's model alias for mint-time resolution (Req 5.4 — the ONLY point
 * where a node alias touches a native session; mid-session it is ignored,
 * Req 5.3).
 */
export async function buildEngineStartSuffix(opts: {
  isPublic: boolean;
  resumeSessionId?: string | null;
}): Promise<EngineMintPolicy> {
  const inactive: EngineMintPolicy = { suffix: '', modelAlias: null };
  try {
    const engine = getConversationEngine();
    let directive: StartDirective | null;
    let engineState: EngineState | null = null;
    if (opts.resumeSessionId) {
      const ref = await conversationHistoryManager.getConversationRefBySessionId(opts.resumeSessionId);
      engineState = ref
        ? ConversationEngine.parseEngineState((ref.latestState as Record<string, unknown> | null)?.engine ?? null)
        : null;
      directive = await engine.resumePolicy(engineState, { isPublic: opts.isPublic });
    } else {
      directive = await engine.startPolicy({ isPublic: opts.isPublic });
    }
    if (!directive) return inactive;
    // J2: on resume the new leg is briefed with the current profile assessment
    // too — the floating block takes over live updates once the session runs.
    const profileText = engineState ? renderProfileText(engineState.flags) : null;
    const parts = [
      ...(directive.contextText ? [directive.contextText] : []),
      ...(profileText ? [profileText] : []),
    ];
    return {
      suffix: parts.length ? `${ENGINE_SUFFIX_HEADER}${parts.join('\n\n')}` : '',
      modelAlias: directive.modelAlias ?? null,
    };
  } catch (err) {
    console.error('[engine] startPolicy failed — mint proceeds on the static path (P1):', err);
    return inactive;
  }
}

/**
 * Realtime-capability gate for mint overrides. DRIVEN RESULT (D22, probed
 * 2026-07-10 with nonsense model ids): BOTH providers mint session tokens
 * without validating the model — OpenAI `client_secrets` and Google
 * `auth_tokens` each returned 200 for "banana-nonexistent…". Rejection, if
 * any, happens at session CONNECT, client-side, where the server cannot
 * retry. Ahead-of-time filtering is therefore the ONLY server-side
 * protection; a retry-on-mint-failure net is dead code and was removed.
 * Conservative name-based check — registry aliases carry no capability
 * metadata (revisit if the registry ever grows a "kind" column).
 */
const REALTIME_MODEL_PATTERNS: Record<'openai' | 'google', RegExp> = {
  openai: /realtime/i,
  google: /live|native-audio/i,
};

/**
 * Req 5.4: the start node's alias participates in mint-time model resolution
 * on native voice. Narrow contract: the alias must resolve in the D4 registry,
 * to the SAME provider as the minting route, AND to a realtime-family model
 * (gate above — a text-model alias on a voice mint would produce a session
 * that dies at connect with no server-side recovery). Anything else → the
 * voice-config default stands with a warning (P1: a graph bug degrades the
 * steering, never breaks a mint).
 */
export async function resolveEngineMintModel(args: {
  routeProvider: 'openai' | 'google';
  engineAlias: string | null;
  defaultModelId: string;
}): Promise<{ modelId: string; overridden: boolean }> {
  const fallback = { modelId: args.defaultModelId, overridden: false };
  if (!args.engineAlias) return fallback;
  try {
    const resolved = await resolveModelAlias(args.engineAlias as ModelAliasName);
    if (resolved.provider !== args.routeProvider) {
      console.warn(
        `[engine] start-node alias '${args.engineAlias}' resolves to provider '${resolved.provider}' — ignored for ${args.routeProvider} mint (config default stands)`
      );
      return fallback;
    }
    if (!REALTIME_MODEL_PATTERNS[args.routeProvider].test(resolved.modelId)) {
      console.warn(
        `[engine] start-node alias '${args.engineAlias}' resolves to non-realtime model '${resolved.modelId}' — ignored for ${args.routeProvider} mint (providers do not validate at mint; a bad model only fails at connect, so it never leaves the server)`
      );
      return fallback;
    }
    if (resolved.modelId === args.defaultModelId) return fallback;
    console.log(`[engine] mint model override via start-node alias '${args.engineAlias}': ${resolved.modelId} (Req 5.4)`);
    return { modelId: resolved.modelId, overridden: true };
  } catch (err) {
    console.warn(`[engine] start-node alias '${args.engineAlias}' failed to resolve — config default stands (P1):`, err);
    return fallback;
  }
}

/**
 * Post-persist turn evaluation (notes §2.2) — the ONE call sites make after a
 * user turn is durable. Swallow-all (P1): the /log or /chat response succeeds
 * regardless. Returns a directive only for native voice providers
 * (notes §2.2.9); cascade/text re-derive server-side next turn.
 */
export async function runEngineTurn(args: {
  conversationId: string;
  evidence: TurnEvidence;
  provider: string;
  isPublic: boolean;
}): Promise<{
  directive: EngineDirective | null;
  debug: ProcessTurnDebug | null;
  /** J4: rolling-window update for the live NATIVE session (null otherwise). */
  window: EngineWindowUpdate | null;
  /** G1 (Req 13.1): target node's chips/label when a transition fired — the /chat envelope's delivery path. */
  ux: EngineUx | null;
}> {
  try {
    const isNative = args.provider === 'openai' || args.provider === 'google';
    const result = await getConversationEngine().processTurn(args.conversationId, args.evidence, {
      provider: args.provider,
      isNative,
      isPublic: args.isPublic,
      debug: debugTelemetryOn(),
    });
    // J3 (P29): staleness-triggered summarizer — fire-and-forget, never blocks
    // or delays this turn; the claim gates to ≥1 interval + engine steering.
    void maybeRunSummarizer(args.conversationId);
    // J4: deliver a fresh running summary to the live native session (the
    // adapter prunes against it — P28 mechanics are the adapter's). One-turn
    // lag behind the async summarizer, same accepted race contract as D55.
    let window: EngineWindowUpdate | null = null;
    if (isNative) {
      try {
        window = await resolveWindowUpdate(args.conversationId);
      } catch (err) {
        console.warn('[engine] window update failed (turn unaffected):', err);
      }
    }
    return { directive: result.directive, debug: result.debug, window, ux: result.ux };
  } catch (err) {
    console.error('[engine] processTurn failed — conversation proceeds unsteered (P1):', err);
    return { directive: null, debug: null, window: null, ux: null };
  }
}

/**
 * G1 (Req 13.1/13.5): current visitor surface for the pill — the
 * conversation's persisted node when a session is running, else the active
 * graph's landing node (chips shown BEFORE any turn draw the visitor into
 * first contact — owner 2026-07-10). Cheap (graph read only, no context
 * resolution, no spend) and safe on a public endpoint: chips/label carry no
 * graph structure. Swallow-all (P1): null on any failure → surfaces hidden.
 */
export async function getCurrentEngineUx(sessionId?: string | null): Promise<EngineUx | null> {
  try {
    const engine = getConversationEngine();
    if (sessionId) {
      const ref = await conversationHistoryManager.getConversationRefBySessionId(sessionId);
      if (ref) {
        const engineState = ConversationEngine.parseEngineState(
          (ref.latestState as Record<string, unknown> | null)?.engine ?? null
        );
        // A pinned engine-off conversation shows no surfaces — not the start node's.
        if (engineState) return engine.currentUx(engineState);
      }
    }
    return await engine.startUx();
  } catch (err) {
    console.warn('[engine] ux read failed — surfaces hidden (P1):', err);
    return null;
  }
}

/** What the engine contributes to one cascade/text turn's assembly (+ `_debug.engine` inputs, C3/J5). */
export interface EngineTurnPrompt {
  /** Appended AFTER the base system prompt; '' when the engine is not steering (Req 2.7). */
  suffix: string;
  /** Current node's D4 alias → THIS turn's `resolveModel` resolution (Req 5.2); null = session default. */
  modelAlias: string | null;
  /** G1: the CURRENT node's chips/label (pre-turn) — /chat's fallback when no transition fires this turn. */
  ux: EngineUx | null;
  /**
   * J4 (Req 20.3): the framed running summary — STABLE-prefix material.
   * Cascade/text assembly places it right after the base instructions
   * (cache-stable ordering: stable prefix first, volatile material last);
   * null when no summary exists yet.
   */
  summaryText: string | null;
  /** J4: verbatim-history cap for this turn's assembly; null = engine not steering (no window). */
  maxVerbatimTurns: number | null;
  /** Prompt-phase debug for `_debug.engine` (Req 7.5); null when the engine is not steering. */
  debug: {
    nodeId: string;
    graphVersionId: string;
    contextDrops: string[];
    /** J5: window + summarizer state exposure. */
    window: {
      summaryVersion: number;
      summaryIncluded: boolean;
      maxVerbatimTurns: number;
      lastSummarizerRunAt: string | null;
      summarizerInFlight: boolean;
    } | null;
    /** J5: the current profile assessment (Req 19.2). */
    profile: Record<string, unknown> | null;
  } | null;
}

/**
 * Per-turn prompt assembly for cascade/text (Req 6.1 second application
 * layer): re-derives the current node's guidance + context from latestState —
 * the response field is never used on these runtimes (notes §2.2.9). Also the
 * cascade/text model-switch path (Req 5.2, task C1): the node's alias rides
 * out as pure data for this turn's adapter resolution — no session surgery.
 *
 * Block J additions: the visitor profile renders into the VOLATILE tail
 * (Req 19.1/19.5 — cascade/text's floating-block equivalent is "assembled
 * last every turn"), the running summary rides out separately as STABLE
 * material (Req 20.3 cache ordering is the caller's to apply), and the window
 * cap tells the caller how much verbatim history to keep.
 */
export async function buildEnginePromptSuffix(sessionId: string, opts: { isPublic: boolean }): Promise<EngineTurnPrompt> {
  const inactive: EngineTurnPrompt = { suffix: '', modelAlias: null, ux: null, summaryText: null, maxVerbatimTurns: null, debug: null };
  try {
    const ref = await conversationHistoryManager.getConversationRefBySessionId(sessionId);
    let directive: StartDirective | null;
    let engineState: EngineState | null = null;
    if (!ref) {
      // First turn — the start node shapes the prompt (notes §2.1; stamping
      // happens at the first processTurn).
      directive = await getConversationEngine().startPolicy({ isPublic: opts.isPublic });
    } else {
      engineState = ConversationEngine.parseEngineState(
        (ref.latestState as Record<string, unknown> | null)?.engine ?? null
      );
      if (engineState && !engineState.nodeId) return inactive; // engine off for this conversation (pinned)
      directive = await getConversationEngine().resumePolicy(engineState, { isPublic: opts.isPublic });
    }
    if (!directive) return inactive;

    // J2: the profile joins the volatile tail — transparent observations, re-
    // derived server-side every turn (the cascade/text application layer).
    const profileText = engineState ? renderProfileText(engineState.flags) : null;
    const suffixParts = [
      ...(directive.contextText ? [directive.contextText] : []),
      ...(profileText ? [profileText] : []),
    ];

    // J4: running summary as stable-prefix material + the verbatim cap.
    const config = windowConfig();
    let summaryText: string | null = null;
    if (ref && engineState && engineState.summaryVersion > 0) {
      const summary = await conversationHistoryManager.getLatestConversationSummary(ref.id);
      if (summary) summaryText = renderSummaryText(summary.summaryText, summary.summaryVersion);
    }

    return {
      suffix: suffixParts.length ? `${ENGINE_SUFFIX_HEADER}${suffixParts.join('\n\n')}` : '',
      modelAlias: directive.modelAlias ?? null,
      ux: directive.ux,
      summaryText,
      maxVerbatimTurns: config.maxVerbatimTurns,
      debug: {
        nodeId: directive.nodeId,
        graphVersionId: directive.graphVersionId,
        contextDrops: directive.contextDrops,
        window: {
          summaryVersion: engineState?.summaryVersion ?? 0,
          summaryIncluded: summaryText !== null,
          maxVerbatimTurns: config.maxVerbatimTurns,
          lastSummarizerRunAt: engineState?.lastSummarizerRunAt ?? null,
          summarizerInFlight: (engineState?.summarizerInFlightSince ?? null) !== null,
        },
        profile: engineState ? (engineState.flags as Record<string, unknown>) : null,
      },
    };
  } catch (err) {
    console.error('[engine] prompt suffix failed — turn proceeds unsteered (P1):', err);
    return inactive;
  }
}

/**
 * B5: the current node's tool allowlist for a session, or null when the node
 * doesn't narrow (Req 4.4) / engine inactive / anything fails (fail-open to
 * the EXISTING tier enforcement — the node layer only ever narrows, never
 * grants, so failing open here cannot widen access beyond the tier).
 */
export async function getNodeToolAllowlist(sessionId: string): Promise<string[] | null> {
  try {
    const ref = await conversationHistoryManager.getConversationRefBySessionId(sessionId);
    if (!ref) return null;
    const engineState = ConversationEngine.parseEngineState(
      (ref.latestState as Record<string, unknown> | null)?.engine ?? null
    );
    if (!engineState?.nodeId || !engineState.graphVersionId) return null;
    const document = await prismaGraphSource.getVersion(engineState.graphVersionId);
    const node = document?.nodes.find((n) => n.id === engineState.nodeId);
    if (!node?.toolAllowlist) return null;
    // Req 3.5: an allowlist may never remove baseline retrieval in start or
    // off-graph states — prepared context biases, it never walls off RAG.
    if (node.role === 'start' || node.role === 'offgraph') {
      return Array.from(new Set([...node.toolAllowlist, 'content_search', 'content_get']));
    }
    return node.toolAllowlist;
  } catch (err) {
    console.warn('[engine] node allowlist lookup failed — tier enforcement alone applies:', err);
    return null;
  }
}
