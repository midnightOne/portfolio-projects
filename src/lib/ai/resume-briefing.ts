/**
 * D49 resume briefing (ai-assistant 5b.3): the text block appended to a new
 * leg's system instructions when it continues an interrupted conversation.
 * Assembled in ONE place from ground truth (conversation store snapshot +
 * bounded recap) — provider-side memory from earlier legs is gone and never
 * assumed. Both native mint routes (OpenAI, ElevenLabs) and later the cascade
 * consume this same function; the D47 engine replaces its internals, not its
 * callers.
 *
 * Block I3 (Req 17.3): when a running conversation summary exists (the ONE
 * Req 20.5 artifact), the briefing is `summary + a short verbatim tail`; with
 * no summary yet it stays the full-recap briefing (P24 ladder — a resume is
 * never blocked on generating a summary inline). Returning-visitor resumes
 * ride this same path (Req 17.1 — "the D49 resume path with a third trigger");
 * the recall tone rule (unceremonious, no fanfare — Req 17.4) is stated in the
 * briefing itself.
 */

import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

export interface ResumeBriefingInput {
  recentTurns: Array<{ role: string; content: string }>;
  lastDisruption?: { issueType?: string };
  snapshot?: { provider?: string; modelAlias?: string } | null;
  summary?: { text: string; version: number } | null;
  /**
   * 7.11 (owner ruling 2026-07-13): resume #1 in a conversation may
   * acknowledge briefly; every LATER resume reconnects silently — by resume
   * #2 the model has used its "we're back" line, and forced speech on a
   * disruption loop produced the `cmrjljvfm…` ghost continuation. The
   * adapter suppresses its auto `response.create` for these legs; this flag
   * makes the briefing match.
   */
  silent?: boolean;
}

/** Pure renderer (unit-tested): input → briefing text, or null when there is nothing to brief. */
export function renderResumeBriefing(briefing: ResumeBriefingInput): string | null {
  if (briefing.recentTurns.length === 0 && !briefing.summary) return null;

  const lines: string[] = [
    '',
    '',
    'SESSION RESUME (system): You are continuing a conversation that was interrupted' +
      (briefing.lastDisruption?.issueType ? ` (${briefing.lastDisruption.issueType})` : '') +
      ' and has just been re-established. The visitor is the same person.',
    briefing.silent
      ? 'This connection has already been re-established at least once before. Do not speak until the visitor does — no greeting, no reconnection acknowledgement, no picking up your last thread unprompted. The visitor heard a reconnect cue already; when they speak, continue naturally from where things left off.'
      : 'Do NOT greet them as if new and do NOT restart the conversation. Briefly acknowledge the reconnection in one short clause, then continue naturally from where things left off.',
    'If you reference earlier context, do it unceremoniously and honestly ("last time you were looking at X") — no reintroduction fanfare.',
    'Keep answering in the language the conversation was already using.',
  ];
  if (briefing.summary) {
    lines.push('', `Conversation so far (running summary v${briefing.summary.version}, ground truth from the server log):`, briefing.summary.text);
  }
  if (briefing.recentTurns.length > 0) {
    lines.push('', briefing.summary ? 'Most recent turns verbatim:' : 'Recent conversation (ground truth from the server log):');
    for (const turn of briefing.recentTurns) {
      lines.push(`${turn.role === 'user' ? 'Visitor' : 'You'}: ${turn.content}`);
    }
  }
  if (briefing.snapshot?.modelAlias || briefing.snapshot?.provider) {
    lines.push(
      '',
      `(Previous leg ran on ${briefing.snapshot.provider ?? 'unknown provider'}${briefing.snapshot.modelAlias ? ` / ${briefing.snapshot.modelAlias}` : ''}; you may be a different model — that is fine, do not mention it.)`
    );
  }
  return lines.join('\n');
}

export async function buildResumeBriefing(
  sessionId: string,
  opts?: { silent?: boolean }
): Promise<string | null> {
  const briefing = await conversationHistoryManager.getResumeBriefing(sessionId);
  if (!briefing) return null;
  return renderResumeBriefing({ ...briefing, silent: opts?.silent });
}
