/**
 * Mint-time instruction stash (ai-assistant task 7.0a(3)).
 *
 * The assembled voice-session instructions + tool schemas are deliberately
 * server-side only (D3) — the browser never sees them on the session
 * transport. The owner's context-debug panel still needs to show what a LIVE
 * session was actually minted with, so each mint route stashes its assembled
 * material here, keyed by the `session_…` tracking id its response returns to
 * the client; the admin-only endpoint /api/admin/ai/debug/context-mint reads
 * it back. Pure observability — nothing model-visible flows from here.
 *
 * In-memory on purpose (owner tool for local/dev test sessions, D46 drills);
 * same HMR-surviving global-singleton convention as prisma.ts. Serverless
 * caveat: entries are per-instance, so a deployed read must land on the
 * instance that minted — acceptable for a debug surface, documented at the
 * endpoint.
 */

import { estimateTokensFromChars } from '@/lib/ai/pricing';

export interface MintDebugSection {
  label: string;
  chars: number;
  tokens: number;
  text: string;
}

export interface MintDebugTool {
  name: string;
  chars: number;
  tokens: number;
}

export interface MintDebugEntry {
  sessionId: string;
  provider: 'openai' | 'google';
  handler: string;
  model: string;
  mintedAt: string;
  reflinkId: string | null;
  resumeSessionId: string | null;
  instructions: {
    totalChars: number;
    totalTokens: number;
    sections: MintDebugSection[];
  };
  tools: {
    count: number;
    totalChars: number;
    totalTokens: number;
    perTool: MintDebugTool[];
  };
}

/** Length checkpoint recorded after each `instructions +=` during assembly —
 *  the only reliable way to split the final string (no re-parsable delimiters). */
export interface MintSectionMark {
  label: string;
  end: number;
}

const MAX_ENTRIES = 20;

const globalForMintStash = globalThis as unknown as {
  __mintDebugStash: Map<string, MintDebugEntry> | undefined;
};
const stash = globalForMintStash.__mintDebugStash ?? new Map<string, MintDebugEntry>();
globalForMintStash.__mintDebugStash = stash;

function sectionsFromMarks(finalText: string, marks: MintSectionMark[]): MintDebugSection[] {
  const sections: MintDebugSection[] = [];
  let start = 0;
  for (const mark of marks) {
    const text = finalText.slice(start, mark.end);
    if (text.length > 0) {
      sections.push({
        label: mark.label,
        chars: text.length,
        tokens: estimateTokensFromChars(text.length),
        text,
      });
    }
    start = mark.end;
  }
  return sections;
}

function toolsBreakdown(tools: unknown[]): MintDebugEntry['tools'] {
  const perTool = tools.map((t) => {
    const chars = JSON.stringify(t)?.length ?? 0;
    const tool = t as { name?: string; function?: { name?: string } };
    return {
      name: tool?.name ?? tool?.function?.name ?? 'unknown',
      chars,
      tokens: estimateTokensFromChars(chars),
    };
  });
  const totalChars = perTool.reduce((sum, t) => sum + t.chars, 0);
  return {
    count: perTool.length,
    totalChars,
    totalTokens: estimateTokensFromChars(totalChars),
    perTool,
  };
}

/** Called by the mint routes right after assembly; never throws (observability
 *  must not fail a mint). */
export function stashMintDebug(input: {
  sessionId: string;
  provider: 'openai' | 'google';
  handler: string;
  model: string;
  reflinkId?: string | null;
  resumeSessionId?: string | null;
  instructionsText: string;
  marks: MintSectionMark[];
  tools: unknown[];
}): void {
  try {
    stash.set(input.sessionId, {
      sessionId: input.sessionId,
      provider: input.provider,
      handler: input.handler,
      model: input.model,
      mintedAt: new Date().toISOString(),
      reflinkId: input.reflinkId ?? null,
      resumeSessionId: input.resumeSessionId ?? null,
      instructions: {
        totalChars: input.instructionsText.length,
        totalTokens: estimateTokensFromChars(input.instructionsText.length),
        sections: sectionsFromMarks(input.instructionsText, input.marks),
      },
      tools: toolsBreakdown(input.tools),
    });
    while (stash.size > MAX_ENTRIES) {
      const oldest = stash.keys().next().value;
      if (oldest === undefined) break;
      stash.delete(oldest);
    }
  } catch (error) {
    console.warn('[mint-debug-stash] stash failed (observability only):', error);
  }
}

export function getMintDebug(sessionId: string): MintDebugEntry | null {
  return stash.get(sessionId) ?? null;
}

export function getLatestMintDebug(): MintDebugEntry | null {
  let latest: MintDebugEntry | null = null;
  for (const entry of stash.values()) latest = entry;
  return latest;
}

export function listMintDebug(): Array<
  Pick<MintDebugEntry, 'sessionId' | 'provider' | 'handler' | 'model' | 'mintedAt'> & {
    totalChars: number;
    totalTokens: number;
  }
> {
  return Array.from(stash.values())
    .map((e) => ({
      sessionId: e.sessionId,
      provider: e.provider,
      handler: e.handler,
      model: e.model,
      mintedAt: e.mintedAt,
      totalChars: e.instructions.totalChars + e.tools.totalChars,
      totalTokens: e.instructions.totalTokens + e.tools.totalTokens,
    }))
    .reverse();
}
