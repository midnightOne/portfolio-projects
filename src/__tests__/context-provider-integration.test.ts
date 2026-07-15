/**
 * Context Provider tests — reflink → tier/capability resolution.
 *
 * 7.2e (2026-07-15): the module was gutted to `validateAndFilterContext`, the
 * one method `/api/ai/tools/execute` consumes (Gen-1 prompt generators, the
 * placeholder token mint, and the ElevenLabs assembler are deleted along with
 * the caller-less `/api/ai/voice/session-init` route). These tests pin the
 * surviving access-control contract.
 */

import { contextProvider } from '@/lib/services/ai/context-provider';

jest.mock('@/lib/services/ai/reflink-manager', () => ({
  reflinkManager: {
    validateReflinkWithBudget: jest.fn(),
  },
}));

const mockValidate = jest.requireMock('@/lib/services/ai/reflink-manager').reflinkManager
  .validateReflinkWithBudget as jest.Mock;

describe('ContextProvider.validateAndFilterContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants basic access with no capabilities when no reflink is supplied', async () => {
    const result = await contextProvider.validateAndFilterContext('session-1');

    expect(result.valid).toBe(true);
    expect(result.accessLevel).toBe('basic');
    expect(result.capabilities).toEqual({ voiceAI: false, jobAnalysis: false, advancedNavigation: false });
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('grants premium access with the reflink’s capability flags', async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      reflink: {
        id: 'ref-1',
        enableVoiceAI: true,
        enableJobAnalysis: false,
        enableAdvancedNavigation: true,
      },
      welcomeMessage: 'Welcome back!',
    });

    const result = await contextProvider.validateAndFilterContext('session-1', 'valid-code');

    expect(result.valid).toBe(true);
    expect(result.accessLevel).toBe('premium');
    expect(result.capabilities).toEqual({ voiceAI: true, jobAnalysis: false, advancedNavigation: true });
    expect(result.welcomeMessage).toBe('Welcome back!');
  });

  it.each([
    ['not_found', 'Invalid reflink code'],
    ['expired', 'Reflink has expired. Please contact the portfolio owner for a new one.'],
    ['budget_exhausted', 'Reflink budget has been exhausted. Please contact the portfolio owner.'],
    ['inactive', 'Reflink is inactive'],
  ])('denies access for a %s reflink with the honest reason', async (reason, message) => {
    mockValidate.mockResolvedValue({ valid: false, reason });

    const result = await contextProvider.validateAndFilterContext('session-1', 'bad-code');

    expect(result.valid).toBe(false);
    expect(result.accessLevel).toBe('no_access');
    expect(result.capabilities).toEqual({ voiceAI: false, jobAnalysis: false, advancedNavigation: false });
    expect(result.error).toBe(message);
  });

  it('fails closed (no_access) when validation itself throws', async () => {
    mockValidate.mockRejectedValue(new Error('db down'));

    const result = await contextProvider.validateAndFilterContext('session-1', 'any-code');

    expect(result.valid).toBe(false);
    expect(result.accessLevel).toBe('no_access');
    expect(result.error).toBe('Validation failed');
  });
});
