/**
 * Safety tripwire — static word-flag scan (Req 22.1, task L1).
 *
 * Pure in-process string matching: no LLM, no network, no DB (P33). The design
 * is CHEAP TRIGGER, not judge: normalization is deliberately conservative —
 * case-fold + word boundaries, nothing else. No fuzzy matching, no leetspeak
 * decoding, no stemming (P34): voice transcripts false-positive by nature
 * ("bomb" in "photo bomb") and the architecture absorbs that, because the
 * static scan never enforces anything — enforcement flows only from the LLM
 * investigation's verdict (investigation.ts), whose whole job is telling the
 * innocent context from the threat. Word lists are owner-tuned data
 * (SafetyConfig.wordLists), never code.
 *
 * Core module (D48): no imports from src/app/** or host services.
 */

/** Owner-configured word lists by category: { "violence": ["bomb", ...], ... } */
export type SafetyWordLists = Record<string, string[]>;

export interface SafetyFlag {
  category: string;
  /** The matched list entry (normalized lower-case). */
  word: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary matcher: the entry must not be flanked by letters/digits, so
 * "ass" never fires inside "class" — but "bomb" DOES fire inside "photo bomb"
 * (a phrase context, not a substring), which is the accepted-by-design false
 * positive P34 describes. Entries may be multi-word phrases; internal
 * whitespace matches any whitespace run.
 */
function buildMatcher(word: string): RegExp | null {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return null;
  const body = escapeRegExp(normalized).replace(/\s+/g, '\\s+');
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'u');
  } catch {
    return null; // a malformed entry degrades that one word, never the scan
  }
}

/**
 * Compiled matchers are cached per wordLists OBJECT — the host's config
 * accessor memoizes the config for ~30s, so the same object flows through
 * every scan in that window and compilation happens once per config refresh.
 */
const matcherCache = new WeakMap<SafetyWordLists, Array<{ category: string; word: string; re: RegExp }>>();

function compiledMatchers(wordLists: SafetyWordLists): Array<{ category: string; word: string; re: RegExp }> {
  const cached = matcherCache.get(wordLists);
  if (cached) return cached;
  const matchers: Array<{ category: string; word: string; re: RegExp }> = [];
  for (const [category, words] of Object.entries(wordLists)) {
    if (!Array.isArray(words)) continue;
    for (const word of words) {
      if (typeof word !== 'string') continue;
      const re = buildMatcher(word);
      if (re) matchers.push({ category, word: word.trim().toLowerCase(), re });
    }
  }
  matcherCache.set(wordLists, matchers);
  return matchers;
}

/**
 * Scan one transcript text against the configured word lists. Returns every
 * (category, word) pair that matched — deduplicated, order = config order.
 * Empty input or empty lists → no flags, near-zero cost.
 */
export function scanText(text: string, wordLists: SafetyWordLists): SafetyFlag[] {
  if (!text || typeof text !== 'string') return [];
  const matchers = compiledMatchers(wordLists);
  if (matchers.length === 0) return [];
  const lower = text.toLowerCase();
  const flags: SafetyFlag[] = [];
  for (const m of matchers) {
    if (m.re.test(lower)) flags.push({ category: m.category, word: m.word });
  }
  return flags;
}
