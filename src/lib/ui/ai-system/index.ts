/**
 * AI System Integration - Main Export
 * 
 * Centralized exports for all AI system integration functionality.
 * This provides a clean API surface for the AI system to interact with the UI system.
 */

// Core AI System Integration
export {
  AISystemIntegration,
  getAISystemIntegration,
  useAISystemIntegration,
  getAISystemDebugInfo,
  clearAISystemDebugData,
  type AISystemAPI,
  type NavigationOptions,
  type ModalOptions,
  type ScrollOptions,
  type TextRange,
  type UserActionEvent,
  type AISystemEvent,
} from '../ai-system-integration';

// AI Communication Layer
export {
  AICommunicationManager,
  WebSocketChannel,
  PostMessageChannel,
  InMemoryChannel,
  getCommunicationManager,
  useAICommunication,
  createWebSocketChannel,
  createPostMessageChannel,
  createInMemoryChannel,
  type AIMessage,
  type AICommandMessage,
  type AIQueryMessage,
  type AINotificationMessage,
  type AIResponseMessage,
  type CommunicationChannel,
} from '../ai-communication';

// AI Navigation Coordination
export {
  AINavigationCoordinator,
  getNavigationCoordinator,
  useAINavigationCoordination,
  type NavigationCoordinator,
  type NavigationResult,
  type ValidationResult,
  type CoordinatedNavigationState,
} from '../ai-navigation-coordinator';

// Re-export relevant UI system types
export type {
  NavigationCommand,
  HighlightOptions,
  AnimationCommand,
  AnimationOptions,
  UIState,
  LayoutState,
  AIInterfaceState,
} from '../types';

// Convenience functions for common AI system operations
export const AISystemUtils = {
  // Quick navigation helpers
  async navigateToSection(target: string, highlight = true): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.navigateToSection(target, {
      animate: true,
      highlight,
      highlightOptions: highlight ? {
        type: 'outline',
        intensity: 'medium',
        duration: 'timed',
        timing: 3
      } : undefined
    });
  },

  async navigateToProject(projectSlug: string): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.navigateToProject(projectSlug, {
      animate: true
    });
  },

  async openProjectModal(projectId: string, data?: any): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.openProjectModal(projectId, data, {
      animate: true,
      size: 'lg',
      backdrop: true
    });
  },

  // Quick highlighting helpers
  async highlightElement(target: string, type: 'spotlight' | 'outline' | 'glow' | 'color' = 'outline', duration = 3): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.highlightElement(target, {
      type,
      intensity: 'medium',
      duration: 'timed',
      timing: duration
    });
  },

  async highlightMultiple(targets: Array<{ target: string; type?: 'spotlight' | 'outline' | 'glow' | 'color' }>): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.highlightMultiple(
      targets.map(({ target, type = 'outline' }) => ({
        target,
        options: {
          type,
          intensity: 'medium' as const,
          duration: 'timed' as const,
          timing: 3
        }
      }))
    );
  },

  async clearHighlights(): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.clearAllHighlights();
  },

  // Communication helpers
  async sendCommand(action: string, parameters: any): Promise<any> {
    const { getCommunicationManager } = await import('../ai-communication');
    const communication = getCommunicationManager();
    return await communication.sendCommand(action, parameters);
  },

  async sendQuery(query: string, context?: any): Promise<any> {
    const { getCommunicationManager } = await import('../ai-communication');
    const communication = getCommunicationManager();
    return await communication.sendQuery(query, context);
  },

  // State helpers
  async getUIState(): Promise<any> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    return aiIntegration.getUIState();
  },

  async updateUIState(updates: any): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.updateUIState(updates);
  },

  // Animation helpers
  async executeCoordinatedSequence(commands: any[]): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.executeCoordinatedSequence(commands);
  },

  async waitForAnimations(): Promise<void> {
    const { getAISystemIntegration } = await import('../ai-system-integration');
    const aiIntegration = getAISystemIntegration();
    await aiIntegration.waitForAnimations();
  },

  // Validation helpers
  async validateNavigationCommand(command: any): Promise<any> {
    const { getNavigationCoordinator } = await import('../ai-navigation-coordinator');
    const coordinator = getNavigationCoordinator();
    return coordinator.validateNavigation(command);
  },

  // Debug helpers
  async getDebugInfo(): Promise<any> {
    const { getAISystemDebugInfo } = await import('../ai-system-integration');
    return getAISystemDebugInfo();
  },

  async clearDebugData(): Promise<void> {
    const { clearAISystemDebugData } = await import('../ai-system-integration');
    clearAISystemDebugData();
  },

  // Connection helpers
  async isConnected(): Promise<boolean> {
    const { getCommunicationManager } = await import('../ai-communication');
    const communication = getCommunicationManager();
    return communication.isConnected;
  },

  async getConnectionStatus(): Promise<{
    communication: boolean;
    coordinator: boolean;
    integration: boolean;
  }> {
    const { getCommunicationManager } = await import('../ai-communication');
    const { getNavigationCoordinator } = await import('../ai-navigation-coordinator');
    const communication = getCommunicationManager();
    const coordinator = getNavigationCoordinator();
    
    return {
      communication: communication.isConnected,
      coordinator: coordinator.getCoordinatedState().coordination.isCoordinating === false, // Available when not coordinating
      integration: true, // Always available
    };
  }
};

// Default export for convenience
const AISystemDefault = {
  // Utilities
  Utils: AISystemUtils,
};

export default AISystemDefault;