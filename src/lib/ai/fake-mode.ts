/**
 * AI_FAKE_MODE (verification spec Req 3 / D46): selects deterministic test doubles
 * behind the real seams. Comma-separated subsystems: `reasoning`, `voice`, `embeddings`.
 * Refuses production — fakes must be impossible to ship.
 */

export type FakeSubsystem = 'reasoning' | 'voice' | 'embeddings';

export function isFakeMode(subsystem: FakeSubsystem): boolean {
  const raw = process.env.AI_FAKE_MODE;
  if (!raw) return false;
  const active = raw.split(',').map((s) => s.trim().toLowerCase()).includes(subsystem);
  if (active && process.env.NODE_ENV === 'production') {
    throw new Error(`AI_FAKE_MODE=${subsystem} is not allowed in production`);
  }
  return active;
}
