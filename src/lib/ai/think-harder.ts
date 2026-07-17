/**
 * think_harder (ai-assistant 7.17) — the first concrete D41 voice↔reasoning
 * hand-off: a hard question escalates from the fast realtime model to the
 * admin-selectable `default-reasoning` alias (D39; never a hardcoded model id,
 * D4/D38) through the REQUIRED secondary-LLM job path (`runSecondaryLLMJob`,
 * Block M — fake-mode aware, metered), and the synthesized answer returns as
 * tool output for the voice model to narrate.
 *
 * Grounding: the same retrieval chain the assistant itself uses (D39 — one
 * server-tool chain, no clones): a global content_search on the question with
 * the caller's UI state (current-project boost), plus the recent conversation
 * tail, plus the compact start frame for identity.
 *
 * Cost gating: basic-tier sessions are refused here (defense-in-depth behind
 * the PUBLIC_TOOL_ALLOWLIST exclusion); spend meters through the gateway
 * meter when the dispatching route passes one (tier/reflink attribution), and
 * through the internal ledger path otherwise — either way the spend lands in
 * the AI ledger (D33).
 */

import { z } from 'zod';
import { runSecondaryLLMJob, type SecondaryLLMMeterInput } from '@/lib/services/ai/secondary-llm';
import { assembleStartFrame } from '@/lib/ai/start-frame';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

const MAX_QUESTION_CHARS = 2000;
const CONVERSATION_TAIL_TURNS = 14;
const TIMEOUT_MS = 45_000;
/** Full-text grounding budget (tokens) — deep answers need the actual prose,
 *  not T2 one-liners (owner review, 2026-07-17). */
const FETCH_TOKEN_BUDGET = 3500;
const FETCH_TOP_IDS = 5;

const AnswerSchema = z.object({
  /** The synthesized deep answer, written to be SPOKEN by the voice model. */
  answer: z.string(),
});

export interface ThinkHarderSearchItem {
  id?: string;
  project?: string;
  source?: { label?: string };
  title?: string;
  oneLiner?: string;
  content?: string;
}

export interface ThinkHarderParams {
  question: string;
  sessionId: string;
  accessLevel: 'basic' | 'limited' | 'premium';
  uiState?: { currentProject?: string; currentRoute?: string };
  /** Gateway meter from the dispatching route — tier/reflink spend attribution. */
  meter?: (entry: {
    usageType: string;
    provider: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    metadata?: Record<string, unknown>;
  }) => Promise<unknown>;
  /** Retrieval seam (the BackendToolService content_search handler). */
  search: (query: string, uiState?: unknown) => Promise<ThinkHarderSearchItem[]>;
  /**
   * Full-content seam (the BackendToolService content_get handler): the top
   * search hits' ACTUAL prose, token-budgeted. Optional so legacy callers and
   * tests degrade to one-liner grounding rather than breaking.
   */
  fetch?: (ids: string[], maxTokens: number) => Promise<Array<{ id?: string; title?: string; content?: string }>>;
}

export interface ThinkHarderResult {
  success: boolean;
  /** Present on success — the deep answer for the voice model to narrate. */
  answer?: string;
  message: string;
  /** Which reasoning model actually answered ("provider/modelId"). */
  model?: string;
  /**
   * Observability (owner ask, 2026-07-17): what grounding the reasoning model
   * actually received — persisted with the tool row so "how much context did
   * we send?" is answerable from the transcript, not from trust. The FULL
   * grounding text is persisted separately as a `think_harder_escalation`
   * session marker (admin-only row — it must never re-enter the realtime
   * model's context through the tool result).
   */
  grounding?: {
    retrievalItems: number;
    fullTextItems: number;
    conversationTurns: number;
    groundingChars: number;
  };
}

const SYSTEM_PROMPT = `You are the deep-reasoning stage behind a spoken portfolio assistant. The fast realtime voice model escalated a question it could not answer at depth; your answer will be NARRATED to the visitor by that voice model.
- Reason carefully and go genuinely deeper than a summary: mechanisms, trade-offs, concrete examples and parallels.
- Ground claims in the provided portfolio evidence when it is relevant; say plainly when something is beyond what the portfolio shows.
- Write for the EAR: flowing prose the voice model can speak — no markdown, no headings, no bullet lists, no code blocks.
- Be substantive but bounded: roughly 150-300 spoken words.
Respond with ONLY a JSON object: {"answer": "..."}`;

/**
 * Run one escalation. Never throws for model-side failures — the returned
 * message tells the voice model honestly what happened so it can recover
 * (P1/P10: no answer beats a fabricated one).
 */
