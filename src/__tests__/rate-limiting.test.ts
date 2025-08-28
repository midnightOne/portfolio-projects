/**
 * Tests for rate limiting system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RateLimiter } from '@/lib/services/ai/rate-limiter';
import { ReflinkManager } from '@/lib/services/ai/reflink-manager';
import { BlacklistManager } from '@/lib/services/ai/blacklist-manager';
import {
  RateLimitCheckParams,
  CreateReflinkParams,
  BlacklistIPParams,
} from '@/lib/types/rate-limiting';

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    aIRateLimit: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    aIReflink: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    aIIPBlacklist: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    aIRateLimitLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  })),
}));

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockPrisma: any;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowSizeMs: 24 * 60 * 60 * 1000, // 24 hours
      defaultDailyLimit: 50,
      cleanupIntervalMs: 60 * 60 * 1000, // 1 hour
      logRetentionDays: 30,
    });

    // Get the mocked prisma instance
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const params: RateLimitCheckParams = {
        identifier: 'test-session',
        identifierType: 'session',
        endpoint: '/api/ai/chat',
        ipAddress: '192.168.1.1',
      };

      // Mock no existing blacklist
      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue(null);

      // Mock no existing rate limit record
      mockPrisma.aIRateLimit.findFirst.mockResolvedValue(null);

      // Mock creating new rate limit record
      const mockRateLimit = {
        id: 'rate-limit-1',
        identifier: 'test-session',
        identifierType: 'session',
        requestsCount: 0,
        windowStart: new Date(),
        windowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reflinkId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.aIRateLimit.create.mockResolvedValue(mockRateLimit);

      // Mock successful log creation
      mockPrisma.aIRateLimitLog.create.mockResolvedValue({});

      // Mock successful usage increment
      mockPrisma.aIRateLimit.updateMany.mockResolvedValue({ count: 1 });

      const result = await rateLimiter.checkRateLimit(params);

      expect(result.success).toBe(true);
      expect(result.status.allowed).toBe(true);
      expect(result.status.requestsRemaining).toBe(49); // 50 - 1
      expect(result.status.dailyLimit).toBe(50);
      expect(result.blocked).toBe(false);
    });

    it('should block requests when rate limit exceeded', async () => {
      const params: RateLimitCheckParams = {
        identifier: 'test-session',
        identifierType: 'session',
        endpoint: '/api/ai/chat',
        ipAddress: '192.168.1.1',
      };

      // Mock no existing blacklist
      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue(null);

      // Mock existing rate limit record at limit
      const mockRateLimit = {
        id: 'rate-limit-1',
        identifier: 'test-session',
        identifierType: 'session',
        requestsCount: 50, // At limit
        windowStart: new Date(),
        windowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reflinkId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.aIRateLimit.findFirst.mockResolvedValue(mockRateLimit);

      // Mock successful log creation
      mockPrisma.aIRateLimitLog.create.mockResolvedValue({});

      const result = await rateLimiter.checkRateLimit(params);

      expect(result.success).toBe(false);
      expect(result.status.allowed).toBe(false);
      expect(result.status.requestsRemaining).toBe(0);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Rate limit exceeded');
    });

    it('should block requests from blacklisted IP', async () => {
      const params: RateLimitCheckParams = {
        identifier: 'test-session',
        identifierType: 'session',
        endpoint: '/api/ai/chat',
        ipAddress: '192.168.1.1',
      };

      // Mock existing blacklist entry
      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue({
        id: 'blacklist-1',
        ipAddress: '192.168.1.1',
        reason: 'spam',
        reinstatedAt: null,
      });

      const result = await rateLimiter.checkRateLimit(params);

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('IP address is blacklisted');
    });

    it('should use reflink rate limits when provided', async () => {
      const params: RateLimitCheckParams = {
        identifier: 'test-session',
        identifierType: 'session',
        endpoint: '/api/ai/chat',
        reflinkCode: 'premium-ref',
        ipAddress: '192.168.1.1',
      };

      // Mock no existing blacklist
      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue(null);

      // Mock reflink with premium tier
      mockPrisma.aIReflink.findUnique.mockResolvedValue({
        id: 'reflink-1',
        code: 'premium-ref',
        rateLimitTier: 'PREMIUM',
        dailyLimit: 200,
        isActive: true,
        expiresAt: null,
      });

      // Mock no existing rate limit record
      mockPrisma.aIRateLimit.findFirst.mockResolvedValue(null);

      // Mock creating new rate limit record
      const mockRateLimit = {
        id: 'rate-limit-1',
        identifier: 'test-session',
        identifierType: 'session',
        requestsCount: 0,
        windowStart: new Date(),
        windowEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reflinkId: 'reflink-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.aIRateLimit.create.mockResolvedValue(mockRateLimit);

      // Mock successful operations
      mockPrisma.aIRateLimitLog.create.mockResolvedValue({});
      mockPrisma.aIRateLimit.updateMany.mockResolvedValue({ count: 1 });

      const result = await rateLimiter.checkRateLimit(params);

      expect(result.success).toBe(true);
      expect(result.status.dailyLimit).toBe(200); // Premium tier limit
      expect(result.status.tier).toBe('PREMIUM');
    });
  });

  describe('getStatus', () => {
    it('should return current rate limit status', async () => {
      const identifier = 'test-session';
      const identifierType = 'session';

      // Mock existing rate limit record
      const mockRateLimit = {
        id: 'rate-limit-1',
        identifier,
        identifierType,
        requestsCount: 25,
        windowStart: new Date(),
        windowEnd: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours remaining
        reflinkId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.aIRateLimit.findFirst.mockResolvedValue(mockRateLimit);

      const status = await rateLimiter.getStatus(identifier, identifierType);

      expect(status.allowed).toBe(true);
      expect(status.requestsRemaining).toBe(25); // 50 - 25
      expect(status.dailyLimit).toBe(50);
      expect(status.tier).toBe('STANDARD');
    });
  });
});

describe('ReflinkManager', () => {
  let reflinkManager: ReflinkManager;
  let mockPrisma: any;

  beforeEach(() => {
    reflinkManager = new ReflinkManager();
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReflink', () => {
    it('should create a new reflink', async () => {
      const params: CreateReflinkParams = {
        code: 'test-ref',
        name: 'Test Reflink',
        description: 'A test reflink',
        rateLimitTier: 'STANDARD',
      };

      // Mock no existing reflink
      mockPrisma.aIReflink.findUnique.mockResolvedValue(null);

      // Mock successful creation
      const mockReflink = {
        id: 'reflink-1',
        code: 'test-ref',
        name: 'Test Reflink',
        description: 'A test reflink',
        rateLimitTier: 'STANDARD',
        dailyLimit: 50,
        expiresAt: null,
        isActive: true,
        createdBy: 'admin@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.aIReflink.create.mockResolvedValue(mockReflink);

      const result = await reflinkManager.createReflink(params, 'admin@test.com');

      expect(result.code).toBe('test-ref');
      expect(result.name).toBe('Test Reflink');
      expect(result.rateLimitTier).toBe('STANDARD');
      expect(result.dailyLimit).toBe(50);
    });

    it('should throw error for duplicate code', async () => {
      const params: CreateReflinkParams = {
        code: 'existing-ref',
        rateLimitTier: 'STANDARD',
      };

      // Mock existing reflink
      mockPrisma.aIReflink.findUnique.mockResolvedValue({
        id: 'existing-1',
        code: 'existing-ref',
      });

      await expect(reflinkManager.createReflink(params)).rejects.toThrow(
        "Reflink code 'existing-ref' already exists"
      );
    });
  });

  describe('validateReflink', () => {
    it('should validate active reflink', async () => {
      const code = 'valid-ref';

      mockPrisma.aIReflink.findUnique.mockResolvedValue({
        id: 'reflink-1',
        code,
        isActive: true,
        expiresAt: null,
        rateLimitTier: 'STANDARD',
        dailyLimit: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await reflinkManager.validateReflink(code);

      expect(result.valid).toBe(true);
      expect(result.reflink).toBeDefined();
      expect(result.reflink?.code).toBe(code);
    });

    it('should reject inactive reflink', async () => {
      const code = 'inactive-ref';

      mockPrisma.aIReflink.findUnique.mockResolvedValue({
        id: 'reflink-1',
        code,
        isActive: false,
        expiresAt: null,
      });

      const result = await reflinkManager.validateReflink(code);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('inactive');
    });

    it('should reject expired reflink', async () => {
      const code = 'expired-ref';

      mockPrisma.aIReflink.findUnique.mockResolvedValue({
        id: 'reflink-1',
        code,
        isActive: true,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      });

      const result = await reflinkManager.validateReflink(code);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });
  });
});

describe('BlacklistManager', () => {
  let blacklistManager: BlacklistManager;
  let mockPrisma: any;

  beforeEach(() => {
    blacklistManager = new BlacklistManager({
      maxViolationsBeforeBlock: 2,
      autoReinstateAfterDays: 30,
      suspiciousActivityThreshold: 100,
      contentAnalysisEnabled: true,
    });
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('blacklistIP', () => {
    it('should blacklist a new IP', async () => {
      const params: BlacklistIPParams = {
        ipAddress: '192.168.1.100',
        reason: 'spam',
        violationCount: 2,
      };

      // Mock no existing blacklist entry
      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue(null);

      // Mock successful creation
      const mockEntry = {
        id: 'blacklist-1',
        ipAddress: '192.168.1.100',
        reason: 'spam',
        violationCount: 2,
        firstViolationAt: new Date(),
        lastViolationAt: new Date(),
        blockedAt: new Date(),
        canReinstate: true,
        reinstatedAt: null,
        reinstatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.aIIPBlacklist.create.mockResolvedValue(mockEntry);

      const result = await blacklistManager.blacklistIP(params);

      expect(result.ipAddress).toBe('192.168.1.100');
      expect(result.reason).toBe('spam');
      expect(result.violationCount).toBe(2);
    });
  });

  describe('recordViolation', () => {
    it('should record first violation as warning', async () => {
      const ipAddress = '192.168.1.200';
      const reason = 'suspicious_activity';

      // Mock no existing entry
      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue(null);

      // Mock successful creation
      const mockEntry = {
        id: 'blacklist-1',
        ipAddress,
        reason,
        violationCount: 1,
        firstViolationAt: new Date(),
        lastViolationAt: new Date(),
        blockedAt: new Date(0), // Not blocked yet
        canReinstate: true,
        reinstatedAt: null,
        reinstatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.aIIPBlacklist.create.mockResolvedValue(mockEntry);

      const result = await blacklistManager.recordViolation(ipAddress, reason);

      expect(result.blacklisted).toBe(false); // First violation is warning
      expect(result.violationCount).toBe(1);
    });

    it('should blacklist IP on second violation', async () => {
      const ipAddress = '192.168.1.200';
      const reason = 'repeated_spam';

      // Mock existing entry with one violation
      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue({
        id: 'blacklist-1',
        ipAddress,
        reason: 'suspicious_activity',
        violationCount: 1,
        reinstatedAt: null,
      });

      // Mock successful update
      const mockUpdatedEntry = {
        id: 'blacklist-1',
        ipAddress,
        reason: 'suspicious_activity; repeated_spam',
        violationCount: 2,
        firstViolationAt: new Date(Date.now() - 60000),
        lastViolationAt: new Date(),
        blockedAt: new Date(),
        canReinstate: true,
        reinstatedAt: null,
        reinstatedBy: null,
        createdAt: new Date(Date.now() - 60000),
        updatedAt: new Date(),
      };
      mockPrisma.aIIPBlacklist.update.mockResolvedValue(mockUpdatedEntry);

      const result = await blacklistManager.recordViolation(ipAddress, reason);

      expect(result.blacklisted).toBe(true); // Second violation triggers block
      expect(result.violationCount).toBe(2);
    });
  });

  describe('isBlacklisted', () => {
    it('should return false for non-blacklisted IP', async () => {
      const ipAddress = '192.168.1.300';

      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue(null);

      const result = await blacklistManager.isBlacklisted(ipAddress);

      expect(result.blacklisted).toBe(false);
    });

    it('should return true for blacklisted IP', async () => {
      const ipAddress = '192.168.1.400';

      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue({
        id: 'blacklist-1',
        ipAddress,
        reason: 'spam',
        violationCount: 2,
        reinstatedAt: null,
        blockedAt: new Date(),
      });

      const result = await blacklistManager.isBlacklisted(ipAddress);

      expect(result.blacklisted).toBe(true);
      expect(result.reason).toBe('spam');
    });

    it('should return false for reinstated IP', async () => {
      const ipAddress = '192.168.1.500';

      mockPrisma.aIIPBlacklist.findUnique.mockResolvedValue({
        id: 'blacklist-1',
        ipAddress,
        reason: 'spam',
        violationCount: 2,
        reinstatedAt: new Date(), // Reinstated
        blockedAt: new Date(Date.now() - 60000),
      });

      const result = await blacklistManager.isBlacklisted(ipAddress);

      expect(result.blacklisted).toBe(false);
    });
  });
});