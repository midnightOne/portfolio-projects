/**
 * Integration tests for rate limiting API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Simple integration test to verify the rate limiting system is properly set up
describe('Rate Limiting Integration', () => {
  it('should have rate limiting types defined', () => {
    // Test that our types are properly exported
    const { RATE_LIMIT_TIERS, IDENTIFIER_TYPES } = require('@/lib/types/rate-limiting');
    
    expect(RATE_LIMIT_TIERS).toBeDefined();
    expect(RATE_LIMIT_TIERS.BASIC).toEqual({ dailyLimit: 10, name: 'Basic' });
    expect(RATE_LIMIT_TIERS.STANDARD).toEqual({ dailyLimit: 50, name: 'Standard' });
    expect(RATE_LIMIT_TIERS.PREMIUM).toEqual({ dailyLimit: 200, name: 'Premium' });
    expect(RATE_LIMIT_TIERS.UNLIMITED).toEqual({ dailyLimit: -1, name: 'Unlimited' });

    expect(IDENTIFIER_TYPES).toBeDefined();
    expect(IDENTIFIER_TYPES.IP).toBe('ip');
    expect(IDENTIFIER_TYPES.SESSION).toBe('session');
    expect(IDENTIFIER_TYPES.REFLINK).toBe('reflink');
  });

  it('should have rate limiting services defined', () => {
    // Test that our services are properly exported
    const { rateLimiter } = require('@/lib/services/ai/rate-limiter');
    const { reflinkManager } = require('@/lib/services/ai/reflink-manager');
    const { blacklistManager } = require('@/lib/services/ai/blacklist-manager');
    
    expect(rateLimiter).toBeDefined();
    expect(typeof rateLimiter.checkRateLimit).toBe('function');
    expect(typeof rateLimiter.getStatus).toBe('function');
    
    expect(reflinkManager).toBeDefined();
    expect(typeof reflinkManager.createReflink).toBe('function');
    expect(typeof reflinkManager.validateReflink).toBe('function');
    
    expect(blacklistManager).toBeDefined();
    expect(typeof blacklistManager.blacklistIP).toBe('function');
    expect(typeof blacklistManager.isBlacklisted).toBe('function');
  });

  it.skip('should have middleware functions defined', () => {
    // Skip this test as it requires Next.js runtime environment
    // The middleware will be tested in actual API endpoint tests
  });

  it('should have utility functions defined', () => {
    // Test that our utilities are properly exported
    const { 
      extractClientInfo,
      checkRequestRateLimit,
      validateReflink,
      checkIPBlacklist,
      createRateLimitMiddleware,
    } = require('@/lib/utils/rate-limiting-integration');
    
    expect(extractClientInfo).toBeDefined();
    expect(typeof extractClientInfo).toBe('function');
    
    expect(checkRequestRateLimit).toBeDefined();
    expect(typeof checkRequestRateLimit).toBe('function');
    
    expect(validateReflink).toBeDefined();
    expect(typeof validateReflink).toBe('function');
    
    expect(checkIPBlacklist).toBeDefined();
    expect(typeof checkIPBlacklist).toBe('function');
    
    expect(createRateLimitMiddleware).toBeDefined();
    expect(typeof createRateLimitMiddleware).toBe('function');
  });

  it('should have validation schemas defined', () => {
    // Test that our validation schemas work
    const { 
      CreateReflinkSchema,
      UpdateReflinkSchema,
      RateLimitCheckSchema,
      BlacklistIPSchema,
    } = require('@/lib/types/rate-limiting');
    
    expect(CreateReflinkSchema).toBeDefined();
    expect(UpdateReflinkSchema).toBeDefined();
    expect(RateLimitCheckSchema).toBeDefined();
    expect(BlacklistIPSchema).toBeDefined();

    // Test basic validation
    const validReflink = {
      code: 'test-ref',
      rateLimitTier: 'STANDARD',
    };
    
    const result = CreateReflinkSchema.safeParse(validReflink);
    expect(result.success).toBe(true);

    const invalidReflink = {
      code: '', // Invalid empty code
      rateLimitTier: 'INVALID_TIER',
    };
    
    const invalidResult = CreateReflinkSchema.safeParse(invalidReflink);
    expect(invalidResult.success).toBe(false);
  });

  it('should have error classes defined', () => {
    // Test that our custom error classes are defined
    const { 
      RateLimitError,
      SecurityViolationError,
      ReflinkError,
    } = require('@/lib/types/rate-limiting');
    
    expect(RateLimitError).toBeDefined();
    expect(SecurityViolationError).toBeDefined();
    expect(ReflinkError).toBeDefined();

    // Test error instantiation
    const rateLimitError = new RateLimitError('Test error', {
      allowed: false,
      requestsRemaining: 0,
      dailyLimit: 50,
      resetTime: new Date(),
      tier: 'STANDARD',
    });
    expect(rateLimitError.name).toBe('RateLimitError');
    expect(rateLimitError.message).toBe('Test error');

    const securityError = new SecurityViolationError('Security test', 'spam', '192.168.1.1', 2);
    expect(securityError.name).toBe('SecurityViolationError');
    expect(securityError.reason).toBe('spam');
    expect(securityError.ipAddress).toBe('192.168.1.1');
    expect(securityError.violationCount).toBe(2);

    const reflinkError = new ReflinkError('Reflink test', 'test-code', 'expired');
    expect(reflinkError.name).toBe('ReflinkError');
    expect(reflinkError.code).toBe('test-code');
    expect(reflinkError.reason).toBe('expired');
  });
});