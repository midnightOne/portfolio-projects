/**
 * UIManager - Unified UI State Management and Navigation System
 * 
 * Consolidates UI state tracking, navigation planning, and execution into a single system.
 * Provides goal-based navigation planning and execution with step sequencing,
 * error handling, timeout management, and idempotency support.
 * Also provides UI state description with epoch tracking for AI tools.
 * 
 * Includes consolidated functionality from UIStateManager:
 * - Breadcrumb-based state tracking with debounced background updates
 * - Intersection observer for visible anchor detection
 * - State serialization for server tool context
 * 
 * Enables single-call navigation goals and UI state queries instead of multi-step tool sequences.
 */

import { debugEventEmitter } from '../debug/debugEventEmitter';
import { v4 as uuidv4 } from 'uuid';

// UI State interfaces (consolidated from UIStateManager)
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

  // Modal stack and epoch tracking
  modalStack: ModalStackEntry[];
  epoch: number;
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

// Navigation intent interfaces
export interface UIIntentParams {
  epoch?: number;                       // Client's last-known UI state version
  target:
  | { type: "section"; id: string; projectId?: string }   // e.g., {type:"section", id:"contact", projectId:"aurora-avatar"}
  | { type: "route"; id: string }     // e.g., {type:"route", id:"home"}
  | { type: "project"; id: string; sectionId?: string }   // e.g., {type:"project", id:"aurora-avatar", sectionId:"technical-details"}
  | { type: "modal"; id: string; parentContext?: string } // e.g., {type:"modal", id:"gallery", parentContext:"project:aurora-avatar"}
  | { type: "element"; id: string };  // tab, accordion, etc.
  behavior?: {
    openIfNeeded?: boolean;             // open modal or navigate if required
    closeBlocking?: boolean;            // close top modal if it blocks target
    waitForReadyMs?: number;            // wait for loader/transition
    scrollBehavior?: "smooth" | "instant";
    allowInterruption?: boolean;        // allow this navigation to be interrupted
    urlStrategy?: "full" | "minimal" | "none"; // URL update strategy
  };
  scope?: {
    route?: string;
    modalId?: string;
    projectId?: string;
  };
  idempotencyKey?: string;
}

// Modal state management
interface ModalStackEntry {
  id: string;
  type: 'project' | 'example' | 'gallery' | 'generic';
  parentId?: string;
  urlTracked: boolean;        // Whether this modal affects URL
  level: number;              // Nesting level (0 = top level)
  context?: any;              // Additional context data
}

export interface UIDescribeResponse {
  epoch: number;                        // Monotonic int that bumps on view changes
  route: string;                        // "home", "projects", etc.
  viewStack: string[];                  // ["home", "projectModal:aurora-avatar"]
  sections: Array<{
    id: string;
    title: string;
    containerId?: string;
  }>;
  transitions: Array<{
    id: string;                         // "open:projectModal"
    kind: "open" | "close" | "route" | "tab";
    target?: string;                    // "projectModal:aurora-avatar"
    requires?: string[];                // transitions that must happen first
  }>;
}

export interface NavigationStep {
  id: string;
  type: 'navigate' | 'scroll' | 'highlight' | 'wait' | 'modal' | 'close';
  selector?: string;
  path?: string;
  timeout?: number;
  retries?: number;
  condition?: () => boolean;
  execute: () => Promise<NavigationStepResult>;
}

export interface NavigationStepResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  shouldRetry?: boolean;
}

export interface NavigationPlan {
  id: string;
  target: UIIntentParams['target'];
  steps: NavigationStep[];
  totalTimeout: number;
  idempotencyKey?: string;
}

export interface NavigationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  executedSteps: string[];
  totalTime: number;
}

// Navigation timing configuration
interface NavigationTimingConfig {
  // Animation durations (ms) - configurable for testing human-like vs instant
  modalOpenDuration: number;
  modalCloseDuration: number;
  scrollDuration: number;
  fadeInDuration: number;
  fadeOutDuration: number;

  // Default delays for human-like navigation (ms)
  defaultStepDelay: number;           // Delay between navigation steps
  modalTransitionDelay: number;       // Delay after modal open/close
  scrollSettleDelay: number;          // Delay after scrolling

  // Wait times (ms)
  modalContentLoadWait: number;
  routeNavigationWait: number;
  elementReadyWait: number;
  animationBufferWait: number;

  // Retry and timeout settings
  stepTimeoutMs: number;
  maxRetries: number;
  retryDelayBase: number;

  // Interruption handling
  gracefulCancelTimeoutMs: number;
  forceCancelTimeoutMs: number;

  // Animation modes
  animationMode: 'human' | 'instant' | 'custom';
}

// Navigation state tracking
interface NavigationState {
  isExecuting: boolean;
  currentPlanId: string | null;
  currentStepIndex: number;
  currentStepId: string | null;
  startTime: number | null;
  canBeInterrupted: boolean;
  interruptionRequested: boolean;
  lastError: string | null;
}

// Plan execution context
interface PlanExecutionContext {
  planId: string;
  sessionId?: string;
  correlationId?: string;
  startTime: number;
  abortController: AbortController;
  currentStepIndex: number;
  executedSteps: string[];
  canBeInterrupted: boolean;
}

// Navigation orchestrator implementation
export class UIManager {
  private static instance: UIManager | null = null;
  private _currentEpoch: number = 0;
  private _executingPlans: Map<string, Promise<NavigationResult>> = new Map();
  private _completedPlans: Map<string, NavigationResult> = new Map();
  private _isInitialized: boolean = false;

  // For testing: allow injection of custom location object
  private _testLocation: any = null;

  // Consolidated UI state management (from UIStateManager)
  private _currentUIState: UIState;
  private _backgroundUpdateCallback: BackgroundUpdateCallback | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;
  private _lastVisibleAnchors: string[] = [];

  // Debounced update functions
  private _debouncedScrollUpdate: (visibleAnchors: string[]) => void;
  private _debouncedFilterUpdate: (filters: UIState['activeFilters']) => void;
  private _debouncedStateUpdate: (state: UIState) => void;

  // Enhanced state management
  private _navigationState: NavigationState = {
    isExecuting: false,
    currentPlanId: null,
    currentStepIndex: -1,
    currentStepId: null,
    startTime: null,
    canBeInterrupted: true,
    interruptionRequested: false,
    lastError: null
  };

  private _executionContexts: Map<string, PlanExecutionContext> = new Map();
  private _pendingInterruptions: Map<string, UIIntentParams> = new Map();

  // Modal stack management
  private _modalStack: ModalStackEntry[] = [];
  private _modalStateListeners: Set<(stack: ModalStackEntry[]) => void> = new Set();

  // Configurable timing
  private _timingConfig: NavigationTimingConfig = {
    // Animation durations (human-like by default)
    modalOpenDuration: 300,
    modalCloseDuration: 250,
    scrollDuration: 800,
    fadeInDuration: 200,
    fadeOutDuration: 150,

    // Default delays for human-like navigation
    defaultStepDelay: 150,           // Small delay between steps
    modalTransitionDelay: 400,       // Wait for modal animations
    scrollSettleDelay: 200,          // Wait for scroll to settle

    // Wait times
    modalContentLoadWait: 1500,
    routeNavigationWait: 2000,
    elementReadyWait: 500,
    animationBufferWait: 100,

    // Retry and timeout
    stepTimeoutMs: 8000,
    maxRetries: 3,
    retryDelayBase: 1000,

    // Interruption handling
    gracefulCancelTimeoutMs: 2000,
    forceCancelTimeoutMs: 5000,

    // Animation mode
    animationMode: 'human'
  };

  private constructor() {
    // Initialize consolidated UI state
    this._currentUIState = {
      breadcrumbPath: this._generateBreadcrumbPath(),
      visibleAnchors: [],
      activeFilters: undefined,
      lastUserAction: undefined,
      modalStack: [],
      epoch: 0
    };

    // Initialize debounced functions with specified intervals
    this._debouncedScrollUpdate = debounce((visibleAnchors: string[]) => {
      if (this._anchorsChanged(visibleAnchors)) {
        this._currentUIState.visibleAnchors = visibleAnchors;
        this._currentUIState.lastUserAction = {
          type: 'scroll',
          timestamp: Date.now()
        };
        this._sendBackgroundUpdate();
      }
    }, 10000); // 10 seconds for scroll updates

    this._debouncedFilterUpdate = debounce((filters: UIState['activeFilters']) => {
      this._currentUIState.activeFilters = filters;
      this._currentUIState.lastUserAction = {
        type: filters?.searchTerm ? 'search' : 'filter',
        timestamp: Date.now()
      };
      this._sendBackgroundUpdate();
    }, 5000); // 5 seconds for search/filter updates

    this._debouncedStateUpdate = debounce((state: UIState) => {
      this._sendBackgroundUpdate();
    }, 2000); // 2 seconds for general state updates

    this._setupEpochTracking();
  }

