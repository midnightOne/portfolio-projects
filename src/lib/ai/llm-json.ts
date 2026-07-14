/**
 * Defensive JSON extraction for JSON-forced LLM responses (Block M1).
 *
 * The ONE parsing posture every secondary-LLM job uses (P26 cheap call, J3
 * summarizer, G3 JD analysis, L2 safety investigation, M4/M5 suggestion
 * generators): strip code fences, tolerate surrounding prose, extract the
 * outermost object, validate with the caller's Zod schema, and return null on
 * anything unparseable — garbage output degrades the FEATURE, never the turn.
 *
 * Pure module: zod only, no host imports — engine-core modules (D48) and
 * host services share it alike.
 */

import type { z } from 'zod';

/**
 * Neutralize `"""` quote-frames inside text interpolated into a secondary-LLM
 * prompt (Req 19.8a): visitor/transcript text is wrapped in `"""…"""` frames,
 * so a triple-quote run inside it could close the frame and promote the rest
 * to instruction position. Each `"` in a run of 3+ gets a backslash — the
 * content stays readable evidence (NO stripping — Req 19.8 prohibits content
 * removal; the classifier must still see "ignore all instructions" verbatim),
 * but the frame can no longer be closed from inside.
 */
export function escapeQuoteFrames(text: string): string {
  return text.replace(/"{3,}/g, (run) => run.split('').map((q) => `\\${q}`).join(''));
}

/**
 * Extract and validate a single JSON object from raw model output.
 * Returns null when there is no parseable object or the schema rejects it.
 */
export function parseJsonWithSchema<Schema extends z.ZodTypeAny>(
  raw: string | null | undefined,
  schema: Schema
): z.infer<Schema> | null {
  if (!raw) return null;
  const stripped = raw.replace(/```(?:json)?/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
