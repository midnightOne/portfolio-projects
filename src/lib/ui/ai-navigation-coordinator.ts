/**
 * AI Navigation Coordinator - UI System Task 14
 * 
 * Coordinates AI interface animations with main portfolio navigation,
 * ensures AI navigation commands work reliably across all UI components,
 * and manages navigation state synchronization.
 * 
 * Requirements: 8.8, 8.9, 8.10
 */

'use client';

import type { 
  NavigationCommand, 
  HighlightOptions, 
  UIState,
  AnimationCommand 
} from './types';
import { 
  executeCoordinatedAnimations,
  executeNavigationCommand,
  executeHighlight,
  removeHighlight,
  isAnimating,
  clearAnimationQueue
} from './animation';
import { getAISystemIntegration } from './ai-system-integration';
import { getCommunicationManager } from './ai-communication';

// Navigation Coordination Types
export interface NavigationCoordinator {
  // Core Navigation
  executeAINavigation: (command: NavigationCommand) => Promise<NavigationResult>;
  executeCoordinatedNavigation: (commands: NavigationCommand[]) => Promise<NavigationResult>;
  
  // Animation Coordination
  coordinateWithFloatingAI: (aiCommand: NavigationCommand, uiCommands: NavigationCommand[]) => Promise<void>;
  synchronizeAnimations: (aiAnimation: AnimationCommand, uiAnimations: AnimationCommand[]) => Promise<void>;
  
  // State Synchronization
  syncNavigationState: (aiState: Partial<UIState>, uiState: Partial<UIState>) => Promise<void>;
  getCoordinatedState: () => CoordinatedNavigationState;
  
  // Reliability Assurance
  validateNavigation: (command: NavigationCommand) => ValidationResult;
  retryFailedNavigation: (command: NavigationCommand, maxRetries?: number) => Promise<NavigationResult>;
  fallbackNavigation: (command: NavigationCommand) => Promise<NavigationResult>;
}

export interface NavigationResult {
  success: boolean;
  command: NavigationCommand;
  duration: number;
  error?: string;
  fallbackUsed?: boolean;
  retryCount?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface CoordinatedNavigationState {
  aiInterface: {
    position: 'hero' | 'pinned';
    mode: 'pill' | 'expanded';
    isAnimating: boolean;
    currentNarration: string | null;
  };
  mainNavigation: {
    currentSection: string;
    currentProject: string | null;
    modalOpen: boolean;
    isAnimating: boolean;
  };
  coordination: {
    isCoordinating: boolean;
    activeSequence: string | null;
    queuedCommands: NavigationCommand[];
    lastSyncTime: number;
  };
  reliability: {
    failedCommands: NavigationCommand[];
    retryAttempts: number;
    fallbacksUsed: number;
    successRate: number;
  };
}

// Navigation Coordinator Implementation
export class AINavigationCoordinator implements NavigationCoordinator {
  private state: CoordinatedNavigationState;
  private commandHistory: NavigationCommand[] = [];
  private activeSequences: Map<string, NavigationCommand[]> = new Map();
  private retryQueue: Array<{ command: NavigationCommand; attempts: number; maxRetries: number }> = [];
  private validationRules: Array<(command: NavigationCommand) => ValidationResult> = [];
  
  constructor() {
    this.state = {
      aiInterface: {
        position: 'hero',
        mode: 'pill',
        isAnimating: false,
        currentNarration: null,
      },
      mainNavigation: {
        currentSection: '',
        currentProject: null,
        modalOpen: false,
        isAnimating: false,
      },
      coordination: {
        isCoordinating: false,
        activeSequence: null,
        queuedCommands: [],
        lastSyncTime: Date.now(),
      },
      reliability: {
        failedCommands: [],
        retryAttempts: 0,
        fallbacksUsed: 0,
        successRate: 1.0,
      },
    };
    
    this.setupValidationRules();
    this.setupRetryProcessor();
  }
  
