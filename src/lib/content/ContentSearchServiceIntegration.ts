/**
 * Content Search Service Integration
 * 
 * Handles registration of ContentSearchService with UIManager and provides
 * initialization utilities for the content search system.
 */

import ContentSearchService from './ContentSearchService';
import { UIManager } from '../navigation/UIManager';
import { debugEventEmitter } from '../debug/debugEventEmitter';

let contentSearchService: ContentSearchService | null = null;
let isRegistered = false;

/**
 * Initialize and register ContentSearchService with UIManager
 */
export function initializeContentSearchService(): ContentSearchService {
  if (!contentSearchService) {
    contentSearchService = new ContentSearchService();
    
    debugEventEmitter.emit('content-search-service-initialized', {
      timestamp: Date.now()
    });
  }

  return contentSearchService;
}

/**
 * Register ContentSearchService with UIManager
 */
export function registerContentSearchWithUIManager(): boolean {
  if (isRegistered) {
    return true;
  }

  try {
    const uiManager = UIManager.getInstance();
    const searchService = initializeContentSearchService();
    
    // Register as content provider
    uiManager.registerContentProvider(searchService);
    
    isRegistered = true;
    
    debugEventEmitter.emit('content-search-service-registered', {
      providerName: searchService.name,
      timestamp: Date.now()
    });

    console.log('✅ ContentSearchService registered with UIManager');
    return true;

  } catch (error) {
    console.error('❌ Failed to register ContentSearchService with UIManager:', error);
    
    debugEventEmitter.emit('content-search-service-registration-error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    });

    return false;
  }
}

/**
 * Get the global ContentSearchService instance
 */
export function getContentSearchService(): ContentSearchService | null {
  return contentSearchService;
}

/**
 * Check if ContentSearchService is registered with UIManager
 */
export function isContentSearchServiceRegistered(): boolean {
  return isRegistered;
}

/**
 * Get integration status for debugging
 */
export function getContentSearchIntegrationStatus(): {
  serviceInitialized: boolean;
  registeredWithUIManager: boolean;
  uiManagerAvailable: boolean;
  providerCount: number;
} {
  let uiManagerAvailable = false;
  let providerCount = 0;

  try {
    const uiManager = UIManager.getInstance();
    uiManagerAvailable = true;
    providerCount = uiManager.getContentProviders().length;
  } catch (error) {
    // UIManager not available
  }

  return {
    serviceInitialized: contentSearchService !== null,
    registeredWithUIManager: isRegistered,
    uiManagerAvailable,
    providerCount
  };
}

/**
 * Auto-initialize ContentSearchService when this module is imported
 * This ensures the service is available for use immediately
 */
if (typeof window !== 'undefined') {
  // Only auto-initialize in browser environment
  setTimeout(() => {
    try {
      registerContentSearchWithUIManager();
    } catch (error) {
      console.warn('Auto-registration of ContentSearchService failed:', error);
    }
  }, 100); // Small delay to ensure UIManager is initialized
}

export default {
  initializeContentSearchService,
  registerContentSearchWithUIManager,
  getContentSearchService,
  isContentSearchServiceRegistered,
  getContentSearchIntegrationStatus
};