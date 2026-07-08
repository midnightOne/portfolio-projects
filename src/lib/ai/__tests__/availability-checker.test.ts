/**
 * Tests for AI Availability Checker.
 *
 * The checker is client-side: it reads provider statuses from
 * GET /api/admin/ai/providers (it does NOT instantiate AIServiceManager),
 * so the harness mocks fetch with the API's response envelope.
 */

import { AIAvailabilityChecker } from '../availability-checker';

const fetchMock = global.fetch as jest.Mock;

function mockProvidersResponse(statuses: Array<Record<string, unknown>>) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: statuses }),
  });
}

const connectedOpenAI = {
  name: 'openai',
  configured: true,
  connected: true,
  error: undefined,
  models: ['gpt-4', 'gpt-3.5-turbo'],
  lastTested: new Date().toISOString(),
};

const unconfiguredOpenAI = {
  name: 'openai',
  configured: false,
  connected: false,
  error: 'OPENAI_API_KEY environment variable not set',
  models: [],
  lastTested: new Date().toISOString(),
};

describe('AIAvailabilityChecker', () => {
  let checker: AIAvailabilityChecker;

  beforeEach(() => {
    jest.clearAllMocks();
    checker = AIAvailabilityChecker.getInstance();
    checker.clearCache();
  });

  describe('checkAvailability', () => {
    it('should return available when providers are configured and connected', async () => {
      mockProvidersResponse([
        connectedOpenAI,
        { ...connectedOpenAI, name: 'anthropic', models: ['claude-3-sonnet'] },
      ]);

      const status = await checker.checkAvailability();

      expect(status.available).toBe(true);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet']);
      expect(status.unavailableReasons).toHaveLength(0);
    });

    it('should return unavailable when no providers are configured', async () => {
      mockProvidersResponse([unconfiguredOpenAI]);

      const status = await checker.checkAvailability();

      expect(status.available).toBe(false);
      expect(status.hasConfiguredProviders).toBe(false);
      expect(status.hasConnectedProviders).toBe(false);
      expect(status.availableModels).toHaveLength(0);
      expect(status.unavailableReasons).toContain('No AI providers are configured');
      expect(status.suggestions).toContain('Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables');
    });

    it('should return unavailable when providers are configured but not connected', async () => {
      mockProvidersResponse([
        { ...unconfiguredOpenAI, configured: true, error: 'Invalid API key' },
      ]);

      const status = await checker.checkAvailability();

      expect(status.available).toBe(false);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(false);
      expect(status.unavailableReasons).toContain('No AI providers are connected');
      expect(status.unavailableReasons).toContain('openai: Invalid API key');
      expect(status.suggestions).toContain('Check your API keys are valid and active');
    });

    it('should return unavailable when providers are connected but no models configured', async () => {
      mockProvidersResponse([{ ...connectedOpenAI, models: [] }]);

      const status = await checker.checkAvailability();

      expect(status.available).toBe(false);
      expect(status.hasConfiguredProviders).toBe(true);
      expect(status.hasConnectedProviders).toBe(true);
      expect(status.availableModels).toHaveLength(0);
      expect(status.unavailableReasons).toContain('No AI models are configured');
      expect(status.suggestions).toContain('Configure models for your connected providers in AI Settings');
    });

    it('should handle errors gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const status = await checker.checkAvailability();

      expect(status.available).toBe(false);
      expect(status.unavailableReasons).toContain('Unable to check AI service status');
      expect(status.suggestions).toContain('Check your internet connection');
    });

    it('should cache results for performance', async () => {
      mockProvidersResponse([{ ...connectedOpenAI, models: ['gpt-4'] }]);

      const status1 = await checker.checkAvailability();
      const status2 = await checker.checkAvailability();

      expect(status1).toEqual(status2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache when forced', async () => {
      mockProvidersResponse([{ ...connectedOpenAI, models: ['gpt-4'] }]);

      await checker.checkAvailability();
      await checker.checkAvailability(true);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/admin/ai/providers?refresh=true',
        expect.anything()
      );
    });
  });

  describe('isAIEnabled', () => {
    it('should return true when AI is available', async () => {
      mockProvidersResponse([{ ...connectedOpenAI, models: ['gpt-4'] }]);
      expect(await checker.isAIEnabled()).toBe(true);
    });

    it('should return false when AI is not available', async () => {
      mockProvidersResponse([unconfiguredOpenAI]);
      expect(await checker.isAIEnabled()).toBe(false);
    });
  });

  describe('getStatusMessage', () => {
    it('should return appropriate status messages', async () => {
      mockProvidersResponse([connectedOpenAI]);
      const message = await checker.getStatusMessage();
      expect(message).toContain('AI features are available with 2 models');
    });

    it('should return disabled message when not configured', async () => {
      mockProvidersResponse([unconfiguredOpenAI]);
      const message = await checker.getStatusMessage();
      expect(message).toContain('AI features are disabled - no providers configured');
    });
  });

  describe('getConfigurationGuidance', () => {
    it('should provide setup guidance when not configured', async () => {
      mockProvidersResponse([unconfiguredOpenAI]);
      const guidance = await checker.getConfigurationGuidance();
      expect(guidance.title).toBe('AI Setup Required');
      expect(guidance.actions.some((a) => a.label === 'Set Environment Variables')).toBe(true);
    });

    it('should provide connection guidance when configured but not connected', async () => {
      mockProvidersResponse([
        { ...unconfiguredOpenAI, configured: true, error: 'Invalid API key' },
      ]);
      const guidance = await checker.getConfigurationGuidance();
      expect(guidance.title).toBe('Connection Issues');
    });
  });

  describe('isModelAvailable', () => {
    it('should check if specific model is available', async () => {
      mockProvidersResponse([{ ...connectedOpenAI, models: ['gpt-4'] }]);
      expect(await checker.isModelAvailable('gpt-4')).toBe(true);
      expect(await checker.isModelAvailable('nonexistent-model')).toBe(false);
    });
  });
});
