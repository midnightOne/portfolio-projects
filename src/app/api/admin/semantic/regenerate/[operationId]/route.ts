/**
 * API Route: Get Regeneration Progress
 * GET /api/admin/semantic/regenerate/[operationId]
 * 
 * Returns real-time progress updates for a regeneration operation.
 * Supports both regular JSON responses and Server-Sent Events (SSE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { SelectiveSectionRegenerator } from '@/lib/content/SelectiveSectionRegenerator';
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
    // Check if this is a stage-based processing operation
    const processingService = getProcessingService();
    let stageProgress = processingService.getProgress(operationId);
    let isStageBasedOperation = !!stageProgress;
    let progress: any;

    if (isStageBasedOperation) {
      // Transform stage-based progress to regenerator format
      progress = transformStageProgressToRegeneratorFormat(stageProgress!);
    } else {
      // Use SelectiveSectionRegenerator progress as-is
      const regenerator = new SelectiveSectionRegenerator();
      progress = regenerator.getProgress(operationId);
    }

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
        // Send initial progress
        const data = `data: ${JSON.stringify(progress)}\n\n`;
        controller.enqueue(encoder.encode(data));

        if (isStageBasedOperation) {
          // Subscribe to stage-based processing updates
          processingService.subscribeToProgress(operationId, (updatedStageProgress) => {
            // Transform to regenerator format
            const transformedProgress = transformStageProgressToRegeneratorFormat(updatedStageProgress);
            const data = `data: ${JSON.stringify(transformedProgress)}\n\n`;
            controller.enqueue(encoder.encode(data));

            // Close stream when completed or failed
            if (updatedStageProgress.status === 'completed' || updatedStageProgress.status === 'failed') {
              controller.close();
            }
          });

          // Cleanup on client disconnect
          request.signal.addEventListener('abort', () => {
            controller.close();
          });
        } else {
          // Subscribe to SelectiveSectionRegenerator updates
          const regenerator = new SelectiveSectionRegenerator();
          regenerator.subscribeToProgress(operationId, (updatedProgress) => {
            const data = `data: ${JSON.stringify(updatedProgress)}\n\n`;
            controller.enqueue(encoder.encode(data));

            // Close stream when completed or failed
            if (updatedProgress.status === 'completed' || updatedProgress.status === 'failed') {
              controller.close();
              regenerator.unsubscribeFromProgress(operationId);
            }
          });

          // Cleanup on client disconnect
          request.signal.addEventListener('abort', () => {
            regenerator.unsubscribeFromProgress(operationId);
            controller.close();
          });
        }
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