  // Core Navigation
  async executeAINavigation(command: NavigationCommand): Promise<NavigationResult> {
    const startTime = Date.now();
    let result: NavigationResult;
    
    try {
      // Validate command
      const validation = this.validateNavigation(command);
      if (!validation.valid) {
        throw new Error(`Navigation validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Update state
      this.state.coordination.isCoordinating = true;
      this.commandHistory.push(command);
      
      // Execute navigation with coordination
      await this.executeWithCoordination(command);
      
      result = {
        success: true,
        command,
        duration: Date.now() - startTime,
      };
      
      // Update success rate
      this.updateSuccessRate(true);
      
    } catch (error) {
      console.error('AI Navigation: Command execution failed:', error);
      
      result = {
        success: false,
        command,
        duration: Date.now() - startTime,
        error: error.message,
      };
      
      // Add to failed commands
      this.state.reliability.failedCommands.push(command);
      this.updateSuccessRate(false);
      
      // Queue for retry if appropriate
      if (this.shouldRetry(command, error)) {
        this.queueForRetry(command);
      }
      
    } finally {
      this.state.coordination.isCoordinating = false;
      this.state.coordination.lastSyncTime = Date.now();
    }
    
    return result;
  }
  
  async executeCoordinatedNavigation(commands: NavigationCommand[]): Promise<NavigationResult> {
    const startTime = Date.now();
    const sequenceId = `seq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate all commands
      const validationResults = commands.map(cmd => this.validateNavigation(cmd));
      const invalidCommands = validationResults.filter(result => !result.valid);
      
      if (invalidCommands.length > 0) {
        throw new Error(`Coordinated navigation validation failed: ${invalidCommands.map(r => r.errors.join(', ')).join('; ')}`);
      }
      
      // Update state
      this.state.coordination.isCoordinating = true;
      this.state.coordination.activeSequence = sequenceId;
      this.activeSequences.set(sequenceId, commands);
      
      // Execute coordinated sequence
      await this.executeCoordinatedSequence(commands);
      
      const result: NavigationResult = {
        success: true,
        command: commands[0], // Primary command
        duration: Date.now() - startTime,
      };
      
      this.updateSuccessRate(true);
      return result;
      
    } catch (error) {
      console.error('AI Navigation: Coordinated execution failed:', error);
      
      const result: NavigationResult = {
        success: false,
        command: commands[0],
        duration: Date.now() - startTime,
        error: error.message,
      };
      
      this.updateSuccessRate(false);
      return result;
      
    } finally {
      this.state.coordination.isCoordinating = false;
      this.state.coordination.activeSequence = null;
      this.activeSequences.delete(sequenceId);
      this.state.coordination.lastSyncTime = Date.now();
    }
  }
  
  // Animation Coordination
  async coordinateWithFloatingAI(aiCommand: NavigationCommand, uiCommands: NavigationCommand[]): Promise<void> {
    try {
      // Create coordinated animation sequence
      const animationCommands: AnimationCommand[] = [];
      
      // AI interface animation
      if (aiCommand.action === 'modal' || aiCommand.action === 'navigate') {
        animationCommands.push({
          id: `ai-${Date.now()}`,
          type: 'custom',
          target: '[data-floating-ai-interface]',
          duration: 0.7,
          options: {
            coordinated: true,
            easing: 'power2.out',
            onStart: () => {
              this.state.aiInterface.isAnimating = true;
            },
            onComplete: () => {
              this.state.aiInterface.isAnimating = false;
            },
          },
          priority: 'high',
        });
      }
      
      // UI navigation animations
      uiCommands.forEach((cmd, index) => {
        animationCommands.push({
          id: `ui-${Date.now()}-${index}`,
          type: cmd.action === 'modal' ? 'modal' : 'navigate',
          target: cmd.target,
          duration: 0.7,
          options: {
            coordinated: true,
            easing: 'power2.out',
            onStart: () => {
              this.state.mainNavigation.isAnimating = true;
            },
            onComplete: () => {
              this.state.mainNavigation.isAnimating = false;
            },
          },
          priority: 'high',
        });
      });
      
      // Execute coordinated animations
      await executeCoordinatedAnimations(animationCommands);
      
    } catch (error) {
      console.error('AI Navigation: Animation coordination failed:', error);
      throw error;
    }
  }
  
  async synchronizeAnimations(aiAnimation: AnimationCommand, uiAnimations: AnimationCommand[]): Promise<void> {
    try {
      const allAnimations = [aiAnimation, ...uiAnimations];
      
      // Ensure all animations have the same duration for synchronization
      const syncDuration = 0.7; // Standard coordination duration
      allAnimations.forEach(anim => {
        anim.duration = syncDuration;
        anim.options.coordinated = true;
      });
      
      await executeCoordinatedAnimations(allAnimations);
      
    } catch (error) {
      console.error('AI Navigation: Animation synchronization failed:', error);
      throw error;
    }
  }
  
  // State Synchronization
  async syncNavigationState(aiState: Partial<UIState>, uiState: Partial<UIState>): Promise<void> {
    try {
      const aiIntegration = getAISystemIntegration();
      
      // Merge states intelligently
      const mergedState: Partial<UIState> = {
        ...uiState,
        ai: {
          ...uiState.ai,
          ...aiState.ai,
        },
        layout: {
          ...uiState.layout,
          ...aiState.layout,
          aiInterface: {
            ...uiState.layout?.aiInterface,
            ...aiState.layout?.aiInterface,
          },
        },
      };
      
      // Update UI state
      await aiIntegration.updateUIState(mergedState);
      
      // Update local coordination state
      if (mergedState.layout?.aiInterface) {
        this.state.aiInterface = {
          ...this.state.aiInterface,
          ...mergedState.layout.aiInterface,
        };
      }
      
      if (mergedState.navigation) {
        this.state.mainNavigation = {
          ...this.state.mainNavigation,
          currentSection: mergedState.navigation.currentSection || this.state.mainNavigation.currentSection,
        };
      }
      
      this.state.coordination.lastSyncTime = Date.now();
      
    } catch (error) {
      console.error('AI Navigation: State synchronization failed:', error);
      throw error;
    }
  }
  
  getCoordinatedState(): CoordinatedNavigationState {
    return { ...this.state };
  }
  
  // Reliability Assurance
  validateNavigation(command: NavigationCommand): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };
    
    // Run all validation rules
    this.validationRules.forEach(rule => {
      const ruleResult = rule(command);
      result.errors.push(...ruleResult.errors);
      result.warnings.push(...ruleResult.warnings);
      result.suggestions.push(...ruleResult.suggestions);
    });
    
    result.valid = result.errors.length === 0;
    
    return result;
  }
  
