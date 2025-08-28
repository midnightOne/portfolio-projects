/**
 * Integration tests for rate limiting admin pages
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { RateLimitingDashboard } from '@/components/admin/rate-limiting-dashboard';
import { ReflinksManager } from '@/components/admin/reflinks-manager';
import { SecurityManager } from '@/components/admin/security-manager';

// Mock the hooks and API calls
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Rate Limiting Admin Integration', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('should render RateLimitingDashboard component without errors', () => {
    // Mock successful API response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          period: { days: 7, startDate: '2025-08-21T00:00:00.000Z', endDate: '2025-08-28T00:00:00.000Z' },
          rateLimiting: {
            totalRequests: 100,
            blockedRequests: 5,
            uniqueUsers: 20,
            blockRate: 5.0,
            averageRequestsPerUser: 5.0,
            topEndpoints: [],
            requestsByTier: { BASIC: 0, STANDARD: 100, PREMIUM: 0, UNLIMITED: 0 },
            requestsByHour: [],
          },
          security: {
            totalBlacklisted: 2,
            recentViolations: 3,
            violationsByReason: { spam: 2, suspicious_activity: 1 },
            topViolatingIPs: [],
          },
          summary: {
            totalRequests: 100,
            blockedRequests: 5,
            uniqueUsers: 20,
            blacklistedIPs: 2,
            blockRate: 5.0,
          },
        },
      }),
    });

    const { container } = render(<RateLimitingDashboard />);
    
    // Should render without throwing errors
    expect(container).toBeInTheDocument();
  });

  it('should render ReflinksManager component without errors', () => {
    // Mock successful API responses
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            reflinks: [
              {
                id: '1',
                code: 'test-reflink',
                name: 'Test Reflink',
                rateLimitTier: 'STANDARD',
                dailyLimit: 50,
                isActive: true,
                createdAt: '2025-08-28T00:00:00.000Z',
                updatedAt: '2025-08-28T00:00:00.000Z',
              },
            ],
            totalCount: 1,
          },
        }),
      });

    const { container } = render(<ReflinksManager />);
    
    // Should render without throwing errors
    expect(container).toBeInTheDocument();
  });

  it('should render SecurityManager component without errors', () => {
    // Mock successful API responses
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            entries: [
              {
                id: '1',
                ipAddress: '192.168.1.100',
                reason: 'spam',
                violationCount: 2,
                firstViolationAt: '2025-08-28T00:00:00.000Z',
                lastViolationAt: '2025-08-28T00:00:00.000Z',
                blockedAt: '2025-08-28T00:00:00.000Z',
                canReinstate: true,
                createdAt: '2025-08-28T00:00:00.000Z',
                updatedAt: '2025-08-28T00:00:00.000Z',
              },
            ],
            totalCount: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            security: {
              totalBlacklisted: 1,
              recentViolations: 2,
              violationsByReason: { spam: 2 },
              topViolatingIPs: [
                {
                  ipAddress: '192.168.1.100',
                  violations: 2,
                  lastViolation: '2025-08-28T00:00:00.000Z',
                },
              ],
            },
          },
        }),
      });

    const { container } = render(<SecurityManager />);
    
    // Should render without throwing errors
    expect(container).toBeInTheDocument();
  });

  it('should have proper component exports', () => {
    // Test that components are properly exported
    expect(RateLimitingDashboard).toBeDefined();
    expect(ReflinksManager).toBeDefined();
    expect(SecurityManager).toBeDefined();
    
    expect(typeof RateLimitingDashboard).toBe('function');
    expect(typeof ReflinksManager).toBe('function');
    expect(typeof SecurityManager).toBe('function');
  });
});