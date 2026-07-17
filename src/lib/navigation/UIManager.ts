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
import { getSemanticIDRegistry, SemanticIDRegistryProvider } from './SemanticIDRegistry';
import { contextFrameManager } from '../ai/ContextFrameManager';
import { PassiveFIDManager, renderFidOrientation } from '../ai/PassiveFIDManager';
import type { IConversationalAgentAdapter } from '../voice/IConversationalAgentAdapter';

// Comprehensive UI State interfaces for both navigation and AI
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

  // Modal stack and epoch tracking
  modalStack: ModalStackEntry[];
  epoch: number;

  // Enhanced state for AI and navigation
  currentRoute: string;
  currentProject?: ProjectState;
  scrollPosition: ScrollState;
  mediaState: MediaState;
  interactionState: InteractionState;
  lastUserAction?: UserAction;
}

// Project-specific state tracking
export interface ProjectState {
  id: string;
  slug: string;
  title: string;
  description?: string;
  briefOverview?: string;
  currentSection: string; // 'overview', 'technical-details', 'gallery'
  sectionsVisited: string[];
  scrollPositions: Record<string, number>; // section -> scroll position
  mediaInteractions: MediaInteraction[];
  timeSpent: number; // milliseconds
}

// Scroll state tracking across all contexts
export interface ScrollState {
  // Global scroll positions for each route/modal
  positions: Record<string, number>; // routeKey -> position
  
  // Currently visible sections/anchors with positions
  visibleElements: Array<{
    id: string;
    type: 'section' | 'anchor' | 'media';
    position: number;
    visibility: number; // 0-1, how much is visible
  }>;

  // Scroll behavior context
  lastScrollDirection: 'up' | 'down' | null;
  scrollVelocity: number; // pixels per second
  isScrolling: boolean;
}

// Media interaction state (carousels, videos, lightboxes)
export interface MediaState {
  // Active media viewers
  activeCarousels: Array<{
    id: string;
    currentIndex: number;
    totalItems: number;
    isPlaying?: boolean;
  }>;

  // Video/iframe state
  activeVideos: Array<{
    id: string;
    url: string;
    currentTime?: number;
    duration?: number;
    isPlaying: boolean;
    volume?: number;
  }>;

  // Lightbox state
  lightbox?: {
    isOpen: boolean;
    mediaId: string;
    currentIndex: number;
    totalItems: number;
  };

  // Download/external link interactions
  recentInteractions: Array<{
    type: 'download' | 'external_link' | 'media_view';
    target: string;
    timestamp: number;
  }>;
}

// User interaction tracking for AI context
export interface InteractionState {
  // Current focus/attention
  focusedElement?: {
    id: string;
    type: string;
    timestamp: number;
  };

  // Interaction patterns
  clickSequence: Array<{
    elementId: string;
    elementType: string;
    timestamp: number;
    coordinates?: { x: number; y: number };
  }>;

  // Search/filter history
  searchHistory: Array<{
    query: string;
    filters: Record<string, any>;
    resultCount: number;
    timestamp: number;
  }>;

  // Navigation patterns
  navigationPath: Array<{
    from: string;
    to: string;
    method: 'click' | 'keyboard' | 'voice' | 'ai';
    timestamp: number;
  }>;
}

// Enhanced user action tracking
export interface UserAction {
  type: 'navigate' | 'search' | 'filter' | 'scroll' | 'media' | 'modal' | 'focus';
  target?: string;
  context?: Record<string, any>;
  timestamp: number;
  sessionId?: string;
}

// Media interaction details
export interface MediaInteraction {
  mediaId: string;
  type: 'view' | 'play' | 'pause' | 'seek' | 'download' | 'share';
  timestamp: number;
  duration?: number; // how long they interacted
  value?: any; // seek position, etc.
}

// Enhanced section interface for semantic navigation
export interface SemanticSection {
  id: string;
  semanticId?: string;        // Optional semantic identifier
  title: string;
  type: 'homepage' | 'project' | 'content';
  projectId?: string;
  parentId?: string;
  level?: number;
  containerId?: string;
  
  // Future semantic features (optional)
  embeddings?: number[];      // For AI context
  keywords?: string[];        // For search
  contentHash?: string;       // For change detection
  metadata?: Record<string, any>; // Extensible metadata
}

// Content provider interface for pluggable section discovery
export interface ContentProvider {
  name: string;
  discoverSections(context: NavigationContext): Promise<SemanticSection[]>;
  searchContent?(query: string, options?: any): Promise<any[]>;
  validateSection?(sectionId: string): Promise<boolean>;
}

// Enhanced navigation context
export interface NavigationContext {
  currentRoute: string;
  currentProject: string | null;
  modalStack: ModalStackEntry[];
  visibleSections: string[];
  canNavigate: boolean;
  
  // Future context features (optional)
  fidContext?: {
    focus: string[];          // Currently focused content
    interest: string[];       // User's demonstrated interests  
    domain: string[];         // Current domain/project context
  };
  contentEmbeddings?: Map<string, number[]>;
  userIntent?: string;
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

// Enhanced navigation intent interfaces with semantic support
export interface UIIntentParams {
  epoch?: number;                       // Client's last-known UI state version
  target:
  | { type: "section"; id: string; projectId?: string; highlight?: { text?: string } }   // e.g., {type:"section", id:"contact", projectId:"aurora-avatar"}
  | { type: "route"; id: string }     // e.g., {type:"route", id:"home"}
  | { type: "project"; id: string; sectionId?: string; highlight?: { text?: string } }   // e.g., {type:"project", id:"aurora-avatar", sectionId:"technical-details"}
  | { type: "modal"; id: string; parentContext?: string } // e.g., {type:"modal", id:"gallery"} or {type:"modal", id:"close"}
  | { type: "element"; id: string }   // tab, accordion, etc.
  // New semantic navigation types (with fallbacks for safety)
  | { type: "semantic"; semanticId: string; fallbackId?: string } // Semantic ID navigation with fallback
  | { type: "content"; query: string; projectId?: string; fallbackSection?: string }; // Content search navigation with fallback
  behavior?: {
    openIfNeeded?: boolean;             // open modal or navigate if required
    closeBlocking?: boolean;            // close top modal if it blocks target
    waitForReadyMs?: number;            // wait for loader/transition
    scrollBehavior?: "smooth" | "instant";
    allowInterruption?: boolean;        // allow this navigation to be interrupted
    urlStrategy?: "full" | "minimal" | "none" | "replace"; // URL update strategy (deprecated - prefer none for stability)
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
  sections: SemanticSection[];          // Enhanced sections with semantic support
  transitions: Array<{
    id: string;                         // "open:projectModal"
    kind: "open" | "close" | "route" | "tab";
    target?: string;                    // "projectModal:aurora-avatar"
    requires?: string[];                // transitions that must happen first
  }>;
  fidContext?: {                        // F-I-D context for AI agents
    focus: string[];                    // Currently focused content
    interest: string[];                 // User's demonstrated interests  
    domain: string[];                   // Current domain/project context
    contextStats?: {                    // Context usage statistics
      frameTokens: number;
      indexTokens: number;
      detailsTokens: number;
      totalTokens: number;
      budgetUtilization: number;
    };
  };
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
  /** Client-side navigation bridge (next/navigation router.push) — full page
   *  loads are never acceptable for AI-driven navigation. */
  private _routeNavigator: ((path: string) => void) | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;
  private _lastVisibleAnchors: string[] = [];

  // State synchronization system
  private _stateSubscribers: Map<string, (state: UIState) => void> = new Map();
  private _componentStateProviders: Map<string, () => Partial<UIState>> = new Map();
  private _stateUpdateQueue: Array<{ source: string; update: Partial<UIState>; timestamp: number }> = [];
  private _lastStateSync: number = 0;

  // Debounced update functions
  private _debouncedScrollUpdate: (visibleAnchors: string[]) => void;
  private _debouncedFilterUpdate: (filters: UIState['activeFilters']) => void;
  private _debouncedStateUpdate: () => void;
  private _debouncedPassiveContextUpdate: () => void;

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
  
  // Modal handlers for different contexts (homepage vs projects page)
  private _modalHandlers: Map<string, (modalId: string, modalType: string) => Promise<boolean>> = new Map();

  // Content provider system for extensible section discovery
  private _contentProviders: ContentProvider[] = [];
  private _sectionCache: Map<string, SemanticSection[]> = new Map();
  private _cacheTimeout: number = 30000; // 30 second cache

  // Passive F-I-D Context Integration
  private _passiveFIDManager: PassiveFIDManager;
  private _lastUIStateHash: string = '';
  private _connectedVoiceAdapter: IConversationalAgentAdapter | null = null;
  private _passiveContextEnabled: boolean = false;
  private _pendingProjectDataUpdates: Map<string, NodeJS.Timeout> = new Map(); // Track pending project data updates

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
    // Initialize comprehensive UI state
    this._currentUIState = {
      breadcrumbPath: this._generateBreadcrumbPath(),
      visibleAnchors: [],
      activeFilters: undefined,
      modalStack: [],
      epoch: 0,
      currentRoute: 'home',
      currentProject: undefined,
      scrollPosition: {
        positions: {},
        visibleElements: [],
        lastScrollDirection: null,
        scrollVelocity: 0,
        isScrolling: false
      },
      mediaState: {
        activeCarousels: [],
        activeVideos: [],
        lightbox: undefined,
        recentInteractions: []
      },
      interactionState: {
        focusedElement: undefined,
        clickSequence: [],
        searchHistory: [],
        navigationPath: []
      },
      lastUserAction: undefined
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
        
        // Trigger passive context update for significant scroll changes (5 second delay)
        this._debouncedPassiveContextUpdate();
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

    this._debouncedStateUpdate = debounce(() => {
      this._sendBackgroundUpdate();
    }, 2000); // 2 seconds for general state updates

    this._debouncedPassiveContextUpdate = debounce(() => {
      if (this._passiveContextEnabled) {
        const currentState = this.getCurrentUIState();
        console.log('⏰ Debounced passive context update executing after delay');
        this._onSignificantNavigation(currentState).catch(error => {
          console.warn('Debounced passive context update failed:', error);
        });
      }
    }, 1000); // 1 second for passive context updates (reduced from 5s)

    this._setupEpochTracking();
    
    // Initialize and register semantic ID registry
    this._initializeSemanticRegistry();

    // Initialize passive F-I-D manager
    this._passiveFIDManager = PassiveFIDManager.getInstance();
  }

  static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
      
      // Expose UIManager globally for console debugging in development TODO: remove this before production
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        const instance = UIManager.instance;
        (window as any).UIManager = instance;
        
        // Quick access functions
        (window as any).describeUI = async () => {
          const description = await instance.describe();
          console.group('🔍 UIManager DescribeUI - Console Call');
          console.log('📋 Full Description:', description);
          console.log('📊 Epoch:', description.epoch);
          console.log('🛣️  Route:', description.route);
          console.log('📚 View Stack:', description.viewStack);
          console.log('🎯 Available Sections:', description.sections);
          console.log('🔄 Available Transitions:', description.transitions);
          console.groupEnd();
          return description;
        };
        
        (window as any).getUIState = () => {
          const state = instance.getCurrentUIState();
          console.log('🎛️  Current UI State:', state);
          return state;
        };
        
        // Navigation helpers
        (window as any).navigateTo = (target: any) => {
          return instance.executeIntent({ target });
        };
        
        (window as any).openProject = (projectId: string, sectionId?: string) => {
          return instance.executeIntent({ 
            target: { type: 'project', id: projectId, sectionId } 
          });
        };
        
        (window as any).goToSection = (sectionId: string) => {
          return instance.executeIntent({ 
            target: { type: 'section', id: sectionId } 
          });
        };
        
        // State helpers
        (window as any).getModalStack = () => {
          return instance.getCurrentUIState().modalStack;
        };
        
        (window as any).getCurrentProject = () => {
          return instance.getCurrentUIState().currentProject;
        };
        
        console.log('🧭 UIManager Debug Console API:');
        console.log('  📊 State Inspection:');
        console.log('    • describeUI() - Get complete UI description');
        console.log('    • getUIState() - Get current UI state');
        console.log('    • getModalStack() - Get open modals');
        console.log('    • getCurrentProject() - Get active project');
        console.log('  🧭 Navigation:');
        console.log('    • navigateTo({type: "section", id: "about"})');
        console.log('    • openProject("portfolio-website", "technical-details")');
        console.log('    • goToSection("contact")');
        console.log('  ⌨️  Hotkey: Ctrl/Cmd + Shift + D');
        console.log('  🎛️  Full API: window.UIManager');
      }
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
    