  async retryFailedNavigation(command: NavigationCommand, maxRetries = 3): Promise<NavigationResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.state.reliability.retryAttempts++;
        
        // Add delay between retries
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
        
        const result = await this.executeAINavigation(command);
        
        if (result.success) {
          result.retryCount = attempt - 1;
          return result;
        } else {
          lastError = new Error(result.error);
        }
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`AI Navigation: Retry attempt ${attempt} failed:`, error);
      }
    }
    
    // All retries failed, try fallback
    console.error(`AI Navigation: All retries failed for command:`, command);
    return this.fallbackNavigation(command);
  }
  
  async fallbackNavigation(command: NavigationCommand): Promise<NavigationResult> {
    const startTime = Date.now();
    
    try {
      this.state.reliability.fallbacksUsed++;
      
      // Implement fallback strategies based on command type
      switch (command.action) {
        case 'navigate':
          // Fallback to simple scroll
          await this.simpleFallbackScroll(command.target);
          break;
          
        case 'modal':
          // Fallback to page navigation
          await this.simpleFallbackNavigation(command.target);
          break;
          
        case 'highlight':
          // Fallback to simple CSS highlight
          await this.simpleFallbackHighlight(command.target);
          break;
          
        case 'focus':
          // Fallback to simple focus
          await this.simpleFallbackFocus(command.target);
          break;
          
        default:
          throw new Error(`No fallback available for action: ${command.action}`);
      }
      
      return {
        success: true,
        command,
        duration: Date.now() - startTime,
        fallbackUsed: true,
      };
      
    } catch (error) {
      console.error('AI Navigation: Fallback navigation failed:', error);
      
      return {
        success: false,
        command,
        duration: Date.now() - startTime,
        error: error.message,
        fallbackUsed: true,
      };
    }
  }
  
  // Private Methods
  private async executeWithCoordination(command: NavigationCommand): Promise<void> {
    // Check if AI interface needs coordination
    const needsAICoordination = this.needsAIInterfaceCoordination(command);
    
    if (needsAICoordination) {
      // Coordinate with floating AI interface
      await this.coordinateWithFloatingAI(command, [command]);
    } else {
      // Execute normally
      const aiIntegration = getAISystemIntegration();
      
      switch (command.action) {
        case 'navigate':
          if (command.target.startsWith('/')) {
            await aiIntegration.navigateToProject(command.target.replace('/', ''));
          } else {
            await aiIntegration.navigateToSection(command.target);
          }
          break;
          
        case 'modal':
          await aiIntegration.openProjectModal(command.target, command.metadata);
          break;
          
        case 'highlight':
          await aiIntegration.highlightElement(command.target, command.options as HighlightOptions);
          break;
          
        case 'focus':
          await aiIntegration.setFocus(command.target);
          break;
          
        case 'scroll':
          await aiIntegration.scrollToElement(command.target, command.options?.scroll);
          break;
          
        default:
          throw new Error(`Unknown navigation action: ${command.action}`);
      }
    }
  }
  
  private async executeCoordinatedSequence(commands: NavigationCommand[]): Promise<void> {
    // Group commands by type for better coordination
    const navigationCommands = commands.filter(cmd => cmd.action === 'navigate' || cmd.action === 'scroll');
    const modalCommands = commands.filter(cmd => cmd.action === 'modal');
    const highlightCommands = commands.filter(cmd => cmd.action === 'highlight');
    const focusCommands = commands.filter(cmd => cmd.action === 'focus');
    
    // Execute in coordinated phases
    if (navigationCommands.length > 0) {
      await Promise.all(navigationCommands.map(cmd => this.executeWithCoordination(cmd)));
    }
    
    if (modalCommands.length > 0) {
      await Promise.all(modalCommands.map(cmd => this.executeWithCoordination(cmd)));
    }
    
    if (highlightCommands.length > 0) {
      await Promise.all(highlightCommands.map(cmd => this.executeWithCoordination(cmd)));
    }
    
    if (focusCommands.length > 0) {
      await Promise.all(focusCommands.map(cmd => this.executeWithCoordination(cmd)));
    }
  }
  
  private needsAIInterfaceCoordination(command: NavigationCommand): boolean {
    // Check if command affects elements that need AI interface coordination
    const aiCoordinationTargets = [
      '[data-project-card]',
      '[data-project-modal]',
      '[data-navigation]',
      '.project-grid',
      '.hero-section',
    ];
    
    return aiCoordinationTargets.some(target => 
      command.target.includes(target) || 
      document.querySelector(command.target)?.matches(target)
    );
  }
  
  private shouldRetry(command: NavigationCommand, error: any): boolean {
    // Don't retry validation errors
    if (error.message.includes('validation failed')) {
      return false;
    }
    
    // Don't retry if target doesn't exist
    if (error.message.includes('not found')) {
      return false;
    }
    
    // Retry network and animation errors
    return error.message.includes('animation') || 
           error.message.includes('timeout') ||
           error.message.includes('network');
  }
  
  private queueForRetry(command: NavigationCommand, maxRetries = 3): void {
    this.retryQueue.push({
      command,
      attempts: 0,
      maxRetries,
    });
  }
  
  private setupValidationRules(): void {
    // Target existence validation
    this.validationRules.push((command: NavigationCommand) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };
      
      if (typeof window !== 'undefined' && command.target && !command.target.startsWith('/')) {
        const element = document.querySelector(command.target);
        if (!element) {
          result.errors.push(`Target element not found: ${command.target}`);
          result.suggestions.push('Ensure the target element exists in the DOM');
        }
      }
      
      return result;
    });
    
    // Command structure validation
    this.validationRules.push((command: NavigationCommand) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };
      
      if (!command.action) {
        result.errors.push('Command action is required');
      }
      
      if (!command.target) {
        result.errors.push('Command target is required');
      }
      
      const validActions = ['navigate', 'modal', 'highlight', 'focus', 'scroll'];
      if (command.action && !validActions.includes(command.action)) {
        result.errors.push(`Invalid action: ${command.action}`);
        result.suggestions.push(`Valid actions are: ${validActions.join(', ')}`);
      }
      
      return result;
    });
    
    // Animation state validation
    this.validationRules.push((command: NavigationCommand) => {
      const result: ValidationResult = { valid: true, errors: [], warnings: [], suggestions: [] };
      
      if (isAnimating() && command.priority !== 'override') {
        result.warnings.push('Animation already in progress, command may be queued');
        result.suggestions.push('Consider using priority: "override" to interrupt current animations');
      }
      
      return result;
    });
  }
  
  private setupRetryProcessor(): void {
    // Process retry queue periodically
    setInterval(() => {
      if (this.retryQueue.length > 0 && !this.state.coordination.isCoordinating) {
        const retryItem = this.retryQueue.shift();
        if (retryItem && retryItem.attempts < retryItem.maxRetries) {
          retryItem.attempts++;
          this.executeAINavigation(retryItem.command).catch(() => {
            // If retry fails, put it back in queue if attempts remain
            if (retryItem.attempts < retryItem.maxRetries) {
              this.retryQueue.push(retryItem);
            }
          });
        }
      }
    }, 1000);
  }
  
  private updateSuccessRate(success: boolean): void {
    const totalCommands = this.commandHistory.length;
    const successfulCommands = totalCommands - this.state.reliability.failedCommands.length + (success ? 1 : 0);
    this.state.reliability.successRate = totalCommands > 0 ? successfulCommands / totalCommands : 1.0;
  }
  
  // Fallback implementations
  private async simpleFallbackScroll(target: string): Promise<void> {
    const element = document.querySelector(target);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      throw new Error(`Fallback scroll target not found: ${target}`);
    }
  }
  
  private async simpleFallbackNavigation(target: string): Promise<void> {
    if (target.startsWith('/')) {
      window.location.href = target;
    } else {
      throw new Error(`Fallback navigation target invalid: ${target}`);
    }
  }
  
  private async simpleFallbackHighlight(target: string): Promise<void> {
    const element = document.querySelector(target) as HTMLElement;
    if (element) {
      element.style.outline = '2px solid #3b82f6';
      element.style.outlineOffset = '2px';
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.style.outline = '';
        element.style.outlineOffset = '';
      }, 3000);
    } else {
      throw new Error(`Fallback highlight target not found: ${target}`);
    }
  }
  
  private async simpleFallbackFocus(target: string): Promise<void> {
    const element = document.querySelector(target) as HTMLElement;
    if (element) {
      element.focus();
    } else {
      throw new Error(`Fallback focus target not found: ${target}`);
    }
  }
}

