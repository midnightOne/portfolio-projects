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
 * Second-chance repair: escape raw control characters INSIDE string literals.
 * Gemini-family models routinely emit multi-paragraph answers with literal
 * newlines inside the JSON string (2026-07-17, think_harder drill), which
 * strict JSON.parse rejects. Context-aware — whitespace BETWEEN tokens
 * (pretty-printed JSON) is untouched, and already-escaped sequences pass
 * through unchanged. Only ever applied after a strict parse has failed.
 */
function repairControlCharsInStrings(candidate: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of candidate) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === '\\') {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
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
  const candidate = stripped.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    try {
      parsed = JSON.parse(repairControlCharsInStrings(candidate));
    } catch {
      return null;
    }
  }
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}
