/**
 * UIManager Integration for Content Ingestion Service
 * 
 * This module provides integration between the ContentIngestionService and UIManager
 * to ensure that navigation affordances are updated when content changes.
 */

import { ContentIngestionService } from './ContentIngestionService';
import { debugEventEmitter } from '../debug/debugEventEmitter';

export class UIManagerContentIntegration {
  private contentService: ContentIngestionService;
  private uiManager: any; // Will be injected at runtime to avoid circular dependencies

  constructor(contentService: ContentIngestionService) {
    this.contentService = contentService;
    this.setupEventListeners();
  }

  /**
   * Set the UIManager instance (called after UIManager is initialized)
   */
  setUIManager(uiManager: any): void {
    this.uiManager = uiManager;
  }

  /**
   * Setup event listeners for content ingestion events
   */
  private setupEventListeners(): void {
    // Listen for content updates
    this.contentService.on('content-updated', (data) => {
      this.handleContentUpdated(data);
    });

    // Listen for section discovery
    this.contentService.on('sections-discovered', (data) => {
      this.handleSectionsDiscovered(data);
    });

    // Listen for ingestion progress
    this.contentService.on('ingestion-progress', (progress) => {
      this.handleIngestionProgress(progress);
    });

    // Listen for ingestion completion
    this.contentService.on('ingestion-complete', (results) => {
      this.handleIngestionComplete(results);
    });

    // Listen for ingestion errors
    this.contentService.on('ingestion-error', (error) => {
      this.handleIngestionError(error);
    });
  }

