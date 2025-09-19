/**
 * Content Source Manager Tests
 * Tests for the flexible content source system
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ContentSourceManager, ContentSourceProvider } from '@/lib/services/ai/content-source-manager';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock content source provider for testing
class MockContentProvider implements ContentSourceProvider {
  id = 'mock-provider';
  type = 'custom' as const;
  name = 'Mock Provider';
  description = 'Test provider for unit tests';
  version = '1.0.0';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getMetadata() {
    return {
      lastUpdated: new Date(),
      itemCount: 5,
      size: 1024,
      tags: ['test', 'mock'],
      summary: 'Mock provider for testing'
    };
  }

  async searchContent(query: string) {
    return [{
      id: 'mock-content-1',
      type: 'custom' as const,
      title: 'Mock Content',
      content: `Mock content matching query: ${query}`,
      summary: 'Mock content summary',
      relevanceScore: 0.8,
      keywords: ['mock', 'test']
    }];
  }
}

describe('ContentSourceManager', () => {
  let manager: ContentSourceManager;
  let mockProvider: MockContentProvider;

  beforeEach(() => {
    // Reset the singleton instance
    (ContentSourceManager as any).instance = undefined;
    manager = ContentSourceManager.getInstance();
    mockProvider = new MockContentProvider();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Provider Registration', () => {
    it('should register a content source provider', () => {
      manager.registerProvider(mockProvider);
      
      const providers = manager.getProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('mock-provider');
    });

    it('should unregister a content source provider', () => {
      manager.registerProvider(mockProvider);
      expect(manager.getProviders()).toHaveLength(1);
      
      manager.unregisterProvider('mock-provider');
      expect(manager.getProviders()).toHaveLength(0);
    });

    it('should get a specific provider by ID', () => {
      manager.registerProvider(mockProvider);
      
      const provider = manager.getProvider('mock-provider');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('mock-provider');
    });

    it('should return undefined for non-existent provider', () => {
      const provider = manager.getProvider('non-existent');
      expect(provider).toBeUndefined();
    });
  });

  describe('Auto-Discovery', () => {
    it('should auto-discover built-in content sources', async () => {
      // Mock API responses for built-in providers
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation((url) => {
        if (typeof url === 'string') {
          if (url.includes('/api/projects')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ data: { projects: [] } })
            } as Response);
          }
          if (url.includes('/api/homepage-config-public')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ 
                data: { 
                  config: { 
                    sections: [
                      { type: 'about', config: { content: 'Test about content', skills: ['JavaScript', 'React'] } }
                    ] 
                  } 
                } 
              })
            } as Response);
          }
          if (url.includes('/api/admin/ai/content-sources')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ data: { configs: [] } })
            } as Response);
          }
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      await manager.autoDiscoverSources();
      
      const providers = manager.getProviders();
      expect(providers.length).toBeGreaterThan(0);
      
      // Should include built-in providers
      const providerIds = providers.map(p => p.id);
      expect(providerIds).toContain('projects');
      expect(providerIds).toContain('about');
    });
  });

  describe('Available Sources', () => {
    it('should get available sources with configurations', async () => {
      manager.registerProvider(mockProvider);
      
      const sources = await manager.getAvailableSources();
      expect(sources).toHaveLength(1);
      expect(sources[0].id).toBe('mock-provider');
      expect(sources[0].enabled).toBe(true); // Default enabled
      expect(sources[0].priority).toBe(50); // Default priority
    });

    it('should filter out unavailable sources', async () => {
      const unavailableProvider = new MockContentProvider();
      unavailableProvider.id = 'unavailable-provider';
      unavailableProvider.isAvailable = async () => false;
      
      manager.registerProvider(mockProvider);
      manager.registerProvider(unavailableProvider);
      
      const sources = await manager.getAvailableSources();
      expect(sources).toHaveLength(1);
      expect(sources[0].id).toBe('mock-provider');
    });
  });

  describe('Content Search', () => {
    it('should search content across enabled sources', async () => {
      manager.registerProvider(mockProvider);
      await manager.updateSourceConfig('mock-provider', { enabled: true });
      
      const results = await manager.searchContent('test query');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('test query');
    });

    it('should not search disabled sources', async () => {
      manager.registerProvider(mockProvider);
      await manager.updateSourceConfig('mock-provider', { enabled: false });
      
      const results = await manager.searchContent('test query');
      expect(results).toHaveLength(0);
    });

    it('should apply priority weighting to relevance scores', async () => {
      manager.registerProvider(mockProvider);
      await manager.updateSourceConfig('mock-provider', { enabled: true, priority: 80 });
      
      const results = await manager.searchContent('test query');
      expect(results).toHaveLength(1);
      expect(results[0].relevanceScore).toBe(0.8 * 0.8); // Original score * priority weight
    });

    it('should limit results when maxResults is specified', async () => {
      // Create multiple mock providers
      for (let i = 0; i < 5; i++) {
        const provider = new MockContentProvider();
        provider.id = `mock-provider-${i}`;
        manager.registerProvider(provider);
        await manager.updateSourceConfig(provider.id, { enabled: true });
      }
      
      const results = await manager.searchContent('test query', { maxResults: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Configuration Management', () => {
    it('should update source configuration', async () => {
      manager.registerProvider(mockProvider);
      
      await manager.updateSourceConfig('mock-provider', {
        enabled: false,
        priority: 75,
        config: { customSetting: 'test' }
      });
      
      const config = manager.getSourceConfig('mock-provider');
      expect(config?.enabled).toBe(false);
      expect(config?.priority).toBe(75);
      expect(config?.config.customSetting).toBe('test');
    });

    it('should toggle source enabled state', async () => {
      manager.registerProvider(mockProvider);
      
      await manager.toggleSource('mock-provider', false);
      let config = manager.getSourceConfig('mock-provider');
      expect(config?.enabled).toBe(false);
      
      await manager.toggleSource('mock-provider', true);
      config = manager.getSourceConfig('mock-provider');
      expect(config?.enabled).toBe(true);
    });

    it('should set source priority', async () => {
      manager.registerProvider(mockProvider);
      
      await manager.setSourcePriority('mock-provider', 90);
      const config = manager.getSourceConfig('mock-provider');
      expect(config?.priority).toBe(90);
    });

    it('should validate priority range', async () => {
      manager.registerProvider(mockProvider);
      
      await expect(manager.setSourcePriority('mock-provider', -10))
        .rejects.toThrow('Priority must be between 0 and 100');
      
      await expect(manager.setSourcePriority('mock-provider', 150))
        .rejects.toThrow('Priority must be between 0 and 100');
    });

    it('should throw error for non-existent provider', async () => {
      await expect(manager.updateSourceConfig('non-existent', { enabled: false }))
        .rejects.toThrow('Provider non-existent not found');
    });
  });

  describe('Provider Validation', () => {
    it('should validate configuration if provider supports it', async () => {
      const validatingProvider = new MockContentProvider();
      validatingProvider.id = 'validating-provider';
      (validatingProvider as any).validateConfig = async (config: any) => {
        if (config.invalidSetting) {
          return {
            isValid: false,
            errors: ['Invalid setting provided'],
            warnings: []
          };
        }
        return { isValid: true, errors: [], warnings: [] };
      };
      
      manager.registerProvider(validatingProvider);
      
      await expect(manager.updateSourceConfig('validating-provider', {
        config: { invalidSetting: true }
      })).rejects.toThrow('Invalid configuration: Invalid setting provided');
    });

    it('should call onConfigChange if provider supports it', async () => {
      const changeHandler = jest.fn();
      const configurableProvider = new MockContentProvider();
      configurableProvider.id = 'configurable-provider';
      (configurableProvider as any).onConfigChange = changeHandler;
      
      manager.registerProvider(configurableProvider);
      
      await manager.updateSourceConfig('configurable-provider', {
        config: { newSetting: 'value' }
      });
      
      expect(changeHandler).toHaveBeenCalledWith({ newSetting: 'value' });
    });
  });

  describe('Schema Support', () => {
    it('should return schema if provider supports it', async () => {
      const schemaProvider = new MockContentProvider();
      schemaProvider.id = 'schema-provider';
      (schemaProvider as any).getSchema = () => ({
        configFields: [
          {
            key: 'testField',
            type: 'string',
            label: 'Test Field',
            required: false,
            defaultValue: 'default'
          }
        ],
        searchFilters: [],
        outputFormat: {
          fields: ['title', 'content'],
          supportedFormats: ['text', 'json']
        }
      });
      
      manager.registerProvider(schemaProvider);
      
      const schema = await manager.getSourceSchema('schema-provider');
      expect(schema).toBeDefined();
      expect(schema?.configFields).toHaveLength(1);
      expect(schema?.configFields[0].key).toBe('testField');
    });

    it('should return null for providers without schema support', async () => {
      manager.registerProvider(mockProvider);
      
      const schema = await manager.getSourceSchema('mock-provider');
      expect(schema).toBeNull();
    });
  });
});