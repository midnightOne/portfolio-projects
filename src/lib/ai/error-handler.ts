/**
 * AI Error Classification and Handling System
 * 
 * Provides comprehensive error classification, context-aware parsing,
 * and actionable error messages for AI operations.
 */

export enum AIErrorType {
  // Configuration errors
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  MISSING_MODEL = 'MISSING_MODEL',
  
  // Network and connectivity errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // API and rate limiting errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Content and processing errors
  CONTENT_TOO_LONG = 'CONTENT_TOO_LONG',
  INVALID_CONTENT = 'INVALID_CONTENT',
  PARSING_ERROR = 'PARSING_ERROR',
  MODEL_ERROR = 'MODEL_ERROR',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AIError {
  type: AIErrorType;
  message: string;
  details: string;
  actionable: boolean;
  suggestions: string[];
  context?: {
    provider?: string;
    model?: string;
    operation?: string;
    timestamp: Date;
  };
  originalError?: any;
}

export interface ErrorContext {
  provider?: string;
  model?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
}

export class AIErrorHandler {
  /**
   * Parse and classify an error with context
   */
  static parseError(error: any, context?: ErrorContext): AIError {
    const timestamp = new Date();
    const errorContext = { ...context, timestamp };
    
    // Handle known error types
    if (error?.status || error?.response?.status) {
      return this.parseHTTPError(error, errorContext);
    }
    
    if (error?.code) {
      return this.parseCodedError(error, errorContext);
    }
    
    if (error instanceof Error) {
      return this.parseGenericError(error, errorContext);
    }
    
    // Fallback for unknown error types
    return {
      type: AIErrorType.UNKNOWN_ERROR,
      message: 'An unknown error occurred',
      details: typeof error === 'string' ? error : JSON.stringify(error),
      actionable: false,
      suggestions: [
        'Try refreshing the page',
        'Check your internet connection',
        'Contact support if the problem persists'
      ],
      context: errorContext,
      originalError: error
    };
  }
  
  /**
   * Parse HTTP status code errors
   */
  private static parseHTTPError(error: any, context: ErrorContext & { timestamp: Date }): AIError {
    const status = error.status || error.response?.status;
    const statusText = error.statusText || error.response?.statusText;
    const data = error.data || error.response?.data;
    
    switch (status) {
      case 401:
        return {
          type: AIErrorType.INVALID_API_KEY,
          message: `Invalid API key for ${context.provider || 'AI provider'}`,
          details: data?.error?.message || statusText || 'Authentication failed',
          actionable: true,
          suggestions: [
            `Check your ${context.provider?.toUpperCase()}_API_KEY environment variable`,
            'Verify the API key is correct and active',
            'Ensure the API key has the necessary permissions',
            'Check the provider\'s documentation for API key setup'
          ],
          context,
          originalError: error
        };
        
      case 403:
        return {
          type: AIErrorType.FORBIDDEN,
          message: `Access forbidden for ${context.provider || 'AI provider'}`,
          details: data?.error?.message || statusText || 'Access denied',
          actionable: true,
          suggestions: [
            'Check if your API key has the required permissions',
            'Verify your account is in good standing',
            'Contact the provider if you believe this is an error'
          ],
          context,
          originalError: error
        };
        
      case 429:
        const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
        return {
          type: AIErrorType.RATE_LIMIT_EXCEEDED,
          message: `Rate limit exceeded for ${context.provider || 'AI provider'}`,
          details: data?.error?.message || statusText || 'Too many requests',
          actionable: true,
          suggestions: [
            retryAfter ? `Wait ${retryAfter} seconds before retrying` : 'Wait a few minutes before retrying',
            'Consider upgrading your API plan for higher limits',
            'Implement request batching to reduce API calls',
            'Use a different model if available'
          ],
          context,
          originalError: error
        };
        
      case 400:
        return {
          type: AIErrorType.BAD_REQUEST,
          message: 'Invalid request to AI provider',
          details: data?.error?.message || statusText || 'Bad request',
          actionable: true,
          suggestions: [
            'Check if the model name is correct',
            'Verify the request parameters are valid',
            'Ensure the content is not too long',
            'Try a different model if the current one is unavailable'
          ],
          context,
          originalError: error
        };
        
      case 413:
        return {
          type: AIErrorType.CONTENT_TOO_LONG,
          message: 'Content is too long for the AI model',
          details: data?.error?.message || statusText || 'Payload too large',
          actionable: true,
          suggestions: [
            'Reduce the content length',
            'Split the content into smaller chunks',
            'Use a model with a larger context window',
            'Summarize the content before processing'
          ],
          context,
          originalError: error
        };
        
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: AIErrorType.SERVICE_UNAVAILABLE,
          message: `${context.provider || 'AI provider'} service is temporarily unavailable`,
          details: data?.error?.message || statusText || 'Service unavailable',
          actionable: true,
          suggestions: [
            'Try again in a few minutes',
            'Check the provider\'s status page',
            'Use a different provider if available',
            'Contact support if the issue persists'
          ],
          context,
          originalError: error
        };
        
      default:
        return {
          type: AIErrorType.UNKNOWN_ERROR,
          message: `HTTP error ${status}`,
          details: data?.error?.message || statusText || 'Unknown HTTP error',
          actionable: false,
          suggestions: [
            'Try refreshing the page',
            'Check your internet connection',
            'Contact support with the error details'
          ],
          context,
          originalError: error
        };
    }
  }
  