  /**
   * Handle content updated events
   */
  private handleContentUpdated(data: { entityType: string; slug: string; sections: string[] }): void {
    debugEventEmitter.emit('ui-content-updated', {
      entityType: data.entityType,
      slug: data.slug,
      sections: data.sections,
      timestamp: Date.now()
    });

    // Clear UIManager section cache if available
    if (this.uiManager && typeof this.uiManager._sectionCache?.clear === 'function') {
      this.uiManager._sectionCache.clear();
      
      debugEventEmitter.emit('ui-section-cache-cleared', {
        reason: 'content-updated',
        entityType: data.entityType,
        slug: data.slug,
        timestamp: Date.now()
      });
    }

    // Trigger navigation affordances update if method exists
    if (this.uiManager && typeof this.uiManager._updateNavigationAffordances === 'function') {
      try {
        this.uiManager._updateNavigationAffordances();
        
        debugEventEmitter.emit('ui-navigation-affordances-updated', {
          trigger: 'content-updated',
          entityType: data.entityType,
          slug: data.slug,
          timestamp: Date.now()
        });
      } catch (error) {
        debugEventEmitter.emit('ui-navigation-affordances-update-error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          entityType: data.entityType,
          slug: data.slug,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Handle sections discovered events
   */
  private handleSectionsDiscovered(data: { entityType: string; slug: string; sections: Array<{ id: string; title: string }> }): void {
    debugEventEmitter.emit('ui-sections-discovered', {
      entityType: data.entityType,
      slug: data.slug,
      sectionsCount: data.sections.length,
      sections: data.sections,
      timestamp: Date.now()
    });

    // If UIManager has a section registry, update it
    if (this.uiManager && typeof this.uiManager._updateSectionRegistry === 'function') {
      try {
        this.uiManager._updateSectionRegistry(data.entityType, data.slug, data.sections);
        
        debugEventEmitter.emit('ui-section-registry-updated', {
          entityType: data.entityType,
          slug: data.slug,
          sectionsCount: data.sections.length,
          timestamp: Date.now()
        });
      } catch (error) {
        debugEventEmitter.emit('ui-section-registry-update-error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          entityType: data.entityType,
          slug: data.slug,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Handle ingestion progress events
   */
  private handleIngestionProgress(progress: any): void {
    debugEventEmitter.emit('content-ingestion-progress', {
      totalItems: progress.totalItems,
      processedItems: progress.processedItems,
      currentItem: progress.currentItem,
      estimatedCost: progress.estimatedCost,
      actualCost: progress.actualCost,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
      errors: progress.errors,
      timestamp: Date.now()
    });

    // Emit progress for any UI components that might be listening
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('content-ingestion-progress', {
        detail: progress
      }));
    }
  }

  /**
   * Handle ingestion completion
   */
  private handleIngestionComplete(results: any[]): void {
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const totalCost = results.reduce((sum, r) => sum + (r.costEstimate || 0), 0);
    const totalEmbeddings = results.reduce((sum, r) => sum + (r.embeddingsGenerated || 0), 0);

    debugEventEmitter.emit('content-ingestion-complete', {
      totalResults: results.length,
      successCount,
      errorCount,
      totalCost,
      totalEmbeddings,
      timestamp: Date.now()
    });

    // Clear all UIManager caches after complete ingestion
    if (this.uiManager) {
      if (typeof this.uiManager._sectionCache?.clear === 'function') {
        this.uiManager._sectionCache.clear();
      }
      
      // Force a complete navigation affordances refresh
      if (typeof this.uiManager._refreshNavigationAffordances === 'function') {
        try {
          this.uiManager._refreshNavigationAffordances();
          
          debugEventEmitter.emit('ui-navigation-complete-refresh', {
            trigger: 'ingestion-complete',
            successCount,
            errorCount,
            timestamp: Date.now()
          });
        } catch (error) {
          debugEventEmitter.emit('ui-navigation-refresh-error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            trigger: 'ingestion-complete',
            timestamp: Date.now()
          });
        }
      }
    }

    // Emit completion event for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('content-ingestion-complete', {
        detail: {
          successCount,
          errorCount,
          totalCost,
          totalEmbeddings
        }
      }));
    }
  }

  /**
   * Handle ingestion errors
   */
  private handleIngestionError(error: { error: string; context: any }): void {
    debugEventEmitter.emit('content-ingestion-error', {
      error: error.error,
      context: error.context,
      timestamp: Date.now()
    });

    // Emit error event for UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('content-ingestion-error', {
        detail: error
      }));
    }
  }

  /**
   * Manually trigger UIManager cache refresh
   */
  refreshUIManagerCache(): void {
    if (this.uiManager && typeof this.uiManager._sectionCache?.clear === 'function') {
      this.uiManager._sectionCache.clear();
      
      debugEventEmitter.emit('ui-section-cache-cleared', {
        reason: 'manual-refresh',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Check if UIManager is properly integrated
   */
  isUIManagerIntegrated(): boolean {
    return this.uiManager !== null && this.uiManager !== undefined;
  }

  /**
   * Get integration status
   */
  getIntegrationStatus(): {
    uiManagerConnected: boolean;
    sectionCacheAvailable: boolean;
    navigationAffordancesAvailable: boolean;
    sectionRegistryAvailable: boolean;
  } {
    return {
      uiManagerConnected: this.isUIManagerIntegrated(),
      sectionCacheAvailable: this.uiManager && typeof this.uiManager._sectionCache?.clear === 'function',
      navigationAffordancesAvailable: this.uiManager && typeof this.uiManager._updateNavigationAffordances === 'function',
      sectionRegistryAvailable: this.uiManager && typeof this.uiManager._updateSectionRegistry === 'function'
    };
  }
}

// Singleton instance for global access
let uiManagerIntegration: UIManagerContentIntegration | null = null;

/**
 * Initialize UIManager integration with ContentIngestionService
 */
export function initializeUIManagerIntegration(contentService: ContentIngestionService): UIManagerContentIntegration {
  if (!uiManagerIntegration) {
    uiManagerIntegration = new UIManagerContentIntegration(contentService);
  }
  return uiManagerIntegration;
}

/**
 * Get the global UIManager integration instance
 */
export function getUIManagerIntegration(): UIManagerContentIntegration | null {
  return uiManagerIntegration;
}

/**
 * Set the UIManager instance for integration
 */
export function setUIManagerForIntegration(uiManager: any): void {
  if (uiManagerIntegration) {
    uiManagerIntegration.setUIManager(uiManager);
    
    debugEventEmitter.emit('ui-manager-integration-connected', {
      timestamp: Date.now()
    });
  }
}

export default UIManagerContentIntegration;