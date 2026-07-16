/**
 * Durable store for stage-based processing operations (semantic-content Req 9.2, task 6.3).
 *
 * The `semantic_processing_operations` row IS the operation state machine:
 * every stage and terminal transition is written here BEFORE any SSE
 * notification, so queue/history panels and reconnecting clients read
 * persisted truth instead of process-local state (design §7, D43).
 *
 * Stage checkpoints (chunk payloads, embeddings) are deliberately NOT
 * persisted — they can be megabytes; the row carries status, progress
 * counts, errors, and per-project outcomes only.
 */

import { prisma } from '@/lib/database/connection';
import type {
  ProcessingProgress,
  ProcessingRequest,
  ProcessingStage,
} from './StageBasedProcessingService';

// Immutable per-project outcome aggregated on a scope:'all' parent (task 6.2)
export interface ChildOutcome {
  operationId: string;
  projectId: string;
  projectSlug?: string;
  projectTitle?: string;
  status: 'completed' | 'failed';
  chunksCreated: number;
  summariesGenerated: number;
  embeddingsGenerated: number;
  costAccumulated: number;
  error?: string;
  completedAt: string;
}

/** stageProgress with checkpoints stripped — safe to persist as JSON. */
function compactStageProgress(progress: ProcessingProgress) {
  const compact: Record<string, unknown> = {};
  for (const [stage, sp] of Object.entries(progress.stageProgress)) {
    compact[stage] = {
      status: sp.status,
      progress: sp.progress,
      itemsProcessed: sp.itemsProcessed,
      totalItems: sp.totalItems,
      errors: sp.errors,
      startedAt: sp.startedAt ?? null,
      completedAt: sp.completedAt ?? null,
    };
  }
  return compact;
}

function progressFields(progress: ProcessingProgress) {
  return {
    status: progress.status,
    currentStage: progress.currentStage,
    stageProgress: compactStageProgress(progress) as object,
    overallProgress: progress.overallProgress,
    totalItems: progress.totalItems,
    itemsProcessed: progress.totalItemsProcessed,
    costAccumulated: progress.costAccumulated,
    tokensUsed: progress.tokensUsed,
    error: progress.errors.length > 0 ? progress.errors[progress.errors.length - 1].error : null,
    errors: JSON.parse(JSON.stringify(progress.errors)) as object,
    canResume: progress.canResume,
    nextStage: progress.nextStage ?? null,
    lastUpdatedAt: new Date(),
    completedAt: progress.completedAt ?? null,
  };
}

export class ProcessingOperationStore {
  // Throttle non-transition writes so per-item progress doesn't hammer the DB
  private lastWriteAt = new Map<string, number>();
  private static readonly WRITE_INTERVAL_MS = 800;

  async createOperation(
    request: ProcessingRequest,
    progress: ProcessingProgress,
    opts: { parentId?: string; type?: string } = {}
  ): Promise<void> {
    await prisma.semanticProcessingOperation.upsert({
      where: { id: request.operationId },
      create: {
        id: request.operationId,
        parentId: opts.parentId ?? null,
        scope: request.scope,
        projectId: request.projectId ?? null,
        sectionId: request.sectionId ?? null,
        sourceId: request.sourceId ?? null,
        type: opts.type ?? 'full',
        stages: JSON.parse(JSON.stringify(request.stages)) as object,
        startedAt: progress.startedAt,
        ...progressFields(progress),
      },
      update: {
        stages: JSON.parse(JSON.stringify(request.stages)) as object,
        ...progressFields(progress),
      },
    });
    this.lastWriteAt.set(request.operationId, Date.now());
  }

  /**
   * Persist current progress. `force` (stage/terminal transitions) always
   * writes; otherwise writes are throttled. Failures are logged, never thrown —
   * a telemetry write must not kill the pipeline (the force path re-throws
   * only for terminal transitions where losing the write would strand the row).
   */
  async persistProgress(
    operationId: string,
    progress: ProcessingProgress,
    opts: { force?: boolean } = {}
  ): Promise<void> {
    const now = Date.now();
    if (!opts.force) {
      const last = this.lastWriteAt.get(operationId) ?? 0;
      if (now - last < ProcessingOperationStore.WRITE_INTERVAL_MS) return;
    }
    this.lastWriteAt.set(operationId, now);
    try {
      await prisma.semanticProcessingOperation.update({
        where: { id: operationId },
        data: progressFields(progress),
      });
    } catch (error) {
      console.error(`[ProcessingOperationStore] Failed to persist ${operationId}:`, error);
      if (opts.force) throw error;
    }
  }

