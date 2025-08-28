/**
 * Rate limiting and security types for AI assistant
 */

import { z } from 'zod';

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

export const RATE_LIMIT_TIERS = {
  BASIC: { dailyLimit: 10, name: 'Basic' },
  STANDARD: { dailyLimit: 50, name: 'Standard' },
  PREMIUM: { dailyLimit: 200, name: 'Premium' },
  UNLIMITED: { dailyLimit: -1, name: 'Unlimited' }
} as const;

export const IDENTIFIER_TYPES = {
  IP: 'ip',
  SESSION: 'session',
  REFLINK: 'reflink'
} as const;

export const VIOLATION_REASONS = {
  SPAM: 'spam',
  INAPPROPRIATE_CONTENT: 'inappropriate_content',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
} as const;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const RateLimitTierSchema = z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'UNLIMITED']);

export const IdentifierTypeSchema = z.enum(['ip', 'session', 'reflink']);

export const CreateReflinkSchema = z.object({
  code: z.string().min(3).max(50).regex(/^[a-zA-Z0-9-_]+$/, 'Code can only contain letters, numbers, hyphens, and underscores'),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  rateLimitTier: RateLimitTierSchema.default('STANDARD'),
  dailyLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const UpdateReflinkSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  rateLimitTier: RateLimitTierSchema.optional(),
  dailyLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const RateLimitCheckSchema = z.object({
  identifier: z.string().min(1),
  identifierType: IdentifierTypeSchema,
  endpoint: z.string().min(1),
  reflinkCode: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

export const BlacklistIPSchema = z.object({
  ipAddress: z.string().ip(),
  reason: z.string().min(1).max(500),
  violationCount: z.number().int().min(1).default(1),
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type RateLimitTier = z.infer<typeof RateLimitTierSchema>;
export type IdentifierType = z.infer<typeof IdentifierTypeSchema>;
export type CreateReflinkParams = z.infer<typeof CreateReflinkSchema>;
export type UpdateReflinkParams = z.infer<typeof UpdateReflinkSchema>;
export type RateLimitCheckParams = z.infer<typeof RateLimitCheckSchema>;
export type BlacklistIPParams = z.infer<typeof BlacklistIPSchema>;

// ============================================================================
// INTERFACE DEFINITIONS
// ============================================================================

export interface RateLimitStatus {
  allowed: boolean;
  requestsRemaining: number;
  dailyLimit: number;
  resetTime: Date;
  tier: RateLimitTier;
  reflinkCode?: string;
}

export interface RateLimitResult {
  success: boolean;
  status: RateLimitStatus;
  blocked: boolean;
  reason?: string;
}

export interface ReflinkInfo {
  id: string;
  code: string;
  name?: string;
  description?: string;
  rateLimitTier: RateLimitTier;
  dailyLimit: number;
  expiresAt?: Date;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitRecord {
  id: string;
  identifier: string;
  identifierType: IdentifierType;
  requestsCount: number;
  windowStart: Date;
  windowEnd: Date;
  reflinkId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPBlacklistEntry {
  id: string;
  ipAddress: string;
  reason: string;
  violationCount: number;
  firstViolationAt: Date;
  lastViolationAt: Date;
  blockedAt: Date;
  canReinstate: boolean;
  reinstatedAt?: Date;
  reinstatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitLogEntry {
  id: string;
  identifier: string;
  identifierType: IdentifierType;
  reflinkId?: string;
  endpoint: string;
  userAgent?: string;
  ipAddress?: string;
  wasBlocked: boolean;
  requestsRemaining?: number;
  timestamp: Date;
}

export interface RateLimitAnalytics {
  totalRequests: number;
  blockedRequests: number;
  uniqueUsers: number;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
  }>;
  requestsByTier: Record<RateLimitTier, number>;
  requestsByHour: Array<{
    hour: string;
    requests: number;
    blocked: number;
  }>;
}

export interface SecurityAnalytics {
  totalBlacklisted: number;
  recentViolations: number;
  violationsByReason: Record<string, number>;
  topViolatingIPs: Array<{
    ipAddress: string;
    violations: number;
    lastViolation: Date;
  }>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface RateLimitConfig {
  windowSizeMs: number;
  defaultDailyLimit: number;
  cleanupIntervalMs: number;
  logRetentionDays: number;
}

export interface SecurityConfig {
  maxViolationsBeforeBlock: number;
  autoReinstateAfterDays: number;
  suspiciousActivityThreshold: number;
  contentAnalysisEnabled: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class RateLimitError extends Error {
  constructor(
    message: string,
    public status: RateLimitStatus,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class SecurityViolationError extends Error {
  constructor(
    message: string,
    public reason: string,
    public ipAddress: string,
    public violationCount: number
  ) {
    super(message);
    this.name = 'SecurityViolationError';
  }
}

export class ReflinkError extends Error {
  constructor(
    message: string,
    public code?: string,
    public reason?: 'expired' | 'inactive' | 'not_found'
  ) {
    super(message);
    this.name = 'ReflinkError';
  }
}