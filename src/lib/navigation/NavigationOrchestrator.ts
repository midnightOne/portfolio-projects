/**
 * NavigationOrchestrator - Declarative Navigation System
 * 
 * Provides goal-based navigation planning and execution with step sequencing,
 * error handling, timeout management, and idempotency support.
 * 
 * Enables single-call navigation goals instead of multi-step tool sequences.
 */

import { debugEventEmitter } from '../debug/debugEventEmitter';
import { uiStateManager, UIState } from './UIStateManager';
import { v4 as uuidv4 } from 'uuid';

// Navigation intent interfaces
export interface UIIntentParams {
  epoch?: number;                       // Client's last-known UI state version
  target: 
    | { type: "section"; id: string }   // e.g., {type:"section", id:"contact"}
    | { type: "route"; id: string }     // e.g., {type:"route", id:"home"}
    | { type: "project"; id: string }   // e.g., {type:"project", id:"aurora-avatar"}
    | { type: "element"; id: string };  // tab, accordion, etc.
  behavior?: {
    openIfNeeded?: boolean;             // open modal or navigate if required
    closeBlocking?: boolean;            // close top modal if it blocks target
    waitForReadyMs?: number;            // wait for loader/transition
    scrollBehavior?: "smooth"|"instant";
  };
  scope?: { 
    route?: string; 
    modalId?: string; 
    projectId?: string; 
  };
  idempotencyKey?: string;
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
    kind: "open"|"close"|"route"|"tab";
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

// Navigation orchestrator implementation
export class NavigationOrchestrator {
  private static instance: NavigationOrchestrator | null = null;
  private _currentEpoch: number = 0;
  private _executingPlans: Map<string, Promise<NavigationResult>> = new Map();
  private _completedPlans: Map<string, NavigationResult> = new Map();
  private _isInitialized: boolean = false;

  private constructor() {
    this._setupEpochTracking();
  }

  static getInstance(): NavigationOrchestrator {
    if (!NavigationOrchestrator.instance) {
      NavigationOrchestrator.instance = new NavigationOrchestrator();
    }
    return NavigationOrchestrator.instance;
  }

  /**
   * Initialize the navigation orchestrator
   */
  initialize(): void {
    if (this._isInitialized) {
      return;
    }

    this._isInitialized = true;
    console.log('NavigationOrchestrator initialized');
  }

  /**
   * Execute a navigation intent declaratively
   */
  async executeIntent(params: UIIntentParams, sessionId?: string): Promise<NavigationResult> {
    const startTime = Date.now();
    const planId = uuidv4();
    const correlationId = `nav_intent_${planId}`;

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

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'intent_start',
        planId,
        params,
        currentState: uiStateManager.getCurrentUIState()
      },
      sessionId || 'navigation-orchestrator',
      correlationId
    );

    try {
      // Create navigation plan
      const plan = await this._createNavigationPlan(params, planId);
      
      // Execute plan
      const executionPromise = this._executePlan(plan, sessionId, correlationId);
      
      // Store execution promise for idempotency
      if (params.idempotencyKey) {
        this._executingPlans.set(params.idempotencyKey, executionPromise);
      }

      const result = await executionPromise;
      
      // Store completed result
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

      return errorResult;
    }
  }

  /**
   * Describe current UI state and available navigation affordances
   */
  async describeUI(): Promise<UIDescribeResponse> {
    const currentState = uiStateManager.getCurrentUIState();
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
    const currentState = uiStateManager.getCurrentUIState();
    const steps: NavigationStep[] = [];
    const defaultBehavior = {
      openIfNeeded: true,
      closeBlocking: true,
      waitForReadyMs: 1500,
      scrollBehavior: 'smooth' as const,
      ...params.behavior
    };

    // Analyze current state and determine required steps
    switch (params.target.type) {
      case 'route':
        steps.push(...this._planRouteNavigation(params.target.id, currentState, defaultBehavior));
        break;
        
      case 'project':
        steps.push(...this._planProjectNavigation(params.target.id, currentState, defaultBehavior));
        break;
        
      case 'section':
        steps.push(...this._planSectionNavigation(params.target.id, currentState, defaultBehavior));
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
   * Execute a single step with retry logic
   */
  private async _executeStepWithRetries(step: NavigationStep, sessionId?: string, correlationId?: string): Promise<NavigationStepResult> {
    const maxRetries = step.retries || 2;
    let lastResult: NavigationStepResult | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const timeoutMs = step.timeout || 5000;
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

        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }

      } catch (error) {
        lastResult = {
          success: false,
          message: `Step execution failed: ${error instanceof Error ? error.message : String(error)}`,
          error: error instanceof Error ? error.message : String(error),
          shouldRetry: attempt < maxRetries
        };

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
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
    }

    // Open project modal
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
    // Map common section names to selectors
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
   * Detect available sections on current page
   */
  private _detectAvailableSections(): Array<{ id: string; title: string; containerId?: string }> {
    if (typeof window === 'undefined') {
      return [];
    }

    const sections: Array<{ id: string; title: string; containerId?: string }> = [];
    
    // Find sections with IDs
    const sectionElements = document.querySelectorAll('section[id], [data-section], [data-section-id]');
    sectionElements.forEach(element => {
      const id = element.id || 
                 element.getAttribute('data-section') || 
                 element.getAttribute('data-section-id');
      
      if (id) {
        const title = element.querySelector('h1, h2, h3')?.textContent || 
                     element.getAttribute('data-title') || 
                     id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        sections.push({
          id,
          title,
          containerId: element.closest('[id]')?.id
        });
      }
    });

    return sections;
  }

  /**
   * Detect available navigation transitions
   */
  private _detectAvailableTransitions(route: string, projectParam?: string | null): Array<{
    id: string;
    kind: "open"|"close"|"route"|"tab";
    target?: string;
    requires?: string[];
  }> {
    const transitions: Array<{
      id: string;
      kind: "open"|"close"|"route"|"tab";
      target?: string;
      requires?: string[];
    }> = [];

    // Route transitions
    if (route !== 'home') {
      transitions.push({
        id: 'route:home',
        kind: 'route',
        target: 'home'
      });
    }

    if (route !== 'projects') {
      transitions.push({
        id: 'route:projects',
        kind: 'route',
        target: 'projects'
      });
    }

    // Modal transitions
    if (route === 'projects' && !projectParam) {
      transitions.push({
        id: 'open:projectModal',
        kind: 'open',
        target: 'projectModal'
      });
    }

    if (projectParam) {
      transitions.push({
        id: 'close:projectModal',
        kind: 'close',
        target: 'projectModal'
      });
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
   * Cleanup resources
   */
  destroy(): void {
    this._executingPlans.clear();
    this._completedPlans.clear();
    this._isInitialized = false;
  }
}

// Export singleton instance
export const navigationOrchestrator = NavigationOrchestrator.getInstance();