/**
 * Integration tests for AI Service Manager
 */

import { AIServiceManager } from '../service-manager';

describe('AIServiceManager Integration', () => {
  let serviceManager: AIServiceManager;

  beforeEach(() => {
    serviceManager = new AIServiceManager();
  });

  it('should initialize without errors', () => {
    expect(serviceManager).toBeInstanceOf(AIServiceManager);
  });

  it('should handle no configured providers gracefully', async () => {
    const providers = await serviceManager.getAvailableProviders();
    
    expect(providers).toHaveLength(2);
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
      expect(['openai', 'anthropic']).toContain(config.provider);
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

    await expect(serviceManager.editContent(request)).rejects.toThrow('Model gpt-4o is not configured');
  });

  it('should handle tag suggestions with unconfigured model gracefully', async () => {
    const request = {
      model: 'gpt-4o',
      projectTitle: 'Test Project',
      projectDescription: 'A test project',
      articleContent: 'Test content',
      existingTags: ['test']
    };

    await expect(serviceManager.suggestTags(request)).rejects.toThrow('Model gpt-4o is not configured');
  });
});