// Global coordinator instance
let globalNavigationCoordinator: AINavigationCoordinator | null = null;

// Get or create navigation coordinator
export function getNavigationCoordinator(): AINavigationCoordinator {
  if (!globalNavigationCoordinator) {
    globalNavigationCoordinator = new AINavigationCoordinator();
  }
  return globalNavigationCoordinator;
}

// React Hook for AI Navigation Coordination
export function useAINavigationCoordination(): {
  coordinator: AINavigationCoordinator;
  state: CoordinatedNavigationState;
  executeNavigation: (command: NavigationCommand) => Promise<NavigationResult>;
  executeCoordinated: (commands: NavigationCommand[]) => Promise<NavigationResult>;
  validateCommand: (command: NavigationCommand) => ValidationResult;
} {
  const coordinator = getNavigationCoordinator();
  
  return {
    coordinator,
    state: coordinator.getCoordinatedState(),
    executeNavigation: coordinator.executeAINavigation.bind(coordinator),
    executeCoordinated: coordinator.executeCoordinatedNavigation.bind(coordinator),
    validateCommand: coordinator.validateNavigation.bind(coordinator),
  };
}

// Export types
export type {
  NavigationCoordinator,
  NavigationResult,
  ValidationResult,
  CoordinatedNavigationState
};