  /** Append one immutable per-project outcome to a scope:'all' parent (task 6.2). */
  async appendChildOutcome(parentId: string, outcome: ChildOutcome): Promise<void> {
    const row = await prisma.semanticProcessingOperation.findUnique({
      where: { id: parentId },
      select: { childOutcomes: true },
    });
    const outcomes = Array.isArray(row?.childOutcomes) ? (row!.childOutcomes as unknown[]) : [];
    outcomes.push(JSON.parse(JSON.stringify(outcome)));
    await prisma.semanticProcessingOperation.update({
      where: { id: parentId },
      data: { childOutcomes: outcomes as object, lastUpdatedAt: new Date() },
    });
  }

  async getOperation(operationId: string) {
    return prisma.semanticProcessingOperation.findUnique({ where: { id: operationId } });
  }

  async listOperations(opts: { projectId?: string; includeChildren?: boolean; limit?: number } = {}) {
    return prisma.semanticProcessingOperation.findMany({
      where: {
        ...(opts.projectId ? { projectId: opts.projectId } : {}),
        ...(opts.includeChildren === false ? { parentId: null } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  async deleteOperation(operationId: string): Promise<boolean> {
    const result = await prisma.semanticProcessingOperation.deleteMany({
      where: { OR: [{ id: operationId }, { parentId: operationId }] },
    });
    return result.count > 0;
  }

  /**
   * Reconstruct a ProcessingProgress from the durable row (checkpoint-less).
   * Used when the in-memory operation is gone: another instance, a restart,
   * or post-completion cleanup. Field-compatible with the SSE snapshot.
   */
  toProcessingProgress(row: NonNullable<Awaited<ReturnType<ProcessingOperationStore['getOperation']>>>): ProcessingProgress {
    const stageNames: ProcessingStage[] = ['chunking', 'summaries', 'embeddings', 'validation'];
    const persisted = (row.stageProgress ?? {}) as Record<string, any>;
    const stageProgress = {} as ProcessingProgress['stageProgress'];
    for (const stage of stageNames) {
      const sp = persisted[stage] ?? {};
      stageProgress[stage] = {
        status: sp.status ?? 'pending',
        progress: sp.progress ?? 0,
        itemsProcessed: sp.itemsProcessed ?? 0,
        totalItems: sp.totalItems ?? 0,
        errors: Array.isArray(sp.errors) ? sp.errors : [],
        startedAt: sp.startedAt ? new Date(sp.startedAt) : undefined,
        completedAt: sp.completedAt ? new Date(sp.completedAt) : undefined,
      };
    }
    return {
      operationId: row.id,
      status: row.status as ProcessingProgress['status'],
      currentStage: (row.currentStage as ProcessingStage | null) ?? null,
      stageProgress,
      overallProgress: row.overallProgress,
      totalItemsProcessed: row.itemsProcessed,
      totalItems: row.totalItems,
      costAccumulated: Number(row.costAccumulated),
      tokensUsed: row.tokensUsed,
      startedAt: row.startedAt,
      lastUpdatedAt: row.lastUpdatedAt,
      completedAt: row.completedAt ?? undefined,
      errors: Array.isArray(row.errors)
        ? (row.errors as any[]).map(e => ({ ...e, timestamp: new Date(e.timestamp) }))
        : [],
      canResume: row.canResume,
      nextStage: (row.nextStage as ProcessingStage | null) ?? undefined,
    };
  }
}

// Singleton (global — survives Next.js dev hot reloads, D43-safe: holds no
// correctness-bearing state, only the write-throttle map)
const globalForOpStore = global as typeof globalThis & {
  processingOperationStore?: ProcessingOperationStore;
};

export function getProcessingOperationStore(): ProcessingOperationStore {
  if (!globalForOpStore.processingOperationStore) {
    globalForOpStore.processingOperationStore = new ProcessingOperationStore();
  }
  return globalForOpStore.processingOperationStore;
}