export async function runThinkHarder(params: ThinkHarderParams): Promise<ThinkHarderResult> {
  const question = (params.question ?? '').trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) {
    return { success: false, message: 'think_harder requires `question` — the full, self-contained question to reason about.' };
  }
  // Cost gate (defense-in-depth behind the public-allowlist exclusion).
  if (params.accessLevel === 'basic') {
    return {
      success: false,
      message: 'think_harder is not available at this access tier. Answer from what you have — content_search/content_get and your own reasoning.',
    };
  }

  // ---- Grounding ----
  let frame = '';
  try {
    frame = await assembleStartFrame();
  } catch (error) {
    console.warn('[think-harder] start frame failed (continuing):', error);
  }

  // Retrieval in two stages: a ranked search for WHICH sections matter, then
  // a token-budgeted fetch of the top hits' FULL prose. One-liners locate; a
  // deep answer needs the text itself.
  let retrieval = '';
  let retrievalItems = 0;
  let fullTextItems = 0;
  try {
    const items = await params.search(question, params.uiState);
    retrievalItems = Math.min(items.length, 8);
    let fullText = '';
    if (params.fetch) {
      const ids = items
        .slice(0, FETCH_TOP_IDS)
        .map((i) => i.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (ids.length) {
        try {
          const fetched = await params.fetch(ids, FETCH_TOKEN_BUDGET);
          fullTextItems = fetched.length;
          fullText = fetched
            .map((f) => `--- ${f.title ?? f.id ?? 'section'} ---\n${(f.content ?? '').trim()}`)
            .filter((t) => t.length > 20)
            .join('\n\n');
        } catch (error) {
          console.warn('[think-harder] full-text fetch failed (falling back to one-liners):', error);
        }
      }
    }
    const oneLiners = items
      .slice(0, 8)
      .map((i) => `- [${i.source?.label ?? i.project ?? 'portfolio'}] ${i.title ?? ''}: ${i.oneLiner ?? i.content ?? ''}`)
      .join('\n');
    retrieval = fullText ? `${oneLiners}\n\nFull text of the most relevant sections:\n\n${fullText}` : oneLiners;
  } catch (error) {
    console.warn('[think-harder] grounding search failed (continuing):', error);
  }

  let conversationTail = '';
  let conversationTurns = 0;
  try {
    const conversation = await conversationHistoryManager.getConversationRefBySessionId(params.sessionId);
    if (conversation) {
      const turns = await conversationHistoryManager.getTurnsSince(conversation.id, null, 200);
      const tail = turns.slice(-CONVERSATION_TAIL_TURNS);
      conversationTurns = tail.length;
      conversationTail = tail.map((t) => `${t.role}: ${t.content.slice(0, 400)}`).join('\n');
    }
  } catch (error) {
    console.warn('[think-harder] conversation tail read failed (continuing):', error);
  }

  const grounding = [
    frame ? `Portfolio grounding:\n${frame}` : '',
    retrieval ? `Relevant portfolio evidence for this question:\n${retrieval}` : '',
    conversationTail ? `Recent conversation (the visitor's context — answer INTO this thread):\n${conversationTail}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const groundingStats = {
    retrievalItems,
    fullTextItems,
    conversationTurns,
    groundingChars: grounding.length,
  };

  // ---- The escalation (Block M path; alias, never a model id) ----
  const outcome = await runSecondaryLLMJob({
    alias: 'default-reasoning',
    prompt: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${grounding}` },
      { role: 'user', content: `Escalated question:\n\n${question}` },
    ],
    schema: AnswerSchema,
    usageType: 'think_harder',
    feature: 'tools',
    temperature: 0.4,
    // Generous: reasoning-enabled models (Gemini 2.5, o-series) spend thinking
    // tokens INSIDE this budget — 1200 starved the answer after thought.
    maxOutputTokens: 4000,
    timeoutMs: TIMEOUT_MS,
    ...(params.meter
      ? {
          meter: (u: SecondaryLLMMeterInput) =>
            params.meter!({
              usageType: 'think_harder',
              provider: u.provider,
              modelId: u.modelId,
              inputTokens: u.inputTokens,
              outputTokens: u.outputTokens,
              metadata: { ok: u.ok, timedOut: u.timedOut },
            }),
        }
      : {}),
    metadata: { sessionId: params.sessionId },
  });

  const model = outcome.provider ? `${outcome.provider}/${outcome.modelId}` : undefined;
  const outcomeLabel = outcome.timedOut ? 'timed_out' : outcome.result ? 'ok' : 'unparseable';

  // Escalation record (owner ask 2026-07-17): WHICH model ran and the FULL
  // context it received, persisted as an admin-only session marker — the
  // replay viewer renders the grounding under a collapsible block. Never
  // rides the tool result (that would re-inject kilobytes into the realtime
  // model's context); never fatal.
  try {
    const conversation = await conversationHistoryManager.getConversationRefBySessionId(params.sessionId);
    if (conversation) {
      await conversationHistoryManager.recordSessionMarker(conversation.id, {
        type: 'think_harder_escalation',
        provider: outcome.provider ?? undefined,
        modelId: outcome.modelId ?? undefined,
        question,
        groundingText: grounding,
        groundingStats,
        usage: outcome.usage ?? undefined,
        outcome: outcomeLabel,
      });
    }
  } catch (error) {
    console.warn('[think-harder] escalation marker write failed (answer unaffected):', error);
  }

  if (outcome.timedOut) {
    return {
      success: false,
      message:
        'The deeper reasoning timed out. Tell the visitor honestly that the deep dive did not come back in time, and answer as well as you can from what you already know.',
      grounding: groundingStats,
    };
  }
  if (!outcome.result) {
    return {
      success: false,
      message:
        'The deeper reasoning failed to produce a usable answer. Answer as well as you can from what you already know — do not present a guess as the deep answer.',
      model,
      grounding: groundingStats,
    };
  }

  return {
    success: true,
    answer: outcome.result.answer,
    message:
      'Deep answer ready. Narrate it in your own voice, naturally — do not read it as a quotation or mention the escalation mechanics.',
    model,
    grounding: groundingStats,
  };
}
