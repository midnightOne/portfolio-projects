/**
 * AI Library Exports
 */

// Core service manager
export { AIServiceManager } from './service-manager';
export type {
  AIModelConfig,
  ModelValidationResult,
  AIContentEditRequest,
  AIContentEditResponse,
  AITagSuggestionRequest,
  AITagSuggestionResponse
} from './service-manager';

// Provider types and interfaces
export type {
  AIProvider,
  AIProviderType,
  AIProviderStatus,
  ConnectionTestResult,
  ProviderChatRequest,
  ProviderChatResponse,
  ChatMessage
} from './types';

// Provider factory
export { ProviderFactory } from './provider-factory';

// Individual providers
export { OpenAIProvider } from './providers/openai-provider';
export { AnthropicProvider } from './providers/anthropic-provider';
export { BaseProvider } from './providers/base-provider';

// Database utilities
export { 
  initializeAIConfiguration,
  cleanupOldAIData,
  validateAIConfiguration,
  getAIConfiguration,
  DEFAULT_AI_CONFIG
} from './database-setup';

// Environment utilities
export { EnvironmentValidator, type AIEnvironmentConfig, type AIConfigStatus } from './environment';

// Error handling
export { AIErrorHandler, AIErrorType, type AIError, type ErrorContext } from './error-handler';

// Availability checking and graceful degradation
export { 
  AIAvailabilityChecker, 
  useAIAvailability, 
  shouldDisableAI, 
  getAIDisabledMessage,
  type AIAvailabilityStatus,
  type ProviderAvailability
} from './availability-checker';