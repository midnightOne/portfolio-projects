/**
 * Retention & data lifecycle (conversation-engine Block K — Req 21 as amended
 * 2026-07-11). Load-bearing behaviors: the default (and every failure
 * direction) is RETAIN — a missing/broken config can never delete data; an
 * unconfigured sweep is a no-op that writes no audit row; every actual
 * deletion produces a DataLifecycleAudit row; per-scope failures are reported
 * honestly and never abort the other scopes; the handled-lead retention clock
 * stamps on entering 'handled' and clears on reopen.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    conversationRetentionConfig: { findUnique: jest.fn() },
    conversationLead: { deleteMany: jest.fn(), update: jest.fn() },
    dataLifecycleAudit: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import {
  getRetentionConfig,
  normalizeRetentionDays,
  runRetentionSweep,
  __clearRetentionConfigCache,
} from '../retention';
import { setLeadStatus } from '@/lib/ai/leads/lead-admin';

const mockPrisma = prisma as unknown as {
  conversationRetentionConfig: { findUnique: jest.Mock };
  conversationLead: { deleteMany: jest.Mock; update: jest.Mock };
  dataLifecycleAudit: { create: jest.Mock };
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

function configRow(days: {
  transcriptRetentionDays?: number | null;
  summaryRetentionDays?: number | null;
  leadRetentionDays?: number | null;
}) {
  return {
    id: 'retention',
    transcriptRetentionDays: days.transcriptRetentionDays ?? null,
    summaryRetentionDays: days.summaryRetentionDays ?? null,
    leadRetentionDays: days.leadRetentionDays ?? null,
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  __clearRetentionConfigCache();
  mockPrisma.conversationRetentionConfig.findUnique.mockResolvedValue(null);
  mockPrisma.conversationLead.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.dataLifecycleAudit.create.mockResolvedValue({ id: 'audit-1' });
  mockPrisma.$queryRaw.mockResolvedValue([]);
  mockPrisma.$executeRaw.mockResolvedValue(0);
});

describe('retention config — the failure direction is RETAIN', () => {
  it('missing row reads as retain-indefinitely defaults', async () => {
    const config = await getRetentionConfig({ fresh: true });
    expect(config).toEqual({
      transcriptRetentionDays: null,
      summaryRetentionDays: null,
      leadRetentionDays: null,
    });
  });

  it('a read failure resolves to the defaults — never toward deletion', async () => {
    mockPrisma.conversationRetentionConfig.findUnique.mockRejectedValue(new Error('db down'));
    const config = await getRetentionConfig({ fresh: true });
    expect(config.transcriptRetentionDays).toBeNull();
    expect(config.summaryRetentionDays).toBeNull();
    expect(config.leadRetentionDays).toBeNull();
  });

  it('normalizes knobs: positive integers pass, everything else = retain', () => {
    expect(normalizeRetentionDays(30)).toBe(30);
    expect(normalizeRetentionDays(1)).toBe(1);
    expect(normalizeRetentionDays(0)).toBeNull();
    expect(normalizeRetentionDays(-5)).toBeNull();
    expect(normalizeRetentionDays(2.5)).toBeNull();
    expect(normalizeRetentionDays('7')).toBeNull();
    expect(normalizeRetentionDays(null)).toBeNull();
    expect(normalizeRetentionDays(undefined)).toBeNull();
  });
});

describe('runRetentionSweep — unconfigured is a no-op', () => {
  it('all-null config: deletes nothing, writes no audit row, says why', async () => {
    const result = await runRetentionSweep();
    expect(result.configured).toBe(false);
    expect(result.messageRowsDeleted).toBe(0);
    expect(result.leadsDeleted).toBe(0);
    expect(result.auditId).toBeNull();
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    expect(mockPrisma.conversationLead.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.dataLifecycleAudit.create).not.toHaveBeenCalled();
    expect(result.notes.join(' ')).toContain('retain indefinitely');
  });
});

describe('runRetentionSweep — configured expiry', () => {
  it('transcript scope: deletes visitor rows, scrubs state, audits with counts', async () => {
    mockPrisma.conversationRetentionConfig.findUnique.mockResolvedValue(
      configRow({ transcriptRetentionDays: 30 })
    );
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 'conv-a' }, { id: 'conv-b' }]);
    mockPrisma.$executeRaw
      .mockResolvedValueOnce(7) // DELETE visitor rows
      .mockResolvedValueOnce(2); // UPDATE latest_state scrub
    const result = await runRetentionSweep({ initiatedBy: 'test' });
    expect(result.configured).toBe(true);
    expect(result.conversationsScrubbed).toBe(2);
    expect(result.messageRowsDeleted).toBe(7);
    expect(result.auditId).toBe('audit-1');
    const audit = mockPrisma.dataLifecycleAudit.create.mock.calls[0][0].data;
    expect(audit.action).toBe('retention_expiry');
    expect(audit.initiatedBy).toBe('test');
    expect(audit.counts.messageRowsDeleted).toBe(7);
    expect(audit.criteria.cutoffs.transcripts).toBeDefined();
  });

  it('nothing eligible → zero counts and NO audit row', async () => {
    mockPrisma.conversationRetentionConfig.findUnique.mockResolvedValue(
      configRow({ transcriptRetentionDays: 30, summaryRetentionDays: 90, leadRetentionDays: 60 })
    );
    const result = await runRetentionSweep();
    expect(result.configured).toBe(true);
    expect(result.messageRowsDeleted).toBe(0);
    expect(result.auditId).toBeNull();
    expect(mockPrisma.dataLifecycleAudit.create).not.toHaveBeenCalled();
  });

  it('reports the per-run cap honestly when the target page is full', async () => {
    mockPrisma.conversationRetentionConfig.findUnique.mockResolvedValue(
      configRow({ transcriptRetentionDays: 30 })
    );
    mockPrisma.$queryRaw.mockResolvedValueOnce(
      Array.from({ length: 200 }, (_, i) => ({ id: `conv-${i}` }))
    );
    mockPrisma.$executeRaw.mockResolvedValueOnce(400).mockResolvedValueOnce(200);
    const result = await runRetentionSweep();
    expect(result.notes.join(' ')).toContain('capped at 200');
  });

  it('warns when summaries are configured to expire BEFORE transcripts', async () => {
    mockPrisma.conversationRetentionConfig.findUnique.mockResolvedValue(
      configRow({ transcriptRetentionDays: 90, summaryRetentionDays: 30 })
    );
    const result = await runRetentionSweep();
    expect(result.notes.join(' ')).toContain('summaries to outlive transcripts');
  });

  it('lead scope: only handled leads past handledAt + M are targeted', async () => {
    mockPrisma.conversationRetentionConfig.findUnique.mockResolvedValue(
      configRow({ leadRetentionDays: 60 })
    );
    mockPrisma.conversationLead.deleteMany.mockResolvedValue({ count: 3 });
    const result = await runRetentionSweep();
    expect(result.leadsDeleted).toBe(3);
    const where = mockPrisma.conversationLead.deleteMany.mock.calls[0][0].where;
    expect(where.status).toBe('handled');
    expect(where.handledAt.not).toBeNull();
    expect(where.handledAt.lt).toBeInstanceOf(Date);
    expect(result.auditId).toBe('audit-1');
  });

  it('a failing scope is reported and never aborts the others (or throws)', async () => {
    mockPrisma.conversationRetentionConfig.findUnique.mockResolvedValue(
      configRow({ transcriptRetentionDays: 30, leadRetentionDays: 60 })
    );
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('select exploded'));
    mockPrisma.conversationLead.deleteMany.mockResolvedValue({ count: 1 });
    const result = await runRetentionSweep();
    expect(result.notes.join(' ')).toContain('transcript expiry failed: select exploded');
    expect(result.leadsDeleted).toBe(1); // lead scope still ran
  });

  it('an audit-write failure after deletion is loud but never throws', async () => {
    mockPrisma.conversationRetentionConfig.findUnique.mockResolvedValue(
      configRow({ leadRetentionDays: 60 })
    );
    mockPrisma.conversationLead.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.dataLifecycleAudit.create.mockRejectedValue(new Error('audit table gone'));
    const result = await runRetentionSweep();
    expect(result.leadsDeleted).toBe(2);
    expect(result.auditId).toBeNull();
    expect(result.notes.join(' ')).toContain('AUDIT WRITE FAILED');
  });
});

describe('setLeadStatus — the handled-lead retention clock (Req 21.4)', () => {
  it('stamps handledAt on entering handled', async () => {
    mockPrisma.conversationLead.update.mockResolvedValue({
      id: 'lead-1', conversationId: 'c1', nodeId: null, graphVersionId: null,
      slots: {}, fitNote: null, status: 'handled', notifiedAt: null,
      notifyChannel: null, notifyError: null, createdAt: new Date(), handledAt: new Date(),
    });
    await setLeadStatus('lead-1', 'handled');
    const data = mockPrisma.conversationLead.update.mock.calls[0][0].data;
    expect(data.handledAt).toBeInstanceOf(Date);
  });

  it('clears handledAt on reopen — a reopened lead never expires off a stale clock', async () => {
    mockPrisma.conversationLead.update.mockResolvedValue({
      id: 'lead-1', conversationId: 'c1', nodeId: null, graphVersionId: null,
      slots: {}, fitNote: null, status: 'seen', notifiedAt: null,
      notifyChannel: null, notifyError: null, createdAt: new Date(), handledAt: null,
    });
    await setLeadStatus('lead-1', 'seen');
    const data = mockPrisma.conversationLead.update.mock.calls[0][0].data;
    expect(data.handledAt).toBeNull();
  });
});
