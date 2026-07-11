/**
 * Notification seam + email transport (conversation-engine Req 15.2 / 13.4,
 * Block G6). Load-bearing behaviors: every send attempt lands one honest
 * AIEmailSend row, the visitor channel enforces the per-conversation cap
 * (admin bypass exempt), unconfigured is a well-defined skip (capture stays
 * durable — P25), the Resend request carries the full message, and the seam
 * NEVER throws into its caller.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aIEmailSend: { create: jest.fn(), count: jest.fn() },
    aIJobAnalysis: { findUnique: jest.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { sendEmail, notifyOwner } from '../leads/notify';
import { sendJdAnalysisEmail } from '../leads/jd-email';
import { fakeSentEmails } from '../leads/email-transport';
import { renderEmailBody, renderEmailShell } from '../leads/email-render';

const mockPrisma = prisma as unknown as {
  aIEmailSend: { create: jest.Mock; count: jest.Mock };
  aIJobAnalysis: { findUnique: jest.Mock };
};

const ENV_KEYS = [
  'AI_FAKE_MODE',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'OWNER_NOTIFY_EMAIL',
  'VISITOR_EMAIL_MAX_PER_CONVERSATION',
] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  fakeSentEmails.length = 0;
  jest.clearAllMocks();
  mockPrisma.aIEmailSend.create.mockResolvedValue({ id: 'send-row-1' });
  mockPrisma.aIEmailSend.count.mockResolvedValue(0);
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe('email rendering', () => {
  it('renders headings, bold, and paragraphs; escapes HTML', () => {
    const html = renderEmailBody('## Fit\n\nStrong **ESP32** match.\n\n<script>alert(1)</script>');
    expect(html).toContain('<h4');
    expect(html).toContain('Fit');
    expect(html).toContain('<strong>ESP32</strong>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('shell carries intro, body, and footer', () => {
    const html = renderEmailShell({ intro: 'Hello', bodyMarkdown: 'Body text', footer: 'Honest footer' });
    expect(html).toContain('Hello');
    expect(html).toContain('Body text');
    expect(html).toContain('Honest footer');
  });
});

describe('sendEmail — visitor channel', () => {
  const params = {
    channel: 'visitor' as const,
    purpose: 'jd_analysis',
    to: 'visitor@example.com',
    subject: 'Test subject',
    text: 'Test body',
    sessionId: 'sess_1',
    analysisId: 'analysis_1',
  };

  it('sends via the fake transport and records an honest row', async () => {
    process.env.AI_FAKE_MODE = 'email';
    process.env.OWNER_NOTIFY_EMAIL = 'owner@example.com';

    const result = await sendEmail(params);
    expect(result.status).toBe('sent');
    expect(result.providerId).toMatch(/^fake-/);
    expect(fakeSentEmails).toHaveLength(1);
    expect(fakeSentEmails[0].to).toBe('visitor@example.com');
    expect(fakeSentEmails[0].replyTo).toBe('owner@example.com'); // replies reach the human

    const row = mockPrisma.aIEmailSend.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      channel: 'visitor',
      purpose: 'jd_analysis',
      recipient: 'visitor@example.com',
      sessionId: 'sess_1',
      analysisId: 'analysis_1',
      status: 'sent',
    });
  });

  it('skips at the per-conversation cap without touching the transport', async () => {
    process.env.AI_FAKE_MODE = 'email';
    mockPrisma.aIEmailSend.count.mockResolvedValue(2);

    const result = await sendEmail(params);
    expect(result.status).toBe('skipped_rate_limited');
    expect(fakeSentEmails).toHaveLength(0);
    expect(mockPrisma.aIEmailSend.create.mock.calls[0][0].data.status).toBe('skipped_rate_limited');
  });

  it('honors VISITOR_EMAIL_MAX_PER_CONVERSATION', async () => {
    process.env.AI_FAKE_MODE = 'email';
    process.env.VISITOR_EMAIL_MAX_PER_CONVERSATION = '5';
    mockPrisma.aIEmailSend.count.mockResolvedValue(2);

    const result = await sendEmail(params);
    expect(result.status).toBe('sent');
  });

  it('admin bypass sends past the cap and marks the row adminInitiated', async () => {
    process.env.AI_FAKE_MODE = 'email';
    mockPrisma.aIEmailSend.count.mockResolvedValue(99);

    const result = await sendEmail({ ...params, bypassRateLimit: true });
    expect(result.status).toBe('sent');
    expect(mockPrisma.aIEmailSend.count).not.toHaveBeenCalled();
    expect(mockPrisma.aIEmailSend.create.mock.calls[0][0].data.metadata).toMatchObject({
      adminInitiated: true,
    });
  });

  it('unconfigured transport is a well-defined skip — capture never lost', async () => {
    const result = await sendEmail(params);
    expect(result.status).toBe('skipped_unconfigured');
    expect(result.error).toContain('RESEND_API_KEY');
    expect(mockPrisma.aIEmailSend.create.mock.calls[0][0].data.status).toBe('skipped_unconfigured');
  });

  it('never throws even when the log write fails', async () => {
    process.env.AI_FAKE_MODE = 'email';
    mockPrisma.aIEmailSend.create.mockRejectedValue(new Error('db down'));

    const result = await sendEmail(params);
    expect(result.status).toBe('sent'); // the send itself succeeded
    expect(result.sendId).toBeUndefined();
  });
});

describe('sendEmail — owner channel', () => {
  it('notifyOwner targets OWNER_NOTIFY_EMAIL', async () => {
    process.env.AI_FAKE_MODE = 'email';
    process.env.OWNER_NOTIFY_EMAIL = 'owner@example.com';

    const result = await notifyOwner({ purpose: 'lead_notification', subject: 'New lead', text: 'Body' });
    expect(result.status).toBe('sent');
    expect(fakeSentEmails[0].to).toBe('owner@example.com');
  });

  it('missing OWNER_NOTIFY_EMAIL is a recorded skip, not an error', async () => {
    process.env.AI_FAKE_MODE = 'email';
    const result = await notifyOwner({ purpose: 'lead_notification', subject: 'New lead', text: 'Body' });
    expect(result.status).toBe('skipped_unconfigured');
    expect(mockPrisma.aIEmailSend.create.mock.calls[0][0].data.recipient).toBe('(none)');
  });
});

describe('Resend transport (mocked fetch)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the full message and returns the provider id', async () => {
    process.env.RESEND_API_KEY = 're_test_123';
    process.env.EMAIL_FROM = 'Portfolio AI <ai@example.com>';
    process.env.OWNER_NOTIFY_EMAIL = 'owner@example.com';
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'resend-id-1' }),
    }));
    global.fetch = fetchMock as never;

    const result = await sendEmail({
      channel: 'visitor',
      purpose: 'jd_analysis',
      to: 'visitor@example.com',
      subject: 'S',
      text: 'T',
      html: '<p>T</p>',
      sessionId: 'sess_1',
    });

    expect(result).toMatchObject({ status: 'sent', providerId: 'resend-id-1' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_123');
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: 'Portfolio AI <ai@example.com>',
      to: ['visitor@example.com'],
      subject: 'S',
      text: 'T',
      html: '<p>T</p>',
      reply_to: 'owner@example.com',
    });
  });

  it('provider rejection lands as a failed row with the provider message', async () => {
    process.env.RESEND_API_KEY = 're_test_123';
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: 'domain not verified' }),
    })) as never;

    const result = await sendEmail({
      channel: 'visitor',
      purpose: 'jd_analysis',
      to: 'visitor@example.com',
      subject: 'S',
      text: 'T',
    });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('domain not verified');
    expect(mockPrisma.aIEmailSend.create.mock.calls[0][0].data.status).toBe('failed');
  });
});

describe('sendJdAnalysisEmail', () => {
  beforeEach(() => {
    process.env.AI_FAKE_MODE = 'email';
  });

  it('composes subject from the row and mails the document', async () => {
    mockPrisma.aIJobAnalysis.findUnique.mockResolvedValue({
      id: 'analysis_1',
      sessionId: 'sess_1',
      visitorEmail: 'recruiter@example.com',
      positionTitle: 'Senior Firmware Engineer',
      companyName: 'Acme Robotics',
      analysisResult: { document: '## Verdict\n\nStrong **match**.' },
    });

    const result = await sendJdAnalysisEmail('analysis_1');
    expect(result.status).toBe('sent');
    expect(fakeSentEmails[0].subject).toBe('Compatibility analysis — Senior Firmware Engineer at Acme Robotics');
    expect(fakeSentEmails[0].text).toContain('Strong **match**.');
    expect(fakeSentEmails[0].html).toContain('<strong>match</strong>');
  });

  it('no captured address / no document are honest failures, not sends', async () => {
    mockPrisma.aIJobAnalysis.findUnique.mockResolvedValue({
      id: 'analysis_1',
      sessionId: 'sess_1',
      visitorEmail: null,
      positionTitle: null,
      companyName: null,
      analysisResult: { document: 'x' },
    });
    expect((await sendJdAnalysisEmail('analysis_1')).status).toBe('failed');

    mockPrisma.aIJobAnalysis.findUnique.mockResolvedValue({
      id: 'analysis_1',
      sessionId: 'sess_1',
      visitorEmail: 'r@example.com',
      positionTitle: null,
      companyName: null,
      analysisResult: {},
    });
    const result = await sendJdAnalysisEmail('analysis_1');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('document');
    expect(fakeSentEmails).toHaveLength(0);
  });
});