  /**
   * Parse errors with specific error codes
   */
  private static parseCodedError(error: any, context: ErrorContext & { timestamp: Date }): AIError {
    const code = error.code;
    const message = error.message || '';
    
    switch (code) {
      case 'ENOTFOUND':
      case 'ECONNREFUSED':
      case 'ECONNRESET':
        return {
          type: AIErrorType.NETWORK_ERROR,
          message: `Network error connecting to ${context.provider || 'AI provider'}`,
          details: message,
          actionable: true,
          suggestions: [
            'Check your internet connection',
            'Verify the provider\'s service is available',
            'Try again in a few minutes',
            'Check if you\'re behind a firewall or proxy'
          ],
          context,
          originalError: error
        };
        
      case 'ETIMEDOUT':
        return {
          type: AIErrorType.CONNECTION_TIMEOUT,
          message: `Connection timeout to ${context.provider || 'AI provider'}`,
          details: message,
          actionable: true,
          suggestions: [
            'Try again with a shorter request',
            'Check your internet connection speed',
            'The service may be experiencing high load',
            'Consider using a different model'
          ],
          context,
          originalError: error
        };
        
      case 'invalid_api_key':
      case 'authentication_error':
        return {
          type: AIErrorType.INVALID_API_KEY,
          message: `Invalid API key for ${context.provider || 'AI provider'}`,
          details: message,
          actionable: true,
          suggestions: [
            `Check your ${context.provider?.toUpperCase()}_API_KEY environment variable`,
            'Verify the API key is correct and active',
            'Ensure the API key has the necessary permissions'
          ],
          context,
          originalError: error
        };
        
      case 'model_not_found':
      case 'invalid_model':
        return {
          type: AIErrorType.MISSING_MODEL,
          message: `Model '${context.model}' not found`,
          details: message,
          actionable: true,
          suggestions: [
            'Check if the model name is spelled correctly',
            'Verify the model is available for your API key',
            'Try a different model',
            'Check the provider\'s documentation for available models'
          ],
          context,
          originalError: error
        };
        
      case 'content_filter':
      case 'safety_error':
        return {
          type: AIErrorType.INVALID_CONTENT,
          message: 'Content was filtered by safety systems',
          details: message,
          actionable: true,
          suggestions: [
            'Review the content for potentially harmful material',
            'Try rephrasing the request',
            'Use different wording to avoid triggering filters',
            'Contact support if you believe this is an error'
          ],
          context,
          originalError: error
        };
        
      default:
        return {
          type: AIErrorType.UNKNOWN_ERROR,
          message: `Error code: ${code}`,
          details: message,
          actionable: false,
          suggestions: [
            'Try the operation again',
            'Check the provider\'s documentation',
            'Contact support with the error code'
          ],
          context,
          originalError: error
        };
    }
  }
  
