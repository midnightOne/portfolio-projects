/**
 * Integration tests for AI Service Manager
 */

import { AIServiceManager } from '../service-manager';

describe('AIServiceManager Integration', () => {
  let serviceManager: AIServiceManager;
  const savedEnv: Record<string, string | undefined> = {};
  const PROVIDER_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'];

  beforeEach(() => {
    // next/jest loads .env, so real keys leak in — the "unconfigured" cases
    // below need a clean slate.
    for (const key of PROVIDER_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    serviceManager = new AIServiceManager();
  });

  afterEach(() => {
    for (const key of PROVIDER_KEYS) {
      if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
    }
  });

  it('should initialize without errors', () => {
    expect(serviceManager).toBeInstanceOf(AIServiceManager);
  });

  it('should handle no configured providers gracefully', async () => {
    const providers = await serviceManager.getAvailableProviders();
    
    expect(providers).toHaveLength(3);
    expect(providers.every(p => !p.configured)).toBe(true);
    expect(providers.every(p => !p.connected)).toBe(true);
  });

  it('should return model configs from database', async () => {
    const configs = await serviceManager.getConfiguredModels();
    expect(configs).toBeInstanceOf(Array);
    expect(configs.length).toBeGreaterThanOrEqual(0);
    
    // If configs exist, they should have the right structure
    configs.forEach(config => {
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('models');
      expect(['openai', 'anthropic', 'google']).toContain(config.provider);
      expect(Array.isArray(config.models)).toBe(true);
    });
  });

  it('should handle model queries with no configured models', () => {
    expect(serviceManager.getProviderModels('openai')).toEqual([]);
    expect(serviceManager.getProviderModels('anthropic')).toEqual([]);
    expect(serviceManager.isModelConfigured('gpt-4o')).toBe(false);
    expect(serviceManager.getProviderForModel('gpt-4o')).toBeNull();
  });

  it('should handle content editing with unconfigured model gracefully', async () => {
    const request = {
      model: 'gpt-4o',
      operation: 'improve' as const,
      content: 'Test content',
      context: {
        projectTitle: 'Test Project',
        projectDescription: 'A test project',
        existingTags: ['test'],
        fullContent: 'Test content'
      }
    };

    // The manager resolves with a failure envelope now (errors are mapped by
    // AIErrorHandler, never thrown at callers).
    const result = await serviceManager.editContent(request);
    expect(result.success).toBe(false);
    expect(result.changes).toEqual({});
  });

  it('should handle tag suggestions with unconfigured model gracefully', async () => {
    const request = {
      model: 'gpt-4o',
      projectTitle: 'Test Project',
      projectDescription: 'A test project',
      articleContent: 'Test content',
      existingTags: ['test']
    };

    const result = await serviceManager.suggestTags(request);
    expect(result.success).toBe(false);
    expect(result.suggestions).toEqual({ add: [], remove: [] });
  });
});