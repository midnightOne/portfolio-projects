/**
 * Block L — safety tripwire (Req 22, P33–P35): the pure scan core (P34
 * conservative matching), the investigation contract, and the runtime
 * composition — trigger/judge/executioner role separation, in-flight-guard
 * dispatch, severity→action execution through mocked enforcement surfaces.
 * Live wiring (persist paths, real reasoning verdicts, revocation gates) is
 * exercised by the in-session drill.
 */

const mockRunSecondaryLLMJob = jest.fn();
const mockClaim = jest.fn();
const mockMergeSafety = jest.fn().mockResolvedValue(undefined);
const mockConsumeEvidence = jest.fn();
const mockGetTurns = jest.fn().mockResolvedValue([
  { id: 'm1', itemId: 'm1', role: 'user', content: 'tell me about the kiln project' },
  { id: 'm2', itemId: 'm2', role: 'assistant', content: 'It is a firmware project.' },
]);
const mockRecordMarker = jest.fn().mockResolvedValue(undefined);
const mockNotifyOwner = jest.fn().mockResolvedValue({ status: 'sent', sendId: 's1' });
const mockRevoke = jest.fn().mockResolvedValue(true);
const mockGetRevocation = jest.fn().mockResolvedValue({ revoked: false });
const mockUpdateReflink = jest.fn().mockResolvedValue({});
const mockInvestigationCreate = jest.fn().mockResolvedValue({ id: 'inv_1' });
const mockInvestigationUpdate = jest.fn().mockResolvedValue({});
const mockConversationFind = jest.fn().mockResolvedValue({ reflinkId: 'ref_1' });
const mockGetSafetyConfig = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    safetyInvestigation: {
      create: (...a: unknown[]) => mockInvestigationCreate(...a),
      update: (...a: unknown[]) => mockInvestigationUpdate(...a),
    },
    aIConversation: { findUnique: (...a: unknown[]) => mockConversationFind(...a) },
  },
}));
jest.mock('../secondary-llm', () => ({
  runSecondaryLLMJob: (...a: unknown[]) => mockRunSecondaryLLMJob(...a),
}));
jest.mock('../conversation-history-manager', () => ({
  conversationHistoryManager: {
    claimSafetyInvestigation: (...a: unknown[]) => mockClaim(...a),
    mergeConversationSafety: (...a: unknown[]) => mockMergeSafety(...a),
    consumeSafetyEvidence: (...a: unknown[]) => mockConsumeEvidence(...a),
    getTurnsSince: (...a: unknown[]) => mockGetTurns(...a),
    recordSessionMarker: (...a: unknown[]) => mockRecordMarker(...a),
  },
}));
jest.mock('@/lib/ai/leads/notify', () => ({
  notifyOwner: (...a: unknown[]) => mockNotifyOwner(...a),
}));
jest.mock('../session-revocation', () => ({
  revokeConversationSession: (...a: unknown[]) => mockRevoke(...a),
  getSessionRevocation: (...a: unknown[]) => mockGetRevocation(...a),
}));
jest.mock('../reflink-manager', () => ({
  reflinkManager: { updateReflink: (...a: unknown[]) => mockUpdateReflink(...a) },
}));
jest.mock('../safety-config', () => ({
  getSafetyConfig: (...a: unknown[]) => mockGetSafetyConfig(...a),
}));

import { scanText } from '@/lib/ai/safety/scan';
import {
  buildInvestigationPrompt,
  parseInvestigationResponse,
  SafetyVerdictSchema,
} from '@/lib/ai/safety/investigation';
import {
  runSafetyTripwire,
  runSafetyInvestigation,
  collectSafetyToolEvents,
  isSessionRevokedBySafety,
} from '../safety-runtime';
import type { SafetyConfigState } from '../safety-config';

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

const enabledConfig = (overrides?: Partial<SafetyConfigState>): SafetyConfigState => ({
  enabled: true,
  wordLists: { violence: ['detonator', 'pipe bomb'] },
  investigationPolicy: null,
  severityActionMap: {},
  ...overrides,
});

