/**
 * /about/ai article ingestion (conversation-engine task G4)
 *
 * The AI-self showcase node (design-ux-and-behavior §2.7) grounds itself on the
 * `/about/ai` article through the NORMAL retrieval path — which requires the
 * article to exist in the semantic index. The page itself is a hardcoded TSX
 * route (src/app/about/ai/page.tsx) outside the project-centric ingestion
 * pipeline, so this script ingests it as a CUSTOM ContentEntity:
 *
 *   - entity  CUSTOM/about-ai
 *   - T0 metadata chunk (same shape as the static BIO/RESUME/SKILLS entities)
 *   - T1 article summary
 *   - T2 one chunk per page section (chunkIds are heading-derived slugs)
 *
 * CONTENT SOURCE OF TRUTH: src/app/about/ai/page.tsx. The section texts below
 * are distilled from that page and MUST be updated when the page changes —
 * re-running the script re-embeds only changed chunks (content-hash gated).
 *
 * Embeddings ride the provider-pluggable `default-embedding` path, budget-gated
 * and ledgered exactly like the engine analytics batch (P23 discipline).
 * Non-project entities are always public in retrieval visibility filtering
 * (semantic-content task 8.1), so public sessions can ground on this content.
 *
 * Run: npm run ingest:about-ai   (idempotent; safe to re-run)
 */

// Load env the way the app does (.env AND .env.local — provider keys live in
// .env.local; same idiom as check-semantic.ts).
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { generateEmbeddings } from '../src/lib/ai/embeddings';
import { recordUsage } from '../src/lib/ai/ledger';
import { estimateCost } from '../src/lib/ai/pricing';
import { estimateTokensFromChars } from '../src/lib/ai/token-estimate';
import { semanticBudgetManager } from '../src/lib/content/SemanticBudgetManager';

const prisma = new PrismaClient();

export const ABOUT_AI_SLUG = 'about-ai';

const TITLE = 'How the AI works — the assistant explained';
const DESCRIPTION =
  'The architecture behind this portfolio’s AI assistant: three voice/text modes sharing one grounded brain, a tiered semantic index, measured-latency voice UX, a metered gateway, and a hardened public MCP server.';

const T1_SUMMARY = `This portfolio's AI assistant is itself the site's flagship project. Visitors can talk to it three ways — native speech-to-speech voice (OpenAI Realtime over WebRTC, Google Gemini Live over WebSocket), cascade voice (speech-to-text into the text pipeline's reasoning model, then text-to-speech via ElevenLabs, OpenAI, or Gemini), and plain text chat — and all three share one grounded reasoning-and-tools backend, so a typed question and a spoken one produce the same substance. Answers are grounded in a four-tier semantic index (T0 portfolio overview, T1 per-project summaries, T2 section summaries, T3 heading-bounded chunks) with hybrid vector + full-text retrieval in Postgres/pgvector. The assistant navigates the site itself by expressing intent against semantic UI targets. Voice UX treats silence as an interface element, using measured per-tool latencies and pre-recorded filler clips. Every AI entry point passes one metered gateway with budgets, rate limits, and a spend watchdog. A hardened public MCP server exposes the same retrieval tools to any visiting AI agent.`;

