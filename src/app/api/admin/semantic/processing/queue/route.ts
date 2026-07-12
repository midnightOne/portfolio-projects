/**
 * API Route: Processing Job Queue
 * GET /api/admin/semantic/processing/queue
 *
 * Read-only projection of the durable operation table
 * (`semantic_processing_operations`). Status comes from persisted rows —
 * never from SSE subscriptions or process-local state (semantic-content
 * Req 9.2, task 6.3): a job completed with no subscriber attached still
 * reads `completed` here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { getProcessingService } from '@/lib/content/StageBasedProcessingServiceSingleton';
import { getProcessingOperationStore } from '@/lib/content/ProcessingOperationStore';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const includeChildren = searchParams.get('includeChildren') === 'true';

    const store = getProcessingOperationStore();
    const processingService = getProcessingService();

    const rows = await store.listOperations({
      projectId: projectId ?? undefined,
      // scope:'all' children are surfaced per project or on request; the
      // default queue view shows top-level operations
      includeChildren: includeChildren || !!projectId,
    });

    const jobs = rows.map(row => {
      // Live in-memory progress (with per-item detail) when this instance is
      // running the operation; otherwise the persisted projection
      const liveProgress = processingService.getProgress(row.id);
      const progress = liveProgress ?? store.toProcessingProgress(row);
      const stages = Array.isArray(row.stages)
        ? (row.stages as any[]).filter(s => s?.enabled !== false).map(s => s?.stage ?? s)
        : [];
      return {
        operationId: row.id,
        parentId: row.parentId,
        projectId: row.projectId,
        scope: row.scope,
        type: row.type,
        status: row.status,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        stages,
        estimatedDuration: stages.length >= 4 ? '~2-3 minutes' : stages.length >= 2 ? '~1 minute' : '~30 seconds',
        childOutcomes: row.childOutcomes ?? undefined,
        error: row.error ?? undefined,
        progress,
      };
    });

    return NextResponse.json({
      jobs,
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'in_progress').length,
      queuedJobs: jobs.filter(j => j.status === 'queued').length
    });

  } catch (error) {
    console.error('Error fetching job queue:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch job queue',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/semantic/processing/queue
 *
 * Remove an operation (and its scope:'all' children) from the durable history
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get('operationId');

    if (!operationId) {
      return NextResponse.json(
        { error: 'Missing operationId parameter' },
        { status: 400 }
      );
    }

    const store = getProcessingOperationStore();
    const removed = await store.deleteOperation(operationId);

    if (!removed) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Operation removed from history'
    });

  } catch (error) {
    console.error('Error removing operation:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove operation',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
