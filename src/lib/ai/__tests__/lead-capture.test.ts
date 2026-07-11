/**
 * lead_capture server tool (conversation-engine Req 15.1/21.3, Block H2).
 * Load-bearing behaviors: the ConversationLead row commits BEFORE any
 * notification attempt and survives every notify outcome (P25), consent is a
 * hard gate (no attestation → no row), engine-captured slots merge under the
 * model's fresher parameters, the capture marker is telemetry-only, and the
 * function never throws into the tool dispatcher.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    conversationLead: { create: jest.fn(), update: jest.fn() },
    aIEmailSend: { create: jest.fn(), count: jest.fn() },
  },
}));

jest.mock('@/lib/services/ai/conversation-history-manager', () => ({
  conversationHistoryManager: {
    getOrCreateConversationId: jest.fn(),
    readEngineStateRaw: jest.fn(),
    recordSessionMarker: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { conversationHistoryManager } from '@/lib/services/ai/conversation-history-manager';
import { captureLead } from '../leads/lead-capture';
import { fakeSentEmails } from '../leads/email-transport';

const mockPrisma = prisma as unknown as {
  conversationLead: { create: jest.Mock; update: jest.Mock };
  aIEmailSend: { create: jest.Mock; count: jest.Mock };
};
const mockHistory = conversationHistoryManager as unknown as {
  getOrCreateConversationId: jest.Mock;
  readEngineStateRaw: jest.Mock;
  recordSessionMarker: jest.Mock;
};

const ENV_KEYS = ['AI_FAKE_MODE', 'RESEND_API_KEY', 'OWNER_NOTIFY_EMAIL'] as const;
const savedEnv: Record<string, string | undefined> = {};

const engineStateRaw = {
  engineStateVersion: 1,
  nodeId: 'n_capture',
  graphVersionId: 'v1',
  lastEvaluatedTurnId: 'turn-9',
  directiveSeq: 3,
  consecutiveLowEffort: 0,
  slots: { company: 'Acme Robotics', timeline: 'Q3' },
  flags: {},
};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  fakeSentEmails.length = 0;
  jest.clearAllMocks();
  mockHistory.getOrCreateConversationId.mockResolvedValue('conv-1');
  mockHistory.readEngineStateRaw.mockResolvedValue(engineStateRaw);
  mockHistory.recordSessionMarker.mockResolvedValue(undefined);
  mockPrisma.conversationLead.create.mockResolvedValue({ id: 'lead-1' });
  mockPrisma.conversationLead.update.mockResolvedValue({});
  mockPrisma.aIEmailSend.create.mockResolvedValue({ id: 'send-1' });
  mockPrisma.aIEmailSend.count.mockResolvedValue(0);
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('captureLead — consent gate (Req 21.3)', () => {
  it('records NOTHING without the consent attestation and tells the model to ask', async () => {
    const result = await captureLead({
      sessionId: 'sess_1',
      consentConfirmed: false,
      fitNote: 'Great fit',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('consent');
    expect(mockPrisma.conversationLead.create).not.toHaveBeenCalled();
    expect(mockHistory.getOrCreateConversationId).not.toHaveBeenCalled();
  });

  it('requires a fit note', async () => {
    const result = await captureLead({ sessionId: 'sess_1', consentConfirmed: true, fitNote: '   ' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('fitNote');
    expect(mockPrisma.conversationLead.create).not.toHaveBeenCalled();
  });
});

describe('captureLead — row first, notify after (P25)', () => {
  it('writes the lead with engine slots merged UNDER the model parameters, then notifies', async () => {
    process.env.AI_FAKE_MODE = 'email';
    process.env.OWNER_NOTIFY_EMAIL = 'owner@example.com';

    const result = await captureLead({
      sessionId: 'sess_1',
      reflinkId: 'ref-1',
      consentConfirmed: true,
      fitNote: 'Firmware recruiter with a concrete contract role.',
      slots: { contact: 'jane@acme.test', company: 'Acme Robotics GmbH' },
    });

    expect(result).toMatchObject({ success: true, leadId: 'lead-1', notification: 'sent' });
    const row = mockPrisma.conversationLead.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      conversationId: 'conv-1',
      nodeId: 'n_capture',
      graphVersionId: 'v1',
      status: 'new',
    });
    // engine slots seed; model-supplied values win per key
    expect(row.slots).toEqual({
      company: 'Acme Robotics GmbH',
      timeline: 'Q3',
      contact: 'jane@acme.test',
    });
    // the row committed before the transport ran: create call precedes the send log
    expect(mockPrisma.conversationLead.create.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrisma.aIEmailSend.create.mock.invocationCallOrder[0]
    );
    // owner mail through the seam
    expect(fakeSentEmails).toHaveLength(1);
    expect(fakeSentEmails[0].to).toBe('owner@example.com');
    expect(fakeSentEmails[0].subject).toContain('Acme Robotics GmbH');
    // notify outcome lands on the lead
    expect(mockPrisma.conversationLead.update.mock.calls[0][0].data).toMatchObject({
      notifyChannel: 'email',
      notifyError: null,
    });
    // capture marker written for replay
    expect(mockHistory.recordSessionMarker.mock.calls[0][1]).toMatchObject({
      type: 'lead_captured',
      leadId: 'lead-1',
    });
  });

  it('keeps the lead and reports honestly when no transport is configured', async () => {
    const result = await captureLead({
      sessionId: 'sess_1',
      consentConfirmed: true,
      fitNote: 'Visitor asked to be contacted.',
    });
    expect(result.success).toBe(true); // recorded ≠ emailed — the row is the promise (P25)
    expect(result.notification).toBe('skipped_unconfigured');
    expect(mockPrisma.conversationLead.update.mock.calls[0][0].data.notifyError).toBeTruthy();
    expect(mockPrisma.conversationLead.update.mock.calls[0][0].data.notifiedAt).toBeUndefined();
  });

  it('a capture-marker failure never loses the lead', async () => {
    mockHistory.recordSessionMarker.mockRejectedValue(new Error('marker down'));
    const result = await captureLead({
      sessionId: 'sess_1',
      consentConfirmed: true,
      fitNote: 'Still a lead.',
    });
    expect(result.success).toBe(true);
    expect(result.leadId).toBe('lead-1');
  });

  it('never throws — a hard DB failure degrades to an honest failure message', async () => {
    mockPrisma.conversationLead.create.mockRejectedValue(new Error('db down'));
    const result = await captureLead({
      sessionId: 'sess_1',
      consentConfirmed: true,
      fitNote: 'Doomed lead.',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('LinkedIn');
  });

  it('works graph-less: no engine state → lead carries null node/version and only model slots', async () => {
    mockHistory.readEngineStateRaw.mockResolvedValue(null);
    await captureLead({
      sessionId: 'sess_1',
      consentConfirmed: true,
      fitNote: 'Organic conversation lead.',
      slots: { name: 'Jane' },
    });
    const row = mockPrisma.conversationLead.create.mock.calls[0][0].data;
    expect(row).toMatchObject({ nodeId: null, graphVersionId: null, slots: { name: 'Jane' } });
  });

  it('sanitizes model-supplied slots: bad keys dropped, values capped, count bounded', async () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < 30; i++) many[`k${i}`] = `v${i}`;
    await captureLead({
      sessionId: 'sess_1',
      consentConfirmed: true,
      fitNote: 'Slot hygiene.',
      slots: {
        ...many,
        'bad key!': 'dropped',
        long: 'x'.repeat(500),
        nested: { evil: true } as unknown as string,
      },
    });
    const slots = mockPrisma.conversationLead.create.mock.calls[0][0].data.slots as Record<string, string>;
    expect(slots['bad key!']).toBeUndefined();
    expect(slots.nested).toBeUndefined();
    if (slots.long) expect(slots.long.length).toBeLessThanOrEqual(200);
    // engine slots (2) + capped model slots ≤ 20
    expect(Object.keys(slots).length).toBeLessThanOrEqual(22);
  });
});
