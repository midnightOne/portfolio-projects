/**
 * Context Provider — reflink access validation for tool execution.
 *
 * 7.2e (2026-07-15): gutted to its ONE live duty. The Gen-1 system-prompt
 * generators (generateSystemPrompt / initial / hidden / public context,
 * buildContextString), the placeholder ephemeral-token mint
 * (injectContext / generateSessionToken — served only the unwrapped, caller-less
 * `/api/ai/voice/session-init` route, deleted alongside; flagged P0 in the
 * 2026-07-11 implementation audit), and the ElevenLabs agent-prompt assembler
 * (adapter retired, D45) are all DELETED. Conversational policy is assembled
 * in exactly one server-side place — the mint routes via `mint-guidance.ts` +
 * `start-frame.ts` — never here.
 *
 * What remains is what `/api/ai/tools/execute` actually consumes:
 * `validateAndFilterContext` — reflink → tier/capability resolution.
 */

import { reflinkManager } from './reflink-manager';

export type AccessLevel = 'no_access' | 'basic' | 'limited' | 'premium';

export interface ContextValidationResult {
  valid: boolean;
  accessLevel: string;
  capabilities: { voiceAI: boolean; jobAnalysis: boolean; advancedNavigation: boolean };
  welcomeMessage?: string;
  error?: string;
}

export class ContextProvider {
  private static instance: ContextProvider;

  static getInstance(): ContextProvider {
    if (!ContextProvider.instance) {
      ContextProvider.instance = new ContextProvider();
    }
    return ContextProvider.instance;
  }

  /**
   * Validate and filter context based on reflink permissions
   */
  async validateAndFilterContext(
    sessionId: string,
    reflinkCode?: string
  ): Promise<ContextValidationResult> {
    const noCapabilities = { voiceAI: false, jobAnalysis: false, advancedNavigation: false };
    try {
      if (!reflinkCode) {
        return { valid: true, accessLevel: 'basic', capabilities: noCapabilities };
      }

      const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);

      if (!validation.valid) {
        return {
          valid: false,
          accessLevel: 'no_access',
          capabilities: noCapabilities,
          error: this.getValidationErrorMessage(validation.reason),
        };
      }

      const reflink = validation.reflink!;
      return {
        valid: true,
        accessLevel: 'premium',
        capabilities: {
          voiceAI: reflink.enableVoiceAI,
          jobAnalysis: reflink.enableJobAnalysis,
          advancedNavigation: reflink.enableAdvancedNavigation,
        },
        welcomeMessage: validation.welcomeMessage,
      };
    } catch (error) {
      console.error('Context validation failed:', error);
      return {
        valid: false,
        accessLevel: 'no_access',
        capabilities: noCapabilities,
        error: 'Validation failed',
      };
    }
  }

  private getValidationErrorMessage(reason?: string): string {
    switch (reason) {
      case 'not_found':
        return 'Invalid reflink code';
      case 'expired':
        return 'Reflink has expired. Please contact the portfolio owner for a new one.';
      case 'budget_exhausted':
        return 'Reflink budget has been exhausted. Please contact the portfolio owner.';
      case 'inactive':
        return 'Reflink is inactive';
      default:
        return 'Reflink validation failed';
    }
  }
}

// Export singleton instance
export const contextProvider = ContextProvider.getInstance();