  /**
   * Parse generic JavaScript errors
   */
  private static parseGenericError(error: Error, context: ErrorContext & { timestamp: Date }): AIError {
    const message = error.message.toLowerCase();
    
    // Check for common error patterns
    if (message.includes('not configured') || message.includes('missing') && message.includes('api')) {
      return {
        type: AIErrorType.NOT_CONFIGURED,
        message: `${context.provider || 'AI provider'} not configured`,
        details: error.message,
        actionable: true,
        suggestions: [
          `Set the ${context.provider?.toUpperCase()}_API_KEY environment variable`,
          'Check the AI settings page for configuration instructions',
          'Verify all required environment variables are set'
        ],
        context,
        originalError: error
      };
    }
    
    if (message.includes('json') || message.includes('parse')) {
      return {
        type: AIErrorType.PARSING_ERROR,
        message: 'Failed to parse AI response',
        details: error.message,
        actionable: true,
        suggestions: [
          'Try the operation again',
          'The AI response may have been malformed',
          'Try using a different model',
          'Contact support if the issue persists'
        ],
        context,
        originalError: error
      };
    }
    
    if (message.includes('database') || message.includes('prisma')) {
      return {
        type: AIErrorType.DATABASE_ERROR,
        message: 'Database error occurred',
        details: error.message,
        actionable: false,
        suggestions: [
          'Try refreshing the page',
          'The issue may be temporary',
          'Contact support if the problem persists'
        ],
        context,
        originalError: error
      };
    }
    
    // Generic error fallback
    return {
      type: AIErrorType.INTERNAL_ERROR,
      message: 'Internal system error',
      details: error.message,
      actionable: false,
      suggestions: [
        'Try the operation again',
        'Refresh the page if the issue persists',
        'Contact support with the error details'
      ],
      context,
      originalError: error
    };
  }
  
  /**
   * Get user-friendly error message for display
   */
  static getDisplayMessage(aiError: AIError): string {
    return aiError.message;
  }
  
  /**
   * Get detailed error information for debugging
   */
  static getDetailedMessage(aiError: AIError): string {
    let message = `${aiError.message}\n\nDetails: ${aiError.details}`;
    
    if (aiError.suggestions.length > 0) {
      message += '\n\nSuggestions:\n';
      aiError.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
    }
    
    if (aiError.context) {
      message += '\n\nContext:\n';
      if (aiError.context.provider) message += `Provider: ${aiError.context.provider}\n`;
      if (aiError.context.model) message += `Model: ${aiError.context.model}\n`;
      if (aiError.context.operation) message += `Operation: ${aiError.context.operation}\n`;
      message += `Timestamp: ${aiError.context.timestamp.toISOString()}\n`;
    }
    
    return message;
  }
  
  /**
   * Check if an error is actionable by the user
   */
  static isActionable(aiError: AIError): boolean {
    return aiError.actionable;
  }
  
  /**
   * Get suggestions for resolving an error
   */
  static getSuggestions(aiError: AIError): string[] {
    return aiError.suggestions;
  }
  
  /**
   * Check if an error is temporary and worth retrying
   */
  static isRetryable(aiError: AIError): boolean {
    const retryableTypes = [
      AIErrorType.NETWORK_ERROR,
      AIErrorType.CONNECTION_TIMEOUT,
      AIErrorType.SERVICE_UNAVAILABLE,
      AIErrorType.RATE_LIMIT_EXCEEDED
    ];
    
    return retryableTypes.includes(aiError.type);
  }
  
  /**
   * Get recommended retry delay in milliseconds
   */
  static getRetryDelay(aiError: AIError): number {
    switch (aiError.type) {
      case AIErrorType.RATE_LIMIT_EXCEEDED:
        return 60000; // 1 minute
      case AIErrorType.SERVICE_UNAVAILABLE:
        return 30000; // 30 seconds
      case AIErrorType.CONNECTION_TIMEOUT:
      case AIErrorType.NETWORK_ERROR:
        return 5000; // 5 seconds
      default:
        return 0; // No retry recommended
    }
  }
  
  /**
   * Log error with appropriate level based on type
   */
  static logError(aiError: AIError): void {
    const logData = {
      type: aiError.type,
      message: aiError.message,
      details: aiError.details,
      context: aiError.context,
      actionable: aiError.actionable
    };
    
    // Log at different levels based on error severity
    switch (aiError.type) {
      case AIErrorType.NOT_CONFIGURED:
      case AIErrorType.INVALID_API_KEY:
      case AIErrorType.MISSING_MODEL:
        console.warn('AI Configuration Error:', logData);
        break;
        
      case AIErrorType.RATE_LIMIT_EXCEEDED:
      case AIErrorType.QUOTA_EXCEEDED:
        console.warn('AI Rate Limit Error:', logData);
        break;
        
      case AIErrorType.NETWORK_ERROR:
      case AIErrorType.CONNECTION_TIMEOUT:
      case AIErrorType.SERVICE_UNAVAILABLE:
        console.warn('AI Network Error:', logData);
        break;
        
      case AIErrorType.INTERNAL_ERROR:
      case AIErrorType.DATABASE_ERROR:
      case AIErrorType.UNKNOWN_ERROR:
        console.error('AI System Error:', logData);
        break;
        
      default:
        console.info('AI Error:', logData);
        break;
    }
  }
}