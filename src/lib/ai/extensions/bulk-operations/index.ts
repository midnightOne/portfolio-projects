/**
 * Bulk Operations Infrastructure - Background processing and status tracking
 */

export { BulkEditService, bulkEditService } from './bulk-edit-service';
export { ProgressTracker, progressTracker, createBulkOperationProgressHook } from './progress-tracker';
export { OperationStatusTracker, operationStatusTracker } from './operation-status';

export type {
  BulkEditOperation,
  BulkEditOperationItem,
  BulkOperationProgress,
  BulkOperationConfig,
  BulkOperationStats,
  BulkOperationFilter,
  BulkOperationSchedule
} from './types';

export type {
  ProgressSubscription
} from './progress-tracker';

export type {
  OperationStatusUpdate,
  OperationMetrics
} from './operation-status';

// Initialize services
import { bulkEditService } from './bulk-edit-service';
import { progressTracker } from './progress-tracker';
import { operationStatusTracker } from './operation-status';

// Export initialized services
export { bulkEditService as defaultBulkEditService };
export { progressTracker as defaultProgressTracker };
export { operationStatusTracker as defaultOperationStatusTracker };