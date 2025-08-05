/**
 * Bulk Operations Infrastructure Types
 */

export interface BulkEditOperation {
  id: string;
  type: 'improve_content' | 'update_tags' | 'standardize_format' | 'translate' | 'optimize_seo';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Configuration
  config: {
    projectIds: string[];
    model: string;
    provider: 'openai' | 'anthropic';
    temperature?: number;
    batchSize: number;
    preserveOriginal: boolean;
    options: Record<string, any>;
  };
  
  // Filters applied
  filters?: {
    minWordCount?: number;
    maxWordCount?: number;
    tags?: string[];
    lastModifiedBefore?: Date;
    lastModifiedAfter?: Date;
    status?: string[];
  };
  
  // Progress tracking
  progress: {
    totalItems: number;
    processedItems: number;
    successfulItems: number;
    failedItems: number;
    currentBatch: number;
    totalBatches: number;
  };
  
  // Results and costs
  results: {
    estimatedCost: number;
    actualCost: number;
    tokensUsed: number;
    processingTime: number; // milliseconds
  };
  
  // Error handling
  errors: Array<{
    projectId: string;
    error: string;
    timestamp: Date;
    retryCount: number;
  }>;
  
  // Metadata
  metadata: {
    userId?: string;
    sessionId: string;
    userAgent?: string;
    source: 'api' | 'ui' | 'scheduled';
  };
}

export interface BulkEditOperationItem {
  id: string;
  operationId: string;
  projectId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  
  // Processing details
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  
  // Original content (for rollback)
  originalContent?: {
    title?: string;
    description?: string;
    briefOverview?: string;
    articleContent?: string;
    tags?: string[];
  };
  
  // Generated changes
  changes?: {
    title?: string;
    description?: string;
    briefOverview?: string;
    articleContent?: string;
    tags?: string[];
    reasoning?: string;
  };
  
  // Processing metadata
  processingMetadata: {
    tokensUsed: number;
    cost: number;
    model: string;
    provider: string;
    processingTime: number;
    confidence?: number;
  };
  
  // Error information
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
  };
}

export interface BulkOperationProgress {
  operationId: string;
  status: BulkEditOperation['status'];
  progress: BulkEditOperation['progress'];
  results: BulkEditOperation['results'];
  currentItem?: {
    projectId: string;
    projectTitle: string;
    status: string;
  };
  estimatedTimeRemaining?: number; // milliseconds
  lastUpdate: Date;
}

export interface BulkOperationFilter {
  minWordCount?: number;
  maxWordCount?: number;
  tags?: string[];
  lastModifiedBefore?: Date;
  lastModifiedAfter?: Date;
  status?: ('DRAFT' | 'PUBLISHED' | 'ARCHIVED')[];
  hasContent?: boolean;
  hasImages?: boolean;
}

export interface BulkOperationConfig {
  maxConcurrentOperations: number;
  maxItemsPerOperation: number;
  defaultBatchSize: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
  timeoutPerItem: number; // milliseconds
  enableProgressTracking: boolean;
  enableRollback: boolean;
  autoCleanupAfter: number; // days
}

export interface BulkOperationStats {
  totalOperations: number;
  activeOperations: number;
  completedOperations: number;
  failedOperations: number;
  totalItemsProcessed: number;
  totalCost: number;
  totalTokensUsed: number;
  averageProcessingTime: number;
  successRate: number;
}

export interface BulkOperationSchedule {
  id: string;
  name: string;
  operationType: BulkEditOperation['type'];
  config: BulkEditOperation['config'];
  filters: BulkOperationFilter;
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'monthly';
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6, Sunday = 0
    dayOfMonth?: number; // 1-31
    timezone: string;
  };
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}