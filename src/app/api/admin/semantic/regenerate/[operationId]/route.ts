/**
 * API Route: Get Regeneration Progress
 * GET /api/admin/semantic/regenerate/[operationId]
 *
 * Returns real-time progress updates for a regeneration operation.
 * Supports both regular JSON responses and Server-Sent Events (SSE).
 * Reconnecting clients re-read persisted state (durable operation row) —
 * SSE is a projection channel only (semantic-content Req 9.2).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSelectiveSectionRegenerator } from '@/lib/content/SelectiveSectionRegenerator';
import { getProcessingService } from '@/lib/content/StageBasedProcessingServiceSingleton';
import type { ProcessingProgress } from '@/lib/content/StageBasedProcessingService';

/**
 * Transform stage-based progress to regenerator format
 */
function transformStageProgressToRegeneratorFormat(stageProgress: ProcessingProgress): any {
  // Get current stage details for more accurate progress
  const currentStageKey = stageProgress.currentStage;
  const currentStageDetails = currentStageKey ? stageProgress.stageProgress[currentStageKey] : null;

  // Count completed stages
  const stageOrder: Array<keyof typeof stageProgress.stageProgress> = ['chunking', 'summaries', 'embeddings', 'validation'];
  const completedStages = stageOrder.filter(stage => stageProgress.stageProgress[stage].status === 'completed').length;
  const totalStages = stageOrder.filter(stage => stageProgress.stageProgress[stage].status !== 'skipped').length;

  return {
    operationId: stageProgress.operationId,
    status: stageProgress.status,
    currentSection: currentStageKey
      ? `Stage: ${currentStageKey} (${currentStageDetails?.itemsProcessed || 0}/${currentStageDetails?.totalItems || 0})`
      : 'Initializing',
    progress: {
      percentComplete: stageProgress.overallProgress,
      // Show stage progress instead of cumulative items
      sectionsProcessed: currentStageDetails?.itemsProcessed || 0,
      totalSections: currentStageDetails?.totalItems || 0,
      // Show completed stages vs total stages
      chunksProcessed: completedStages,
      tokensUsed: stageProgress.tokensUsed,
      costAccumulated: stageProgress.costAccumulated
    },
    errors: stageProgress.errors.map(e => e.error),
    estimatedTimeRemaining: null, // Not available in stage-based processing
    startedAt: stageProgress.startedAt,
    completedAt: stageProgress.completedAt,
    // Add stage-specific data for better display
    stageDetails: {
      currentStage: currentStageKey,
      completedStages,
      totalStages,
      stageProgress: currentStageKey ? {
        stage: currentStageKey,
        progress: currentStageDetails?.progress || 0,
        itemsProcessed: currentStageDetails?.itemsProcessed || 0,
        totalItems: currentStageDetails?.totalItems || 0
      } : null
    }
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> }
) {
  const { operationId } = await params;
  const { searchParams } = new URL(request.url);
  const useSSE = searchParams.get('sse') === 'true';

  try {
    // Check if this is a stage-based processing operation (durable fallback
    // included — reconnect after completion still resolves)
    const processingService = getProcessingService();
    const regenerator = getSelectiveSectionRegenerator();

    const stageProgress = operationId.startsWith('regen-')
      ? null
      : await processingService.getProgressOrPersisted(operationId);
    const isStageBasedOperation = !!stageProgress;
    const progress: any = isStageBasedOperation
      ? transformStageProgressToRegeneratorFormat(stageProgress!)
      : await regenerator.getProgressOrPersisted(operationId);

    if (!progress) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    // Regular JSON response
    if (!useSSE) {
      return NextResponse.json(progress);
    }

    // Server-Sent Events (SSE) response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        let unsubscribe: () => void = () => {};
        const safeClose = () => {
          if (closed) return;
          closed = true;
          unsubscribe();
          try { controller.close(); } catch { /* already closed */ }
        };

        // Send initial snapshot (persisted state on reconnect)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));

        // Already terminal: snapshot is the whole story
        if (progress.status === 'completed' || progress.status === 'failed') {
          safeClose();
          return;
        }

        if (isStageBasedOperation) {
          const onProgress = (updatedStageProgress: ProcessingProgress) => {
            if (closed) return;
            const transformedProgress = transformStageProgressToRegeneratorFormat(updatedStageProgress);
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(transformedProgress)}\n\n`));
            } catch {
              safeClose();
              return;
            }
            if (updatedStageProgress.status === 'completed' || updatedStageProgress.status === 'failed') {
              safeClose();
            }
          };
          unsubscribe = () => processingService.unsubscribeFromProgress(operationId, onProgress);
          processingService.subscribeToProgress(operationId, onProgress);
        } else {
          const onProgress = (updatedProgress: any) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(updatedProgress)}\n\n`));
            } catch {
              safeClose();
              return;
            }
            if (updatedProgress.status === 'completed' || updatedProgress.status === 'failed') {
              safeClose();
            }
          };
          unsubscribe = () => regenerator.unsubscribeFromProgress(operationId, onProgress);
          regenerator.subscribeToProgress(operationId, onProgress);
        }

        // Cleanup on client disconnect — removes only this client's callback
        request.signal.addEventListener('abort', safeClose);
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Error getting regeneration progress:', error);
    return NextResponse.json(
      {
        error: 'Failed to get regeneration progress',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
