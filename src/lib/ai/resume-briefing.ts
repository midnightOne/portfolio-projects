/**
 * D49 resume briefing (ai-assistant 5b.3): the text block appended to a new
 * leg's system instructions when it continues an interrupted conversation.
 * Assembled in ONE place from ground truth (conversation store snapshot +
 * bounded recap) — provider-side memory from earlier legs is gone and never
 * assumed. Both native mint routes (OpenAI, ElevenLabs) and later the cascade
 * consume this same function; the D47 engine replaces its internals, not its
 * callers.
 */

import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';

export async function buildResumeBriefing(sessionId: string): Promise<string | null> {
  const briefing = await conversationHistoryManager.getResumeBriefing(sessionId);
  if (!briefing || briefing.recentTurns.length === 0) return null;

  const lines: string[] = [
    '',
    '',
    'SESSION RESUME (system): You are continuing a conversation that was interrupted' +
      (briefing.lastDisruption?.issueType ? ` (${briefing.lastDisruption.issueType})` : '') +
      ' and has just been re-established. The visitor is the same person.',
    'Do NOT greet them as if new and do NOT restart the conversation. Briefly acknowledge the reconnection in one short clause, then continue naturally from where things left off.',
    'Keep answering in the language the conversation was already using.',
    '',
    'Recent conversation (ground truth from the server log):',
  ];
  for (const turn of briefing.recentTurns) {
    lines.push(`${turn.role === 'user' ? 'Visitor' : 'You'}: ${turn.content}`);
  }
  if (briefing.snapshot?.modelAlias || briefing.snapshot?.provider) {
    lines.push(
      '',
      `(Previous leg ran on ${briefing.snapshot.provider ?? 'unknown provider'}${briefing.snapshot.modelAlias ? ` / ${briefing.snapshot.modelAlias}` : ''}; you may be a different model — that is fine, do not mention it.)`
    );
  }
  return lines.join('\n');
}
