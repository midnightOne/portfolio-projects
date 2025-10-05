/**
 * API Route: Processing Job Queue
 * GET /api/admin/semantic/processing/queue
 * 
 * Returns the current processing job queue with optional project filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { getProcessingService } from '@/lib/content/StageBasedProcessingServiceSingleton';
import { getJobQueueManager, QueuedJob } from '@/lib/content/JobQueueManager';

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

    // Get job queue manager and processing service
    const queueManager = getJobQueueManager();
    const processingService = getProcessingService();
    
    // Filter jobs by project if specified
    let jobs = projectId 
      ? queueManager.getJobsByProject(projectId)
      : queueManager.getAllJobs();

    // Enrich jobs with current progress from processing service
    const enrichedJobs = jobs.map(job => {
      const progress = processingService.getProgress(job.operationId);
      const updatedJob = {
        ...job,
        progress,
        // Update status from progress if available
        status: progress?.status || job.status
      };
      
      // Update job status in queue if we have progress
      if (progress && progress.status !== job.status) {
        queueManager.updateJobStatus(job.operationId, progress.status as QueuedJob['status']);
      }
      
      return updatedJob;
    });

    return NextResponse.json({
      jobs: enrichedJobs,
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
 * POST /api/admin/semantic/processing/queue
 * 
 * Add a job to the queue (called internally by processing service)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      operationId, 
      projectId, 
      type, 
      stages, 
      estimatedDuration 
    } = body;

    if (!operationId || !type || !stages) {
      return NextResponse.json(
        { error: 'Missing required fields: operationId, type, stages' },
        { status: 400 }
      );
    }

    // Add job to queue
    const job: QueuedJob = {
      operationId,
      projectId,
      type,
      status: 'queued' as const,
      startedAt: new Date(),
      estimatedDuration: estimatedDuration || '~1 minute',
      stages
    };

    const queueManager = getJobQueueManager();
    queueManager.addJob(job);

    return NextResponse.json({
      message: 'Job added to queue',
      job
    });

  } catch (error) {
    console.error('Error adding job to queue:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add job to queue',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/semantic/processing/queue
 * 
 * Remove a job from the queue
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

    // Remove job from queue
    const queueManager = getJobQueueManager();
    const removed = queueManager.removeJob(operationId);

    if (!removed) {
      return NextResponse.json(
        { error: 'Job not found in queue' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Job removed from queue'
    });

  } catch (error) {
    console.error('Error removing job from queue:', error);
    return NextResponse.json(
      { 
        error: 'Failed to remove job from queue',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}