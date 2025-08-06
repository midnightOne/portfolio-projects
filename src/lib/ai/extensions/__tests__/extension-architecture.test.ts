/**
 * Extension Architecture Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIFunctionRegistry } from '../function-registry';
import { BulkEditFunction, AnalyticsFunction, ContentFunction } from '../functions';
import { BulkEditService } from '../bulk-operations/bulk-edit-service';
import { ProgressTracker } from '../bulk-operations/progress-tracker';
import { OperationStatusTracker } from '../bulk-operations/operation-status';
import { AIFunction, AIFunctionRequest, AIFunctionResponse } from '../types';

describe('AI Function Registry', () => {
  let registry: AIFunctionRegistry;

  beforeEach(() => {
    registry = new AIFunctionRegistry();
  });

  it('should register and retrieve functions', () => {
    const bulkEditFunction = new BulkEditFunction();
    registry.register(bulkEditFunction);

    expect(registry.hasFunction('bulk_edit_projects')).toBe(true);
    expect(registry.getFunctions()).toHaveLength(1);
    expect(registry.getFunctions()[0].name).toBe('bulk_edit_projects');
  });

  it('should prevent duplicate function registration', () => {
    const bulkEditFunction = new BulkEditFunction();
    registry.register(bulkEditFunction);

    expect(() => registry.register(bulkEditFunction)).toThrow('Function bulk_edit_projects is already registered');
  });

  it('should filter functions by category', () => {
    const bulkEditFunction = new BulkEditFunction();
    const analyticsFunction = new AnalyticsFunction();
    const contentFunction = new ContentFunction();

    registry.register(bulkEditFunction);
    registry.register(analyticsFunction);
    registry.register(contentFunction);

    const bulkEditFunctions = registry.getFunctionsByCategory('bulk-edit');
    const analyticsFunctions = registry.getFunctionsByCategory('analytics');
    const contentFunctions = registry.getFunctionsByCategory('content');

    expect(bulkEditFunctions).toHaveLength(1);
    expect(analyticsFunctions).toHaveLength(1);
    expect(contentFunctions).toHaveLength(1);
  });

  it('should execute functions successfully', async () => {
    const mockFunction: AIFunction = {
      schema: {
        name: 'test_function',
        description: 'Test function',
        parameters: [],
        category: 'system',
        permissions: [],
        version: '1.0.0'
      },
      async execute(request: AIFunctionRequest): Promise<AIFunctionResponse> {
        return {
          success: true,
          result: { message: 'Test successful' },
          metadata: { executionTime: 100 }
        };
      }
    };

    registry.register(mockFunction);

    const request: AIFunctionRequest = {
      functionName: 'test_function',
      parameters: {},
      context: {
        sessionId: 'test-session',
        timestamp: new Date()
      }
    };

    const response = await registry.execute(request);
    expect(response.success).toBe(true);
    expect(response.result?.message).toBe('Test successful');
  });

  it('should handle function execution errors', async () => {
    const request: AIFunctionRequest = {
      functionName: 'nonexistent_function',
      parameters: {},
      context: {
        sessionId: 'test-session',
        timestamp: new Date()
      }
    };

    const response = await registry.execute(request);
    expect(response.success).toBe(false);
    expect(response.error?.message).toContain('Function nonexistent_function not found');
  });

  it('should track execution statistics', async () => {
    const mockFunction: AIFunction = {
      schema: {
        name: 'stats_test_unique',
        description: 'Stats test function',
        parameters: [],
        category: 'system',
        permissions: [],
        version: '1.0.0'
      },
      async execute(): Promise<AIFunctionResponse> {
        return { success: true, result: {}, metadata: { executionTime: 100 } };
      }
    };

    registry.register(mockFunction);

    const request: AIFunctionRequest = {
      functionName: 'stats_test_unique',
      parameters: {},
      context: {
        sessionId: 'test-session',
        timestamp: new Date()
      }
    };

    await registry.execute(request);

    const stats = registry.getStats();
    expect(stats.totalExecutions).toBeGreaterThan(0);
    expect(stats.successfulExecutions).toBeGreaterThan(0);
    expect(stats.registeredFunctions).toBeGreaterThan(0);
  });
});

describe('Bulk Edit Service', () => {
  let service: BulkEditService;

  beforeEach(() => {
    service = new BulkEditService({
      maxConcurrentOperations: 2,
      defaultBatchSize: 3,
      enableProgressTracking: true
    });
  });

  it('should create bulk operations', async () => {
    const operationId = await service.createOperation(
      'improve_content',
      ['project-1', 'project-2', 'project-3'],
      {
        projectIds: ['project-1', 'project-2', 'project-3'],
        model: 'gpt-4o',
        provider: 'openai',
        temperature: 0.7,
        batchSize: 2,
        preserveOriginal: true,
        options: {}
      }
    );

    expect(operationId).toBeDefined();
    expect(operationId).toMatch(/^bulk_\d+_[a-z0-9]+$/);
  });

  it('should track operation progress', async () => {
    const operationId = await service.createOperation(
      'update_tags',
      ['project-1', 'project-2'],
      {
        projectIds: ['project-1', 'project-2'],
        model: 'gpt-4o-mini',
        provider: 'openai',
        temperature: 0.5,
        batchSize: 1,
        preserveOriginal: true,
        options: {}
      }
    );

    // Wait a bit for processing to start
    await new Promise(resolve => setTimeout(resolve, 100));

    const progress = service.getOperationProgress(operationId);
    expect(progress).toBeDefined();
    expect(progress?.operationId).toBe(operationId);
    expect(progress?.progress.totalItems).toBe(2);
  });

  it('should validate operation limits', async () => {
    const tooManyProjects = Array.from({ length: 101 }, (_, i) => `project-${i}`);

    await expect(
      service.createOperation(
        'improve_content',
        tooManyProjects,
        {
          projectIds: tooManyProjects,
          model: 'gpt-4o',
          provider: 'openai',
          temperature: 0.7,
          batchSize: 5,
          preserveOriginal: true,
          options: {}
        }
      )
    ).rejects.toThrow('Maximum 100 projects allowed per operation');
  });

  it('should provide service statistics', async () => {
    const stats = await service.getStats();
    
    expect(stats).toHaveProperty('totalOperations');
    expect(stats).toHaveProperty('activeOperations');
    expect(stats).toHaveProperty('completedOperations');
    expect(stats).toHaveProperty('successRate');
    expect(typeof stats.successRate).toBe('number');
  });
});

describe('Progress Tracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker(100); // 100ms update interval for testing
  });

  it('should handle subscriptions', () => {
    const mockCallback = jest.fn();
    const unsubscribe = tracker.subscribe('test-operation', mockCallback);

    expect(tracker.getSubscriptionCount('test-operation')).toBe(1);
    expect(tracker.getActiveSubscriptions()).toContain('test-operation');

    unsubscribe();
    expect(tracker.getSubscriptionCount('test-operation')).toBe(0);
  });

  it('should update and cache progress', () => {
    const progress = {
      operationId: 'test-operation',
      status: 'in_progress' as const,
      progress: {
        totalItems: 10,
        processedItems: 5,
        successfulItems: 4,
        failedItems: 1,
        currentBatch: 2,
        totalBatches: 5
      },
      results: {
        estimatedCost: 0.05,
        actualCost: 0.025,
        tokensUsed: 1250,
        processingTime: 5000
      },
      lastUpdate: new Date()
    };

    tracker.updateProgress(progress);

    const cached = tracker.getProgress('test-operation');
    expect(cached).toEqual(progress);
  });

  it('should notify subscribers of progress updates', () => {
    const mockCallback = jest.fn();
    tracker.subscribe('test-operation', mockCallback);

    const progress = {
      operationId: 'test-operation',
      status: 'completed' as const,
      progress: {
        totalItems: 5,
        processedItems: 5,
        successfulItems: 5,
        failedItems: 0,
        currentBatch: 1,
        totalBatches: 1
      },
      results: {
        estimatedCost: 0.02,
        actualCost: 0.018,
        tokensUsed: 900,
        processingTime: 3000
      },
      lastUpdate: new Date()
    };

    tracker.updateProgress(progress);
    expect(mockCallback).toHaveBeenCalledWith(progress);
  });
});

describe('Operation Status Tracker', () => {
  let statusTracker: OperationStatusTracker;

  beforeEach(() => {
    statusTracker = new OperationStatusTracker();
  });

  it('should register and track operations', () => {
    const operation = {
      id: 'test-op-1',
      type: 'improve_content' as const,
      status: 'pending' as const,
      createdAt: new Date(),
      config: {
        projectIds: ['project-1'],
        model: 'gpt-4o',
        provider: 'openai' as const,
        temperature: 0.7,
        batchSize: 1,
        preserveOriginal: true,
        options: {}
      },
      progress: {
        totalItems: 1,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        currentBatch: 0,
        totalBatches: 1
      },
      results: {
        estimatedCost: 0.01,
        actualCost: 0,
        tokensUsed: 0,
        processingTime: 0
      },
      errors: [],
      metadata: {
        sessionId: 'test-session',
        source: 'api' as const
      }
    };

    statusTracker.registerOperation(operation);

    const retrieved = statusTracker.getOperation('test-op-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-op-1');
    expect(retrieved?.status).toBe('pending');
  });

  it('should update operation status', () => {
    const operation = {
      id: 'test-op-2',
      type: 'update_tags' as const,
      status: 'pending' as const,
      createdAt: new Date(),
      config: {
        projectIds: ['project-1'],
        model: 'gpt-4o-mini',
        provider: 'openai' as const,
        temperature: 0.5,
        batchSize: 1,
        preserveOriginal: true,
        options: {}
      },
      progress: {
        totalItems: 1,
        processedItems: 0,
        successfulItems: 0,
        failedItems: 0,
        currentBatch: 0,
        totalBatches: 1
      },
      results: {
        estimatedCost: 0.005,
        actualCost: 0,
        tokensUsed: 0,
        processingTime: 0
      },
      errors: [],
      metadata: {
        sessionId: 'test-session',
        source: 'ui' as const
      }
    };

    statusTracker.registerOperation(operation);

    statusTracker.updateStatus({
      operationId: 'test-op-2',
      status: 'in_progress',
      progress: { processedItems: 1 },
      timestamp: new Date()
    });

    const updated = statusTracker.getOperation('test-op-2');
    expect(updated?.status).toBe('in_progress');
    expect(updated?.progress.processedItems).toBe(1);
  });

  it('should provide overall statistics', () => {
    // Register a few operations
    const operations = [
      {
        id: 'op-1',
        type: 'improve_content' as const,
        status: 'completed' as const,
        createdAt: new Date(),
        config: { projectIds: ['p1'], model: 'gpt-4o', provider: 'openai' as const, temperature: 0.7, batchSize: 1, preserveOriginal: true, options: {} },
        progress: { totalItems: 1, processedItems: 1, successfulItems: 1, failedItems: 0, currentBatch: 1, totalBatches: 1 },
        results: { estimatedCost: 0.01, actualCost: 0.008, tokensUsed: 400, processingTime: 2000 },
        errors: [],
        metadata: { sessionId: 'session-1', source: 'api' as const }
      },
      {
        id: 'op-2',
        type: 'update_tags' as const,
        status: 'in_progress' as const,
        createdAt: new Date(),
        config: { projectIds: ['p2'], model: 'gpt-4o-mini', provider: 'openai' as const, temperature: 0.5, batchSize: 1, preserveOriginal: true, options: {} },
        progress: { totalItems: 1, processedItems: 0, successfulItems: 0, failedItems: 0, currentBatch: 0, totalBatches: 1 },
        results: { estimatedCost: 0.005, actualCost: 0, tokensUsed: 0, processingTime: 0 },
        errors: [],
        metadata: { sessionId: 'session-2', source: 'ui' as const }
      }
    ];

    operations.forEach(op => statusTracker.registerOperation(op));

    const stats = statusTracker.getOverallStats();
    expect(stats.totalOperations).toBe(2);
    expect(stats.activeOperations).toBe(1);
    expect(stats.completedOperations).toBe(1);
    expect(stats.totalTokensUsed).toBe(400);
  });
});