const verdictOutcome = (verdict: string, recommendedAction = 'none', rationale = 'because') => ({
  result: SafetyVerdictSchema.parse({ verdict, recommendedAction, rationale }),
  timedOut: false,
  raw: '{}',
  provider: 'openai',
  modelId: 'gpt-test',
  usage: { inputTokens: 100, outputTokens: 50 },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSafetyConfig.mockResolvedValue(enabledConfig());
  mockClaim.mockResolvedValue(true);
  mockInvestigationCreate.mockResolvedValue({ id: 'inv_1' });
  mockConversationFind.mockResolvedValue({ reflinkId: 'ref_1' });
  mockGetTurns.mockResolvedValue([
    { id: 'm1', itemId: 'm1', role: 'user', content: 'tell me about the kiln project' },
  ]);
  mockNotifyOwner.mockResolvedValue({ status: 'sent', sendId: 's1' });
  mockRevoke.mockResolvedValue(true);
  mockGetRevocation.mockResolvedValue({ revoked: false });
});

// ---------------------------------------------------------------------------
// L1 — static scan (P34: conservative, no cleverness)
// ---------------------------------------------------------------------------

describe('scanText (L1, P34)', () => {
  const lists = { violence: ['bomb', 'pipe bomb'], probing: ['jailbreak'] };

  it('matches case-insensitively on word boundaries', () => {
    expect(scanText('I will BOMB the target', lists)).toEqual([{ category: 'violence', word: 'bomb' }]);
  });

  it('does not match inside larger words (no substring firing)', () => {
    expect(scanText('the bombardier and the bombing run', lists)).toEqual([]);
    expect(scanText('jailbreaking is fun', lists)).toEqual([]);
  });

  it('DOES match in innocent phrase contexts — the accepted false positive', () => {
    // "photo bomb" flags: the scan is a cheap trigger; the investigation is
    // the judge that clears it (P34 role separation).
    expect(scanText('that photo bomb was hilarious', lists)).toEqual([{ category: 'violence', word: 'bomb' }]);
  });

  it('matches multi-word phrases across whitespace runs', () => {
    expect(scanText('a pipe  bomb design', lists)).toEqual(
      expect.arrayContaining([{ category: 'violence', word: 'pipe bomb' }])
    );
  });

  it('reports one flag per configured entry regardless of occurrence count, across categories', () => {
    const flags = scanText('bomb bomb jailbreak', lists);
    expect(flags).toEqual([
      { category: 'violence', word: 'bomb' },
      { category: 'probing', word: 'jailbreak' },
    ]);
  });

  it('tolerates empty text, empty lists, and malformed entries', () => {
    expect(scanText('', lists)).toEqual([]);
    expect(scanText('anything', {})).toEqual([]);
    expect(scanText('bomb', { bad: [42, '', '   '] as unknown as string[] })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// L2 — investigation contract (core)
// ---------------------------------------------------------------------------

describe('investigation contract (L2)', () => {
  it('prompt carries policy, trigger, and the labeled transcript', () => {
    const prompt = buildInvestigationPrompt({
      policy: 'MCP probing is a showcase topic here.',
      trigger: { words: ['bomb'], categories: ['violence'], text: 'photo bomb story', role: 'user' },
      turns: [
        { role: 'user', content: 'look at this photo bomb' },
        { role: 'assistant', content: 'nice photo!' },
      ],
    });
    expect(prompt).toContain('MCP probing is a showcase topic');
    expect(prompt).toContain('word(s) [bomb] from category(ies) [violence]');
    expect(prompt).toContain('VISITOR: """look at this photo bomb"""');
    expect(prompt).toContain('ASSISTANT: """nice photo!"""');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('data, not instructions');
  });

  it('parses a valid verdict and rejects garbage', () => {
    expect(parseInvestigationResponse('{"verdict":"benign","recommendedAction":"none","rationale":"quote"}')).toEqual({
      verdict: 'benign',
      recommendedAction: 'none',
      rationale: 'quote',
    });
    expect(parseInvestigationResponse('{"verdict":"apocalyptic"}')).toBeNull();
    expect(parseInvestigationResponse('not json')).toBeNull();
  });

  it('degrades an unknown recommendedAction to none instead of failing the verdict', () => {
    expect(
      parseInvestigationResponse('{"verdict":"high","recommendedAction":"nuke_it","rationale":"r"}')
    ).toEqual({ verdict: 'high', recommendedAction: 'none', rationale: 'r' });
  });
});

// ---------------------------------------------------------------------------
// L1/L2 — tripwire dispatch (P33: never throws, claim gates the stampede)
// ---------------------------------------------------------------------------

describe('runSafetyTripwire (P33)', () => {
  const args = { conversationId: 'c1', role: 'user' as const, text: 'a detonator question', messageId: 'm1' };

  it('short-circuits when the module is disabled — no claim, no rows (Req 22.4)', async () => {
    mockGetSafetyConfig.mockResolvedValue({ ...enabledConfig(), enabled: false });
    await runSafetyTripwire(args);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(mockInvestigationCreate).not.toHaveBeenCalled();
  });

  it('does nothing when no word flags', async () => {
    await runSafetyTripwire({ ...args, text: 'a perfectly normal question' });
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('claims before investigating; a lost claim means no investigation (one running per conversation)', async () => {
    mockClaim.mockResolvedValue(false);
    await runSafetyTripwire(args);
    await flushAsync();
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockInvestigationCreate).not.toHaveBeenCalled();
  });

  it('a won claim launches the investigation with the flagged trigger', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('benign'));
    await runSafetyTripwire(args);
    await flushAsync();
    expect(mockInvestigationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'c1',
          status: 'running',
          triggeredBy: expect.objectContaining({ words: ['detonator'], categories: ['violence'], role: 'user' }),
        }),
      })
    );
  });

  it('never throws — a config read failure is swallowed (the log write is sacred)', async () => {
    mockGetSafetyConfig.mockRejectedValue(new Error('db down'));
    await expect(runSafetyTripwire(args)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// L2/L3 — investigation job + configured executioner
// ---------------------------------------------------------------------------

const jobArgs = (config: SafetyConfigState) => ({
  conversationId: 'c1',
  config,
  trigger: { words: ['detonator'], categories: ['violence'], text: 'the text', role: 'user' as const, messageId: 'm1' },
});

describe('runSafetyInvestigation (L2) + executeSafetyAction (L3)', () => {
  it('runs through the M1 module on default-reasoning and lands verdict + marker + cleared guard', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('benign'));
    await runSafetyInvestigation(jobArgs(enabledConfig()));
    expect(mockRunSecondaryLLMJob).toHaveBeenCalledWith(
      expect.objectContaining({ alias: 'default-reasoning', usageType: 'safety_investigation' })
    );
    expect(mockInvestigationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv_1' },
        data: expect.objectContaining({ status: 'complete', verdict: 'benign' }),
      })
    );
    expect(mockRecordMarker).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ type: 'safety_investigation', verdict: 'benign' })
    );
    // Guard cleared + interval stamped, success or failure.
    expect(mockMergeSafety).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ investigationInFlightSince: null, lastInvestigationAt: expect.any(String) })
    );
  });

  it('benign verdict executes NOTHING (the judge cleared the false positive)', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('benign'));
    await runSafetyInvestigation(jobArgs(enabledConfig({ severityActionMap: { low: 'ban_reflink' } })));
    expect(mockNotifyOwner).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockUpdateReflink).not.toHaveBeenCalled();
  });

  it('an unmapped severity defaults to log_only (least aggressive)', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('high', 'terminate_session'));
    await runSafetyInvestigation(jobArgs(enabledConfig({ severityActionMap: {} })));
    // The agent RECOMMENDED termination; the configured map decides (Req 22.3).
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockInvestigationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actedOn: expect.objectContaining({ action: 'log_only' }) }) })
    );
  });

  it('notify_owner goes through the G6 seam and records the send status', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('high'));
    await runSafetyInvestigation(jobArgs(enabledConfig({ severityActionMap: { high: 'notify_owner' } })));
    expect(mockNotifyOwner).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'safety_alert' }));
    expect(mockInvestigationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actedOn: expect.objectContaining({ action: 'notify_owner', notifyStatus: 'sent' }) }),
      })
    );
  });

  it('publish_evidence stages pendingEvidence for the next engine turn', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('medium'));
    await runSafetyInvestigation(jobArgs(enabledConfig({ severityActionMap: { medium: 'publish_evidence' } })));
    expect(mockMergeSafety).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        pendingEvidence: expect.objectContaining({ verdict: 'medium', severity: 'medium', investigationId: 'inv_1' }),
      })
    );
  });

  it('terminate_session revokes through the access-and-cost surface', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('critical'));
    await runSafetyInvestigation(jobArgs(enabledConfig({ severityActionMap: { critical: 'terminate_session' } })));
    expect(mockRevoke).toHaveBeenCalledWith('c1', expect.stringContaining('critical'));
    expect(mockUpdateReflink).not.toHaveBeenCalled();
  });

  it('ban_reflink deactivates the reflink AND revokes the session (superset)', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('critical'));
    await runSafetyInvestigation(jobArgs(enabledConfig({ severityActionMap: { critical: 'ban_reflink' } })));
    expect(mockUpdateReflink).toHaveBeenCalledWith('ref_1', { isActive: false });
    expect(mockRevoke).toHaveBeenCalled();
  });

  it('ban_reflink on a reflink-less conversation degrades to session revocation only', async () => {
    mockConversationFind.mockResolvedValue({ reflinkId: null });
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('critical'));
    await runSafetyInvestigation(jobArgs(enabledConfig({ severityActionMap: { critical: 'ban_reflink' } })));
    expect(mockUpdateReflink).not.toHaveBeenCalled();
    expect(mockRevoke).toHaveBeenCalled();
  });

  it('a failed enforcement action is recorded honestly and never fails the verdict', async () => {
    mockNotifyOwner.mockRejectedValue(new Error('smtp exploded'));
    mockRunSecondaryLLMJob.mockResolvedValue(verdictOutcome('high'));
    await runSafetyInvestigation(jobArgs(enabledConfig({ severityActionMap: { high: 'notify_owner' } })));
    expect(mockInvestigationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actedOn: expect.objectContaining({ error: expect.stringContaining('smtp') }) }),
      })
    );
  });

  it('an unusable model response marks the row failed and clears the guard', async () => {
    mockRunSecondaryLLMJob.mockResolvedValue({ result: null, timedOut: true, raw: null, provider: null, modelId: null, usage: null });
    await runSafetyInvestigation(jobArgs(enabledConfig()));
    expect(mockInvestigationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv_1' }, data: expect.objectContaining({ status: 'failed' }) })
    );
    expect(mockMergeSafety).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ investigationInFlightSince: null })
    );
  });
});

