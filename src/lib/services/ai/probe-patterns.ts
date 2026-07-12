/**
 * v1 probe patterns (Req 18.2 "pattern + classifier"). Conservative, injected
 * into the engine core as config (D48 — never hardcoded there); owner-tunable
 * lists arrive with the safety module / graph authoring.
 *
 * Own module (Block F2) so every injection site shares ONE list: the runtime
 * evaluator (engine-runtime), the scenario route/editor (scenario-store), and
 * the `check:scenarios` CLI — which must import it without dragging the full
 * app graph behind engine-runtime into a tsx process.
 */
export const DEFAULT_PROBE_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|your\s+|previous\s+|the\s+)?(instructions|rules|prompts?)/i,
  /system\s+prompt/i,
  /\bjailbreak\b/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /you\s+are\s+now\s+(a|an|in)\b/i,
];
