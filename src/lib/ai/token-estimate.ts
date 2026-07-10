/**
 * Client-safe token estimator (extracted from pricing.ts for Block D).
 *
 * The graph editor's live token meter must use the SAME estimator as runtime
 * context assembly (conversation-engine notes §6 — "import, don't duplicate"),
 * but pricing.ts imports Prisma and cannot enter a client bundle. This module
 * has zero imports; pricing.ts re-exports it so existing server importers are
 * untouched.
 */

/** Rough pre-flight token estimate (chars/4). Never for ledger writes — provider usage wins. */
export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}