  static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  /**
   * Initialize the unified UI manager with consolidated state management
   */
  initialize(backgroundUpdateCallback?: BackgroundUpdateCallback): void {
    if (this._isInitialized) {
      return;
    }

    this._backgroundUpdateCallback = backgroundUpdateCallback || null;
    this._setupIntersectionObserver();
    this._setupNavigationListeners();
    this._setupGlobalErrorHandling();
    this._isInitialized = true;

    // Initial state capture
    this._updateBreadcrumbPath();
    this._updateVisibleAnchors();

    console.log('UIManager initialized with consolidated state management and navigation');
  }

  /**
   * Configure navigation timing parameters
   */
  configureTiming(config: Partial<NavigationTimingConfig>): void {
    this._timingConfig = { ...this._timingConfig, ...config };
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'config_update',
        config: this._timingConfig
      },
      'navigation-orchestrator'
    );
  }

  /**
   * Set animation mode for testing different UX approaches
   */
  setAnimationMode(mode: 'human' | 'instant' | 'custom', customConfig?: Partial<NavigationTimingConfig>): void {
    if (mode === 'instant') {
      this._timingConfig = {
        ...this._timingConfig,
        modalOpenDuration: 0,
        modalCloseDuration: 0,
        scrollDuration: 0,
        fadeInDuration: 0,
        fadeOutDuration: 0,
        defaultStepDelay: 0,
        modalTransitionDelay: 0,
        scrollSettleDelay: 0,
        animationMode: 'instant'
      };
    } else if (mode === 'human') {
      this._timingConfig = {
        ...this._timingConfig,
        modalOpenDuration: 300,
        modalCloseDuration: 250,
        scrollDuration: 800,
        fadeInDuration: 200,
        fadeOutDuration: 150,
        defaultStepDelay: 150,
        modalTransitionDelay: 400,
        scrollSettleDelay: 200,
        animationMode: 'human'
      };
    } else if (mode === 'custom' && customConfig) {
      this._timingConfig = {
        ...this._timingConfig,
        ...customConfig,
        animationMode: 'custom'
      };
    }

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'animation_mode_changed',
        mode,
        config: this._timingConfig
      },
      'navigation-orchestrator'
    );
  }

  /**
   * Get current timing configuration
   */
  getTimingConfig(): NavigationTimingConfig {
    return { ...this._timingConfig };
  }

  /**
   * Get current navigation state
   */
  getNavigationState(): NavigationState {
    return { ...this._navigationState };
  }

  /**
   * Check if orchestrator can accept new navigation requests
   */
  canAcceptNewRequest(): boolean {
    return !this._navigationState.isExecuting || this._navigationState.canBeInterrupted;
  }

  /**
   * Describe current UI state with epoch and available affordances
   */
  describe(): UIDescribeResponse {
    // Update breadcrumb path in real-time
    this._currentUIState.breadcrumbPath = this._generateBreadcrumbPath();

    // Get current route from URL or state
    const route = this._getCurrentRoute();

    // Build view stack (route + open modals)
    const viewStack = [route];
    if (this._modalStack.length > 0) {
      this._modalStack.forEach(modal => {
        viewStack.push(`${modal.type}Modal:${modal.id}`);
      });
    }

    // Get available sections based on current context
    const sections = this._detectAvailableSections();

    // Get available transitions based on current state
    const transitions = this._detectAvailableTransitions(route, this._getProjectParam());

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'ui_describe',
        epoch: this._currentUIState.epoch,
        route,
        viewStack,
        sectionsCount: sections.length,
        transitionsCount: transitions.length
      },
      'ui-manager'
    );

    return {
      epoch: this._currentUIState.epoch,
      route,
      viewStack,
      sections,
      transitions
    };
  }

  /**
   * Get current UI state (consolidated from UIStateManager)
   */
  getCurrentUIState(): UIState {
    // Update breadcrumb path in real-time
    this._currentUIState.breadcrumbPath = this._generateBreadcrumbPath();
    this._currentUIState.modalStack = [...this._modalStack];
    this._currentUIState.epoch = this._currentEpoch;
    return { ...this._currentUIState };
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
    this._currentUIState.breadcrumbPath = path || this._generateBreadcrumbPath();
    this._currentUIState.lastUserAction = {
      type: 'navigate',
      timestamp: Date.now()
    };
    this._currentEpoch++;

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
   * Request interruption of current navigation
   */
  async requestInterruption(newIntent: UIIntentParams, force: boolean = false): Promise<boolean> {
    if (!this._navigationState.isExecuting) {
      return true; // No interruption needed
    }

    const currentPlanId = this._navigationState.currentPlanId;
    if (!currentPlanId) {
      return true;
    }

    if (force) {
      return this._forceInterruption(currentPlanId, newIntent);
    } else {
      return this._gracefulInterruption(currentPlanId, newIntent);
    }
  }

  /**
   * Setup global error handling for navigation
   */
  private _setupGlobalErrorHandling(): void {
    if (typeof window !== 'undefined') {
      // Handle page unload during navigation
      window.addEventListener('beforeunload', () => {
        this._cleanupAllExecutions('page_unload');
      });

      // Handle visibility changes (tab switching, etc.)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this._navigationState.isExecuting) {
          this._pauseCurrentExecution();
        } else if (!document.hidden && this._navigationState.isExecuting) {
          this._resumeCurrentExecution();
        }
      });

      // Handle browser back/forward for modal stack
      window.addEventListener('popstate', (event) => {
        this._handleBrowserNavigation(event);
      });
    }
  }

  /**
   * Get current modal stack
   */
  getModalStack(): ModalStackEntry[] {
    return [...this._modalStack];
  }

  /**
   * Add modal state listener
   */
  addModalStateListener(listener: (stack: ModalStackEntry[]) => void): void {
    this._modalStateListeners.add(listener);
  }

  /**
   * Remove modal state listener
   */
  removeModalStateListener(listener: (stack: ModalStackEntry[]) => void): void {
    this._modalStateListeners.delete(listener);
  }

  /**
   * Push modal to stack with smart URL management
   */
  private _pushModal(entry: Omit<ModalStackEntry, 'level'>): void {
    const level = this._modalStack.length;
    const modalEntry: ModalStackEntry = { ...entry, level };

    // Determine URL tracking strategy
    const shouldTrackInURL = this._shouldTrackModalInURL(modalEntry);
    modalEntry.urlTracked = shouldTrackInURL;

    this._modalStack.push(modalEntry);

    // Update URL if needed
    if (shouldTrackInURL) {
      this._updateURLForModalStack();
    }

    // Notify listeners
    this._notifyModalStateListeners();

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'modal_pushed',
        modalId: entry.id,
        level,
        urlTracked: shouldTrackInURL,
        stackSize: this._modalStack.length
      },
      'navigation-orchestrator'
    );
  }

  /**
   * Pop modal from stack
   */
  private _popModal(modalId?: string): ModalStackEntry | null {
    let poppedModal: ModalStackEntry | null = null;

    if (modalId) {
      // Remove specific modal and all modals above it
      const index = this._modalStack.findIndex(m => m.id === modalId);
      if (index !== -1) {
        const removed = this._modalStack.splice(index);
        poppedModal = removed[0];
      }
    } else {
      // Remove top modal
      poppedModal = this._modalStack.pop() || null;
    }

    if (poppedModal) {
      // Update URL if the removed modal was tracked
      if (poppedModal.urlTracked || this._modalStack.some(m => m.urlTracked)) {
        this._updateURLForModalStack();
      }

      // Notify listeners
      this._notifyModalStateListeners();

      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'modal_popped',
          modalId: poppedModal.id,
          level: poppedModal.level,
          stackSize: this._modalStack.length
        },
        'navigation-orchestrator'
      );
    }

    return poppedModal;
  }

  /**
   * Determine if modal should be tracked in URL
   */
  private _shouldTrackModalInURL(modal: ModalStackEntry): boolean {
    const currentRoute = this._getCurrentRoute();

    // Always track top-level modals
    if (modal.level === 0) {
      return true;
    }

    // Track project modals even if nested (important for navigation)
    if (modal.type === 'project') {
      return true;
    }

    // Track gallery/example modals if they're direct children of project modals
    if (modal.level === 1 && modal.parentId && (modal.type === 'gallery' || modal.type === 'example')) {
      const parentModal = this._modalStack.find(m => m.id === modal.parentId);
      if (parentModal && parentModal.type === 'project') {
        return true;
      }
    }

    // Don't track deep nesting (level 2+) or temporary modals
    return false;
  }

  /**
   * Update URL based on current modal stack
   */
  private _updateURLForModalStack(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    // Clear existing modal parameters
    url.searchParams.delete('project');
    url.searchParams.delete('modal');
    url.searchParams.delete('gallery');
    url.searchParams.delete('example');

    // Add parameters for URL-tracked modals in order
    const trackedModals = this._modalStack.filter(m => m.urlTracked).sort((a, b) => a.level - b.level);

    trackedModals.forEach(modal => {
      switch (modal.type) {
        case 'project':
          url.searchParams.set('project', modal.id);
          break;
        case 'gallery':
          url.searchParams.set('gallery', modal.id);
          break;
        case 'example':
          url.searchParams.set('example', modal.id);
          break;
        default:
          url.searchParams.set('modal', modal.id);
          break;
      }
    });

    // Update URL without triggering navigation
    window.history.replaceState({}, '', url.toString());

    // Update internal state to reflect URL change
    this._currentEpoch++;
    this._updateBreadcrumbPath();
  }

  /**
   * Handle browser back/forward navigation
   */
  private _handleBrowserNavigation(event: PopStateEvent): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const projectParam = url.searchParams.get('project');
    const modalParam = url.searchParams.get('modal');

    // Reconstruct expected modal stack from URL
    const expectedStack: ModalStackEntry[] = [];

    if (projectParam) {
      expectedStack.push({
        id: projectParam,
        type: 'project',
        urlTracked: true,
        level: 0
      });
    }

    if (modalParam) {
      expectedStack.push({
        id: modalParam,
        type: 'generic',
        urlTracked: true,
        level: expectedStack.length
      });
    }

    // Sync modal stack with URL
    this._syncModalStackWithURL(expectedStack);
  }

  /**
   * Sync modal stack with URL state
   */
  private _syncModalStackWithURL(expectedStack: ModalStackEntry[]): void {
    // Close modals that shouldn't be open
    const currentTracked = this._modalStack.filter(m => m.urlTracked);
    const toClose = currentTracked.filter(current =>
      !expectedStack.some(expected => expected.id === current.id)
    );

    toClose.forEach(modal => {
      this._closeModalElement(modal.id);
    });

    // Open modals that should be open
    const toOpen = expectedStack.filter(expected =>
      !currentTracked.some(current => current.id === expected.id)
    );

    toOpen.forEach(modal => {
      this._openModalElement(modal.id, modal.type);
    });

    // Update internal stack
    this._modalStack = this._modalStack.filter(m => !m.urlTracked);
    this._modalStack.push(...expectedStack);

    // Notify listeners
    this._notifyModalStateListeners();
  }

  /**
   * Notify modal state listeners
   */
  private _notifyModalStateListeners(): void {
    const stack = [...this._modalStack];
    this._modalStateListeners.forEach(listener => {
      try {
        listener(stack);
      } catch (error) {
        console.error('Error in modal state listener:', error);
      }
    });
  }

  /**
   * Open modal element (DOM manipulation)
   */
  private _openModalElement(modalId: string, modalType: string): void {
    // This would integrate with your actual modal system
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'modal_dom_open',
        modalId,
        modalType
      },
      'navigation-orchestrator'
    );
  }

  /**
   * Close modal element (DOM manipulation)
   */
  private _closeModalElement(modalId: string): void {
    // This would integrate with your actual modal system
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'modal_dom_close',
        modalId
      },
      'navigation-orchestrator'
    );
  }

  /**
   * Execute a navigation intent declaratively with robust state management
   */
  async executeIntent(params: UIIntentParams, sessionId?: string): Promise<NavigationResult> {
    const startTime = Date.now();
    const planId = uuidv4();
    const correlationId = `nav_intent_${planId}`;

    // Validate the navigation intent
    const validation = this._validateNavigationIntent(params);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.reason || 'Invalid navigation intent',
        error: 'VALIDATION_FAILED',
        executedSteps: [],
        totalTime: Date.now() - startTime
      };
    }

    // Check if we can accept this request
    if (!this.canAcceptNewRequest()) {
      // Try graceful interruption first
      const interruptionSuccessful = await this.requestInterruption(params, false);
      if (!interruptionSuccessful) {
        return {
          success: false,
          message: 'Navigation orchestrator is busy and cannot be interrupted',
          error: 'ORCHESTRATOR_BUSY',
          executedSteps: [],
          totalTime: Date.now() - startTime
        };
      }
    }

    // Check idempotency
    if (params.idempotencyKey) {
      const existingResult = this._completedPlans.get(params.idempotencyKey);
      if (existingResult) {
        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'idempotent_skip',
            planId,
            idempotencyKey: params.idempotencyKey,
            result: existingResult
          },
          sessionId || 'navigation-orchestrator',
          correlationId
        );
        return existingResult;
      }

      const existingExecution = this._executingPlans.get(params.idempotencyKey);
      if (existingExecution) {
        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'idempotent_wait',
            planId,
            idempotencyKey: params.idempotencyKey
          },
          sessionId || 'navigation-orchestrator',
          correlationId
        );
        return await existingExecution;
      }
    }

    // Update navigation state
    this._updateNavigationState({
      isExecuting: true,
      currentPlanId: planId,
      currentStepIndex: -1,
      currentStepId: null,
      startTime,
      canBeInterrupted: params.behavior?.allowInterruption !== false,
      interruptionRequested: false,
      lastError: null
    });

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'intent_start',
        planId,
        params,
        currentState: this.getCurrentUIState()
      },
      sessionId || 'navigation-orchestrator',
      correlationId
    );

    try {
      // Create navigation plan
      const plan = await this._createNavigationPlan(params, planId);

      // Create execution context
      const executionContext: PlanExecutionContext = {
        planId,
        sessionId,
        correlationId,
        startTime,
        abortController: new AbortController(),
        currentStepIndex: -1,
        executedSteps: [],
        canBeInterrupted: params.behavior?.allowInterruption !== false
      };

      this._executionContexts.set(planId, executionContext);

      // Execute plan with enhanced context
      const executionPromise = this._executePlanWithContext(plan, executionContext);

      // Store execution promise for idempotency
      if (params.idempotencyKey) {
        this._executingPlans.set(params.idempotencyKey, executionPromise);
      }

      const result = await executionPromise;

      // Store completed result and cleanup
      if (params.idempotencyKey) {
        this._executingPlans.delete(params.idempotencyKey);
        this._completedPlans.set(params.idempotencyKey, result);

        // Clean up old completed plans (keep last 100)
        if (this._completedPlans.size > 100) {
          const keys = Array.from(this._completedPlans.keys());
          keys.slice(0, keys.length - 100).forEach(key => {
            this._completedPlans.delete(key);
          });
        }
      }

      // Cleanup execution context
      this._executionContexts.delete(planId);

      // Reset navigation state
      this._updateNavigationState({
        isExecuting: false,
        currentPlanId: null,
        currentStepIndex: -1,
        currentStepId: null,
        startTime: null,
        canBeInterrupted: true,
        interruptionRequested: false,
        lastError: result.success ? null : result.error || 'Unknown error'
      });

      const totalTime = Date.now() - startTime;

      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'intent_complete',
          planId,
          result,
          totalTime
        },
        sessionId || 'navigation-orchestrator',
        correlationId
      );

      // Handle any pending interruptions
      await this._processPendingInterruptions();

      return {
        ...result,
        totalTime
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const errorResult: NavigationResult = {
        success: false,
        message: `Navigation intent failed: ${errorMessage}`,
        error: errorMessage,
        executedSteps: [],
        totalTime
      };

      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'intent_error',
          planId,
          error: errorMessage,
          totalTime
        },
        sessionId || 'navigation-orchestrator',
        correlationId
      );

      // Clean up execution tracking
      if (params.idempotencyKey) {
        this._executingPlans.delete(params.idempotencyKey);
      }

      // Cleanup execution context
      this._executionContexts.delete(planId);

      // Reset navigation state
      this._updateNavigationState({
        isExecuting: false,
        currentPlanId: null,
        currentStepIndex: -1,
        currentStepId: null,
        startTime: null,
        canBeInterrupted: true,
        interruptionRequested: false,
        lastError: errorMessage
      });

      return errorResult;
    }
  }

  /**
   * Execute a step with retry logic
   */
  private async _executeStepWithRetries(
    step: NavigationStep,
    sessionId?: string,
    correlationId?: string
  ): Promise<NavigationStepResult> {
    const maxRetries = step.retries || this._timingConfig.maxRetries;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'step_attempt',
            stepId: step.id,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1
          },
          sessionId || 'navigation-orchestrator',
          correlationId
        );

        const result = await step.execute();

        if (result.success) {
          return result;
        }

        lastError = result.error || 'Step execution failed';

        // Check if we should retry
        if (attempt < maxRetries && result.shouldRetry !== false) {
          const delay = this._timingConfig.retryDelayBase * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt < maxRetries) {
          const delay = this._timingConfig.retryDelayBase * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return {
          success: false,
          message: `Step ${step.id} failed after ${maxRetries + 1} attempts`,
          error: lastError
        };
      }
    }

    return {
      success: false,
      message: `Step ${step.id} failed after ${maxRetries + 1} attempts`,
      error: lastError || 'Unknown error'
    };
  }

  /**
   * Enhanced plan execution with context and interruption support
   */
  private async _executePlanWithContext(plan: NavigationPlan, context: PlanExecutionContext): Promise<NavigationResult> {
    const executedSteps: string[] = [];
    let lastError: string | undefined;

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'plan_start',
        planId: plan.id,
        stepsCount: plan.steps.length,
        totalTimeout: plan.totalTimeout,
        canBeInterrupted: context.canBeInterrupted
      },
      context.sessionId || 'navigation-orchestrator',
      context.correlationId
    );

    try {
      // Execute steps sequentially with interruption checks
      for (let i = 0; i < plan.steps.length; i++) {
        // Check for interruption requests
        if (this._navigationState.interruptionRequested) {
          debugEventEmitter.emit(
            'navigation_event',
            {
              type: 'plan_interrupted',
              planId: plan.id,
              stepIndex: i,
              executedSteps: executedSteps.length
            },
            context.sessionId || 'navigation-orchestrator',
            context.correlationId
          );

          return {
            success: false,
            message: `Navigation interrupted at step ${i + 1}/${plan.steps.length}`,
            error: 'NAVIGATION_INTERRUPTED',
            executedSteps,
            totalTime: 0
          };
        }

        // Check abort signal
        if (context.abortController.signal.aborted) {
          return {
            success: false,
            message: `Navigation aborted at step ${i + 1}/${plan.steps.length}`,
            error: 'NAVIGATION_ABORTED',
            executedSteps,
            totalTime: 0
          };
        }

        const step = plan.steps[i];
        const stepStartTime = Date.now();

        // Update current step state
        this._updateNavigationState({
          currentStepIndex: i,
          currentStepId: step.id
        });

        context.currentStepIndex = i;

        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'step_start',
            planId: plan.id,
            stepId: step.id,
            stepType: step.type,
            stepIndex: i,
            canBeInterrupted: context.canBeInterrupted
          },
          context.sessionId || 'navigation-orchestrator',
          context.correlationId
        );

        try {
          // Execute step with enhanced retry logic
          const result = await this._executeStepWithEnhancedRetries(step, context);
          const stepTime = Date.now() - stepStartTime;

          if (result.success) {
            executedSteps.push(step.id);
            context.executedSteps.push(step.id);

            debugEventEmitter.emit(
              'navigation_event',
              {
                type: 'step_complete',
                planId: plan.id,
                stepId: step.id,
                result,
                executionTime: stepTime
              },
              context.sessionId || 'navigation-orchestrator',
              context.correlationId
            );
          } else {
            lastError = result.error || result.message;
            debugEventEmitter.emit(
              'navigation_event',
              {
                type: 'step_error',
                planId: plan.id,
                stepId: step.id,
                error: lastError,
                executionTime: stepTime
              },
              context.sessionId || 'navigation-orchestrator',
              context.correlationId
            );

            // Decide whether to continue or abort
            if (!result.shouldRetry) {
              break; // Critical failure, abort plan
            }
          }

        } catch (error) {
          const stepTime = Date.now() - stepStartTime;
          lastError = error instanceof Error ? error.message : String(error);

          debugEventEmitter.emit(
            'navigation_event',
            {
              type: 'step_exception',
              planId: plan.id,
              stepId: step.id,
              error: lastError,
              executionTime: stepTime
            },
            context.sessionId || 'navigation-orchestrator',
            context.correlationId
          );

          break; // Exception, abort plan
        }
      }

      // Determine overall result
      const success = executedSteps.length > 0 && !lastError;
      const message = success
        ? `Navigation completed successfully (${executedSteps.length}/${plan.steps.length} steps)`
        : `Navigation failed: ${lastError || 'Unknown error'}`;

      return {
        success,
        message,
        data: {
          planId: plan.id,
          target: plan.target,
          stepsPlanned: plan.steps.length,
          stepsExecuted: executedSteps.length
        },
        error: lastError,
        executedSteps,
        totalTime: 0 // Will be set by caller
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Plan execution failed: ${errorMessage}`,
        error: errorMessage,
        executedSteps,
        totalTime: 0
      };
    }
  }

  /**
   * Update navigation state safely
   */
  private _updateNavigationState(updates: Partial<NavigationState>): void {
    this._navigationState = { ...this._navigationState, ...updates };

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'state_update',
        state: this._navigationState
      },
      'navigation-orchestrator'
    );
  }

  /**
   * Graceful interruption handling
   */
  private async _gracefulInterruption(currentPlanId: string, newIntent: UIIntentParams): Promise<boolean> {
    if (!this._navigationState.canBeInterrupted) {
      return false;
    }

    this._updateNavigationState({ interruptionRequested: true });
    this._pendingInterruptions.set(currentPlanId, newIntent);

    // Wait for graceful cancellation
    const timeout = setTimeout(() => {
      this._forceInterruption(currentPlanId, newIntent);
    }, this._timingConfig.gracefulCancelTimeoutMs);

    // Check if interruption completed
    const checkInterval = setInterval(() => {
      if (!this._navigationState.isExecuting || this._navigationState.currentPlanId !== currentPlanId) {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        return true;
      }
    }, 100);

    return true;
  }

  /**
   * Force interruption handling
   */
  private async _forceInterruption(currentPlanId: string, newIntent: UIIntentParams): Promise<boolean> {
    const context = this._executionContexts.get(currentPlanId);
    if (context) {
      context.abortController.abort();
    }

    // Force cleanup after timeout
    setTimeout(() => {
      this._cleanupExecution(currentPlanId, 'force_interrupted');
    }, this._timingConfig.forceCancelTimeoutMs);

    this._pendingInterruptions.set(currentPlanId, newIntent);
    return true;
  }

  /**
   * Process pending interruptions
   */
  private async _processPendingInterruptions(): Promise<void> {
    if (this._pendingInterruptions.size === 0) {
      return;
    }

    // Execute the most recent interruption request
    const entries = Array.from(this._pendingInterruptions.entries());
    const [planId, intent] = entries[entries.length - 1];

    this._pendingInterruptions.clear();

    // Execute the pending intent
    setTimeout(() => {
      this.executeIntent(intent);
    }, this._timingConfig.animationBufferWait);
  }

  /**
   * Cleanup execution context
   */
  private _cleanupExecution(planId: string, reason: string): void {
    const context = this._executionContexts.get(planId);
    if (context) {
      context.abortController.abort();
      this._executionContexts.delete(planId);
    }

    if (this._navigationState.currentPlanId === planId) {
      this._updateNavigationState({
        isExecuting: false,
        currentPlanId: null,
        currentStepIndex: -1,
        currentStepId: null,
        startTime: null,
        canBeInterrupted: true,
        interruptionRequested: false,
        lastError: `Execution cleaned up: ${reason}`
      });
    }

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'execution_cleanup',
        planId,
        reason
      },
      'navigation-orchestrator'
    );
  }

  /**
   * Cleanup all executions
   */
  private _cleanupAllExecutions(reason: string): void {
    this._executionContexts.forEach((context, planId) => {
      this._cleanupExecution(planId, reason);
    });
    this._pendingInterruptions.clear();
  }

  /**
   * Pause current execution (for tab switching, etc.)
   */
  private _pauseCurrentExecution(): void {
    if (this._navigationState.isExecuting) {
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'execution_paused',
          planId: this._navigationState.currentPlanId
        },
        'navigation-orchestrator'
      );
    }
  }

  /**
   * Resume current execution
   */
  private _resumeCurrentExecution(): void {
    if (this._navigationState.isExecuting) {
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'execution_resumed',
          planId: this._navigationState.currentPlanId
        },
        'navigation-orchestrator'
      );
    }
  }

  /**
   * Describe current UI state and available navigation affordances
   */
  async describeUI(): Promise<UIDescribeResponse> {
    const currentState = this.getCurrentUIState();
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

    // Increment epoch for state changes
    this._currentEpoch++;

    // Determine current route
    let route = 'unknown';
    if (pathname === '/') {
      route = 'home';
    } else if (pathname === '/projects') {
      route = 'projects';
    } else if (pathname.startsWith('/projects/')) {
      route = 'project-detail';
    } else {
      route = pathname.replace(/^\//, '').replace(/\/$/, '') || 'home';
    }

    // Build view stack
    const viewStack: string[] = [route];
    const projectParam = searchParams.get('project');
    if (projectParam) {
      viewStack.push(`projectModal:${projectParam}`);
    }

    // Detect available sections
    const sections = this._detectAvailableSections();

    // Determine available transitions
    const transitions = this._detectAvailableTransitions(route, projectParam);

    return {
      epoch: this._currentEpoch,
      route,
      viewStack,
      sections,
      transitions
    };
  }

  /**
   * Create a navigation plan based on current state and target
   */
  private async _createNavigationPlan(params: UIIntentParams, planId: string): Promise<NavigationPlan> {
    const currentState = this.getCurrentUIState();
    const steps: NavigationStep[] = [];
    const defaultBehavior = {
      openIfNeeded: true,
      closeBlocking: true,
      waitForReadyMs: 1500,
      scrollBehavior: 'smooth' as const,
      allowInterruption: true,
      urlStrategy: 'full' as const,
      ...params.behavior
    };

    // Analyze current state and determine required steps
    switch (params.target.type) {
      case 'route':
        steps.push(...this._planRouteNavigation(params.target.id, currentState, defaultBehavior));
        break;

      case 'project':
        // Handle complex project navigation scenarios
        steps.push(...this._planComplexProjectNavigation(params.target.id, params.target.sectionId, currentState, defaultBehavior));
        break;

      case 'section':
        // Handle complex section navigation scenarios
        if (params.target.projectId) {
          // Navigate to project first, then section (handles project switching)
          steps.push(...this._planComplexProjectNavigation(params.target.projectId, params.target.id, currentState, defaultBehavior));
        } else {
          // Direct section navigation (within current context)
          steps.push(...this._planSectionNavigation(params.target.id, currentState, defaultBehavior));
        }
        break;

      case 'element':
        steps.push(...this._planElementNavigation(params.target.id, currentState, defaultBehavior));
        break;

      default:
        throw new Error(`Unknown target type: ${(params.target as any).type}`);
    }

    // Add wait step if specified
    if (defaultBehavior.waitForReadyMs && defaultBehavior.waitForReadyMs > 0) {
      steps.push(this._createWaitStep(defaultBehavior.waitForReadyMs));
    }

    return {
      id: planId,
      target: params.target,
      steps,
      totalTimeout: Math.max(30000, steps.length * 5000), // 30s minimum, 5s per step
      idempotencyKey: params.idempotencyKey
    };
  }

  /**
   * Plan complex project navigation handling modal switching and sections
   */
  private _planComplexProjectNavigation(
    targetProjectId: string,
    targetSectionId: string | undefined,
    currentState: UIState,
    behavior: any
  ): NavigationStep[] {
    const steps: NavigationStep[] = [];
    const currentRoute = this._getCurrentRoute();
    const currentProjectModal = this._modalStack.find(m => m.type === 'project');

    // Scenario 1: Currently viewing Project A, want to view Project B (with optional section)
    if (currentProjectModal && currentProjectModal.id !== targetProjectId) {
      // Close current project modal
      steps.push(this._createCloseModalStep(currentProjectModal.id, behavior));

      // Add delay for modal close animation
      if (this._timingConfig.animationMode !== 'instant') {
        steps.push(this._createDelayStep(this._timingConfig.modalTransitionDelay));
      }

      // Navigate to projects page if not already there
      if (currentRoute !== 'projects') {
        steps.push(this._createRouteNavigationStep('projects', behavior));

        // Add delay for route navigation
        if (this._timingConfig.animationMode !== 'instant') {
          steps.push(this._createDelayStep(this._timingConfig.routeNavigationWait));
        }
      }

      // Open new project modal
      steps.push(this._createOpenProjectModalStep(targetProjectId, behavior));

      // Add delay for modal open animation
      if (this._timingConfig.animationMode !== 'instant') {
        steps.push(this._createDelayStep(this._timingConfig.modalTransitionDelay));
      }
    }
    // Scenario 2: No project modal open, need to open one
    else if (!currentProjectModal) {
      // Navigate to projects page if not already there
      if (currentRoute !== 'projects') {
        steps.push(this._createRouteNavigationStep('projects', behavior));

        if (this._timingConfig.animationMode !== 'instant') {
          steps.push(this._createDelayStep(this._timingConfig.routeNavigationWait));
        }
      }

      // Open project modal
      steps.push(this._createOpenProjectModalStep(targetProjectId, behavior));

      if (this._timingConfig.animationMode !== 'instant') {
        steps.push(this._createDelayStep(this._timingConfig.modalTransitionDelay));
      }
    }
    // Scenario 3: Already viewing the correct project, just need section navigation
    else if (currentProjectModal.id === targetProjectId) {
      // Already in the right project, no modal changes needed
    }

    // Add section navigation if specified
    if (targetSectionId) {
      steps.push(this._createSectionScrollStep(targetSectionId, behavior));

      if (this._timingConfig.animationMode !== 'instant') {
        steps.push(this._createDelayStep(this._timingConfig.scrollSettleDelay));
      }
    }

    return steps;
  }

  /**
   * Create a delay step for human-like navigation timing
   */
  private _createDelayStep(delayMs: number): NavigationStep {
    return {
      id: `delay_${delayMs}ms_${Date.now()}`,
      type: 'wait',
      timeout: delayMs + 1000, // Add buffer for timeout
      execute: async () => {
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return {
          success: true,
          message: `Delayed ${delayMs}ms for animation timing`
        };
      }
    };
  }

  /**
   * Create a step to close a specific modal
   */
  private _createCloseModalStep(modalId: string, behavior: any): NavigationStep {
    return {
      id: `close_modal_${modalId}`,
      type: 'close',
      timeout: this._timingConfig.stepTimeoutMs,
      execute: async () => {
        try {
          // Find and close the modal
          const modal = this._modalStack.find(m => m.id === modalId);
          if (!modal) {
            return {
              success: true,
              message: `Modal ${modalId} already closed`
            };
          }

          // Close modal in DOM
          this._closeModalElement(modalId);

          // Update internal state
          this._popModal(modalId);

          // Wait for close animation if not instant
          if (this._timingConfig.animationMode !== 'instant') {
            await new Promise(resolve => setTimeout(resolve, this._timingConfig.modalCloseDuration));
          }

          return {
            success: true,
            message: `Successfully closed modal ${modalId}`
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to close modal ${modalId}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  /**
   * Create a step to open a project modal
   */
  private _createOpenProjectModalStep(projectId: string, behavior: any): NavigationStep {
    return {
      id: `open_project_${projectId}`,
      type: 'modal',
      timeout: this._timingConfig.stepTimeoutMs,
      execute: async () => {
        try {
          // Add to modal stack
          this._pushModal({
            id: projectId,
            type: 'project',
            urlTracked: true
          });

          // Open modal in DOM
          this._openModalElement(projectId, 'project');

          // Wait for open animation if not instant
          if (this._timingConfig.animationMode !== 'instant') {
            await new Promise(resolve => setTimeout(resolve, this._timingConfig.modalOpenDuration));
          }

          return {
            success: true,
            message: `Successfully opened project modal ${projectId}`
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to open project modal ${projectId}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  /**
   * Create a step for route navigation
   */
  private _createRouteNavigationStep(route: string, behavior: any): NavigationStep {
    return {
      id: `navigate_to_${route}`,
      type: 'navigate',
      path: `/${route}`,
      timeout: this._timingConfig.stepTimeoutMs,
      execute: async () => {
        try {
          // Navigate to route
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', `/${route}`);

            // Update internal state
            this._currentEpoch++;
            this._updateBreadcrumbPath();

            // Trigger any necessary page updates
            window.dispatchEvent(new PopStateEvent('popstate'));
          }

          return {
            success: true,
            message: `Successfully navigated to ${route}`
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to navigate to ${route}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  /**
   * Create a step for section scrolling
   */
  private _createSectionScrollStep(sectionId: string, behavior: any): NavigationStep {
    return {
      id: `scroll_to_${sectionId}`,
      type: 'scroll',
      selector: `#${sectionId}, [data-section="${sectionId}"]`,
      timeout: this._timingConfig.stepTimeoutMs,
      execute: async () => {
        try {
          if (typeof window === 'undefined') {
            return {
              success: true,
              message: 'Server-side, skipping scroll'
            };
          }

          const element = document.querySelector(`#${sectionId}, [data-section="${sectionId}"]`);
          if (!element) {
            return {
              success: false,
              message: `Section ${sectionId} not found`
            };
          }

          // Scroll to element
          element.scrollIntoView({
            behavior: this._timingConfig.animationMode === 'instant' ? 'auto' : 'smooth',
            block: 'start'
          });

          // Wait for scroll animation if not instant
          if (this._timingConfig.animationMode !== 'instant') {
            await new Promise(resolve => setTimeout(resolve, this._timingConfig.scrollDuration));
          }

          return {
            success: true,
            message: `Successfully scrolled to section ${sectionId}`
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to scroll to section ${sectionId}`,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  /**
   * Execute a navigation plan with step sequencing and error handling
   */
  private async _executePlan(plan: NavigationPlan, sessionId?: string, correlationId?: string): Promise<NavigationResult> {
    const executedSteps: string[] = [];
    let lastError: string | undefined;

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'plan_start',
        planId: plan.id,
        stepsCount: plan.steps.length,
        totalTimeout: plan.totalTimeout
      },
      sessionId || 'navigation-orchestrator',
      correlationId
    );

    // Execute steps sequentially
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepStartTime = Date.now();

      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'step_start',
          planId: plan.id,
          stepId: step.id,
          stepType: step.type,
          stepIndex: i
        },
        sessionId || 'navigation-orchestrator',
        correlationId
      );

      try {
        // Check step condition if provided
        if (step.condition && !step.condition()) {
          debugEventEmitter.emit(
            'navigation_event',
            {
              type: 'step_skip',
              planId: plan.id,
              stepId: step.id,
              reason: 'condition_not_met'
            },
            sessionId || 'navigation-orchestrator',
            correlationId
          );
          continue;
        }

        // Execute step with retries
        const result = await this._executeStepWithRetries(step, sessionId, correlationId);
        const stepTime = Date.now() - stepStartTime;

        if (result.success) {
          executedSteps.push(step.id);
          debugEventEmitter.emit(
            'navigation_event',
            {
              type: 'step_complete',
              planId: plan.id,
              stepId: step.id,
              result,
              executionTime: stepTime
            },
            sessionId || 'navigation-orchestrator',
            correlationId
          );
        } else {
          lastError = result.error || result.message;
          debugEventEmitter.emit(
            'navigation_event',
            {
              type: 'step_error',
              planId: plan.id,
              stepId: step.id,
              error: lastError,
              executionTime: stepTime
            },
            sessionId || 'navigation-orchestrator',
            correlationId
          );

          // Decide whether to continue or abort
          if (!result.shouldRetry) {
            break; // Critical failure, abort plan
          }
        }

      } catch (error) {
        const stepTime = Date.now() - stepStartTime;
        lastError = error instanceof Error ? error.message : String(error);

        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'step_exception',
            planId: plan.id,
            stepId: step.id,
            error: lastError,
            executionTime: stepTime
          },
          sessionId || 'navigation-orchestrator',
          correlationId
        );

        break; // Exception, abort plan
      }
    }

    // Determine overall result
    const success = executedSteps.length > 0 && !lastError;
    const message = success
      ? `Navigation completed successfully (${executedSteps.length}/${plan.steps.length} steps)`
      : `Navigation failed: ${lastError || 'Unknown error'}`;

    return {
      success,
      message,
      data: {
        planId: plan.id,
        target: plan.target,
        stepsPlanned: plan.steps.length,
        stepsExecuted: executedSteps.length
      },
      error: lastError,
      executedSteps,
      totalTime: 0 // Will be set by caller
    };
  }

  /**
   * Execute a single step with enhanced retry logic and configurable timing
   */
  private async _executeStepWithEnhancedRetries(step: NavigationStep, context: PlanExecutionContext): Promise<NavigationStepResult> {
    const maxRetries = step.retries || this._timingConfig.maxRetries;
    let lastResult: NavigationStepResult | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check for interruption before each attempt
        if (context.abortController.signal.aborted || this._navigationState.interruptionRequested) {
          return {
            success: false,
            message: 'Step execution interrupted',
            error: 'STEP_INTERRUPTED'
          };
        }

        // Add timeout wrapper with configurable timing
        const timeoutMs = step.timeout || this._timingConfig.stepTimeoutMs;
        const result = await Promise.race([
          step.execute(),
          new Promise<NavigationStepResult>((_, reject) =>
            setTimeout(() => reject(new Error(`Step timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);

        if (result.success || !result.shouldRetry) {
          return result;
        }

        lastResult = result;

        // Wait before retry with configurable delay
        if (attempt < maxRetries) {
          const retryDelay = this._timingConfig.retryDelayBase * Math.pow(2, attempt); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

      } catch (error) {
        lastResult = {
          success: false,
          message: `Step execution failed: ${error instanceof Error ? error.message : String(error)}`,
          error: error instanceof Error ? error.message : String(error),
          shouldRetry: attempt < maxRetries
        };

        if (attempt < maxRetries) {
          const retryDelay = this._timingConfig.retryDelayBase * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    return lastResult || {
      success: false,
      message: 'Step failed after all retries',
      error: 'Max retries exceeded'
    };
  }

  /**
   * Plan navigation to a specific route
   */
  private _planRouteNavigation(routeId: string, currentState: UIState, behavior: Required<UIIntentParams['behavior']>): NavigationStep[] {
    const steps: NavigationStep[] = [];
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    // Determine target path
    let targetPath: string;
    switch (routeId) {
      case 'home':
        targetPath = '/';
        break;
      case 'projects':
        targetPath = '/projects';
        break;
      case 'about':
        targetPath = '/about';
        break;
      case 'contact':
        targetPath = '/contact';
        break;
      default:
        targetPath = `/${routeId}`;
    }

    // Only navigate if we're not already on the target route
    if (currentPath !== targetPath) {
      steps.push({
        id: `navigate_to_${routeId}`,
        type: 'navigate',
        path: targetPath,
        execute: async () => {
          try {
            if (typeof window !== 'undefined') {
              window.location.href = targetPath;
              return {
                success: true,
                message: `Navigated to ${targetPath}`,
                data: { path: targetPath }
              };
            }
            return {
              success: false,
              message: 'Window not available for navigation',
              error: 'No window object'
            };
          } catch (error) {
            return {
              success: false,
              message: `Failed to navigate to ${targetPath}`,
              error: error instanceof Error ? error.message : String(error),
              shouldRetry: true
            };
          }
        }
      });
    }

    return steps;
  }

  /**
   * Plan navigation to a specific project
   */
  private _planProjectNavigation(projectId: string, currentState: UIState, behavior: Required<UIIntentParams['behavior']>): NavigationStep[] {
    const steps: NavigationStep[] = [];
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const currentProject = searchParams.get('project');

    // If we're already viewing this project, no navigation needed
    if (currentPath === '/projects' && currentProject === projectId) {
      return steps;
    }

    // If we're not on projects page, navigate there first
    if (currentPath !== '/projects') {
      steps.push({
        id: `navigate_to_projects`,
        type: 'navigate',
        path: '/projects',
        execute: async () => {
          try {
            if (typeof window !== 'undefined') {
              window.location.href = '/projects';
              return {
                success: true,
                message: 'Navigated to projects page',
                data: { path: '/projects' }
              };
            }
            return {
              success: false,
              message: 'Window not available for navigation',
              error: 'No window object'
            };
          } catch (error) {
            return {
              success: false,
              message: 'Failed to navigate to projects page',
              error: error instanceof Error ? error.message : String(error),
              shouldRetry: true
            };
          }
        }
      });
    } else if (currentProject && currentProject !== projectId && behavior.closeBlocking) {
      // We're on projects page but viewing a different project modal - close it first
      steps.push({
        id: `close_current_project_modal`,
        type: 'close',
        execute: async () => {
          try {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('project');
              window.history.pushState({}, '', url.toString());
              window.dispatchEvent(new PopStateEvent('popstate'));

              return {
                success: true,
                message: `Closed current project modal (${currentProject})`,
                data: { closedProject: currentProject }
              };
            }
            return {
              success: false,
              message: 'Window not available for modal operation',
              error: 'No window object'
            };
          } catch (error) {
            return {
              success: false,
              message: 'Failed to close current project modal',
              error: error instanceof Error ? error.message : String(error),
              shouldRetry: true
            };
          }
        }
      });

      // Add a brief wait for modal close animation
      steps.push(this._createWaitStep(this._timingConfig.modalCloseDuration + this._timingConfig.animationBufferWait));
    }

    // Open target project modal (only if we're not already viewing it)
    if (currentProject !== projectId) {
      steps.push({
        id: `open_project_${projectId}`,
        type: 'modal',
        execute: async () => {
          try {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('project', projectId);
              window.history.pushState({}, '', url.toString());
              window.dispatchEvent(new PopStateEvent('popstate'));

              return {
                success: true,
                message: `Opened project ${projectId}`,
                data: { projectId }
              };
            }
            return {
              success: false,
              message: 'Window not available for modal operation',
              error: 'No window object'
            };
          } catch (error) {
            return {
              success: false,
              message: `Failed to open project ${projectId}`,
              error: error instanceof Error ? error.message : String(error),
              shouldRetry: true
            };
          }
        }
      });

      // Add wait for modal open animation and content loading
      steps.push(this._createWaitStep(
        behavior.waitForReadyMs ||
        (this._timingConfig.modalOpenDuration + this._timingConfig.modalContentLoadWait)
      ));
    }

    return steps;
  }

  /**
   * Plan navigation to a specific section
   */
  private _planSectionNavigation(sectionId: string, currentState: UIState, behavior: Required<UIIntentParams['behavior']>): NavigationStep[] {
    const steps: NavigationStep[] = [];

    // Create scroll step
    steps.push({
      id: `scroll_to_${sectionId}`,
      type: 'scroll',
      selector: this._getSectionSelector(sectionId),
      execute: async () => {
        try {
          const selector = this._getSectionSelector(sectionId);
          const element = typeof window !== 'undefined' ? document.querySelector(selector) : null;

          if (!element) {
            return {
              success: false,
              message: `Section not found: ${sectionId}`,
              error: 'Element not found',
              shouldRetry: true
            };
          }

          element.scrollIntoView({
            behavior: behavior.scrollBehavior,
            block: 'center'
          });

          return {
            success: true,
            message: `Scrolled to section ${sectionId}`,
            data: { sectionId, selector }
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to scroll to section ${sectionId}`,
            error: error instanceof Error ? error.message : String(error),
            shouldRetry: true
          };
        }
      }
    });

    return steps;
  }

  /**
   * Plan navigation to a specific element
   */
  private _planElementNavigation(elementId: string, currentState: UIState, behavior: Required<UIIntentParams['behavior']>): NavigationStep[] {
    const steps: NavigationStep[] = [];

    // Create focus/scroll step
    steps.push({
      id: `focus_element_${elementId}`,
      type: 'scroll',
      selector: `#${elementId}`,
      execute: async () => {
        try {
          const element = typeof window !== 'undefined' ? document.getElementById(elementId) : null;

          if (!element) {
            return {
              success: false,
              message: `Element not found: ${elementId}`,
              error: 'Element not found',
              shouldRetry: true
            };
          }

          element.scrollIntoView({
            behavior: behavior.scrollBehavior,
            block: 'center'
          });

          if (element instanceof HTMLElement) {
            element.focus();
          }

          return {
            success: true,
            message: `Focused element ${elementId}`,
            data: { elementId }
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to focus element ${elementId}`,
            error: error instanceof Error ? error.message : String(error),
            shouldRetry: true
          };
        }
      }
    });

    return steps;
  }

  /**
   * Create a wait step
   */
  private _createWaitStep(waitMs: number): NavigationStep {
    return {
      id: `wait_${waitMs}ms`,
      type: 'wait',
      timeout: waitMs + 1000, // Add buffer to timeout
      execute: async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, waitMs));
          return {
            success: true,
            message: `Waited ${waitMs}ms for UI to stabilize`,
            data: { waitMs }
          };
        } catch (error) {
          return {
            success: false,
            message: `Wait step failed`,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }

  /**
   * Get CSS selector for a section
   */
  private _getSectionSelector(sectionId: string): string {
    // Map common section names to selectors [hardcode] //TODO make dynamic
    const sectionMap: Record<string, string> = {
      'hero': '#hero, [data-section-type="hero"], [data-section-id*="hero"]',
      'about': '#about, [data-section-type="about"], [data-section-id*="about"]',
      'bio': '#about, [data-section-type="about"], [data-section-id*="about"]',
      'projects': '#projects, [data-section-type="projects"], [data-section-id*="projects"]',
      'work': '#projects, [data-section-type="projects"], [data-section-id*="projects"]',
      'contact': '#contact, [data-section-type="contact"], [data-section-id*="contact"]'
    };

    return sectionMap[sectionId.toLowerCase()] || `#${sectionId}`;
  }

  /**
   * Detect available sections based on current UI state
   */
  private _detectAvailableSections(): Array<{ id: string; title: string; containerId?: string }> {
    const sections = [];

    // Always available main sections
    sections.push(
      { id: 'hero', title: 'Hero Section' },
      { id: 'about', title: 'About Section' },
      { id: 'projects', title: 'Projects Section' },
      { id: 'contact', title: 'Contact Section' }
    );

    // Add modal-specific sections if modals are open
    if (this._modalStack.length > 0) {
      const topModal = this._modalStack[this._modalStack.length - 1];

      if (topModal.type === 'project') {
        sections.push(
          { id: 'overview', title: 'Project Overview', containerId: 'project-modal' },
          { id: 'technical-details', title: 'Technical Details', containerId: 'project-modal' },
          { id: 'gallery', title: 'Project Gallery', containerId: 'project-modal' }
        );
      }
    }

    return sections;
  }

  /**
   * Detect available transitions based on current state
   */
  private _detectAvailableTransitions(route: string, projectId?: string): Array<{
    id: string;
    kind: "open" | "close" | "route" | "tab";
    target?: string;
    requires?: string[];
  }> {
    const transitions = [];

    // Route transitions (always available)
    transitions.push(
      { id: 'route:home', kind: 'route', target: 'home' },
      { id: 'route:projects', kind: 'route', target: 'projects' },
      { id: 'route:about', kind: 'route', target: 'about' },
      { id: 'route:contact', kind: 'route', target: 'contact' }
    );

    // Modal transitions based on current state
    if (this._modalStack.length === 0) {
      // Can open project modals
      transitions.push(
        { id: 'open:project-modal', kind: 'open', target: 'project-modal' }
      );
    } else {
      // Can close current modals
      const topModal = this._modalStack[this._modalStack.length - 1];
      transitions.push(
        { id: `close:${topModal.id}`, kind: 'close', target: topModal.id }
      );

      // Can open nested modals if not too deep
      if (this._modalStack.length < 3) {
        transitions.push(
          { id: 'open:nested-modal', kind: 'open', target: 'nested-modal', requires: [`open:${topModal.id}`] }
        );
      }
    }

    return transitions;
  }

  /**
   * Setup epoch tracking for UI state changes
   */
  private _setupEpochTracking(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Listen for navigation events that should bump epoch
    window.addEventListener('popstate', () => {
      this._currentEpoch++;
    });

    window.addEventListener('hashchange', () => {
      this._currentEpoch++;
    });

    // Listen for DOM mutations that might affect navigation
    const observer = new MutationObserver((mutations) => {
      const hasSignificantChanges = mutations.some(mutation =>
        mutation.type === 'childList' &&
        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
      );

      if (hasSignificantChanges) {
        this._currentEpoch++;
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Cleanup resources and reset state (consolidated cleanup)
   */
  destroy(): void {
    // Cleanup all active executions
    this._cleanupAllExecutions('ui_manager_destroy');

    // Clear all maps and state
    this._executingPlans.clear();
    this._completedPlans.clear();
    this._executionContexts.clear();
    this._pendingInterruptions.clear();

    // Cleanup consolidated state management resources
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }

    this._backgroundUpdateCallback = null;

    // Reset navigation state
    this._navigationState = {
      isExecuting: false,
      currentPlanId: null,
      currentStepIndex: -1,
      currentStepId: null,
      startTime: null,
      canBeInterrupted: true,
      interruptionRequested: false,
      lastError: null
    };

    // Reset consolidated UI state
    this._currentUIState = {
      breadcrumbPath: 'destroyed',
      visibleAnchors: [],
      activeFilters: undefined,
      lastUserAction: undefined,
      modalStack: [],
      epoch: 0
    };

    this._isInitialized = false;

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'ui_manager_destroyed'
      },
      'ui-manager'
    );
  }

  /**
   * Get current route from URL
   */
  private _getCurrentRoute(): string {
    const location = this._getLocation();
    if (!location) {
      return 'server';
    }

    const pathname = location.pathname;
    if (pathname === '/') {
      return 'home';
    }

    return pathname.replace(/^\//, '').replace(/\/$/, '') || 'home';
  }

  /**
   * Get project parameter from URL
   */
  private _getProjectParam(): string | undefined {
    const location = this._getLocation();
    if (!location) {
      return undefined;
    }

    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('project') || undefined;
  }

  /**
   * Get comprehensive navigation status for debugging and monitoring
   */
  getNavigationStatus(): {
    isExecuting: boolean;
    currentPlan: string | null;
    currentStep: string | null;
    modalStack: ModalStackEntry[];
    currentRoute: string;
    currentProject: string | null;
    animationMode: string;
    executionQueue: number;
    lastError: string | null;
  } {
    const context = this._getNavigationContext();

    return {
      isExecuting: this._navigationState.isExecuting,
      currentPlan: this._navigationState.currentPlanId,
      currentStep: this._navigationState.currentStepId,
      modalStack: context.modalStack,
      currentRoute: context.currentRoute,
      currentProject: context.currentProject,
      animationMode: this._timingConfig.animationMode,
      executionQueue: this._executingPlans.size,
      lastError: this._navigationState.lastError
    };
  }

  /**
   * Test navigation scenarios for UX comparison
   */
  async testNavigationScenario(
    scenario: 'project-switch' | 'section-navigation' | 'modal-nesting',
    mode: 'human' | 'instant' = 'human'
  ): Promise<NavigationResult> {
    const originalMode = this._timingConfig.animationMode;
    this.setAnimationMode(mode);

    try {
      let result: NavigationResult;

      switch (scenario) {
        case 'project-switch':
          // Test Project A → Project B scenario
          result = await this.executeIntent({
            target: { type: 'project', id: 'test-project-b', sectionId: 'technical-details' }
          });
          break;

        case 'section-navigation':
          // Test section navigation within current context
          result = await this.executeIntent({
            target: { type: 'section', id: 'contact' }
          });
          break;

        case 'modal-nesting':
          // Test nested modal scenario
          result = await this.executeIntent({
            target: { type: 'modal', id: 'gallery', parentContext: 'project:test-project' }
          });
          break;

        default:
          throw new Error(`Unknown test scenario: ${scenario}`);
      }

      return result;
    } finally {
      // Restore original animation mode
      this.setAnimationMode(originalMode);
    }
  }

  /**
   * Set test location for testing purposes
   */
  setTestLocation(location: any): void {
    this._testLocation = location;
  }

  /**
   * Get location object (real or test)
   */
  private _getLocation(): any {
    if (this._testLocation) {
      return this._testLocation;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    return window.location;
  }

  /**
   * Generate breadcrumb path from current route and modal stack (consolidated from UIStateManager)
   */
  private _generateBreadcrumbPath(): string {
    const location = this._getLocation();
    if (!location) {
      return 'server';
    }

    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const hash = location.hash;

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
   * Setup intersection observer for visible anchor detection (consolidated from UIStateManager)
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
   * Observe all anchor elements for visibility changes (consolidated from UIStateManager)
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
   * Setup navigation listeners for immediate updates (consolidated from UIStateManager)
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

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      UIManager.getInstance().updateNavigationState();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      UIManager.getInstance().updateNavigationState();
    };
  }

  /**
   * Update visible anchors immediately (used for initialization) (consolidated from UIStateManager)
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

    this._currentUIState.visibleAnchors = visibleAnchors;
    this._lastVisibleAnchors = [...visibleAnchors];
  }

  /**
   * Update breadcrumb path immediately (consolidated from UIStateManager)
   */
  private _updateBreadcrumbPath(): void {
    this._currentUIState.breadcrumbPath = this._generateBreadcrumbPath();
    this._currentUIState.modalStack = [...this._modalStack];
    this._currentUIState.epoch = this._currentEpoch;
  }

  /**
   * Get comprehensive navigation context for planning
   */
  private _getNavigationContext(): {
    currentRoute: string;
    currentProject: string | null;
    modalStack: ModalStackEntry[];
    visibleSections: string[];
    canNavigate: boolean;
  } {
    const currentRoute = this._getCurrentRoute();
    const currentProject = this._modalStack.find(m => m.type === 'project')?.id || null;

    return {
      currentRoute,
      currentProject,
      modalStack: [...this._modalStack],
      visibleSections: [...this._currentUIState.visibleAnchors],
      canNavigate: !this._navigationState.isExecuting || this._navigationState.canBeInterrupted
    };
  }

  /**
   * Validate navigation intent against current state
   */
  private _validateNavigationIntent(params: UIIntentParams): { valid: boolean; reason?: string } {
    const context = this._getNavigationContext();

    // Check if we can accept new navigation requests
    if (!context.canNavigate) {
      return {
        valid: false,
        reason: 'Navigation system is busy and cannot be interrupted'
      };
    }

    // Validate target exists (basic validation)
    if (params.target.type === 'project' && !params.target.id) {
      return {
        valid: false,
        reason: 'Project ID is required for project navigation'
      };
    }

    if (params.target.type === 'section' && !params.target.id) {
      return {
        valid: false,
        reason: 'Section ID is required for section navigation'
      };
    }

    return { valid: true };
  }

  /**
   * Check if visible anchors have changed (consolidated from UIStateManager)
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
   * Send background update using callback (consolidated from UIStateManager)
   */
  private _sendBackgroundUpdate(): void {
    if (!this._backgroundUpdateCallback) {
      return;
    }

    const update = {
      type: 'ui_state_update' as const,
      breadcrumbPath: this._currentUIState.breadcrumbPath,
      visibleAnchors: this._currentUIState.visibleAnchors,
      activeFilters: this._currentUIState.activeFilters,
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
            source: 'UIManager',
            updateType: 'background'
          }
        },
        'ui-manager',
        undefined,
        'ui-manager'
      );
    } catch (error) {
      console.error('Failed to send background UI state update:', error);
    }
  }


}

// Export singleton instance
export const uiManager = UIManager.getInstance();

// Backward compatibility export
export const navigationOrchestrator = uiManager;