    // Initialize semantic ID registry
    this._initializeSemanticRegistryOnDOMReady();
    
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
  async describe(): Promise<UIDescribeResponse> {
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

    // Get available sections based on current context (now async)
    const sections = await this._detectAvailableSections();

    // Get available transitions based on current state
    const transitions = this._detectAvailableTransitions(route, this._getProjectParam());

    // Get enhanced navigation context with F-I-D integration
    const navigationContext: NavigationContext = {
      currentRoute: route,
      currentProject: this._getProjectParam() ?? null,
      modalStack: [...this._modalStack],
      visibleSections: this._currentUIState.visibleAnchors,
      canNavigate: this.canAcceptNewRequest()
    };

    const enhancedContext = contextFrameManager.getEnhancedNavigationContext(navigationContext);
    const contextStats = contextFrameManager.getContextStats();

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'ui_describe',
        epoch: this._currentUIState.epoch,
        route,
        viewStack,
        sectionsCount: sections.length,
        transitionsCount: transitions.length,
        providersCount: this._contentProviders.length,
        fidContextEnabled: !!enhancedContext.fidContext,
        contextTokens: contextStats.totalTokens
      },
      'ui-manager'
    );

    return {
      epoch: this._currentUIState.epoch,
      route,
      viewStack,
      sections,
      transitions,
      fidContext: enhancedContext.fidContext ? {
        focus: enhancedContext.fidContext.focus,
        interest: enhancedContext.fidContext.interest,
        domain: enhancedContext.fidContext.domain,
        contextStats: {
          frameTokens: contextStats.frameTokens,
          indexTokens: contextStats.indexTokens,
          detailsTokens: contextStats.detailsTokens,
          totalTokens: contextStats.totalTokens,
          budgetUtilization: contextStats.budgetUtilization
        }
      } : undefined
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
    this._currentUIState.currentRoute = this._getCurrentRoute();
    
    // Update current project from modal stack
    const currentProjectModal = this._modalStack.find(m => m.type === 'project');
    if (currentProjectModal) {
      // Create or update ProjectState from modal
      this._currentUIState.currentProject = {
        id: currentProjectModal.id,
        slug: currentProjectModal.id, // Assuming slug matches id for now
        title: currentProjectModal.id, // Will be enhanced by providers
        currentSection: 'overview', // Default section
        sectionsVisited: [],
        scrollPositions: {},
        mediaInteractions: [],
        timeSpent: 0
      };
    } else {
      this._currentUIState.currentProject = undefined;
    }
    
    // Sync state from all providers before returning
    this._syncStateFromProviders();
    
    return { ...this._currentUIState };
  }

  // ============================================================================
  // PASSIVE F-I-D CONTEXT INTEGRATION
  // ============================================================================

