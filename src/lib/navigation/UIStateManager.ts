/**
 * UIStateManager - Lightweight UI State Tracking with Background Updates
 * 
 * Provides breadcrumb-based state tracking and debounced background updates
 * to keep AI aware of user context without interrupting conversation flow.
 */

import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';

// UI State interfaces
export interface UIState {
  // Hierarchical navigation path (breadcrumb style)
  breadcrumbPath: string;
  
  // Currently visible content anchors (debounced scroll updates)
  visibleAnchors: string[];
  
  // Active search/filter state (debounced updates)
  activeFilters?: {
    searchTerm?: string;
    tags?: string[];
    techStack?: string[];
  };
  
  // Minimal interaction context for AI awareness
  lastUserAction?: {
    type: 'navigate' | 'search' | 'filter' | 'scroll';
    timestamp: number;
  };
}

export interface BackgroundUpdateCallback {
  (update: {
    type: 'ui_state_update';
    breadcrumbPath: string;
    visibleAnchors: string[];
    activeFilters?: UIState['activeFilters'];
    timestamp: number;
  }): void;
}

// Debounce utility
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export class UIStateManager {
  private static instance: UIStateManager | null = null;
  private _currentState: UIState;
  private _backgroundUpdateCallback: BackgroundUpdateCallback | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;
  private _lastVisibleAnchors: string[] = [];
  private _isInitialized: boolean = false;

  // Debounced update functions
  private _debouncedScrollUpdate: (visibleAnchors: string[]) => void;
  private _debouncedFilterUpdate: (filters: UIState['activeFilters']) => void;
  private _debouncedStateUpdate: (state: UIState) => void;

  private constructor() {
    this._currentState = {
      breadcrumbPath: this._generateBreadcrumbPath(),
      visibleAnchors: [],
      activeFilters: undefined,
      lastUserAction: undefined
    };

    // Initialize debounced functions with specified intervals
    this._debouncedScrollUpdate = debounce((visibleAnchors: string[]) => {
      if (this._anchorsChanged(visibleAnchors)) {
        this._currentState.visibleAnchors = visibleAnchors;
        this._currentState.lastUserAction = {
          type: 'scroll',
          timestamp: Date.now()
        };
        this._sendBackgroundUpdate();
      }
    }, 10000); // 10 seconds for scroll updates

    this._debouncedFilterUpdate = debounce((filters: UIState['activeFilters']) => {
      this._currentState.activeFilters = filters;
      this._currentState.lastUserAction = {
        type: filters?.searchTerm ? 'search' : 'filter',
        timestamp: Date.now()
      };
      this._sendBackgroundUpdate();
    }, 5000); // 5 seconds for search/filter updates

    this._debouncedStateUpdate = debounce((state: UIState) => {
      this._sendBackgroundUpdate();
    }, 2000); // 2 seconds for general state updates
  }

  static getInstance(): UIStateManager {
    if (!UIStateManager.instance) {
      UIStateManager.instance = new UIStateManager();
    }
    return UIStateManager.instance;
  }

  /**
   * Initialize the UI state manager with background update callback
   */
  initialize(backgroundUpdateCallback?: BackgroundUpdateCallback): void {
    if (this._isInitialized) {
      return;
    }

    this._backgroundUpdateCallback = backgroundUpdateCallback || null;
    this._setupIntersectionObserver();
    this._setupNavigationListeners();
    this._isInitialized = true;

    // Initial state capture
    this._updateBreadcrumbPath();
    this._updateVisibleAnchors();

    console.log('UIStateManager initialized with background updates');
  }

  /**
   * Get current UI state
   */
  getCurrentUIState(): UIState {
    // Update breadcrumb path in real-time
    this._currentState.breadcrumbPath = this._generateBreadcrumbPath();
    return { ...this._currentState };
  }

  /**
   * Set background update callback for sending non-interrupting updates
   */
  setBackgroundUpdateCallback(callback: BackgroundUpdateCallback): void {
    this._backgroundUpdateCallback = callback;
  }

  /**
   * Update navigation state immediately (no debounce)
   */
  updateNavigationState(path?: string): void {
    this._currentState.breadcrumbPath = path || this._generateBreadcrumbPath();
    this._currentState.lastUserAction = {
      type: 'navigate',
      timestamp: Date.now()
    };

    // Navigation updates are immediate
    this._sendBackgroundUpdate();
  }

  /**
   * Update search/filter state with debouncing
   */
  updateFilterState(filters: UIState['activeFilters']): void {
    this._debouncedFilterUpdate(filters);
  }

  /**
   * Generate breadcrumb path from current route and modal stack
   */
  private _generateBreadcrumbPath(): string {
    if (typeof window === 'undefined') {
      return 'server';
    }

    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    // Build hierarchical path
    const pathParts: string[] = [];

    // Add base route
    if (pathname === '/') {
      pathParts.push('home');
    } else {
      pathParts.push(pathname.replace(/^\//, '').replace(/\/$/, '') || 'home');
    }

    // Add modal/project context
    const projectParam = searchParams.get('project');
    if (projectParam) {
      pathParts.push(`project:${projectParam}`);
    }

    // Add section context from hash
    if (hash && hash.length > 1) {
      pathParts.push(`section:${hash.substring(1)}`);
    }

    // Add any other relevant search params
    const tab = searchParams.get('tab');
    if (tab) {
      pathParts.push(`tab:${tab}`);
    }

    return pathParts.join('.');
  }

  /**
   * Setup intersection observer for visible anchor detection
   */
  private _setupIntersectionObserver(): void {
    if (typeof window === 'undefined' || this._intersectionObserver) {
      return;
    }

    // Find all potential anchor elements
    const anchorSelectors = [
      'h1[id]', 'h2[id]', 'h3[id]', 'h4[id]', 'h5[id]', 'h6[id]',
      '[data-section]', '[data-anchor]', 'section[id]', 'article[id]',
      '.project-section[id]', '.content-section[id]'
    ];

    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        const visibleAnchors: string[] = [];

        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id || 
                     entry.target.getAttribute('data-section') ||
                     entry.target.getAttribute('data-anchor');
            if (id) {
              visibleAnchors.push(id);
            }
          }
        });

        // Update visible anchors with debouncing
        this._debouncedScrollUpdate(visibleAnchors);
      },
      {
        root: null,
        rootMargin: '-10% 0px -10% 0px', // Only consider elements in middle 80% of viewport
        threshold: [0.1, 0.5, 0.9] // Multiple thresholds for better detection
      }
    );

    // Observe all anchor elements
    this._observeAnchorElements();

    // Re-observe when DOM changes (for dynamic content)
    const mutationObserver = new MutationObserver(() => {
      this._observeAnchorElements();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Observe all anchor elements for visibility changes
   */
  private _observeAnchorElements(): void {
    if (!this._intersectionObserver) {
      return;
    }

    const anchorSelectors = [
      'h1[id]', 'h2[id]', 'h3[id]', 'h4[id]', 'h5[id]', 'h6[id]',
      '[data-section]', '[data-anchor]', 'section[id]', 'article[id]',
      '.project-section[id]', '.content-section[id]'
    ];

    anchorSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        this._intersectionObserver!.observe(element);
      });
    });
  }

  /**
   * Setup navigation listeners for immediate updates
   */
  private _setupNavigationListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Listen for navigation events
    window.addEventListener('popstate', () => {
      this.updateNavigationState();
    });

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      this.updateNavigationState();
    });

    // Listen for pushState/replaceState (for SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      UIStateManager.getInstance().updateNavigationState();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      UIStateManager.getInstance().updateNavigationState();
    };
  }

  /**
   * Update visible anchors immediately (used for initialization)
   */
  private _updateVisibleAnchors(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const visibleAnchors: string[] = [];
    const anchorSelectors = [
      'h1[id]', 'h2[id]', 'h3[id]', 'h4[id]', 'h5[id]', 'h6[id]',
      '[data-section]', '[data-anchor]', 'section[id]', 'article[id]',
      '.project-section[id]', '.content-section[id]'
    ];

    anchorSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top >= 0 && rect.top <= window.innerHeight * 0.8;
        
        if (isVisible) {
          const id = element.id || 
                   element.getAttribute('data-section') ||
                   element.getAttribute('data-anchor');
          if (id) {
            visibleAnchors.push(id);
          }
        }
      });
    });

    this._currentState.visibleAnchors = visibleAnchors;
    this._lastVisibleAnchors = [...visibleAnchors];
  }

  /**
   * Update breadcrumb path immediately
   */
  private _updateBreadcrumbPath(): void {
    this._currentState.breadcrumbPath = this._generateBreadcrumbPath();
  }

  /**
   * Check if visible anchors have changed
   */
  private _anchorsChanged(newAnchors: string[]): boolean {
    if (newAnchors.length !== this._lastVisibleAnchors.length) {
      this._lastVisibleAnchors = [...newAnchors];
      return true;
    }

    const changed = !newAnchors.every((anchor, index) => 
      anchor === this._lastVisibleAnchors[index]
    );

    if (changed) {
      this._lastVisibleAnchors = [...newAnchors];
    }

    return changed;
  }

  /**
   * Send background update using callback
   */
  private _sendBackgroundUpdate(): void {
    if (!this._backgroundUpdateCallback) {
      return;
    }

    const update = {
      type: 'ui_state_update' as const,
      breadcrumbPath: this._currentState.breadcrumbPath,
      visibleAnchors: this._currentState.visibleAnchors,
      activeFilters: this._currentState.activeFilters,
      timestamp: Date.now()
    };

    try {
      this._backgroundUpdateCallback(update);
      
      // Emit debug event for monitoring
      debugEventEmitter.emit(
        'transcript_update', 
        {
          update,
          metadata: {
            source: 'UIStateManager',
            updateType: 'background'
          }
        },
        'ui-state-manager',
        undefined,
        'ui-state-manager'
      );
    } catch (error) {
      console.error('Failed to send background UI state update:', error);
    }
  }

  /**
   * Serialize current state for server tool call context
   */
  serializeForServerContext(): {
    breadcrumbPath: string;
    visibleAnchors: string[];
    activeFilters?: UIState['activeFilters'];
    lastUserAction?: UIState['lastUserAction'];
  } {
    const state = this.getCurrentUIState();
    return {
      breadcrumbPath: state.breadcrumbPath,
      visibleAnchors: state.visibleAnchors,
      activeFilters: state.activeFilters,
      lastUserAction: state.lastUserAction
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }

    this._backgroundUpdateCallback = null;
    this._isInitialized = false;
  }
}

// Export singleton instance
export const uiStateManager = UIStateManager.getInstance();