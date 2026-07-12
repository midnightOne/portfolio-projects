/**
 * API Route: Stage-Based Processing Progress
 * GET /api/admin/semantic/processing/[operationId]
 * 
 * Returns real-time progress updates for stage-based processing operations.
 * Supports both regular JSON responses and Server-Sent Events (SSE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { getProcessingService } from '@/lib/content/StageBasedProcessingServiceSingleton';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> }
) {
  const { operationId } = await params;
  const { searchParams } = new URL(request.url);
  const useSSE = searchParams.get('sse') === 'true';

  try {
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const processingService = getProcessingService();
    // Durable-state fallback (task 6.3): reconnecting clients re-read
    // persisted state — a completed/failed operation stays reachable after
    // the in-memory projection is cleaned up or the process restarted
    const progress = await processingService.getProgressOrPersisted(operationId);

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

    // Server-Sent Events (SSE) response — a read/projection channel only:
    // subscribing/disconnecting never causes a status transition (Req 9.2)
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        const safeClose = () => {
          if (closed) return;
          closed = true;
          processingService.unsubscribeFromProgress(operationId, onProgress);
          try { controller.close(); } catch { /* already closed */ }
        };

        const onProgress = (updatedProgress: typeof progress) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(updatedProgress)}\n\n`));
          } catch {
            safeClose();
            return;
          }
          // Close stream when completed or failed
          if (updatedProgress.status === 'completed' || updatedProgress.status === 'failed') {
            safeClose();
          }
        };

        // Send initial snapshot (persisted state on reconnect)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));

        // Already terminal (e.g. reconnect after completion): snapshot is the
        // whole story — close immediately
        if (progress.status === 'completed' || progress.status === 'failed') {
          safeClose();
          return;
        }

        // Subscribe to live progress updates (multi-subscriber safe)
        processingService.subscribeToProgress(operationId, onProgress);

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
    console.error('Error getting processing progress:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get processing progress',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/semantic/processing/[operationId]
 * 
 * Control processing operations (pause, resume, cancel)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> }
) {
  const { operationId } = await params;

  try {
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const processingService = getProcessingService();
    const body = await request.json();
    const { action, resumeFromStage } = body;

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: pause, resume, or cancel' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'pause':
        await processingService.pauseProcessing(operationId);
        return NextResponse.json({ message: 'Processing paused successfully' });

      case 'resume':
        await processingService.resumeProcessing(operationId, resumeFromStage);
        return NextResponse.json({ message: 'Processing resumed successfully' });

      case 'cancel':
        await processingService.cancelProcessing(operationId);
        return NextResponse.json({ message: 'Processing cancelled successfully' });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error controlling processing operation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to control processing operation',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}