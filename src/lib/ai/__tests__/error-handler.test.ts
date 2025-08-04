/**
 * Tests for AI Error Handler
 */

import { AIErrorHandler, AIErrorType } from '../error-handler';

describe('AIErrorHandler', () => {
  describe('parseError', () => {
    it('should parse HTTP 401 errors correctly', () => {
      const error = {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: { message: 'Invalid API key' } }
      };

      const result = AIErrorHandler.parseError(error, { provider: 'openai' });

      expect(result.type).toBe(AIErrorType.INVALID_API_KEY);
      expect(result.message).toContain('Invalid API key for openai');
      expect(result.actionable).toBe(true);
      expect(result.suggestions).toContain('Check your OPENAI_API_KEY environment variable');
    });

    it('should parse HTTP 429 rate limit errors correctly', () => {
      const error = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'retry-after': '60' }
      };

      const result = AIErrorHandler.parseError(error, { provider: 'anthropic' });

      expect(result.type).toBe(AIErrorType.RATE_LIMIT_EXCEEDED);
      expect(result.message).toContain('Rate limit exceeded for anthropic');
      expect(result.actionable).toBe(true);
      expect(result.suggestions).toContain('Wait 60 seconds before retrying');
    });

    it('should parse network errors correctly', () => {
      const error = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND api.openai.com'
      };

      const result = AIErrorHandler.parseError(error, { provider: 'openai' });

      expect(result.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(result.message).toContain('Network error connecting to openai');
      expect(result.actionable).toBe(true);
      expect(result.suggestions).toContain('Check your internet connection');
    });

    it('should parse configuration errors correctly', () => {
      const error = new Error('Missing OPENAI_API_KEY environment variable');

      const result = AIErrorHandler.parseError(error, { provider: 'openai' });

      expect(result.type).toBe(AIErrorType.NOT_CONFIGURED);
      expect(result.message).toContain('openai not configured');
      expect(result.actionable).toBe(true);
      expect(result.suggestions).toContain('Set the OPENAI_API_KEY environment variable');
    });

    it('should parse JSON parsing errors correctly', () => {
      const error = new Error('Unexpected token in JSON at position 0');

      const result = AIErrorHandler.parseError(error, { operation: 'editContent' });

      expect(result.type).toBe(AIErrorType.PARSING_ERROR);
      expect(result.message).toBe('Failed to parse AI response');
      expect(result.actionable).toBe(true);
      expect(result.suggestions).toContain('Try the operation again');
    });

    it('should handle unknown errors gracefully', () => {
      const error = { unknown: 'error type' };

      const result = AIErrorHandler.parseError(error);

      expect(result.type).toBe(AIErrorType.UNKNOWN_ERROR);
      expect(result.message).toBe('An unknown error occurred');
      expect(result.actionable).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable errors', () => {
      const networkError = AIErrorHandler.parseError({ code: 'ENOTFOUND' });
      const rateLimitError = AIErrorHandler.parseError({ status: 429 });
      const serviceError = AIErrorHandler.parseError({ status: 503 });

      expect(AIErrorHandler.isRetryable(networkError)).toBe(true);
      expect(AIErrorHandler.isRetryable(rateLimitError)).toBe(true);
      expect(AIErrorHandler.isRetryable(serviceError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const authError = AIErrorHandler.parseError({ status: 401 });
      const configError = AIErrorHandler.parseError(new Error('not configured'));

      expect(AIErrorHandler.isRetryable(authError)).toBe(false);
      expect(AIErrorHandler.isRetryable(configError)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should return appropriate retry delays', () => {
      const rateLimitError = AIErrorHandler.parseError({ status: 429 });
      const networkError = AIErrorHandler.parseError({ code: 'ENOTFOUND' });
      const authError = AIErrorHandler.parseError({ status: 401 });

      expect(AIErrorHandler.getRetryDelay(rateLimitError)).toBe(60000); // 1 minute
      expect(AIErrorHandler.getRetryDelay(networkError)).toBe(5000); // 5 seconds
      expect(AIErrorHandler.getRetryDelay(authError)).toBe(0); // No retry
    });
  });

  describe('getDisplayMessage', () => {
    it('should return user-friendly messages', () => {
      const error = AIErrorHandler.parseError({ status: 401 }, { provider: 'openai' });
      const message = AIErrorHandler.getDisplayMessage(error);

      expect(message).toBe(error.message);
      expect(message).toContain('Invalid API key for openai');
    });
  });

  describe('getSuggestions', () => {
    it('should return actionable suggestions', () => {
      const error = AIErrorHandler.parseError({ status: 401 }, { provider: 'openai' });
      const suggestions = AIErrorHandler.getSuggestions(error);

      expect(suggestions).toContain('Check your OPENAI_API_KEY environment variable');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('context handling', () => {
    it('should include context in error details', () => {
      const error = new Error('Test error');
      const context = {
        provider: 'openai',
        model: 'gpt-4',
        operation: 'editContent',
        userId: 'user123'
      };

      const result = AIErrorHandler.parseError(error, context);

      expect(result.context?.provider).toBe('openai');
      expect(result.context?.model).toBe('gpt-4');
      expect(result.context?.operation).toBe('editContent');
      expect(result.context?.timestamp).toBeInstanceOf(Date);
    });
  });
});