  /**
   * Enable passive context integration with voice adapter
   */
  enablePassiveContext(voiceAdapter: IConversationalAgentAdapter): void {
    this._connectedVoiceAdapter = voiceAdapter;
    this._passiveContextEnabled = true;
    this._lastUIStateHash = this._generateUIStateHash(this.getCurrentUIState());

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'passive_context_enabled',
        provider: voiceAdapter.provider,
        sessionId: voiceAdapter.getConfig()?.contextId
      },
      'ui-manager'
    );

    console.log('UIManager: Passive F-I-D context integration enabled for', voiceAdapter.provider);
  }

  /**
   * Disable passive context integration
   */
  disablePassiveContext(): void {
    this._connectedVoiceAdapter = null;
    this._passiveContextEnabled = false;
    this._lastUIStateHash = '';

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'passive_context_disabled'
      },
      'ui-manager'
    );

    console.log('UIManager: Passive F-I-D context integration disabled');
  }

  /**
   * Check if passive context integration is enabled
   */
  isPassiveContextEnabled(): boolean {
    return this._passiveContextEnabled && this._connectedVoiceAdapter !== null;
  }

  /**
   * Get passive context status for debugging
   */
  getPassiveContextStatus(): {
    enabled: boolean;
    hasVoiceAdapter: boolean;
    voiceProvider: string | null;
    lastStateHash: string;
  } {
    return {
      enabled: this._passiveContextEnabled,
      hasVoiceAdapter: this._connectedVoiceAdapter !== null,
      voiceProvider: this._connectedVoiceAdapter?.provider || null,
      lastStateHash: this._lastUIStateHash
    };
  }



  /**
   * Trigger immediate passive context update for critical UI changes (modals, navigation)
   */
  private async _triggerImmediatePassiveContextUpdate(newState: UIState): Promise<void> {
    if (!this._passiveContextEnabled || !this._connectedVoiceAdapter) {
      return;
    }

    console.log('⚡ Immediate passive context update triggered');
    
    try {
      // Convert UIState to the format expected by PassiveFIDManager
      const convertedState = this._convertUIStateForPassiveFID(newState);
      
      console.log('🔍 Context update state check:', {
        hasCurrentProject: !!newState.currentProject,
        currentProjectType: typeof newState.currentProject,
        currentProjectId: typeof newState.currentProject === 'string' ? newState.currentProject : newState.currentProject?.id,
        currentProjectObject: typeof newState.currentProject === 'object' ? newState.currentProject : null
      });
      
      // Get F-I-D context from PassiveFIDManager (server-driven)
      const fidContext = await this._passiveFIDManager.getOrFetchContext(convertedState);

      // D55 (conversation-engine task A3): publish into the adapter's context
      // buffer under source key 'fid' — the one injector delivers it via the
      // floating block (immediately when the model is idle, at the next turn
      // boundary otherwise). Works on EVERY adapter (Gemini via versioned
      // supersession). 7.1a (owner ruling 2026-07-12): the published form is
      // compact orientation TEXT — location + pull handles, never content
      // prose or the raw JSON object; the full context stays retained in the
      // manager for the ui_details pull (7.1e). Publisher-side change only —
      // buffer mechanics, debounce, and change gating are untouched (7.1c).
      if (typeof (this._connectedVoiceAdapter as any).publishPassiveContext === 'function') {
        const orientationText = renderFidOrientation(fidContext);
        (this._connectedVoiceAdapter as any).publishPassiveContext('fid', orientationText);

        console.log('✅ Passive context published to D55 buffer (key: fid, compact text)');

        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'immediate_passive_context_pushed',
            provider: this._connectedVoiceAdapter.provider,
            route: newState.currentRoute,
            project: newState.currentProject
          },
          'ui-manager'
        );

        // Task 7.0a(2): the RAW fid payload for the admin context-debug panel
        // (the buffer only ever holds the stringified/compacted form). This is
        // the before/after judgment view once 7.1a's compact-text publish
        // lands. Observer-only — nothing model-visible rides this.
        debugEventEmitter.emit(
          'fid-context-published',
          {
            provider: this._connectedVoiceAdapter.provider,
            route: newState.currentRoute,
            project: newState.currentProject,
            raw: fidContext,
            // Owner report 2026-07-15: the panel's fid tab could only show
            // raw JSON — the rendered orientation text never rode the event
            // (the "published" pane depended on catching the buffer entry
            // before supersession). Ship what was ACTUALLY published.
            published: orientationText,
          },
          'ui-manager'
        );
      }
    } catch (error) {
      console.error('❌ Immediate passive context update failed:', error);
    }
  }

  /**
   * Manually trigger passive context update for testing (bypasses debounce and change detection)
   */
  async triggerPassiveContextUpdate(): Promise<void> {
    if (!this._passiveContextEnabled || !this._connectedVoiceAdapter) {
      throw new Error('Passive context is not enabled or no voice adapter connected');
    }

    const currentState = this.getCurrentUIState();
    
    console.log('🔧 Manually triggering passive context update...');
    
    try {
      // Use the immediate update method
      await this._triggerImmediatePassiveContextUpdate(currentState);
    } catch (error) {
      console.error('❌ Manual passive context update failed:', error);
      throw error;
    }
  }



  /**
   * Detect significant navigation changes that should trigger context updates
   */
  private _onSignificantNavigation(newState: UIState): Promise<void> {
    const startTime = Date.now();
    console.log('🔍 _onSignificantNavigation called at', new Date().toISOString());
    
    if (!this._passiveContextEnabled || !this._connectedVoiceAdapter) {
      console.log('❌ Passive context not enabled or no voice adapter');
      return Promise.resolve();
    }

    const currentStateHash = this._generateUIStateHash(newState);
    
    // Check if this is a significant change
    if (currentStateHash === this._lastUIStateHash) {
      console.log('⏭️ No state change detected (same hash)');
      return Promise.resolve();
    }

    const oldState = this.getCurrentUIState();
    const isSignificant = this._detectSignificantChange(oldState, newState);

    if (!isSignificant) {
      console.log('⏭️ Change not significant enough for context update');
      return Promise.resolve();
    }

    console.log('✅ Significant change detected, proceeding with passive context update');
    console.log('📊 State change:', {
      route: `${oldState.currentRoute} → ${newState.currentRoute}`,
      project: `${oldState.currentProject} → ${newState.currentProject}`,
      modalCount: `${oldState.modalStack?.length || 0} → ${newState.modalStack?.length || 0}`
    });

    // Update hash to prevent duplicate updates
    this._lastUIStateHash = currentStateHash;

    // Use immediate passive context update (non-blocking)
    this._triggerImmediatePassiveContextUpdate(newState).catch(error => {
      console.error('Failed to update passive F-I-D context:', error);
      
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'passive_context_error',
          error: error instanceof Error ? error.message : String(error),
          route: newState.currentRoute,
          project: newState.currentProject
        },
        'ui-manager'
      );
    });

    return Promise.resolve();
  }

  /**
   * Detect if UI state change is significant enough to trigger context update
   */
  private _detectSignificantChange(oldState: UIState, newState: UIState): boolean {
    // Route changes (home → projects)
    if (oldState.currentRoute !== newState.currentRoute) {
      return true;
    }

    // Project selection changes (different project modal)
    if (oldState.currentProject !== newState.currentProject) {
      return true;
    }

    // Modal opens/closes (project modal opening)
    const oldModalCount = oldState.modalStack?.length || 0;
    const newModalCount = newState.modalStack?.length || 0;
    if (oldModalCount !== newModalCount) {
      return true;
    }

    // Modal content changes (different modal IDs at same level)
    if (oldState.modalStack && newState.modalStack && oldState.modalStack.length === newState.modalStack.length) {
      for (let i = 0; i < oldState.modalStack.length; i++) {
        if (oldState.modalStack[i].id !== newState.modalStack[i].id) {
          return true;
        }
      }
    }

    // Significant visible anchor changes (more than 2 anchors changed)
    const oldAnchors = new Set(oldState.visibleAnchors || []);
    const newAnchors = new Set(newState.visibleAnchors || []);
    const anchorChanges = Array.from(newAnchors).filter(anchor => !oldAnchors.has(anchor)).length +
                         Array.from(oldAnchors).filter(anchor => !newAnchors.has(anchor)).length;
    
    if (anchorChanges > 2) {
      return true;
    }

    return false;
  }

  /**
   * Generate hash for UI state to detect meaningful changes
   */
  private _generateUIStateHash(state: UIState): string {
    const hashData = {
      route: state.currentRoute || 'home',
      project: state.currentProject || null,
      modalStack: (state.modalStack || []).map(m => m.id).join(','),
      anchors: (state.visibleAnchors || []).slice(0, 5).sort().join(',') // Only first 5 anchors, sorted
    };

    return JSON.stringify(hashData);
  }

  /**
   * Convert UIManager's UIState to the format expected by PassiveFIDManager //TODO improve both
   */
  private _convertUIStateForPassiveFID(state: UIState): import('../ai/tools/types').UIState {
    // Convert lastUserAction to match the expected type
    let convertedLastUserAction: { type: 'navigate' | 'search' | 'filter' | 'scroll'; timestamp: number; } | undefined;
    if (state.lastUserAction) {
      const validTypes: ('navigate' | 'search' | 'filter' | 'scroll')[] = ['navigate', 'search', 'filter', 'scroll'];
      if (validTypes.includes(state.lastUserAction.type as any)) {
        convertedLastUserAction = {
          type: state.lastUserAction.type as 'navigate' | 'search' | 'filter' | 'scroll',
          timestamp: state.lastUserAction.timestamp
        };
      }
    }

    // Extract current project from modal stack (project modals)
    const currentProjectModal = state.modalStack?.find(m => m.type === 'project');
    const currentProject = currentProjectModal?.id || null;

    console.log('🔄 Converting UI state for passive F-I-D:', {
      modalStackLength: state.modalStack?.length || 0,
      modalStack: state.modalStack?.map(m => `${m.type}:${m.id}`) || [],
      currentProjectModal: currentProjectModal?.id || 'none',
      currentProject: currentProject || 'none',
      currentRoute: state.currentRoute
    });

    return {
      breadcrumbPath: state.breadcrumbPath,
      visibleAnchors: state.visibleAnchors,
      activeFilters: state.activeFilters,
      currentRoute: state.currentRoute,
      currentProject: currentProject ?? undefined,
      currentModal: state.modalStack && state.modalStack.length > 0 ? state.modalStack[state.modalStack.length - 1].id : undefined,
      lastUserAction: convertedLastUserAction
    };
  }

  /**
   * Current UI state in PassiveFIDManager's shape (7.1e cold-start fallback:
   * the ui_details executor fetches the view context on demand when nothing
   * is retained yet — e.g. a question fired before the first navigation).
   */
  getUIStateForPassiveFID(): import('../ai/tools/types').UIState {
    return this._convertUIStateForPassiveFID(this.getCurrentUIState());
  }

  // ============================================================================
  // STATE SYNCHRONIZATION SYSTEM
  // ============================================================================

  /**
   * Register a component as a state provider
   * Components can provide partial state updates
   */
  registerStateProvider(componentId: string, provider: () => Partial<UIState>): void {
    this._componentStateProviders.set(componentId, provider);
    
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'state_provider_registered',
        componentId,
        providersCount: this._componentStateProviders.size
      },
      'ui-manager'
    );
  }

  /**
   * Unregister a state provider
   */
  unregisterStateProvider(componentId: string): void {
    this._componentStateProviders.delete(componentId);
  }

  /**
   * Subscribe to state changes
   */
  // _notifyStateSubscribers always emits the FULL current state
  subscribeToState(subscriberId: string, callback: (state: UIState) => void): void {
    this._stateSubscribers.set(subscriberId, callback);
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribeFromState(subscriberId: string): void {
    this._stateSubscribers.delete(subscriberId);
  }

  /**
   * Update UI state from external components
   */
  updateUIState(source: string, update: Partial<UIState>): void {
    const timestamp = Date.now();
    
    // Add to update queue
    this._stateUpdateQueue.push({ source, update, timestamp });
    
    // Debounce state updates to prevent thrashing
    if (timestamp - this._lastStateSync > 100) { // 100ms debounce
      this._processStateUpdates();
    }
  }

  /**
   * Sync state from all registered providers
   */
  private _syncStateFromProviders(): void {
    for (const [componentId, provider] of Array.from(this._componentStateProviders.entries())) {
      try {
        const partialState = provider();
        if (partialState && Object.keys(partialState).length > 0) {
          this._mergeStateUpdate(partialState, componentId);
        }
      } catch (error) {
        console.error(`State provider ${componentId} failed:`, error);
      }
    }
  }

  /**
   * Process queued state updates
   */
  private _processStateUpdates(): void {
    if (this._stateUpdateQueue.length === 0) return;

    const updates = [...this._stateUpdateQueue];
    this._stateUpdateQueue = [];
    this._lastStateSync = Date.now();

    // Group updates by source and merge
    const mergedUpdates: Record<string, Partial<UIState>> = {};
    for (const { source, update } of updates) {
      if (!mergedUpdates[source]) {
        mergedUpdates[source] = {};
      }
      Object.assign(mergedUpdates[source], update);
    }

    // Apply all updates
    for (const [source, update] of Object.entries(mergedUpdates)) {
      this._mergeStateUpdate(update, source);
    }

    // Notify subscribers
    this._notifyStateSubscribers();
    
    // Increment epoch to signal state change
    this._currentUIState.epoch++;
  }

  /**
   * Merge a state update into current state
   */
  private _mergeStateUpdate(update: Partial<UIState>, source: string): void {
    // Deep merge for complex objects
    if (update.scrollPosition) {
      this._currentUIState.scrollPosition = {
        ...this._currentUIState.scrollPosition,
        ...update.scrollPosition,
        positions: {
          ...this._currentUIState.scrollPosition.positions,
          ...update.scrollPosition.positions
        },
        visibleElements: update.scrollPosition.visibleElements || this._currentUIState.scrollPosition.visibleElements
      };
    }

    if (update.mediaState) {
      this._currentUIState.mediaState = {
        ...this._currentUIState.mediaState,
        ...update.mediaState,
        activeCarousels: update.mediaState.activeCarousels || this._currentUIState.mediaState.activeCarousels,
        activeVideos: update.mediaState.activeVideos || this._currentUIState.mediaState.activeVideos,
        recentInteractions: update.mediaState.recentInteractions || this._currentUIState.mediaState.recentInteractions
      };
    }

    if (update.interactionState) {
      this._currentUIState.interactionState = {
        ...this._currentUIState.interactionState,
        ...update.interactionState,
        clickSequence: update.interactionState.clickSequence || this._currentUIState.interactionState.clickSequence,
        searchHistory: update.interactionState.searchHistory || this._currentUIState.interactionState.searchHistory,
        navigationPath: update.interactionState.navigationPath || this._currentUIState.interactionState.navigationPath
      };
    }

    if (update.currentProject) {
      this._currentUIState.currentProject = {
        ...this._currentUIState.currentProject,
        ...update.currentProject,
        sectionsVisited: update.currentProject.sectionsVisited || this._currentUIState.currentProject?.sectionsVisited || [],
        scrollPositions: {
          ...this._currentUIState.currentProject?.scrollPositions,
          ...update.currentProject.scrollPositions
        },
        mediaInteractions: update.currentProject.mediaInteractions || this._currentUIState.currentProject?.mediaInteractions || []
      };
    }

    // Simple properties
    if (update.currentRoute) this._currentUIState.currentRoute = update.currentRoute;
    if (update.visibleAnchors) this._currentUIState.visibleAnchors = update.visibleAnchors;
    if (update.activeFilters) this._currentUIState.activeFilters = update.activeFilters;
    if (update.lastUserAction) this._currentUIState.lastUserAction = update.lastUserAction;
    if (update.breadcrumbPath) this._currentUIState.breadcrumbPath = update.breadcrumbPath;

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'ui_state_updated',
        source,
        updateKeys: Object.keys(update),
        epoch: this._currentUIState.epoch
      },
      'ui-manager'
    );
  }

  /**
   * Notify all state subscribers
   */
  private _notifyStateSubscribers(): void {
    const currentState = { ...this._currentUIState };
    
    for (const [subscriberId, callback] of Array.from(this._stateSubscribers.entries())) {
      try {
        callback(currentState);
      } catch (error) {
        console.error(`State subscriber ${subscriberId} failed:`, error);
      }
    }
  }

  /**
   * Set background update callback for sending non-interrupting updates
   */
  // null clears the callback (adapter disconnect path)
  setBackgroundUpdateCallback(callback: BackgroundUpdateCallback | null): void {
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

    // Update internal state (no URL changes)
    this._updateStateForModalStack();

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
    console.log('🔄 _popModal called with modalId:', modalId);
    let poppedModal: ModalStackEntry | null = null;

    if (modalId) {
      // Remove specific modal and all modals above it
      const index = this._modalStack.findIndex(m => m.id === modalId);
      console.log('🔍 Modal index in stack:', index, 'Stack size:', this._modalStack.length);
      if (index !== -1) {
        const removed = this._modalStack.splice(index);
        poppedModal = removed[0];
        console.log('✅ Popped modal:', poppedModal.id, 'Remaining stack size:', this._modalStack.length);
      } else {
        console.log('❌ Modal not found in stack');
      }
    } else {
      // Remove top modal
      poppedModal = this._modalStack.pop() || null;
      console.log('✅ Popped top modal:', poppedModal?.id, 'Remaining stack size:', this._modalStack.length);
    }

    if (poppedModal) {
      // Update internal state (no URL changes)
      console.log('🔄 Calling _updateStateForModalStack after popping modal');
      this._updateStateForModalStack();

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
    } else {
      console.log('❌ No modal was popped');
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
   * Update internal state based on current modal stack (no URL changes)
   */
  private _updateStateForModalStack(): void {
    // Pure state-based synchronization - no URL manipulation
    console.log('🎯 Updating internal state for modal stack (no URL changes)');
    
    // Update internal state to reflect modal changes
    this._currentEpoch++;
    this._updateBreadcrumbPath();
    
    // Log current modal stack for debugging
    if (this._modalStack.length > 0) {
      console.log('📚 Current modal stack:', this._modalStack.map(m => `${m.type}:${m.id}`));
    }

    // Trigger immediate passive context update for modal state changes (critical UI change)
    if (this._passiveContextEnabled) {
      console.log('🔄 Triggering IMMEDIATE passive context update for modal state change');
      const currentState = this.getCurrentUIState();
      
      // Use immediate update for modal changes (server-driven data)
      this._triggerImmediatePassiveContextUpdate(currentState).catch(error => {
        console.warn('Immediate passive context update failed:', error);
      });
    }
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

    toClose.forEach(async modal => {
      await this._closeModalElement(modal.id);
    });

    // Open modals that should be open
    const toOpen = expectedStack.filter(expected =>
      !currentTracked.some(current => current.id === expected.id)
    );

    toOpen.forEach(async modal => {
      await this._openModalElement(modal.id, modal.type);
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
   * Register a modal handler for a specific context
   */
  registerModalHandler(context: string, handler: (modalId: string, modalType: string) => Promise<boolean>): void {
    this._modalHandlers.set(context, handler);
    
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'modal_handler_registered',
        context,
        handlersCount: this._modalHandlers.size
      },
      'ui-manager'
    );
  }

  /**
   * Unregister a modal handler
   */
  /** Register the app router's push so route steps are client-side. */
  registerRouteNavigator(navigate: ((path: string) => void) | null): void {
    this._routeNavigator = navigate;
  }

  unregisterModalHandler(context: string): void {
    this._modalHandlers.delete(context);
  }

  /**
   * Register that a modal was opened externally (by modal handlers)
   * This keeps the UIManager's modal stack in sync with actual UI state
   */
  registerExternalModal(modalId: string, modalType: 'project' | 'example' | 'gallery' | 'generic', context?: any): void {
    // Check if modal is already in stack
    const existingModal = this._modalStack.find(m => m.id === modalId && m.type === modalType);
    if (existingModal) {
      return; // Already registered
    }

    this._pushModal({
      id: modalId,
      type: modalType,
      urlTracked: false, // External modals don't affect URL by default
      context
    });

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'external_modal_registered',
        modalId,
        modalType,
        stackSize: this._modalStack.length
      },
      'ui-manager'
    );
  }

  /**
   * Unregister that a modal was closed externally
   */
  unregisterExternalModal(modalId: string, modalType: 'project' | 'example' | 'gallery' | 'generic'): void {
    console.log('🔄 unregisterExternalModal called:', { modalId, modalType });
    const modalIndex = this._modalStack.findIndex(m => m.id === modalId && m.type === modalType);
    if (modalIndex === -1) {
      console.log('❌ Modal not found in stack for unregistration');
      return; // Not found
    }

    console.log('✅ Modal found in stack, calling _popModal');
    // Use _popModal to ensure proper state updates and passive context triggering
    this._popModal(modalId);

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'external_modal_unregistered',
        modalId,
        modalType,
        stackSize: this._modalStack.length
      },
      'ui-manager'
    );
  }

  /**
   * Open modal element (DOM manipulation)
   */
  private async _openModalElement(modalId: string, modalType: string): Promise<boolean> {
    console.log('🚪 _openModalElement called:', { modalId, modalType, handlersCount: this._modalHandlers.size });
    
    // Try registered handlers first (homepage, projects page, etc.)
    for (const [context, handler] of Array.from(this._modalHandlers.entries())) {
      try {
        console.log(`🚪 Trying modal handler: ${context} for ${modalId}`);
        const handled = await handler(modalId, modalType);
        console.log(`🚪 Handler ${context} result:`, handled);
        
        if (handled) {
          debugEventEmitter.emit(
            'navigation_event',
            {
              type: 'modal_dom_open',
              modalId,
              modalType,
              handledBy: context
            },
            'ui-manager'
          );
          console.log(`✅ Modal ${modalId} successfully opened by handler: ${context}`);
          return true;
        }
      } catch (error) {
        console.error(`❌ Modal handler ${context} failed:`, error);
      }
    }

    // Fallback: emit event for any listening components
    console.log(`⚠️ No modal handlers succeeded for ${modalId}, emitting fallback event`);
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'modal_dom_open',
        modalId,
        modalType,
        handledBy: 'event-system'
      },
      'ui-manager'
    );
    
    console.log(`❌ Modal ${modalId} could not be opened - no successful handlers`);
    return false;
  }

  /**
   * Close modal element (DOM manipulation)
   */
  private async _closeModalElement(modalId: string): Promise<boolean> {
    // Try registered handlers first (homepage, projects page, etc.)
    for (const [context, handler] of Array.from(this._modalHandlers.entries())) {
      try {
        // Check if this handler can close the modal
        // We'll use a special modalType 'close' to indicate close operation
        const handled = await handler(modalId, 'close');
        if (handled) {
          debugEventEmitter.emit(
            'navigation_event',
            {
              type: 'modal_dom_close',
              modalId,
              handledBy: context
            },
            'ui-manager'
          );
          return true;
        }
      } catch (error) {
        console.error(`Modal close handler ${context} failed:`, error);
      }
    }

    // Fallback: emit event for any listening components
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'modal_dom_close',
        modalId,
        handledBy: 'event-system'
      },
      'ui-manager'
    );
    
    return false;
  }

  /**
   * Execute a navigation intent declaratively with robust state management
   */
  async executeIntent(params: UIIntentParams, sessionId?: string): Promise<NavigationResult> {
    const startTime = Date.now();
    const planId = uuidv4();
    const correlationId = `nav_intent_${planId}`;

    console.log('🎯 UIManager.executeIntent called with:', {
      params: JSON.stringify(params, null, 2),
      sessionId,
      planId,
      correlationId
    });

    // Validate the navigation intent
    const validation = this._validateNavigationIntent(params);
    console.log('🎯 Navigation intent validation:', validation);
    
    if (!validation.valid) {
      console.error('❌ Navigation intent validation failed:', validation.reason);
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
      console.log('🎯 Creating navigation plan...');
      const plan = await this._createNavigationPlan(params, planId);
      console.log('🎯 Navigation plan created:', {
        steps: plan.steps.length,
        planId: plan.id,
        stepsPreview: plan.steps.map(s => ({ id: s.id, type: s.type }))
      });

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

      // Trigger passive F-I-D context update after successful navigation (non-blocking)
      if (result.success) {
        Promise.resolve().then(async () => {
          try {
            const newState = this.getCurrentUIState();
            await this._onSignificantNavigation(newState);
          } catch (error) {
            // Log but don't fail the navigation
            console.warn('Passive context update failed:', error);
          }
        });
      }

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

      // Update F-I-D context after successful navigation (async, non-interrupting)
      if (success) {
        const currentRoute = this._getCurrentRoute();
        const currentProject = this._getProjectParam();
        
        const navigationContext: NavigationContext = {
          currentRoute,
          currentProject: currentProject ?? null,
          modalStack: [...this._modalStack],
          visibleSections: this._currentUIState.visibleAnchors,
          canNavigate: true
        };

        // Async context update - don't block navigation completion
        contextFrameManager.updateContextForNavigation(
          contextFrameManager.getEnhancedNavigationContext(navigationContext)
        ).catch(error => {
          console.error('F-I-D context update failed after navigation:', error);
        });

        // Trigger immediate passive context update for successful navigation (critical change)
        if (this._passiveContextEnabled) {
          console.log('🔄 Triggering IMMEDIATE passive context update for successful navigation completion');
          const currentState = this.getCurrentUIState();
          this._triggerImmediatePassiveContextUpdate(currentState).catch(error => {
            console.warn('Navigation completion passive context update failed:', error);
          });
        }
      }

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
    const sections = await this._detectAvailableSections();

    // Determine available transitions
    const transitions = this._detectAvailableTransitions(route, projectParam ?? undefined);

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
      waitForReadyMs: 500,
      scrollBehavior: 'smooth' as const,
      allowInterruption: true,
      urlStrategy: 'none' as const,
      ...params.behavior
    };

    // Model-dialect tolerance: provider schema flattening (Gemini merges the
    // oneOf variants into one permissive object) produces shape drift like
    // {type:'section', id:'<project-slug>', sectionId:'<anchor>'} — the
    // intent is unambiguous, so normalize instead of misrouting it.
    params = { ...params, target: this._normalizeIntentTarget(params.target) };

    // Analyze current state and determine required steps
    switch (params.target.type) {
      case 'route':
        steps.push(...this._planRouteNavigation(params.target.id, currentState, defaultBehavior));
        break;

      case 'project':
        // Handle complex project navigation scenarios
        steps.push(...this._planComplexProjectNavigation(params.target.id, params.target.sectionId, currentState, defaultBehavior, params.target.highlight));
        break;

      case 'section':
        // Handle complex section navigation scenarios
        if (params.target.projectId) {
          // Navigate to project first, then section (handles project switching)
          steps.push(...this._planComplexProjectNavigation(params.target.projectId, params.target.id, currentState, defaultBehavior, params.target.highlight));
        } else {
          // Direct section navigation (within current context)
          steps.push(...this._planSectionNavigation(params.target.id, currentState, defaultBehavior));
          if (params.target.highlight !== undefined) {
            steps.push(this._createHighlightStep(params.target.id, params.target.highlight));
          }
        }
        break;

      case 'modal':
        // Handle explicit modal operations (open/close)
        // While declarative section navigation is preferred, explicit modal operations
        // are still useful for internal use and edge cases
        steps.push(...this._planModalNavigation(params.target.id, currentState, defaultBehavior));
        break;

      case 'element':
        steps.push(...this._planElementNavigation(params.target.id, currentState, defaultBehavior));
        break;

      case 'semantic':
        // Handle semantic navigation with fallback
        steps.push(...await this._planSemanticNavigation(params.target.semanticId, params.target.fallbackId, currentState, defaultBehavior));
        break;

      case 'content':
        // Handle content-based navigation with fallback
        steps.push(...await this._planContentNavigation(params.target.query, params.target.projectId, params.target.fallbackSection, currentState, defaultBehavior));
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

  /** Repair drifted target shapes coming from provider schema dialects. */
  private _normalizeIntentTarget(target: UIIntentParams['target']): UIIntentParams['target'] {
    const t = target as any;
    // {type:'section', id:<project-slug>, sectionId:<anchor>} — the section
    // variant has no sectionId field; the model meant project+section.
    if (t?.type === 'section' && typeof t.sectionId === 'string' && t.sectionId && !t.projectId) {
      console.warn('🎯 ui_intent target normalized: section+sectionId drift → project navigation', t);
      return { type: 'project', id: t.id, sectionId: t.sectionId, highlight: t.highlight };
    }
    // {type:'section', id:<anchor>, parentContext:<project-slug>} — the model
    // borrowed the MODAL variant's parentContext for the project.
    if (t?.type === 'section' && typeof t.parentContext === 'string' && t.parentContext && !t.projectId) {
      console.warn('🎯 ui_intent target normalized: section+parentContext drift → project navigation', t);
      return { type: 'project', id: t.parentContext, sectionId: t.id, highlight: t.highlight };
    }
    // {type:'project', id, section/anchor aliases}
    if (t?.type === 'project' && !t.sectionId && (typeof t.section === 'string' || typeof t.anchor === 'string')) {
      console.warn('🎯 ui_intent target normalized: section alias field', t);
      return { type: 'project', id: t.id, sectionId: t.section ?? t.anchor, highlight: t.highlight };
    }
    return target;
  }

  /**
   * Plan complex project navigation handling modal switching and sections
   */
  private _planComplexProjectNavigation(
    targetProjectId: string,
    targetSectionId: string | undefined,
    currentState: UIState,
    behavior: any,
    highlight?: { text?: string }
  ): NavigationStep[] {
    const steps: NavigationStep[] = [];
    const currentRoute = this._getCurrentRoute();
    const currentProjectModal = this._modalStack.find(m => m.type === 'project');

    // Scenario 1: Currently viewing Project A, want to view Project B (with optional section)
    if (currentProjectModal && currentProjectModal.id !== targetProjectId) {
      // Check if we have modal handlers available and can avoid route navigation
      const hasModalHandler = this._modalHandlers.size > 0;
      const canSkipRouteNavigation = hasModalHandler && (currentRoute === 'home' || currentRoute === 'projects');
      
      // Close current project modal
      steps.push(this._createCloseModalStep(currentProjectModal.id, behavior));

      // Add delay for modal close animation
      if (this._timingConfig.animationMode !== 'instant') {
        steps.push(this._createDelayStep(this._timingConfig.modalTransitionDelay));
      }

      // Only navigate to projects page if we don't have modal handlers or URL strategy requires it
      if (currentRoute !== 'projects' && !canSkipRouteNavigation) {
        // For WebRTC sessions, avoid route navigation entirely if possible
        if (behavior.urlStrategy === 'none') {
          console.log('🎯 Skipping route navigation to projects page due to urlStrategy: none');
        } else {
          console.log(`🎯 Route navigation to projects with urlStrategy: ${behavior.urlStrategy}`);
          steps.push(this._createRouteNavigationStep('projects', behavior));

          // Add delay for route navigation
          if (this._timingConfig.animationMode !== 'instant') {
            steps.push(this._createDelayStep(this._timingConfig.routeNavigationWait));
          }
        }
      } else if (canSkipRouteNavigation) {
        console.log(`🎯 Skipping route navigation - modal handler available on ${currentRoute} page`);
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
      // Check if we have a modal handler available (homepage or projects page)
      const hasModalHandler = this._modalHandlers.size > 0;
      
      // Only navigate to projects page if we're not on homepage or don't have a modal handler
      if (currentRoute !== 'projects' && currentRoute !== 'home' && !hasModalHandler) {
        // For WebRTC sessions, avoid route navigation entirely if possible
        if (behavior.urlStrategy === 'none') {
          console.log('🎯 Skipping route navigation to projects page due to urlStrategy: none (no modal handler scenario)');
        } else {
          console.log(`🎯 Route navigation to projects (no modal handler) with urlStrategy: ${behavior.urlStrategy}`);
          steps.push(this._createRouteNavigationStep('projects', behavior));

          if (this._timingConfig.animationMode !== 'instant') {
            steps.push(this._createDelayStep(this._timingConfig.routeNavigationWait));
          }
        }
      }

      // Open project modal (will use registered handler if available)
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

      // Guided-navigation emphasis: pulse the section (and the exact passage
      // when the navTarget carries a snippet) so "show me where" actually shows
      steps.push(this._createHighlightStep(targetSectionId, highlight));
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
          const modalClosed = await this._closeModalElement(modalId);
          if (!modalClosed) {
            console.warn(`No handler available to close modal ${modalId}, proceeding anyway`);
          }

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
          // Models sometimes pass the project TITLE instead of the slug
          // (schema descriptions get lossy through provider dialects) — try
          // the id verbatim, then a slugified fallback.
          const candidates = [projectId];
          const slugified = projectId
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          if (slugified && slugified !== projectId) candidates.push(slugified);

          // Fuzzy rescue: models drop hyphens ('ecommerce-platform' for
          // 'e-commerce-platform') and slugifying can't restore them. Match
          // the id against real slugs on the page (project cards carry
          // data-project-id) with all non-alphanumerics stripped.
          const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
          const wanted = normalize(projectId);
          if (wanted) {
            for (const el of Array.from(document.querySelectorAll('[data-project-id]'))) {
              const slug = el.getAttribute('data-project-id');
              if (slug && !candidates.includes(slug) && normalize(slug) === wanted) {
                candidates.push(slug);
                break;
              }
            }
          }

          let openedId: string | null = null;
          for (const candidate of candidates) {
            if (await this._openModalElement(candidate, 'project')) {
              openedId = candidate;
              break;
            }
          }
          if (!openedId) {
            throw new Error(`No modal handler could open project ${projectId}${candidates.length > 1 ? ` (also tried ${candidates.slice(1).map(c => `'${c}'`).join(', ')})` : ''} — check the slug`);
          }

          // Track state only for the id that actually opened
          this._pushModal({
            id: openedId,
            type: 'project',
            urlTracked: true
          });

          // Wait for open animation if not instant
          if (this._timingConfig.animationMode !== 'instant') {
            await new Promise(resolve => setTimeout(resolve, this._timingConfig.modalOpenDuration));
          }

          return {
            success: true,
            message: `Successfully opened project modal ${openedId}`
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
          // State-only route navigation - no URL manipulation
          if (typeof window !== 'undefined') {
            console.log(`🎯 State-only route navigation to ${route} (no URL changes)`);
            
            // Update internal state only
            this._currentEpoch++;
            this._updateBreadcrumbPath();
            
            // Update the internal route tracking without URL changes
            this._currentUIState.currentRoute = route;
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

  /** Selector for a section anchor: heading ids from the Tiptap renderer,
   *  fixed modal anchors, or data-section wrappers. */
  private _sectionSelector(sectionId: string): string {
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(sectionId) : sectionId;
    return `#${escaped}, [data-section="${escaped}"], [data-section-id="${escaped}"]`;
  }

  /** Modal article content loads async — poll for the anchor instead of
   *  failing on the first miss. */
  private async _waitForElement(selector: string, timeoutMs = 4000): Promise<Element | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const element = document.querySelector(selector);
      if (element) return element;
      if (Date.now() >= deadline) return null;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  /**
   * Create a step for section scrolling
   */
  private _createSectionScrollStep(sectionId: string, behavior: any): NavigationStep {
    return {
      id: `scroll_to_${sectionId}`,
      type: 'scroll',
      selector: this._sectionSelector(sectionId),
      timeout: this._timingConfig.stepTimeoutMs,
      execute: async () => {
        try {
          if (typeof window === 'undefined') {
            return {
              success: true,
              message: 'Server-side, skipping scroll'
            };
          }

          const element = await this._waitForElement(this._sectionSelector(sectionId));
          if (!element) {
            return {
              success: false,
              message: `Section ${sectionId} not found`
            };
          }

          // Scroll with re-assert: late async renders (article content,
          // images, layout animations) can reset the position afterwards.
          await this._scrollWithReassert(element);

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
   * Guided-navigation emphasis after a section scroll (the "automatic
   * highlighting" the tool docs promise). Best-effort: a failed highlight
   * never fails the navigation. With a text snippet (T3 navTargets carry the
   * passage), the exact text is marked; otherwise the section pulses.
   */
  private _createHighlightStep(sectionId: string, highlight?: { text?: string }): NavigationStep {
    return {
      id: `highlight_${sectionId}`,
      type: 'highlight',
      timeout: this._timingConfig.stepTimeoutMs,
      execute: async () => {
        try {
          if (typeof window === 'undefined') {
            return { success: true, message: 'Server-side, skipping highlight' };
          }
          // Dynamic import — client-tools imports UIManager the same way
          const { uiNavigationTools } = await import('@/lib/ai/tools/client-tools');

          // Fresh emphasis: previous highlights are stale context
          await uiNavigationTools.clearHighlights({});

          const element = document.querySelector(this._sectionSelector(sectionId));

          if (highlight?.text && element) {
            // The anchor is usually the heading; the passage lives in the
            // SIBLINGS after it. The parent container rarely has an id, so
            // mark it with a transient attribute to scope the text search.
            const scope = element.parentElement ?? element;
            scope.setAttribute('data-ai-highlight-scope', 'active');
            try {
              const result = await uiNavigationTools.highlightText({
                selector: '[data-ai-highlight-scope="active"]',
                text: highlight.text,
              });
              if (result.success && (result.data as { count?: number } | undefined)?.count) {
                return { success: true, message: `Highlighted passage in ${sectionId}` };
              }
            } finally {
              scope.removeAttribute('data-ai-highlight-scope');
            }
            // Passage not found verbatim — fall through to section pulse
          }

          if (element) {
            await uiNavigationTools.highlightText({ selector: this._sectionSelector(sectionId) });
            return { success: true, message: `Highlighted section ${sectionId}` };
          }
          return { success: true, message: `Nothing to highlight for ${sectionId} (non-fatal)` };
        } catch (error) {
          // Emphasis is sugar — never fail the navigation over it
          console.warn('Highlight step failed (non-fatal):', error);
          return { success: true, message: `Highlight skipped for ${sectionId}` };
        }
      }
    };
  }

  /**
   * Plan semantic navigation with graceful fallback
   */
  private async _planSemanticNavigation(
    semanticId: string, 
    fallbackId: string | undefined, 
    currentState: UIState, 
    behavior: any
  ): Promise<NavigationStep[]> {
    try {
      // First, try to validate semantic ID using registry
      const isValidSemantic = await this.validateSemanticID(semanticId);
      
      if (isValidSemantic) {
        // Semantic ID is valid, try to find section
        const sections = await this._detectAvailableSections();
        const targetSection = sections.find(s => s.semanticId === semanticId || s.id === semanticId);
        
        if (targetSection) {
          // Found semantic section, navigate to it
          if (targetSection.projectId && targetSection.projectId !== this._getProjectParam()) {
            // Need to switch projects first
            return this._planComplexProjectNavigation(targetSection.projectId, targetSection.id, currentState, behavior);
          } else {
            // Direct section navigation
            return this._planSectionNavigation(targetSection.id, currentState, behavior);
          }
        }
      }
      
      // Semantic section not found or invalid, try fallback
      if (fallbackId) {
        console.warn(`Semantic ID ${semanticId} not found or invalid, using fallback ${fallbackId}`);
        
        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'semantic_navigation_fallback',
            semanticId,
            fallbackId,
            reason: isValidSemantic ? 'section_not_found' : 'invalid_semantic_id'
          },
          'ui-manager'
        );
        
        return this._planSectionNavigation(fallbackId, currentState, behavior);
      }
      
      throw new Error(`Semantic section ${semanticId} not found and no fallback provided`);
      
    } catch (error) {
      // If semantic navigation fails completely, try fallback
      if (fallbackId) {
        console.warn(`Semantic navigation failed, using fallback:`, error);
        
        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'semantic_navigation_error_fallback',
            semanticId,
            fallbackId,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'ui-manager'
        );
        
        return this._planSectionNavigation(fallbackId, currentState, behavior);
      }
      
      throw error;
    }
  }

  /**
   * Plan content-based navigation with graceful fallback
   */
  private async _planContentNavigation(
    query: string, 
    projectId: string | undefined, 
    fallbackSection: string | undefined, 
    currentState: UIState, 
    behavior: any
  ): Promise<NavigationStep[]> {
    try {
      // Try to find content using registered providers
      for (const provider of this._contentProviders) {
        if (provider.searchContent) {
          try {
            const results = await provider.searchContent(query, { projectId });
            
            if (results.length > 0) {
              const bestResult = results[0];
              
              // Navigate to the best search result
              if (bestResult.semanticId) {
                return this._planSemanticNavigation(bestResult.semanticId, bestResult.id, currentState, behavior);
              } else if (bestResult.id) {
                return this._planSectionNavigation(bestResult.id, currentState, behavior);
              }
            }
          } catch (error) {
            console.warn(`Content search failed for provider ${provider.name}:`, error);
          }
        }
      }
      
      // No search results found, try fallback
      if (fallbackSection) {
        console.warn(`No content found for query "${query}", using fallback ${fallbackSection}`);
        return this._planSectionNavigation(fallbackSection, currentState, behavior);
      }
      
      throw new Error(`No content found for query "${query}" and no fallback provided`);
      
    } catch (error) {
      // If content navigation fails completely, try fallback
      if (fallbackSection) {
        console.warn(`Content navigation failed, using fallback:`, error);
        return this._planSectionNavigation(fallbackSection, currentState, behavior);
      }
      
      throw error;
    }
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
  private _planRouteNavigation(routeId: string, currentState: UIState, behavior: Required<NonNullable<UIIntentParams['behavior']>>): NavigationStep[] {
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
              // 7.7: the AI provider lives in the ROOT layout now, so a
              // CLIENT-side route change (registered navigator → router.push)
              // no longer tears down a live session — route steps are allowed
              // during voice sessions. Only the full-page-load fallback
              // (window.location.href, no navigator registered) remains
              // session-fatal and is still refused while a session is live.
              if (this._backgroundUpdateCallback && !this._routeNavigator) {
                return {
                  success: false,
                  message: `Route navigation to ${targetPath} would end the live voice session (no client-side navigator available). Stay on this page — projects and sections can be opened here directly (use a project/section target instead).`,
                  error: 'ROUTE_CHANGE_BLOCKED_DURING_VOICE_SESSION'
                };
              }
              if (this._routeNavigator) {
                this._routeNavigator(targetPath);
              } else {
                window.location.href = targetPath;
              }
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
   * Plan explicit modal operations (open/close)
   * While declarative section navigation is preferred, explicit modal operations
   * are useful for internal use and edge cases
   */
  private _planModalNavigation(modalId: string, currentState: UIState, behavior: Required<NonNullable<UIIntentParams['behavior']>>): NavigationStep[] {
    const steps: NavigationStep[] = [];
    
    // Handle explicit close operations
    if (modalId === 'close' || modalId === 'close-all') {
      // Close all modals or specific types
      const modalsToClose = modalId === 'close-all' ? 
        this._modalStack : 
        this._modalStack.filter(m => m.type === 'project'); // Default to project modals
      
      for (const modal of modalsToClose) {
        console.log(`🎯 Explicitly closing modal: ${modal.id}`);
        steps.push(this._createCloseModalStep(modal.id, behavior));
        
        // Add delay for modal close animation
        if (this._timingConfig.animationMode !== 'instant') {
          steps.push(this._createDelayStep(this._timingConfig.modalTransitionDelay));
        }
      }
    } else {
      // Handle modal opening (treat as project opening)
      console.log(`🎯 Explicitly opening modal: ${modalId}`);
      steps.push(this._createOpenProjectModalStep(modalId, behavior));
    }
    
    return steps;
  }

  // _planProjectNavigation removed: dead code superseded by
  // _planComplexProjectNavigation (it forced a full page load to /projects,
  // which would destroy a live voice session).

  /**
   * Plan navigation to a specific section
   */
  private _planSectionNavigation(sectionId: string, currentState: UIState, behavior: Required<NonNullable<UIIntentParams['behavior']>>): NavigationStep[] {
    // ONE runtime-resolved step: where the anchor lives (inside the open
    // project modal vs behind it on the page) is only knowable in the DOM at
    // execution time. The old plan closed EVERY project modal up front when
    // closeBlocking was set — so "scroll to X" inside an open project closed
    // the project instead of scrolling within it (owner report, 2026-07-08).
    return [{
      id: `section_nav_${sectionId}`,
      type: 'scroll',
      selector: this._sectionSelector(sectionId),
      timeout: this._timingConfig.stepTimeoutMs,
      execute: async () => {
        try {
          if (typeof window === 'undefined') {
            return { success: true, message: 'Server-side, skipping scroll' };
          }

          const combinedSelector = `${this._getSectionSelector(sectionId)}, ${this._sectionSelector(sectionId)}`;
          const openProjectModal = this._modalStack.find(m => m.type === 'project');
          const modalRoot = document.querySelector('[role="dialog"]');

          let element = await this._waitForElement(combinedSelector);

          // Target lives INSIDE the open modal: scroll in place — never close.
          if (element && modalRoot && modalRoot.contains(element)) {
            await this._scrollWithReassert(element, behavior.scrollBehavior);
            return {
              success: true,
              message: `Scrolled to section ${sectionId} inside the open project${openProjectModal ? ` (${openProjectModal.id})` : ''}`,
              data: { sectionId, within: 'project-modal' }
            };
          }

          // Target exists but is BEHIND the open modal: close it first (the
          // canonical staged route), unless the caller forbade that.
          if (element && modalRoot && !modalRoot.contains(element) && openProjectModal) {
            if (!behavior.closeBlocking) {
              return {
                success: false,
                message: `Section ${sectionId} is behind the open project modal. Retry with behavior.closeBlocking=true, or use a project target to stay inside the project.`,
                error: 'SECTION_BEHIND_MODAL'
              };
            }
            await this._closeModalElement(openProjectModal.id);
            this._popModal(openProjectModal.id);
            if (this._timingConfig.animationMode !== 'instant') {
              await new Promise(resolve => setTimeout(resolve, this._timingConfig.modalCloseDuration + this._timingConfig.animationBufferWait));
            }
            element = document.querySelector(combinedSelector);
          }

          if (!element) {
            return {
              success: false,
              message: `Section ${sectionId} not found on this page${openProjectModal ? ` or inside the open project (${openProjectModal.id})` : ''}. If it belongs to another project, use {type:'project', id:'<slug>', sectionId:'${sectionId}'}.`,
              error: 'Element not found'
            };
          }

          await this._scrollWithReassert(element, behavior.scrollBehavior);
          return {
            success: true,
            message: `Scrolled to section ${sectionId}`,
            data: { sectionId }
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
    }];
  }

  /** Scroll an element into view and re-assert after late layout shifts. */
  private async _scrollWithReassert(element: Element, scrollBehavior: 'smooth' | 'instant' = 'smooth'): Promise<void> {
    element.scrollIntoView({
      behavior: this._timingConfig.animationMode === 'instant' || scrollBehavior === 'instant' ? 'auto' : 'smooth',
      block: 'start'
    });
    if (this._timingConfig.animationMode !== 'instant') {
      await new Promise(resolve => setTimeout(resolve, this._timingConfig.scrollDuration));
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const rect = element.getBoundingClientRect();
      const inView = rect.top >= 0 && rect.top < window.innerHeight * 0.5;
      if (inView) break;
      element.scrollIntoView({ behavior: 'auto', block: 'start' });
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  /**
   * Plan navigation to a specific element
   */
  private _planElementNavigation(elementId: string, currentState: UIState, behavior: Required<NonNullable<UIIntentParams['behavior']>>): NavigationStep[] {
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
      timeout: waitMs, //+ 1000, // Add buffer to timeout
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
   * Detect available sections with pluggable provider system
   */
  private async _detectAvailableSections(): Promise<SemanticSection[]> {
    const cacheKey = this._generateSectionCacheKey();
    
    // Check cache first
    if (this._sectionCache.has(cacheKey)) {
      const cached = this._sectionCache.get(cacheKey)!;
      // Check if cache is still valid (30 seconds)
      if (Date.now() - (cached as any)._cacheTime < this._cacheTimeout) {
        return cached;
      }
    }

    // Get static sections (current behavior)
    const staticSections = this._getStaticSections();
    
    // Get dynamic sections from providers
    const dynamicSections = await this._getDynamicSections();
    
    // Combine and deduplicate
    const allSections = this._mergeSections(staticSections, dynamicSections);
    
    // Cache the result
    (allSections as any)._cacheTime = Date.now();
    this._sectionCache.set(cacheKey, allSections);
    
    return allSections;
  }

  /**
   * Get static sections (backward compatibility)
   */
  private _getStaticSections(): SemanticSection[] {
    const sections: SemanticSection[] = [];

    // Always available main sections
    sections.push(
      { id: 'hero', title: 'Hero Section', type: 'homepage' },
      { id: 'about', title: 'About Section', type: 'homepage' },
      { id: 'projects', title: 'Projects Section', type: 'homepage' },
      { id: 'contact', title: 'Contact Section', type: 'homepage' }
    );

    // Add modal-specific sections if modals are open
    if (this._modalStack.length > 0) {
      const topModal = this._modalStack[this._modalStack.length - 1];

      if (topModal.type === 'project') {
        sections.push(
          { id: 'overview', title: 'Project Overview', type: 'project', projectId: topModal.id, containerId: 'project-modal' },
          { id: 'technical-details', title: 'Technical Details', type: 'project', projectId: topModal.id, containerId: 'project-modal' },
          { id: 'gallery', title: 'Project Gallery', type: 'project', projectId: topModal.id, containerId: 'project-modal' }
        );
      }
    }

    return sections;
  }

  /**
   * Get dynamic sections from registered providers
   */
  private async _getDynamicSections(): Promise<SemanticSection[]> {
    const allSections: SemanticSection[] = [];
    const context = this._getNavigationContext();
    
    for (const provider of this._contentProviders) {
      try {
        const sections = await provider.discoverSections(context);
        allSections.push(...sections);
        
        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'sections_discovered',
            providerName: provider.name,
            sectionCount: sections.length
          },
          'ui-manager'
        );
      } catch (error) {
        // Graceful degradation - log but continue
        console.warn(`Content provider ${provider.name} failed:`, error);
        
        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'provider_error',
            providerName: provider.name,
            error: error instanceof Error ? error.message : String(error)
          },
          'ui-manager'
        );
      }
    }
    
    return allSections;
  }

  /**
   * Merge static and dynamic sections, removing duplicates
   */
  private _mergeSections(staticSections: SemanticSection[], dynamicSections: SemanticSection[]): SemanticSection[] {
    const sectionMap = new Map<string, SemanticSection>();
    
    // Add static sections first
    staticSections.forEach(section => {
      sectionMap.set(section.id, section);
    });
    
    // Add dynamic sections, allowing them to override static ones
    dynamicSections.forEach(section => {
      const key = section.semanticId || section.id;
      sectionMap.set(key, section);
    });
    
    return Array.from(sectionMap.values());
  }

  /**
   * Generate cache key for section discovery
   */
  private _generateSectionCacheKey(): string {
    const route = this._getCurrentRoute();
    const project = this._getProjectParam();
    const modalIds = this._modalStack.map(m => m.id).join(',');
    
    return `${route}:${project || 'none'}:${modalIds}`;
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
    const transitions: Array<{
      id: string;
      kind: 'route' | 'open' | 'close' | 'tab';
      target?: string;
      requires?: string[];
    }> = [];

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
      // Trigger immediate passive context update for browser navigation (critical change)
      if (this._passiveContextEnabled) {
        console.log('🔄 Triggering IMMEDIATE passive context update for browser back/forward navigation');
        const currentState = this.getCurrentUIState();
        this._triggerImmediatePassiveContextUpdate(currentState).catch(error => {
          console.warn('Browser navigation passive context update failed:', error);
        });
      }
    });

    window.addEventListener('hashchange', () => {
      this._currentEpoch++;
      // Trigger immediate passive context update for hash changes (critical change)
      if (this._passiveContextEnabled) {
        console.log('🔄 Triggering IMMEDIATE passive context update for hash change navigation');
        const currentState = this.getCurrentUIState();
        this._triggerImmediatePassiveContextUpdate(currentState).catch(error => {
          console.warn('Hash change passive context update failed:', error);
        });
      }
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
      modalStack: [],
      epoch: 0,
      currentRoute: 'destroyed',
      currentProject: undefined,
      scrollPosition: {
        positions: {},
        visibleElements: [],
        lastScrollDirection: null,
        scrollVelocity: 0,
        isScrolling: false
      },
      mediaState: {
        activeCarousels: [],
        activeVideos: [],
        lightbox: undefined,
        recentInteractions: []
      },
      interactionState: {
        focusedElement: undefined,
        clickSequence: [],
        searchHistory: [],
        navigationPath: []
      },
      lastUserAction: undefined
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
   * Navigate by semantic ID (for AI system)
   */
  async navigateToSemanticId(
    semanticId: string, 
    fallbackId?: string
  ): Promise<NavigationResult> {
    return this.executeIntent({
      target: { 
        type: 'semantic', 
        semanticId, 
        fallbackId 
      },
      behavior: {
        scrollBehavior: 'smooth',
        allowInterruption: true
      }
    });
  }

  /**
   * Test navigation scenarios for UX comparison
   */
  async testNavigationScenario(
    scenario: 'project-switch' | 'section-navigation' | 'modal-nesting' | 'semantic-navigation' | 'content-search',
    mode: 'human' | 'instant' = 'human'
  ): Promise<NavigationResult> {
    const originalMode = this._timingConfig.animationMode;
    this.setAnimationMode(mode);

    try {
      let result: NavigationResult;

      switch (scenario) {
        case 'project-switch':
          // Test Project A → Project B scenario
          // First check if we have a project modal open, if not open one
          const currentProjectModal = this._modalStack.find(m => m.type === 'project');
          if (!currentProjectModal) {
            // Open first project
            result = await this.executeIntent({
              target: { type: 'project', id: 'portfolio-website' }
            });
            if (!result.success) break;
            
            // Wait a bit, then switch to different project
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Now switch to a different project with a section
          const targetProject = currentProjectModal?.id === 'e-commerce-platform'
            ? 'llm-systems-research'
            : 'e-commerce-platform';
            
          result = await this.executeIntent({
            target: { type: 'project', id: targetProject, sectionId: 'technical-details' }
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

        case 'semantic-navigation':
          // Test semantic navigation with fallback
          result = await this.executeIntent({
            target: { type: 'semantic', semanticId: 'test-semantic-section', fallbackId: 'about' }
          });
          break;

        case 'content-search':
          // Test content-based navigation
          result = await this.navigateToContent('technical implementation details');
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
   * Register a content provider for dynamic section discovery
   */
  registerContentProvider(provider: ContentProvider): void {
    this._contentProviders.push(provider);
    
    // Clear cache when new provider is added
    this._sectionCache.clear();
    
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'content_provider_registered',
        providerName: provider.name,
        totalProviders: this._contentProviders.length
      },
      'ui-manager'
    );
  }

  /**
   * Unregister a content provider
   */
  unregisterContentProvider(providerName: string): boolean {
    const initialLength = this._contentProviders.length;
    this._contentProviders = this._contentProviders.filter(p => p.name !== providerName);
    
    if (this._contentProviders.length < initialLength) {
      this._sectionCache.clear();
      
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'content_provider_unregistered',
          providerName,
          totalProviders: this._contentProviders.length
        },
        'ui-manager'
      );
      
      return true;
    }
    
    return false;
  }

  /**
   * Initialize semantic ID registry when DOM is ready
   */
  private _initializeSemanticRegistryOnDOMReady(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const initRegistry = () => {
      try {
        const semanticRegistry = getSemanticIDRegistry();
        semanticRegistry.initialize();
        
        // Register as content provider for section discovery
        this.registerContentProvider(semanticRegistry);
        
        debugEventEmitter.emit(
          'navigation_event',
          {
            type: 'semantic_registry_initialized_dom_ready',
            registryName: semanticRegistry.name
          },
          'ui-manager'
        );
      } catch (error) {
        console.error('Failed to initialize semantic ID registry on DOM ready:', error);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initRegistry);
    } else {
      // DOM is already ready
      initRegistry();
    }
  }

  /**
   * Initialize semantic ID registry and register it as a content provider
   */
  private _initializeSemanticRegistry(): void {
    try {
      const semanticRegistry = getSemanticIDRegistry();
      
      // Register as content provider for section discovery
      this.registerContentProvider(semanticRegistry);
      
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'semantic_registry_integrated',
          registryName: semanticRegistry.name
        },
        'ui-manager'
      );
    } catch (error) {
      console.error('Failed to initialize semantic ID registry:', error);
      
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'semantic_registry_integration_failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'ui-manager'
      );
    }
  }

  /**
   * Get the semantic ID registry instance
   */
  getSemanticIDRegistry(): SemanticIDRegistryProvider | null {
    const provider = this._contentProviders.find(p => p.name === 'semantic-id-registry');
    return provider as SemanticIDRegistryProvider || null;
  }

  /**
   * Resolve semantic ID to element using the registry
   */
  resolveSemanticID(semanticId: string): Element | null {
    const registry = this.getSemanticIDRegistry();
    if (!registry) {
      return null;
    }
    
    return registry.resolveSemanticID(semanticId);
  }

  /**
   * Update navigation affordances (called by content ingestion)
   */
  _updateNavigationAffordances(): void {
    try {
      // Clear section cache to force refresh
      this._sectionCache.clear();
      
      // Update current UI state
      this._currentEpoch++;
      this._updateBreadcrumbPath();
      
      // Emit debug event
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'navigation_affordances_updated',
          epoch: this._currentEpoch,
          timestamp: Date.now()
        },
        'ui-manager'
      );
      
      // Trigger background state update
      this._debouncedStateUpdate();
      
    } catch (error) {
      console.error('Failed to update navigation affordances:', error);
      
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'navigation_affordances_update_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        },
        'ui-manager'
      );
    }
  }

  /**
   * Update section registry (called by content ingestion)
   */
  _updateSectionRegistry(entityType: string, slug: string, sections: Array<{ id: string; title: string }>): void {
    try {
      const cacheKey = `${entityType}:${slug}`;
      
      // Convert to SemanticSection format
      const semanticSections: SemanticSection[] = sections.map(section => ({
        id: section.id,
        title: section.title,
        type: entityType === 'PROJECT' ? 'project' : 'content',
        metadata: {
          entityType,
          slug,
          source: 'content-ingestion'
        }
      }));
      
      // Update cache
      this._sectionCache.set(cacheKey, semanticSections);
      
      // Emit debug event
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'section_registry_updated',
          entityType,
          slug,
          sectionsCount: sections.length,
          cacheKey,
          timestamp: Date.now()
        },
        'ui-manager'
      );
      
      // Update navigation affordances
      this._updateNavigationAffordances();
      
    } catch (error) {
      console.error('Failed to update section registry:', error);
      
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'section_registry_update_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          entityType,
          slug,
          timestamp: Date.now()
        },
        'ui-manager'
      );
    }
  }

  /**
   * Validate semantic ID using the registry
   */
  async validateSemanticID(semanticId: string): Promise<boolean> {
    const registry = this.getSemanticIDRegistry();
    if (!registry) {
      return false;
    }
    
    return registry.validateSection(semanticId);
  }

  /**
   * Get registered content providers
   */
  getContentProviders(): ContentProvider[] {
    return [...this._contentProviders];
  }

  /**
   * Navigate to content based on search query using registered content providers
   * Provides graceful fallback handling for robust navigation
   */
  async navigateToContent(query: string): Promise<NavigationResult> {
    const startTime = Date.now();
    
    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'content_navigation_start',
        query,
        providersCount: this._contentProviders.length
      },
      'ui-manager'
    );

    try {
      // Try to find content using registered providers
      for (const provider of this._contentProviders) {
        if (provider.searchContent) {
          try {
            const searchResults = await provider.searchContent(query, { k: 1 });
            
            if (searchResults && searchResults.length > 0) {
              const bestMatch = searchResults[0];
              
              // If the provider has a navigateToContent method, use it
              if ('navigateToContent' in provider && typeof provider.navigateToContent === 'function') {
                const navResult = await provider.navigateToContent(query, this);
                
                if (navResult.success && navResult.target) {
                  // Execute the navigation using UIManager
                  const result = await this.executeIntent({ target: navResult.target });
                  
                  debugEventEmitter.emit(
                    'navigation_event',
                    {
                      type: 'content_navigation_success',
                      query,
                      provider: provider.name,
                      target: navResult.target,
                      totalTime: Date.now() - startTime
                    },
                    'ui-manager'
                  );
                  
                  return {
                    success: result.success,
                    message: result.message || `Navigated to content: "${query}"`,
                    data: {
                      query,
                      provider: provider.name,
                      target: navResult.target,
                      searchResult: bestMatch
                    },
                    error: result.error,
                    executedSteps: result.executedSteps || [],
                    totalTime: Date.now() - startTime
                  };
                }
              } else {
                // Fallback: try to create navigation target from search result
                const fallbackTarget = this._createNavigationTargetFromSearchResult(bestMatch);
                
                if (fallbackTarget) {
                  const result = await this.executeIntent({ target: fallbackTarget });
                  
                  debugEventEmitter.emit(
                    'navigation_event',
                    {
                      type: 'content_navigation_fallback_success',
                      query,
                      provider: provider.name,
                      target: fallbackTarget,
                      totalTime: Date.now() - startTime
                    },
                    'ui-manager'
                  );
                  
                  return {
                    success: result.success,
                    message: result.message || `Found and navigated to content: "${query}"`,
                    data: {
                      query,
                      provider: provider.name,
                      target: fallbackTarget,
                      searchResult: bestMatch,
                      fallback: true
                    },
                    error: result.error,
                    executedSteps: result.executedSteps || [],
                    totalTime: Date.now() - startTime
                  };
                }
              }
            }
          } catch (providerError) {
            console.warn(`Content provider ${provider.name} failed for query "${query}":`, providerError);
            // Continue to next provider
          }
        }
      }

      // No content found with any provider
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'content_navigation_not_found',
          query,
          providersSearched: this._contentProviders.length,
          totalTime: Date.now() - startTime
        },
        'ui-manager'
      );

      return {
        success: false,
        message: `No content found for query: "${query}"`,
        data: {
          query,
          providersSearched: this._contentProviders.length
        },
        error: 'CONTENT_NOT_FOUND',
        executedSteps: [],
        totalTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMsg = `Content navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'content_navigation_error',
          query,
          error: errorMsg,
          totalTime: Date.now() - startTime
        },
        'ui-manager'
      );

      return {
        success: false,
        message: errorMsg,
        data: { query },
        error: errorMsg,
        executedSteps: [],
        totalTime: Date.now() - startTime
      };
    }
  }

  /**
   * Create navigation target from search result (fallback method)
   */
  private _createNavigationTargetFromSearchResult(searchResult: any): UIIntentParams['target'] | null {
    try {
      // If search result has navTarget, use it
      if (searchResult.navTarget) {
        return searchResult.navTarget;
      }

      // Try to infer navigation target from search result properties
      if (searchResult.project) {
        return {
          type: 'project',
          id: searchResult.project,
          sectionId: searchResult.id
        };
      }

      if (searchResult.id) {
        return {
          type: 'section',
          id: searchResult.id
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to create navigation target from search result:', error);
      return null;
    }
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

    console.log('🎯 UIManager navigation listeners setup (URL-independent mode)');
    
    // Note: We no longer listen to popstate, pushState, or replaceState events
    // since we're operating in pure state-based mode to avoid WebRTC disruption
    
    // Instead, we rely on:
    // 1. Direct modal handler calls
    // 2. Internal state management  
    // 3. Component-level state synchronization
    
    // Only listen to hash changes for scroll-to-section functionality
    window.addEventListener('hashchange', () => {
      this.updateNavigationState();
    });
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
   * Check if WebRTC connections are active to determine URL update strategy
   */
  private _isWebRTCActive(): boolean {
    try {
      // Check if we're in a voice session by looking for WebRTC-related indicators
      if (typeof window !== 'undefined') {
        // Check for active MediaStream tracks
        const hasActiveMediaStreams = navigator.mediaDevices.getUserMedia !== undefined;
        
        // Check for ConversationalAgentProvider state
        const voiceAIElements = document.querySelectorAll('[data-voice-ai="true"]');
        const hasVoiceAI = voiceAIElements.length > 0;
        
        // Check for WebRTC-related objects in window
        const hasWebRTCIndicators = 'webkitRTCPeerConnection' in window || 'RTCPeerConnection' in window;
        
        return hasActiveMediaStreams && (hasVoiceAI || hasWebRTCIndicators);
      }
    } catch (error) {
      console.warn('Error checking WebRTC status:', error);
    }
    return false;
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