const SECTIONS: Array<{ chunkId: string; title: string; content: string }> = [
  {
    chunkId: 'three-modes-one-brain',
    title: 'Three modes, one brain',
    content: `You can talk to the portfolio three ways, and all three give the same grounded answers because they share a single reasoning-and-tools backend. Native speech-to-speech: realtime voice models from OpenAI (WebRTC) and Google Gemini Live (WebSocket), connected directly from the browser with short-lived session tokens — the flagship experience, no transcription hop. Cascade voice: speech-to-text, then the text pipeline's reasoning model, then text-to-speech (ElevenLabs, OpenAI, or Gemini TTS as the engine) — any chat model gains a voice, and tool calls run server-side where they are reliable. Text chat: the base mode on a cost-efficient reasoning model; the cascade is literally this pipeline with audio layered on. All three sit behind one adapter interface, so a session can be resumed on a different provider mid-conversation: connection recovery and deliberate provider switching are the same code path. When a connection drops, the new session is briefed from the server-side conversation store — the server is the ground truth; a model's in-session memory is treated as a cache. Which models, which voices, and what they may spend are admin-configurable data — no model ID is hardcoded anywhere in the codebase.`,
  },
  {
    chunkId: 'grounded-in-a-tiered-semantic-index',
    title: 'Grounded in a tiered semantic index',
    content: `Answers come from the portfolio's actual content, not the model's imagination. Every project is ingested into a four-tier index — T0 one portfolio-level overview, T1 a summary per project, T2 section summaries, T3 heading-bounded content chunks — each chunk carrying an embedding in Postgres/pgvector. Retrieval is hybrid: vector similarity, full-text search, and metadata filters combined, so "the kiln project" and "PID control loops" both land in the right place. The assistant also knows where the visitor is: a passive context pipeline pushes Frame (current page), Index (what content exists), and Details (the focused item) into the session during browsing, each on a strict token budget, replacing stale context rather than accumulating it. Questions about what's on screen need no lookup; anything deeper goes through search tools over the index. When retrieval comes back weak, the assistant is instructed to say the portfolio doesn't cover it — a low-relevance match is not an answer. Navigation is a tool like any other: the model expresses intent against a registry of semantic UI targets, and the site animates itself there — the model never touches the DOM.`,
  },
  {
    chunkId: 'voice-ux-the-silence-tells-the-truth',
    title: 'Voice UX: the silence tells the truth',
    content: `In a voice interface, the gap between a question and the answer is itself an interface element — two seconds of dead air reads as a dropped call. This system treats filler as a latency instrument, driven by measurement. Per-tool median execution times, measured from real conversations, are injected when a session starts: tools that finish imperceptibly fast are called silently (narrating "one moment" around a sub-second call only prolongs the interaction), while slower tools earn a short, topic-relevant lead-in. For genuinely slow calls, a pre-recorded clip in the assistant's own voice plays the instant the call starts — chosen so its length fits the expected gap, one clip per silence, cut off the moment real speech arrives. Clips are rendered per configured voice; a provider with no matching voice gets silence, never the wrong voice. The worst moment — a dropped connection, when there is no model to speak at all — is covered by the same mechanism: a client-side "reconnecting" clip plays over the automatic resume flow. Every clip playback is logged as its own event, so admin replay never mistakes a canned clip for model speech. Honest telemetry over polish.`,
  },
  {
    chunkId: 'running-llms-in-public-without-a-blank-check',
    title: 'Running LLMs in public without a blank check',
    content: `Every AI entry point on the site — text chat, voice session minting, the MCP endpoint — passes through one gateway: kill switch, then access tier, then rate limits, then execution, then a metered write to a single usage ledger. There is exactly one place where money is counted, and everything reads from it. Anonymous visitors get bot-challenged text chat with per-minute, per-day, and token budgets, and a strict tool allowlist. Invitation links (for recruiters: premium voice access, job-spec analysis) are treated as leakable credentials from day one: each link carries its own budget, binds to the first few devices that use it (IPs stored only as hashes), and enforces per-device daily sublimits — a leaked link doesn't open premium access to the whole internet. A global spend watchdog reads the ledger and trips a kill switch that darkens every public AI surface at once, requiring manual re-enable. Voice sessions carry duration caps enforced client-and-server side. The honest version of the security claim: a determined adversary with unlimited IPs is bounded by the watchdog, not stopped — graceful, capped failure instead of a surprise bill.`,
  },
  {
    chunkId: 'bring-your-own-ai-the-public-mcp-server',
    title: 'Bring your own AI: the public MCP server',
    content: `Visitors don't have to use the pill: the portfolio exposes a public Model Context Protocol (MCP) server, so any AI that speaks MCP over Streamable HTTP — Claude, an agent framework, anything — can search and read the portfolio directly. Three read-only tools: search_portfolio, get_project, list_projects — the same backend chain the voice assistant uses, exposed twice, implemented once. An anonymous, cookie-less AI endpoint is exactly the kind of thing that goes wrong in public, so its hardening is deliberate and testable, and the safeguards double as the endpoint's test plan: every call passes the same gateway with its own stricter per-IP rate bucket and kill switch; inputs are schema-validated with hard length caps before any service or database is touched; only PUBLIC content is reachable, enforced in SQL — a private project and a nonexistent one answer identically, so the endpoint isn't an existence oracle; errors map to generic messages with no stack traces, SQL, or paths; retrieved content is returned as data, never executed as instructions; and every tool call is metered into the ledger with the tool name and a hashed caller IP. v1 is deliberately read-only — write tools and deep reasoning tools would each require their own abuse analysis before they exist.`,
  },
  {
    chunkId: 'why-build-it-this-way',
    title: 'Why build it this way',
    content: `Everything in the assistant follows a few principles applied repeatedly: one mechanism, many triggers (recovery-resume is provider-switching; voice tools are MCP tools); the server is truth and sessions are caches; observability as the development loop (every turn, tool call, clip, and disruption is replayable in an admin timeline); and security posture as a feature with an audience, stated honestly. The system was also built WITH AI agents as first-class users — including the agent that helped build it, which drives the real voice pipeline in tests through a synthesized microphone because it doesn't have one of its own. The assistant answering questions about itself is grounded on this very article through the same retrieval path as any project.`,
  },
];

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('ingest-about-ai — CUSTOM/about-ai entity + T0/T1/T2 chunks');

  const entity = await prisma.contentEntity.upsert({
    where: { entityType_slug: { entityType: 'CUSTOM', slug: ABOUT_AI_SLUG } },
    create: {
      entityType: 'CUSTOM',
      slug: ABOUT_AI_SLUG,
      title: TITLE,
      description: DESCRIPTION,
      tags: ['ai', 'architecture', 'voice', 'mcp', 'assistant'],
      technologies: ['OpenAI Realtime', 'Gemini Live', 'ElevenLabs', 'pgvector', 'Next.js', 'MCP'],
    },
    update: { title: TITLE, description: DESCRIPTION },
  });
  console.log(`entity ${entity.id} (${entity.entityType}/${entity.slug})`);

  // T0 metadata (same shape as the static BIO/RESUME/SKILLS entities)
  const metadataContent = JSON.stringify({
    title: TITLE,
    type: 'CUSTOM',
    slug: ABOUT_AI_SLUG,
    page: '/about/ai',
  });
  await prisma.contextChunk.upsert({
    where: { entityId_tier_chunkId: { entityId: entity.id, tier: 0, chunkId: 'metadata' } },
    create: {
      entityId: entity.id,
      tier: 0,
      chunkId: 'metadata',
      title: 'Metadata',
      content: metadataContent,
      tokenCount: estimateTokensFromChars(metadataContent.length),
      metadata: { type: 'metadata', source: 'about-ai-page' },
    },
    update: { content: metadataContent, tokenCount: estimateTokensFromChars(metadataContent.length) },
  });

  // T1 summary + T2 sections — upsert, then embed only new/changed content.
  const chunks = [
    { tier: 1, chunkId: 'summary', title: TITLE, content: T1_SUMMARY },
    ...SECTIONS.map((s) => ({ tier: 2, chunkId: s.chunkId, title: s.title, content: s.content })),
  ];

  const toEmbed: Array<{ id: string; content: string }> = [];
  for (const c of chunks) {
    const contentHash = hashContent(c.content);
    const existing = await prisma.contextChunk.findUnique({
      where: { entityId_tier_chunkId: { entityId: entity.id, tier: c.tier, chunkId: c.chunkId } },
      select: { id: true, contentHash: true, embeddingGeneratedAt: true },
    });
    const row = await prisma.contextChunk.upsert({
      where: { entityId_tier_chunkId: { entityId: entity.id, tier: c.tier, chunkId: c.chunkId } },
      create: {
        entityId: entity.id,
        tier: c.tier,
        chunkId: c.chunkId,
        title: c.title,
        content: c.content,
        tokenCount: estimateTokensFromChars(c.content.length),
        metadata: { type: c.tier === 1 ? 'entity-summary' : 'section-summary', source: 'about-ai-page' },
        contentHash,
        generationMode: 'manual',
        importanceSource: 'manual',
        importance: 0.7,
      },
      update: {
        title: c.title,
        content: c.content,
        tokenCount: estimateTokensFromChars(c.content.length),
        contentHash,
      },
    });
    const unchanged = existing?.contentHash === contentHash && existing?.embeddingGeneratedAt;
    if (!unchanged) toEmbed.push({ id: row.id, content: c.content });
    console.log(`  T${c.tier} ${c.chunkId}: ${unchanged ? 'unchanged (embedding kept)' : 'queued for embedding'}`);
  }

  if (toEmbed.length === 0) {
    console.log('all chunks unchanged — nothing to embed. Done.');
    return;
  }

  // Budget gate + ledgered embedding — same discipline as the engine batches (P23).
  const estTokens = toEmbed.reduce((n, c) => n + estimateTokensFromChars(c.content.length), 0);
  const estimated = await estimateCost('gemini-embedding-001', { inputTokens: estTokens }).catch(() => 0.001);
  const afford = await semanticBudgetManager.canAffordOperation(estimated || 0.001);
  if (!afford.canAfford) {
    console.error(
      `embedding skipped: budget gate (needs ~$${(estimated || 0.001).toFixed(4)}, remaining $${afford.remainingFunds.toFixed(2)}). Chunks persisted without embeddings — re-run when budget allows.`
    );
    return;
  }

  const result = await generateEmbeddings(toEmbed.map((c) => c.content), { taskType: 'document' });
  for (let i = 0; i < toEmbed.length; i++) {
    const vec = `[${result.vectors[i].join(',')}]`;
    await prisma.$executeRaw`
      UPDATE context_chunks
      SET embedding_vector = ${vec}::vector,
          embedding_model = ${result.modelId},
          embedding_generated_at = NOW()
      WHERE id = ${toEmbed[i].id}`;
  }
  const costUsd = await estimateCost(result.modelId, { inputTokens: result.tokensUsed }).catch(() => 0);
  await recordUsage({
    feature: 'semantic',
    usageType: 'about_ai_ingest_embedding',
    provider: result.provider,
    modelId: result.modelId,
    inputTokens: result.tokensUsed,
    costUsd,
    metadata: { source: 'ingest-about-ai', chunks: toEmbed.length },
  });
  console.log(
    `embedded ${toEmbed.length} chunk(s) via ${result.modelId} (${result.tokensUsed} tokens, ~$${costUsd.toFixed(6)}) — ledgered as about_ai_ingest_embedding`
  );
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
