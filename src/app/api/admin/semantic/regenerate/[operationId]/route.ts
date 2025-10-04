/**
 * API Route: Get Regeneration Progress
 * GET /api/admin/semantic/regenerate/[operationId]
 * 
 * Returns real-time progress updates for a regeneration operation.
 * Supports both regular JSON responses and Server-Sent Events (SSE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { SelectiveSectionRegenerator } from '@/lib/content/SelectiveSectionRegenerator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> }
) {
  const { operationId } = await params;
  const { searchParams } = new URL(request.url);
  const useSSE = searchParams.get('sse') === 'true';

  try {
    const regenerator = new SelectiveSectionRegenerator();
    const progress = regenerator.getProgress(operationId);

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

        // Subscribe to progress updates
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
