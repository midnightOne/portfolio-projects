/**
 * Progress Tracker - Real-time progress tracking for bulk operations
 */

import { BulkOperationProgress, BulkEditOperation } from './types';

export interface ProgressSubscription {
  operationId: string;
  callback: (progress: BulkOperationProgress) => void;
  lastUpdate: Date;
}

export class ProgressTracker {
  private subscriptions: Map<string, ProgressSubscription[]> = new Map();
  private progressCache: Map<string, BulkOperationProgress> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private isTracking = false;

  constructor(private updateIntervalMs: number = 1000) {}

  /**
   * Subscribe to progress updates for an operation
   */
  subscribe(
    operationId: string, 
    callback: (progress: BulkOperationProgress) => void
  ): () => void {
    const subscription: ProgressSubscription = {
      operationId,
      callback,
      lastUpdate: new Date()
    };

    const existing = this.subscriptions.get(operationId) || [];
    existing.push(subscription);
    this.subscriptions.set(operationId, existing);

    // Start tracking if this is the first subscription
    if (!this.isTracking) {
      this.startTracking();
    }

    // Send current progress immediately if available
    const cachedProgress = this.progressCache.get(operationId);
    if (cachedProgress) {
      callback(cachedProgress);
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(operationId) || [];
      const index = subs.indexOf(subscription);
      if (index > -1) {
        subs.splice(index, 1);
        if (subs.length === 0) {
          this.subscriptions.delete(operationId);
        } else {
          this.subscriptions.set(operationId, subs);
        }
      }

      // Stop tracking if no more subscriptions
      if (this.subscriptions.size === 0) {
        this.stopTracking();
      }
    };
  }

  /**
   * Update progress for an operation
   */
  updateProgress(progress: BulkOperationProgress): void {
    this.progressCache.set(progress.operationId, progress);
    
    const subscriptions = this.subscriptions.get(progress.operationId) || [];
    subscriptions.forEach(sub => {
      try {
        sub.callback(progress);
        sub.lastUpdate = new Date();
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  /**
   * Get cached progress for an operation
   */
  getProgress(operationId: string): BulkOperationProgress | null {
    return this.progressCache.get(operationId) || null;
  }

  /**
   * Remove progress data for completed operations
   */
  cleanup(operationId: string): void {
    this.progressCache.delete(operationId);
    this.subscriptions.delete(operationId);
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get subscription count for an operation
   */
  getSubscriptionCount(operationId: string): number {
    return this.subscriptions.get(operationId)?.length || 0;
  }

  private startTracking(): void {
    if (this.isTracking) {
      return;
    }

    this.isTracking = true;
    this.updateInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.updateIntervalMs);
  }

  private stopTracking(): void {
    if (!this.isTracking) {
      return;
    }

    this.isTracking = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private checkForUpdates(): void {
    // This would typically poll the database or service for updates
    // For now, we'll just clean up old cached progress
    const now = new Date();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    const progressEntries = Array.from(this.progressCache.entries());
    for (const [operationId, progress] of progressEntries) {
      const age = now.getTime() - progress.lastUpdate.getTime();
      
      // Clean up old progress for completed operations
      if (age > maxAge && (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled')) {
        this.cleanup(operationId);
      }
    }
  }
}

// Singleton instance
export const progressTracker = new ProgressTracker();

/**
 * Utility function to create a React hook for subscribing to bulk operation progress
 * This should be implemented in a React component file with proper React imports
 * 
 * Example usage:
 * ```typescript
 * import { useState, useEffect } from 'react';
 * import { progressTracker } from './progress-tracker';
 * 
 * export function useBulkOperationProgress(operationId: string | null) {
 *   const [progress, setProgress] = useState<BulkOperationProgress | null>(null);
 *   const [isSubscribed, setIsSubscribed] = useState(false);
 * 
 *   useEffect(() => {
 *     if (!operationId) {
 *       setProgress(null);
 *       setIsSubscribed(false);
 *       return;
 *     }
 * 
 *     setIsSubscribed(true);
 *     
 *     const unsubscribe = progressTracker.subscribe(operationId, (newProgress) => {
 *       setProgress(newProgress);
 *     });
 * 
 *     return () => {
 *       unsubscribe();
 *       setIsSubscribed(false);
 *     };
 *   }, [operationId]);
 * 
 *   return {
 *     progress,
 *     isSubscribed,
 *     isActive: progress?.status === 'in_progress',
 *     isCompleted: progress?.status === 'completed',
 *     isFailed: progress?.status === 'failed',
 *     isCancelled: progress?.status === 'cancelled'
 *   };
 * }
 * ```
 */
export const createBulkOperationProgressHook = () => {
  // This is a factory function that can be used to create the hook
  // when React imports are available
  return progressTracker;
};