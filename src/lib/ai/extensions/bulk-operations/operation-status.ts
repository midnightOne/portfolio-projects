/**
 * Operation Status Tracker - Centralized status management for bulk operations
 */

import { BulkEditOperation, BulkOperationStats } from './types';

export interface OperationStatusUpdate {
  operationId: string;
  status: BulkEditOperation['status'];
  progress?: Partial<BulkEditOperation['progress']>;
  results?: Partial<BulkEditOperation['results']>;
  error?: string;
  timestamp: Date;
}

export interface OperationMetrics {
  operationId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  throughput: number; // items per second
  errorRate: number; // percentage
  costEfficiency: number; // cost per successful item
  retryRate: number; // percentage of items that needed retries
}

export class OperationStatusTracker {
  private operations: Map<string, BulkEditOperation> = new Map();
  private metrics: Map<string, OperationMetrics> = new Map();
  private statusHistory: Map<string, OperationStatusUpdate[]> = new Map();
  private listeners: Map<string, ((update: OperationStatusUpdate) => void)[]> = new Map();

  /**
   * Register a new operation for tracking
   */
  registerOperation(operation: BulkEditOperation): void {
    this.operations.set(operation.id, { ...operation });
    
    // Initialize metrics
    this.metrics.set(operation.id, {
      operationId: operation.id,
      startTime: operation.createdAt,
      throughput: 0,
      errorRate: 0,
      costEfficiency: 0,
      retryRate: 0
    });

    // Initialize status history
    this.statusHistory.set(operation.id, [{
      operationId: operation.id,
      status: operation.status,
      timestamp: operation.createdAt
    }]);

    this.notifyListeners(operation.id, {
      operationId: operation.id,
      status: operation.status,
      timestamp: new Date()
    });
  }

  /**
   * Update operation status
   */
  updateStatus(update: OperationStatusUpdate): void {
    const operation = this.operations.get(update.operationId);
    if (!operation) {
      console.warn(`Operation ${update.operationId} not found for status update`);
      return;
    }

    // Update operation
    operation.status = update.status;
    if (update.progress) {
      Object.assign(operation.progress, update.progress);
    }
    if (update.results) {
      Object.assign(operation.results, update.results);
    }

    // Update timestamps
    if (update.status === 'in_progress' && !operation.startedAt) {
      operation.startedAt = update.timestamp;
    }
    if ((update.status === 'completed' || update.status === 'failed' || update.status === 'cancelled') && !operation.completedAt) {
      operation.completedAt = update.timestamp;
    }

    this.operations.set(update.operationId, operation);

    // Add to history
    const history = this.statusHistory.get(update.operationId) || [];
    history.push(update);
    this.statusHistory.set(update.operationId, history);

    // Update metrics
    this.updateMetrics(update.operationId);

    // Notify listeners
    this.notifyListeners(update.operationId, update);
  }

  /**
   * Get current operation status
   */
  getOperation(operationId: string): BulkEditOperation | null {
    return this.operations.get(operationId) || null;
  }

  /**
   * Get operation metrics
   */
  getMetrics(operationId: string): OperationMetrics | null {
    return this.metrics.get(operationId) || null;
  }

  /**
   * Get operation status history
   */
  getStatusHistory(operationId: string): OperationStatusUpdate[] {
    return this.statusHistory.get(operationId) || [];
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): BulkEditOperation[] {
    return Array.from(this.operations.values())
      .filter(op => op.status === 'pending' || op.status === 'in_progress');
  }

  /**
   * Get operations by status
   */
  getOperationsByStatus(status: BulkEditOperation['status']): BulkEditOperation[] {
    return Array.from(this.operations.values())
      .filter(op => op.status === status);
  }

