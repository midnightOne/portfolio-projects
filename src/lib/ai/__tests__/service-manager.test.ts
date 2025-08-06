/**
 * Tests for AI Service Manager
 */

import { AIServiceManager } from '../service-manager';
import { ProviderFactory } from '../provider-factory';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    aIModelConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    aIGeneralSettings: {
      findUnique: jest.fn(),
    },
  })),
}));

// Mock providers
jest.mock('../providers/openai-provider');
jest.mock('../providers/anthropic-provider');

describe('AIServiceManager', () => {
  let serviceManager: AIServiceManager;
  let mockOpenAIProvider: any;
  let mockAnthropicProvider: any;

  beforeEach(() => {
    // Reset environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    
    // Create mock providers
    mockOpenAIProvider = {
      name: 'openai',
      testConnection: jest.fn(),
      listModels: jest.fn(),
      chat: jest.fn(),
      estimateTokens: jest.fn(),
      calculateCost: jest.fn(),
    };
    
    mockAnthropicProvider = {
      name: 'anthropic',
      testConnection: jest.fn(),
      listModels: jest.fn(),
      chat: jest.fn(),
      estimateTokens: jest.fn(),
      calculateCost: jest.fn(),
    };
    
    // Mock ProviderFactory
    jest.spyOn(ProviderFactory, 'createAvailableProviders').mockReturnValue(new Map());
    
    serviceManager = new AIServiceManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableProviders', () => {
    it('should return status for all provider types even when not configured', async () => {
      const statuses = await serviceManager.getAvailableProviders();
      
      expect(statuses).toHaveLength(2);
      expect(statuses.map(s => s.name)).toEqual(['openai', 'anthropic']);
      expect(statuses.every(s => !s.configured)).toBe(true);
      expect(statuses.every(s => !s.connected)).toBe(true);
    });

    it('should show configured status when providers are available', async () => {
      // Mock configured providers
      const mockProviders = new Map();
      mockProviders.set('openai', mockOpenAIProvider);
      
      jest.spyOn(ProviderFactory, 'createAvailableProviders').mockReturnValue(mockProviders);
      mockOpenAIProvider.testConnection.mockResolvedValue(true);
      mockOpenAIProvider.listModels.mockResolvedValue(['gpt-4o', 'gpt-3.5-turbo']);
      
      serviceManager = new AIServiceManager();
      const statuses = await serviceManager.getAvailableProviders();
      
      const openaiStatus = statuses.find(s => s.name === 'openai');
      expect(openaiStatus?.configured).toBe(true);
      expect(openaiStatus?.connected).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('should return not configured error when provider is not available', async () => {
      const result = await serviceManager.testConnection('openai');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
      expect(result.error?.code).toBe('NOT_CONFIGURED');
    });

    it('should test connection successfully when provider is available', async () => {
      const mockProviders = new Map();
      mockProviders.set('openai', mockOpenAIProvider);
      
      jest.spyOn(ProviderFactory, 'createAvailableProviders').mockReturnValue(mockProviders);
      mockOpenAIProvider.testConnection.mockResolvedValue(true);
      mockOpenAIProvider.listModels.mockResolvedValue(['gpt-4o']);
      
      serviceManager = new AIServiceManager();
      const result = await serviceManager.testConnection('openai');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected successfully');
      expect(result.availableModels).toEqual(['gpt-4o']);
    });
  });

  describe('model configuration', () => {
    it('should get provider for model', () => {
      // Set up model configs
      serviceManager['modelConfigs'].set('openai', ['gpt-4o', 'gpt-3.5-turbo']);
      serviceManager['modelConfigs'].set('anthropic', ['claude-3-5-sonnet-20241022']);
      
      expect(serviceManager.getProviderForModel('gpt-4o')).toBe('openai');
      expect(serviceManager.getProviderForModel('claude-3-5-sonnet-20241022')).toBe('anthropic');
      expect(serviceManager.getProviderForModel('unknown-model')).toBeNull();
    });

    it('should check if model is configured', () => {
      serviceManager['modelConfigs'].set('openai', ['gpt-4o']);
      
      expect(serviceManager.isModelConfigured('gpt-4o')).toBe(true);
      expect(serviceManager.isModelConfigured('unknown-model')).toBe(false);
    });

    it('should get provider models', () => {
      const models = ['gpt-4o', 'gpt-3.5-turbo'];
      serviceManager['modelConfigs'].set('openai', models);
      
      expect(serviceManager.getProviderModels('openai')).toEqual(models);
      expect(serviceManager.getProviderModels('anthropic')).toEqual([]);
    });
  });

  describe('content editing', () => {
    beforeEach(() => {
      const mockProviders = new Map();
      mockProviders.set('openai', mockOpenAIProvider);
      
      jest.spyOn(ProviderFactory, 'createAvailableProviders').mockReturnValue(mockProviders);
      serviceManager = new AIServiceManager();
      serviceManager['modelConfigs'].set('openai', ['gpt-4o']);
    });

    it('should edit content successfully', async () => {
      mockOpenAIProvider.chat.mockResolvedValue({
        content: JSON.stringify({
          newText: 'Improved content',
          reasoning: 'Made it better',
          confidence: 0.9,
          warnings: []
        }),
        model: 'gpt-4o',
        tokensUsed: 100,
        cost: 0.001,
        finishReason: 'stop'
      });

      const request = {
        model: 'gpt-4o',
        operation: 'improve' as const,
        content: 'Original content',
        context: {
          projectTitle: 'Test Project',
          projectDescription: 'A test project',
          existingTags: ['test'],
          fullContent: 'Original content'
        }
      };

      const result = await serviceManager.editContent(request);
      
      expect(result.success).toBe(true);
      expect(result.changes.fullContent).toBe('Improved content');
      expect(result.reasoning).toBe('Made it better');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle content editing errors gracefully', async () => {
      mockOpenAIProvider.chat.mockRejectedValue(new Error('API Error'));

      const request = {
        model: 'gpt-4o',
        operation: 'improve' as const,
        content: 'Original content',
        context: {
          projectTitle: 'Test Project',
          projectDescription: 'A test project',
          existingTags: ['test'],
          fullContent: 'Original content'
        }
      };

      const result = await serviceManager.editContent(request);
      
      expect(result.success).toBe(false);
      expect(result.reasoning).toContain('Content editing failed');
      expect(result.warnings).toContain('AI content editing is currently unavailable');
    });

    it('should suggest tags successfully', async () => {
      mockOpenAIProvider.chat.mockResolvedValue({
        content: JSON.stringify({
          suggestions: {
            add: [
              { tag: 'javascript', confidence: 0.9, reasoning: 'Uses JS' }
            ],
            remove: [
              { tag: 'old-tag', reasoning: 'Not relevant' }
            ]
          },
          reasoning: 'Analysis complete'
        }),
        model: 'gpt-4o',
        tokensUsed: 50,
        cost: 0.0005,
        finishReason: 'stop'
      });

      const request = {
        model: 'gpt-4o',
        projectTitle: 'JS Project',
        projectDescription: 'A JavaScript project',
        articleContent: 'This project uses JavaScript',
        existingTags: ['old-tag']
      };

      const result = await serviceManager.suggestTags(request);
      
      expect(result.success).toBe(true);
      expect(result.suggestions.add).toHaveLength(1);
      expect(result.suggestions.add[0].tag).toBe('javascript');
      expect(result.suggestions.remove).toHaveLength(1);
    });
  });
});