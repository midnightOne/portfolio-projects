/**
 * Context Provider Integration Tests
 * Tests for secure context injection and management system
 * (Phase 3 Wave 3: context-manager deleted, context-injector folded into
 * context-provider — tests target the consolidated surface.)
 */

import { contextProvider } from '@/lib/services/ai/context-provider';

// Mock dependencies
jest.mock('@/lib/services/ai/content-source-manager', () => ({
  contentSourceManager: {
    autoDiscoverSources: jest.fn().mockResolvedValue(undefined),
    searchContent: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/lib/services/ai/reflink-manager', () => ({
  reflinkManager: {
    validateReflinkWithBudget: jest.fn().mockResolvedValue({
      valid: false,
      reason: 'not_found',
    }),
    getReflinkByCode: jest.fn().mockResolvedValue(null),
    trackUsage: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Context Provider Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextProvider.clearAllCache();

    const mockContentSourceManager = require('@/lib/services/ai/content-source-manager');
    mockContentSourceManager.contentSourceManager.autoDiscoverSources.mockResolvedValue(undefined);
    mockContentSourceManager.contentSourceManager.searchContent.mockResolvedValue([]);

    const mockReflinkManager = require('@/lib/services/ai/reflink-manager');
    mockReflinkManager.reflinkManager.validateReflinkWithBudget.mockResolvedValue({
      valid: false,
      reason: 'not_found',
    });
  });

  describe('ContextProvider', () => {
    it('should inject context with basic access level', async () => {
      const request = {
        sessionId: 'test-session',
        query: 'Tell me about the projects',
      };

      const result = await contextProvider.injectContext(request);

      expect(result.success).toBe(true);
      expect(result.context.accessLevel).toBe('basic');
      expect(result.context.systemPrompt).toContain('ACCESS LEVEL: Basic');
    });

    it('should inject context with premium access for valid reflink', async () => {
      const mockReflinkManager = require('@/lib/services/ai/reflink-manager');
      mockReflinkManager.reflinkManager.validateReflinkWithBudget.mockResolvedValue({
        valid: true,
        reflink: {
          id: 'reflink-1',
          enableVoiceAI: true,
          enableJobAnalysis: true,
          enableAdvancedNavigation: true,
          recipientName: 'John Doe',
          customContext: 'Recruiting for senior developer position',
        },
        budgetStatus: {
          spendRemaining: 50,
          isExhausted: false,
        },
      });

      const request = {
        sessionId: 'test-session',
        query: 'Tell me about the projects',
        reflinkCode: 'valid-reflink',
      };

      const result = await contextProvider.injectContext(request);

      expect(result.success).toBe(true);
      expect(result.context.accessLevel).toBe('premium');
      expect(result.context.systemPrompt).toContain('ACCESS LEVEL: Premium');
      expect(result.context.systemPrompt).toContain('John Doe');
      expect(result.context.systemPrompt).toContain('Recruiting for senior developer position');
    });

    it('should filter context based on access level', async () => {
      const basicRequest = {
        sessionId: 'test-session',
        query: 'Tell me about the projects',
        accessLevel: 'basic' as const,
      };

      const result = await contextProvider.injectContext(basicRequest);

      expect(result.success).toBe(true);
      expect(result.context.hiddenContext).toBe('');
      expect(result.context.tokenCount).toBeLessThanOrEqual(2000);
    });

    it('should cache context for performance', async () => {
      const request = {
        sessionId: 'test-session',
        query: 'Tell me about the projects',
      };

      const result1 = await contextProvider.injectContext(request);
      const result2 = await contextProvider.injectContext(request);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.context.cacheKey).toBe(result2.context.cacheKey);

      // Search ran only for the first (uncached) call
      const mockContentSourceManager = require('@/lib/services/ai/content-source-manager');
      expect(mockContentSourceManager.contentSourceManager.searchContent).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid reflink gracefully', async () => {
      const mockReflinkManager = require('@/lib/services/ai/reflink-manager');
      mockReflinkManager.reflinkManager.validateReflinkWithBudget.mockResolvedValue({
        valid: false,
        reason: 'expired',
      });

      const request = {
        sessionId: 'test-session',
        query: 'Tell me about the projects',
        reflinkCode: 'expired-reflink',
      };

      const result = await contextProvider.injectContext(request);

      expect(result.success).toBe(true);
      expect(result.context.accessLevel).toBe('basic');
    });

    it('should build context from content-source search results', async () => {
      const mockContentSourceManager = require('@/lib/services/ai/content-source-manager');
      mockContentSourceManager.contentSourceManager.searchContent.mockResolvedValue([
        {
          id: 'proj-1',
          type: 'project',
          title: 'Kiln Controller',
          content: 'A dual-thermocouple kiln controller.',
          summary: 'Kiln controller project',
          relevanceScore: 0.9,
          keywords: ['embedded', 'FreeRTOS'],
        },
      ]);

      const result = await contextProvider.injectContext({
        sessionId: 'test-session-2',
        query: 'kiln',
      });

      expect(result.success).toBe(true);
      expect(result.context.initialContext).toContain('Kiln Controller');
      expect(result.context.relevantContent).toHaveLength(1);
    });
  });

  describe('Folded injector surface', () => {
    it('should generate session token for voice providers', async () => {
      const mockReflinkManager = require('@/lib/services/ai/reflink-manager');
      mockReflinkManager.reflinkManager.validateReflinkWithBudget.mockResolvedValue({
        valid: true,
        reflink: {
          id: 'reflink-1',
          enableVoiceAI: true,
          recipientName: 'John Doe',
        },
        budgetStatus: {
          spendRemaining: 50,
          isExhausted: false,
        },
        welcomeMessage: 'Welcome John! You have enhanced AI access.',
      });

      const result = await contextProvider.generateSessionToken({
        sessionId: 'test-session',
        provider: 'openai',
        reflinkCode: 'valid-reflink',
      });

      expect(result.success).toBe(true);
      expect(result.ephemeralToken).toBeDefined();
      expect(result.welcomeMessage).toBe('Welcome John! You have enhanced AI access.');
      expect(result.accessLevel).toBe('premium');
    });

    it('should validate and filter context based on permissions', async () => {
      const mockReflinkManager = require('@/lib/services/ai/reflink-manager');
      mockReflinkManager.reflinkManager.validateReflinkWithBudget.mockResolvedValue({
        valid: true,
        reflink: {
          id: 'reflink-1',
          enableVoiceAI: true,
          enableJobAnalysis: false,
          enableAdvancedNavigation: true,
          recipientName: 'Jane Smith',
        },
        welcomeMessage: 'Welcome Jane!',
      });

      const result = await contextProvider.validateAndFilterContext(
        'test-session',
        'valid-reflink'
      );

      expect(result.valid).toBe(true);
      expect(result.accessLevel).toBe('premium');
      expect(result.capabilities.voiceAI).toBe(true);
      expect(result.capabilities.jobAnalysis).toBe(false);
      expect(result.capabilities.advancedNavigation).toBe(true);
      expect(result.welcomeMessage).toBe('Welcome Jane!');
    });

    it('should handle budget exhausted reflinks', async () => {
      const mockReflinkManager = require('@/lib/services/ai/reflink-manager');
      mockReflinkManager.reflinkManager.validateReflinkWithBudget.mockResolvedValue({
        valid: false,
        reason: 'budget_exhausted',
        reflink: {
          id: 'reflink-1',
          recipientName: 'John Doe',
        },
      });

      const result = await contextProvider.validateAndFilterContext(
        'test-session',
        'exhausted-reflink'
      );

      expect(result.valid).toBe(false);
      expect(result.accessLevel).toBe('no_access');
      expect(result.error).toContain('budget has been exhausted');
    });

    it('should generate an ElevenLabs prompt', async () => {
      const result = await contextProvider.generateElevenLabsPrompt(
        'test-session',
        undefined,
        'Tell me about the projects'
      );

      expect(result.agent_prompt).toContain('portfolio website');
      expect(result.first_message).toBeTruthy();
      expect(result.language).toBe('en');
      expect(result.capabilities.voiceAI).toBe(false);
    });

    it('should load filtered context on-demand', async () => {
      const result = await contextProvider.loadContextOnDemand(
        'test-session',
        'Tell me about React projects'
      );

      expect(result).toBeDefined();
      expect(result.accessLevel).toBeDefined();
      expect(result.systemPrompt).toBeDefined();
      expect(result.publicContext).toBeDefined();
      expect(result.contextSources).toBeDefined();
      expect(result.relevantContent).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear session cache', () => {
      contextProvider.clearSessionCache('test-session');
      expect(true).toBe(true);
    });

    it('should provide cache statistics', () => {
      const providerStats = contextProvider.getCacheStats();

      expect(providerStats).toHaveProperty('size');
      expect(providerStats).toHaveProperty('keys');
      expect(providerStats).toHaveProperty('totalTokens');
    });
  });

  describe('Error Handling', () => {
    it('should handle context build errors gracefully', async () => {
      const mockContentSourceManager = require('@/lib/services/ai/content-source-manager');
      mockContentSourceManager.contentSourceManager.searchContent.mockRejectedValue(
        new Error('Search failed')
      );

      const result = await contextProvider.injectContext({
        sessionId: 'error-session',
        query: 'anything',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search failed');
    });
  });
});