  /**
   * Get overall statistics
   */
  getOverallStats(): BulkOperationStats {
    const operations = Array.from(this.operations.values());
    const totalOperations = operations.length;
    const activeOperations = operations.filter(op => op.status === 'in_progress').length;
    const completedOperations = operations.filter(op => op.status === 'completed').length;
    const failedOperations = operations.filter(op => op.status === 'failed').length;

    const totalItemsProcessed = operations.reduce((sum, op) => sum + op.progress.processedItems, 0);
    const totalCost = operations.reduce((sum, op) => sum + op.results.actualCost, 0);
    const totalTokensUsed = operations.reduce((sum, op) => sum + op.results.tokensUsed, 0);
    
    const completedOps = operations.filter(op => op.completedAt && op.startedAt);
    const averageProcessingTime = completedOps.length > 0 
      ? completedOps.reduce((sum, op) => sum + (op.completedAt!.getTime() - op.startedAt!.getTime()), 0) / completedOps.length
      : 0;

    const successfulItems = operations.reduce((sum, op) => sum + op.progress.successfulItems, 0);
    const successRate = totalItemsProcessed > 0 ? (successfulItems / totalItemsProcessed) * 100 : 0;

    return {
      totalOperations,
      activeOperations,
      completedOperations,
      failedOperations,
      totalItemsProcessed,
      totalCost,
      totalTokensUsed,
      averageProcessingTime,
      successRate
    };
  }

  /**
   * Subscribe to status updates for an operation
   */
  subscribe(operationId: string, callback: (update: OperationStatusUpdate) => void): () => void {
    const listeners = this.listeners.get(operationId) || [];
    listeners.push(callback);
    this.listeners.set(operationId, listeners);

    // Send current status immediately
    const operation = this.operations.get(operationId);
    if (operation) {
      callback({
        operationId,
        status: operation.status,
        progress: operation.progress,
        results: operation.results,
        timestamp: new Date()
      });
    }

    // Return unsubscribe function
    return () => {
      const currentListeners = this.listeners.get(operationId) || [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
        if (currentListeners.length === 0) {
          this.listeners.delete(operationId);
        } else {
          this.listeners.set(operationId, currentListeners);
        }
      }
    };
  }

  /**
   * Clean up completed operations
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number { // 24 hours default
    const cutoff = new Date(Date.now() - maxAge);
    let cleanedCount = 0;

    const operationEntries = Array.from(this.operations.entries());
    for (const [operationId, operation] of operationEntries) {
      if (operation.completedAt && operation.completedAt < cutoff) {
        this.operations.delete(operationId);
        this.metrics.delete(operationId);
        this.statusHistory.delete(operationId);
        this.listeners.delete(operationId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Export operation data for analysis
   */
  exportOperationData(operationId: string): any {
    const operation = this.operations.get(operationId);
    const metrics = this.metrics.get(operationId);
    const history = this.statusHistory.get(operationId);

    if (!operation) {
      return null;
    }

    return {
      operation,
      metrics,
      history,
      exportedAt: new Date()
    };
  }

  private updateMetrics(operationId: string): void {
    const operation = this.operations.get(operationId);
    const metrics = this.metrics.get(operationId);
    
    if (!operation || !metrics) {
      return;
    }

    // Update end time if operation is completed
    if (operation.completedAt && !metrics.endTime) {
      metrics.endTime = operation.completedAt;
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    }

    // Calculate throughput (items per second)
    if (metrics.duration && metrics.duration > 0) {
      metrics.throughput = (operation.progress.processedItems / metrics.duration) * 1000;
    }

    // Calculate error rate
    if (operation.progress.processedItems > 0) {
      metrics.errorRate = (operation.progress.failedItems / operation.progress.processedItems) * 100;
    }

    // Calculate cost efficiency (cost per successful item)
    if (operation.progress.successfulItems > 0) {
      metrics.costEfficiency = operation.results.actualCost / operation.progress.successfulItems;
    }

    // Calculate retry rate (would need retry data from operation items)
    // For now, estimate based on error rate
    metrics.retryRate = Math.min(metrics.errorRate * 0.5, 20); // Assume 50% of errors result in retries, max 20%

    this.metrics.set(operationId, metrics);
  }

  private notifyListeners(operationId: string, update: OperationStatusUpdate): void {
    const listeners = this.listeners.get(operationId) || [];
    listeners.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in status update callback:', error);
      }
    });
  }
}

// Singleton instance
export const operationStatusTracker = new OperationStatusTracker();