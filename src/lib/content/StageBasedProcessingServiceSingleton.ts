/**
 * Singleton instance of StageBasedProcessingService
 * 
 * This ensures all API routes share the same service instance
 * and progress tracking data, preventing 404 errors on SSE connections.
 * 
 * Uses global object to persist across Next.js hot reloads in development.
 */

import { StageBasedProcessingService } from './StageBasedProcessingService';

// Use global object to persist across hot reloads in development
const globalForProcessingService = global as typeof globalThis & {
  processingServiceInstance?: StageBasedProcessingService;
  instanceCount?: number;
};

export function getProcessingService(): StageBasedProcessingService {
  if (!globalForProcessingService.processingServiceInstance) {
    globalForProcessingService.instanceCount = (globalForProcessingService.instanceCount || 0) + 1;
    console.log(`[Singleton] Creating new StageBasedProcessingService instance #${globalForProcessingService.instanceCount}`);
    globalForProcessingService.processingServiceInstance = new StageBasedProcessingService();
  } else {
    console.log(`[Singleton] Reusing existing StageBasedProcessingService instance #${globalForProcessingService.instanceCount}`);
  }
  return globalForProcessingService.processingServiceInstance;
}

export default getProcessingService;
