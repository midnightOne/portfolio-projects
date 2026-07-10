/**
 * GraphSource — how the engine core obtains graph documents (notes §1).
 *
 * Interface ONLY: no Prisma import here (D48). The Prisma-backed
 * implementation lives in src/lib/services/ai/graph-store.ts and is handed to
 * the engine from outside core — the phone-agent litmus (design §7) holds by
 * construction.
 */

import type { GraphDocument } from './types';

export interface ActiveGraphRef {
  graphId: string;
  versionId: string;
  document: GraphDocument;
}

export interface GraphSource {
  /**
   * The single active graph (exactly one or none — no multi-graph routing,
   * notes §8). Resolved fresh per call; implementations may cache the
   * immutable version DOCUMENT but never the active pointer (D43).
   */
  getActiveGraph(): Promise<ActiveGraphRef | null>;

  /**
   * A specific immutable version (conversations pin their version at start —
   * P6; later turns never re-resolve the active pointer).
   */
  getVersion(versionId: string): Promise<GraphDocument | null>;
}
