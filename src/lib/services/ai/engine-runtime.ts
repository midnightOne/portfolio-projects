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
import { ConversationEngine, EngineStateStore } from '@/lib/ai/engine/engine';
import type { ContextItemSpec, EngineDirective, StartDirective, TurnEvidence } from '@/lib/ai/engine/types';
import { buildCheapCallPrompt, parseCheapCallResponse, CheapCallInput, CheapCallResult } from '@/lib/ai/engine/cheap-call';
import { prismaGraphSource } from './graph-store';
import { conversationHistoryManager } from './conversation-history-manager';
import { getReasoningAdapter } from '@/lib/ai/reasoning';
import { generateEmbeddingsForModel } from '@/lib/ai/embeddings';
import { recordUsage } from '@/lib/ai/ledger';
import { estimateTokensFromChars } from '@/lib/ai/pricing';
import { unifiedToolRegistry } from '@/lib/ai/tools/UnifiedToolRegistry';
import { ContentSearchService } from '@/lib/content/ContentSearchService';

/** P10: hard classifier timeout — no transition beats a wrong one. */
const CLASSIFIER_TIMEOUT_MS = 2000;

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
// B5: provider tool arrays (full replacement schema, P8)
// ---------------------------------------------------------------------------

function buildProviderTools(provider: string, allowlist: string[]): Array<Record<string, unknown>> | undefined {
  if (provider === 'openai') {
    return unifiedToolRegistry
      .getOpenAIToolsArray()
      .filter((t: { name: string }) => allowlist.includes(t.name)) as unknown as Array<Record<string, unknown>>;
  }
  // Gemini: tool set is token-locked at mint (driven: close 1007) — node
  // scoping is advisory guidance there; server-side enforcement is the teeth
  // (GoogleLiveAdapter header doc; owner decision 2026-07-09).
  return undefined;
}

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
      buildProviderTools,
      log: (msg, data) => console.warn(`[engine] ${msg}`, data ?? ''),
    });
  }
  return engineSingleton;
}

/** Debug-telemetry gate for evaluated-but-not-taken rows (Req 7.3) — dev only until F1's test tagging. */
function debugTelemetryOn(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_VERIFICATION === 'true';
}

/**
 * Mint/first-turn instruction suffix (notes §2.1.4): the start node's (or, on
 * resume, the PERSISTED node's — Req 2.6) guidance + prepared context,
 * appended AFTER base instructions. '' when no graph is active — the static
 * path stays byte-identical (Req 2.7).
 */
export async function buildEngineStartSuffix(opts: {
  isPublic: boolean;
  resumeSessionId?: string | null;
}): Promise<string> {
  try {
    const engine = getConversationEngine();
    let directive: StartDirective | null;
    if (opts.resumeSessionId) {
      const ref = await conversationHistoryManager.getConversationRefBySessionId(opts.resumeSessionId);
      const engineState = ref
        ? ConversationEngine.parseEngineState((ref.latestState as Record<string, unknown> | null)?.engine ?? null)
        : null;
      directive = await engine.resumePolicy(engineState, { isPublic: opts.isPublic });
    } else {
      directive = await engine.startPolicy({ isPublic: opts.isPublic });
    }
    if (!directive?.contextText) return '';
    return `\n\n======== CONVERSATION-STATE GUIDANCE ========\n${directive.contextText}`;
  } catch (err) {
    console.error('[engine] startPolicy failed — mint proceeds on the static path (P1):', err);
    return '';
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
}): Promise<EngineDirective | null> {
  try {
    const isNative = args.provider === 'openai' || args.provider === 'google';
    const result = await getConversationEngine().processTurn(args.conversationId, args.evidence, {
      provider: args.provider,
      isNative,
      isPublic: args.isPublic,
      debug: debugTelemetryOn(),
    });
    return result.directive;
  } catch (err) {
    console.error('[engine] processTurn failed — conversation proceeds unsteered (P1):', err);
    return null;
  }
}

/**
 * Per-turn prompt suffix for cascade/text (Req 6.1 second application layer):
 * re-derives the current node's guidance + context from latestState — the
 * response field is never used on these runtimes (notes §2.2.9).
 */
export async function buildEnginePromptSuffix(sessionId: string, opts: { isPublic: boolean }): Promise<string> {
  try {
    const ref = await conversationHistoryManager.getConversationRefBySessionId(sessionId);
    if (!ref) return buildEngineStartSuffix({ isPublic: opts.isPublic }); // first turn — start node shapes the prompt
    const engineState = ConversationEngine.parseEngineState(
      (ref.latestState as Record<string, unknown> | null)?.engine ?? null
    );
    if (engineState && !engineState.nodeId) return ''; // engine off for this conversation (pinned)
    const directive = await getConversationEngine().resumePolicy(engineState, { isPublic: opts.isPublic });
    if (!directive?.contextText) return '';
    return `\n\n======== CONVERSATION-STATE GUIDANCE ========\n${directive.contextText}`;
  } catch (err) {
    console.error('[engine] prompt suffix failed — turn proceeds unsteered (P1):', err);
    return '';
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
