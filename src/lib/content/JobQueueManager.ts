/**
 * Job Queue Manager - Singleton
 * 
 * Centralized job queue for tracking processing operations across API routes.
 */

export interface QueuedJob {
  operationId: string;
  projectId?: string;
  type: 'full' | 'chunking' | 'summaries' | 'embeddings' | 'validation';
  status: 'queued' | 'in_progress' | 'paused' | 'completed' | 'failed';
  startedAt: Date;
  estimatedDuration: string;
  stages: string[];
}

class JobQueueManager {
  private queue: Map<string, QueuedJob> = new Map();

  addJob(job: QueuedJob): void {
    this.queue.set(job.operationId, job);
  }

  getJob(operationId: string): QueuedJob | undefined {
    return this.queue.get(operationId);
  }

  getAllJobs(): QueuedJob[] {
    return Array.from(this.queue.values());
  }

  getJobsByProject(projectId: string): QueuedJob[] {
    return Array.from(this.queue.values()).filter(
      job => job.projectId === projectId
    );
  }

  removeJob(operationId: string): boolean {
    return this.queue.delete(operationId);
  }

  updateJobStatus(operationId: string, status: QueuedJob['status']): void {
    const job = this.queue.get(operationId);
    if (job) {
      job.status = status;
      this.queue.set(operationId, job);
    }
  }
}

// Singleton instance using global to persist across Next.js hot reloads
const globalForQueueManager = global as typeof globalThis & {
  queueManagerInstance?: JobQueueManager;
};

export function getJobQueueManager(): JobQueueManager {
  if (!globalForQueueManager.queueManagerInstance) {
    console.log('[JobQueueManager] Creating new instance');
    globalForQueueManager.queueManagerInstance = new JobQueueManager();
  } else {
    console.log('[JobQueueManager] Reusing existing instance');
  }
  return globalForQueueManager.queueManagerInstance;
}

export default getJobQueueManager;
