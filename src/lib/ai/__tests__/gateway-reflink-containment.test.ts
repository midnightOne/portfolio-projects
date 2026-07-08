/**
 * Gateway step 4 — reflink leak containment (access-and-cost task 8, owner
 * backlog (a)+(b)): a leaked invitation link must not open premium access to
 * the whole internet. Covered here:
 *   (a) the link binds to its first maxIps hashed IPs; excess IPs get 403 +
 *       an owner notification; a DB failure on the binding check fails OPEN
 *       (the windows below still bound damage);
 *   (b) an admin-tunable per-IP daily window WITHIN the reflink.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(async () => null), // never admin in these tests
}));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('../ledger', () => ({
  getKillSwitchState: jest.fn(async () => ({
    status: 'active',
    publicAIEnabled: true,
    disableReflinksOnTrip: true,
  })),
  recordUsage: jest.fn(async () => ({ ledgerId: 'l1', costUsd: 0, tripped: false })),
}));

jest.mock('../public-access', () => ({
  getPublicAccessSettings: jest.fn(async () => ({ publicTier: 'enabled', mcpEnabled: true })),
}));

jest.mock('../public-session', () => ({
  SESSION_COOKIE_NAME: 'ai_session',
  getClientIp: () => '203.0.113.7',
  hashIp: (ip: string) => `hashed-${ip}`,
  verifySessionToken: jest.fn(),
}));

const validateReflinkWithBudget = jest.fn();
jest.mock('@/lib/services/ai/reflink-manager', () => ({
  reflinkManager: { validateReflinkWithBudget: (...a: unknown[]) => validateReflinkWithBudget(...a) },
}));

const notifyWarning = jest.fn();
jest.mock('@/lib/services/ai/security-notifier', () => ({
  securityNotifier: { notifyWarning: (...a: unknown[]) => notifyWarning(...a) },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aIReflink: { findUnique: jest.fn(), update: jest.fn() },
    aIRateLimit: { upsert: jest.fn(), update: jest.fn() },
    aIUsageLog: { aggregate: jest.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { withAIGateway } from '../gateway';

const mockPrisma = prisma as unknown as {
  aIReflink: { findUnique: jest.Mock; update: jest.Mock };
  aIRateLimit: { upsert: jest.Mock; update: jest.Mock };
};

const HASHED_IP = 'hashed-203.0.113.7';

const handler = jest.fn(async () => NextResponse.json({ ok: true }));
const wrapped = withAIGateway({ feature: 'chat', publicAllowed: true }, handler);

function reflinkRequest() {
  return new NextRequest('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-reflink': 'TESTCODE',
      'x-forwarded-for': '203.0.113.7',
    },
    body: JSON.stringify({ message: 'hi' }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  validateReflinkWithBudget.mockResolvedValue({
    valid: true,
    reflink: {
      id: 'ref-1',
      code: 'TESTCODE',
      enableVoiceAI: true,
      enableJobAnalysis: true,
      enableAdvancedNavigation: true,
    },
  });
  // Windows under their limits by default
  mockPrisma.aIRateLimit.upsert.mockResolvedValue({ requestsCount: 1 });
});

describe('reflink IP binding (containment a)', () => {
  it('binds a new IP while slots remain, then runs the handler', async () => {
    mockPrisma.aIReflink.findUnique.mockResolvedValue({
      boundIpHashes: [],
      maxIps: 3,
      perIpDailyLimit: 300,
    });

    const res = await wrapped(reflinkRequest());

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(mockPrisma.aIReflink.update).toHaveBeenCalledWith({
      where: { id: 'ref-1' },
      data: { boundIpHashes: { push: HASHED_IP } },
    });
  });

  it('rejects a new IP when the binding is full and notifies the owner', async () => {
    mockPrisma.aIReflink.findUnique.mockResolvedValue({
      boundIpHashes: ['hashed-other-1', 'hashed-other-2'],
      maxIps: 2,
      perIpDailyLimit: 300,
    });

    const res = await wrapped(reflinkRequest());

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('REFLINK_IP_LIMIT');
    expect(handler).not.toHaveBeenCalled();
    expect(mockPrisma.aIReflink.update).not.toHaveBeenCalled();
    expect(notifyWarning).toHaveBeenCalledWith(
      'reflink',
      expect.stringContaining('TESTCODE'),
      expect.objectContaining({ metadata: expect.objectContaining({ reflinkId: 'ref-1' }) })
    );
  });

  it('recognizes an already-bound IP without re-pushing', async () => {
    mockPrisma.aIReflink.findUnique.mockResolvedValue({
      boundIpHashes: [HASHED_IP],
      maxIps: 1,
      perIpDailyLimit: 300,
    });

    const res = await wrapped(reflinkRequest());

    expect(res.status).toBe(200);
    expect(mockPrisma.aIReflink.update).not.toHaveBeenCalled();
  });

  it('fails OPEN when the binding check errors (windows below still bound damage)', async () => {
    mockPrisma.aIReflink.findUnique.mockRejectedValue(new Error('db unreachable'));

    const res = await wrapped(reflinkRequest());

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });
});

describe('per-IP daily window within the reflink (containment b)', () => {
  it('429s when the per-IP window is exhausted, keyed reflink:ip', async () => {
    mockPrisma.aIReflink.findUnique.mockResolvedValue({
      boundIpHashes: [HASHED_IP],
      maxIps: 1,
      perIpDailyLimit: 5,
    });
    // First bumpWindow call is the reflink_ip_day window — over its limit
    mockPrisma.aIRateLimit.upsert.mockResolvedValueOnce({ requestsCount: 6 });

    const res = await wrapped(reflinkRequest());

    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('RATE_LIMITED');
    expect(handler).not.toHaveBeenCalled();

    const windowArgs = mockPrisma.aIRateLimit.upsert.mock.calls[0][0];
    expect(windowArgs.create.identifier).toBe(`ref-1:${HASHED_IP}`);
    expect(windowArgs.create.identifierType).toBe('reflink_ip_day');
  });

  it('uses the admin-tuned per-link limit from the reflink row', async () => {
    mockPrisma.aIReflink.findUnique.mockResolvedValue({
      boundIpHashes: [HASHED_IP],
      maxIps: 1,
      perIpDailyLimit: 2,
    });
    mockPrisma.aIRateLimit.upsert.mockResolvedValueOnce({ requestsCount: 3 });

    const res = await wrapped(reflinkRequest());
    expect(res.status).toBe(429);
  });

  it('passes when within both the per-IP and per-link windows', async () => {
    mockPrisma.aIReflink.findUnique.mockResolvedValue({
      boundIpHashes: [HASHED_IP],
      maxIps: 1,
      perIpDailyLimit: 300,
    });
    mockPrisma.aIRateLimit.upsert
      .mockResolvedValueOnce({ requestsCount: 10 }) // reflink_ip_day, under 300
      .mockResolvedValueOnce({ requestsCount: 100 }); // reflink_day, under 1000

    const res = await wrapped(reflinkRequest());
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });
});