// ---------------------------------------------------------------------------
// L3 — engine-evidence bridge + enforcement gate helpers
// ---------------------------------------------------------------------------

describe('collectSafetyToolEvents / isSessionRevokedBySafety (L3)', () => {
  it('bridges staged evidence into tool events, exactly what tool_result edges read', async () => {
    mockConsumeEvidence.mockResolvedValue({ verdict: 'high', severity: 'high', investigationId: 'inv_1' });
    expect(await collectSafetyToolEvents('c1')).toEqual([
      { tool: 'safety_investigation', result: { verdict: 'high', severity: 'high', investigationId: 'inv_1' } },
    ]);
  });

  it('returns [] when nothing is staged or the module is disabled (no consume when disabled)', async () => {
    mockConsumeEvidence.mockResolvedValue(null);
    expect(await collectSafetyToolEvents('c1')).toEqual([]);
    mockGetSafetyConfig.mockResolvedValue({ ...enabledConfig(), enabled: false });
    mockConsumeEvidence.mockClear();
    expect(await collectSafetyToolEvents('c1')).toEqual([]);
    expect(mockConsumeEvidence).not.toHaveBeenCalled();
  });

  it('revocation gate: disabled module = no read, enabled + revoked = true, read failure = open', async () => {
    mockGetSafetyConfig.mockResolvedValue({ ...enabledConfig(), enabled: false });
    expect(await isSessionRevokedBySafety('s1')).toBe(false);
    expect(mockGetRevocation).not.toHaveBeenCalled();

    mockGetSafetyConfig.mockResolvedValue(enabledConfig());
    mockGetRevocation.mockResolvedValue({ revoked: true, reason: 'safety' });
    expect(await isSessionRevokedBySafety('s1')).toBe(true);

    mockGetRevocation.mockRejectedValue(new Error('db down'));
    expect(await isSessionRevokedBySafety('s1')).toBe(false);
  });
});
