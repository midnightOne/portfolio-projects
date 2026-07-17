/**
 * 7.16/7.17 tool contracts: schema diet (7.2b — every minted schema is
 * standing per-turn overhead), recruiter/client intake split (7.16 fork
 * resolution A), and deliberate allowlist tiering (client_request_form +
 * fill_field public; lead_capture + think_harder NOT).
 */

import { describe, it, expect } from '@jest/globals';

// The gateway module pulls next-auth (ESM `jose`) and prisma — neither is
// under test here; the allowlist constant is.
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  thinkHarderToolDefinition,
  leadCaptureToolDefinition,
  serverToolDefinitions,
} from '../server-tools';
import {
  clientRequestFormToolDefinition,
  fillFieldToolDefinition,
  jobDescriptionFormToolDefinition,
  clientToolDefinitions,
} from '../client-tools';
import { PUBLIC_TOOL_ALLOWLIST } from '@/lib/ai/gateway';

describe('7.17 think_harder contract', () => {
  it('is a registered server tool with a TINY schema: one required question, nothing else', () => {
    expect(serverToolDefinitions).toContain(thinkHarderToolDefinition);
    expect(thinkHarderToolDefinition.executionContext).toBe('server');
    expect(Object.keys(thinkHarderToolDefinition.parameters.properties as object)).toEqual(['question']);
    expect(thinkHarderToolDefinition.parameters.required).toEqual(['question']);
  });

  it('description carries the trigger AND the anti-trigger (no burning the model on lookups)', () => {
    expect(thinkHarderToolDefinition.description).toContain('deep technical questions');
    expect(thinkHarderToolDefinition.description).toContain('too surface-level');
    expect(thinkHarderToolDefinition.description).toContain('NEVER use it for routine lookups');
    expect(thinkHarderToolDefinition.description).toContain('several seconds');
  });
});

describe('7.16 intake split (fork resolution A)', () => {
  it('job_description_form is framed recruiter-only and points clients elsewhere', () => {
    expect(jobDescriptionFormToolDefinition.description).toContain('recruiters/employers');
    expect(jobDescriptionFormToolDefinition.description).toContain('NEVER open it for a prospective client');
    expect(jobDescriptionFormToolDefinition.description).toContain('client_request_form');
  });

  it('client_request_form is a zero-param client tool registered alongside it', () => {
    expect(clientToolDefinitions).toContain(clientRequestFormToolDefinition);
    expect(Object.keys(clientRequestFormToolDefinition.parameters.properties as object)).toEqual([]);
    expect(clientRequestFormToolDefinition.description).toContain('NOT the recruiter job-analysis form');
  });

  it('lead_capture gained the free-form message channel and keeps the consent gate', () => {
    const props = leadCaptureToolDefinition.parameters.properties as Record<string, unknown>;
    expect(Object.keys(props)).toEqual(['consentConfirmed', 'fitNote', 'slots', 'message']);
    expect(leadCaptureToolDefinition.parameters.required).toEqual(['consentConfirmed', 'fitNote']);
  });

  it('fill_field schema stays tiny: field required; value/submit/submitConfirmed optional', () => {
    expect(clientToolDefinitions).toContain(fillFieldToolDefinition);
    expect(Object.keys(fillFieldToolDefinition.parameters.properties as object)).toEqual([
      'field',
      'value',
      'submit',
      'submitConfirmed',
    ]);
    expect(fillFieldToolDefinition.parameters.required).toEqual(['field']);
  });
});

describe('public-tier allowlist decisions (deliberate, Req 2.1)', () => {
  it('client_request_form + fill_field are public; lead_capture + think_harder are NOT', () => {
    expect(PUBLIC_TOOL_ALLOWLIST).toContain('client_request_form');
    expect(PUBLIC_TOOL_ALLOWLIST).toContain('fill_field');
    expect(PUBLIC_TOOL_ALLOWLIST).not.toContain('lead_capture'); // H2 ruling — unchanged
    expect(PUBLIC_TOOL_ALLOWLIST).not.toContain('think_harder'); // 7.17 cost gate
  });
});
