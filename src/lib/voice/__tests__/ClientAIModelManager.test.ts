/**
 * ClientAIModelManager Tests
 * 
 * Tests for the client-side AI model manager with database-backed JSON configuration storage.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { 
  ClientAIModelManager, 
  ClientAIModelManagerError,
  getClientAIModelManager,
  resetClientAIModelManager
} from '../ClientAIModelManager';
import { OpenAIRealtimeSerializer } from '../config-serializers/OpenAIRealtimeSerializer';
import { ElevenLabsSerializer } from '../config-serializers/ElevenLabsSerializer';

// Mock Prisma Client
const mockPrisma = {
  voiceProviderConfig: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
  }
} as unknown as PrismaClient;

describe('ClientAIModelManager', () => {
  let manager: ClientAIModelManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ClientAIModelManager(mockPrisma, { autoReload: false });
  });
  
  afterEach(() => {
    manager.destroy();
    resetClientAIModelManager();
  });

  describe('Configuration Management', () => {
    it('should save OpenAI configuration successfully', async () => {
      const openaiSerializer = new OpenAIRealtimeSerializer();
      const config = openaiSerializer.getDefaultConfig();
      
      const mockRecord = {
        id: 'test-id',
        provider: 'openai',
        name: 'Professional',
        isDefault: true,
        configJson: JSON.stringify(config),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (mockPrisma.voiceProviderConfig.updateMany as any).mockResolvedValue({ count: 0 });
      (mockPrisma.voiceProviderConfig.upsert as any).mockResolvedValue(mockRecord);
      
      const result = await manager.saveProviderConfig('openai', 'Professional', config, true);
      
      expect(result.provider).toBe('openai');
      expect(result.name).toBe('Professional');
      expect(result.isDefault).toBe(true);
      expect(result.config).toEqual(config);
    });

    it('should save ElevenLabs configuration successfully', async () => {
      const elevenLabsSerializer = new ElevenLabsSerializer();
      const config = elevenLabsSerializer.getDefaultConfig();
      config.agentId = 'test-agent-id';
      config.voiceId = 'test-voice-id';
      
      const mockRecord = {
        id: 'test-id',
        provider: 'elevenlabs',
        name: 'Casual',
        isDefault: false,
        configJson: JSON.stringify(config),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (mockPrisma.voiceProviderConfig.upsert as any).mockResolvedValue(mockRecord);
      
      const result = await manager.saveProviderConfig('elevenlabs', 'Casual', config, false);
      
      expect(result.provider).toBe('elevenlabs');
      expect(result.name).toBe('Casual');
      expect(result.isDefault).toBe(false);
      expect(result.config).toEqual(config);
    });

    it('should validate configuration before saving', async () => {
      const invalidConfig = {
        provider: 'openai',
        enabled: true,
        displayName: '', // Invalid: empty display name
        description: 'Test config',
        version: '1.0.0'
      } as any;
      
      await expect(
        manager.saveProviderConfig('openai', 'Invalid', invalidConfig)
      ).rejects.toThrow('Configuration validation failed');
    });

    it('should handle default configuration logic correctly', async () => {
      const openaiSerializer = new OpenAIRealtimeSerializer();
      const config = openaiSerializer.getDefaultConfig();
      
      const mockRecord = {
        id: 'test-id',
        provider: 'openai',
        name: 'New Default',
        isDefault: true,
        configJson: JSON.stringify(config),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (mockPrisma.voiceProviderConfig.updateMany as any).mockResolvedValue({ count: 1 });
      (mockPrisma.voiceProviderConfig.upsert as any).mockResolvedValue(mockRecord);
      
      await manager.saveProviderConfig('openai', 'New Default', config, true);
      
      // Should have called updateMany to unset previous defaults
      expect(mockPrisma.voiceProviderConfig.updateMany).toHaveBeenCalledWith({
        where: { 
          provider: 'openai',
          isDefault: true
        },
        data: { isDefault: false }
      });
    });
  });

  describe('Configuration Retrieval', () => {
    it('should get provider configuration by name', async () => {
      const openaiSerializer = new OpenAIRealtimeSerializer();
      const config = openaiSerializer.getDefaultConfig();
      
      const mockRecord = {
        id: 'test-id',
        provider: 'openai',
        name: 'Professional',
        isDefault: false,
        configJson: JSON.stringify(config),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (mockPrisma.voiceProviderConfig.findUnique as any).mockResolvedValue(mockRecord);
      
      const result = await manager.getProviderConfig('openai', 'Professional');
      
      expect(result).toBeTruthy();
      expect(result!.name).toBe('Professional');
      expect(result!.config).toEqual(config);
    });

    it('should get default provider configuration', async () => {
      const openaiSerializer = new OpenAIRealtimeSerializer();
      const config = openaiSerializer.getDefaultConfig();
      
      const mockRecord = {
        id: 'test-id',
        provider: 'openai',
        name: 'Default',
        isDefault: true,
        configJson: JSON.stringify(config),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (mockPrisma.voiceProviderConfig.findFirst as any).mockResolvedValue(mockRecord);
      
      const result = await manager.getProviderConfig('openai');
      
      expect(result).toBeTruthy();
      expect(result!.isDefault).toBe(true);
      expect(result!.config).toEqual(config);
    });

    it('should return null for non-existent configuration', async () => {
      (mockPrisma.voiceProviderConfig.findUnique as any).mockResolvedValue(null);
      
      const result = await manager.getProviderConfig('openai', 'NonExistent');
      
      expect(result).toBeNull();
    });

    it('should get all configurations for a provider', async () => {
      const openaiSerializer = new OpenAIRealtimeSerializer();
      const config1 = openaiSerializer.getDefaultConfig();
      const config2 = { ...config1, displayName: 'Config 2' };
      
      const mockRecords = [
        {
          id: 'test-id-1',
          provider: 'openai',
          name: 'Config 1',
          isDefault: true,
          configJson: JSON.stringify(config1),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'test-id-2',
          provider: 'openai',
          name: 'Config 2',
          isDefault: false,
          configJson: JSON.stringify(config2),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      (mockPrisma.voiceProviderConfig.findMany as any).mockResolvedValue(mockRecords);
      
      const result = await manager.getAllProviderConfigs('openai');
      
      expect(result).toHaveLength(2);
      expect(result[0].isDefault).toBe(true);
      expect(result[1].isDefault).toBe(false);
    });
  });

  describe('Configuration Deletion', () => {
    it('should delete configuration successfully', async () => {
      const mockRecord = {
        id: 'test-id',
        provider: 'openai',
        name: 'ToDelete'
      };
      
      (mockPrisma.voiceProviderConfig.delete as any).mockResolvedValue(mockRecord);
      
      const result = await manager.deleteProviderConfig('openai', 'ToDelete');
      
      expect(result).toBe(true);
      expect(mockPrisma.voiceProviderConfig.delete).toHaveBeenCalledWith({
        where: {
          provider_name: {
            provider: 'openai',
            name: 'ToDelete'
          }
        }
      });
    });

    it('should return false for non-existent configuration', async () => {
      const error = new Error('Record not found');
      (error as any).code = 'P2025';
      (mockPrisma.voiceProviderConfig.delete as any).mockRejectedValue(error);
      
      const result = await manager.deleteProviderConfig('openai', 'NonExistent');
      
      expect(result).toBe(false);
    });
  });

  describe('Default Provider Management', () => {
    it('should get default provider', async () => {
      const mockRecords = [
        { provider: 'openai' }
      ];
      
      (mockPrisma.voiceProviderConfig.findMany as any).mockResolvedValue(mockRecords);
      
      const result = await manager.getDefaultProvider();
      
      expect(result).toBe('openai');
    });

    it('should return null when no default provider exists', async () => {
      (mockPrisma.voiceProviderConfig.findMany as any).mockResolvedValue([]);
      
      const result = await manager.getDefaultProvider();
      
      expect(result).toBeNull();
    });

    it('should set default provider', async () => {
      (mockPrisma.voiceProviderConfig.updateMany as any)
        .mockResolvedValueOnce({ count: 1 }) // Unset previous defaults
        .mockResolvedValueOnce({ count: 1 }); // Set new default
      
      const result = await manager.setDefaultProvider('openai', 'Professional');
      
      expect(result).toBe(true);
      expect(mockPrisma.voiceProviderConfig.updateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate OpenAI configuration', () => {
      const openaiSerializer = new OpenAIRealtimeSerializer();
      const validConfig = openaiSerializer.getDefaultConfig();
      
      const result = manager.validateConfig('openai', validConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid configuration', () => {
      const invalidConfig = {
        provider: 'openai',
        enabled: true,
        displayName: '', // Invalid
        description: 'Test'
      };
      
      const result = manager.validateConfig('openai', invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache configurations', async () => {
      const openaiSerializer = new OpenAIRealtimeSerializer();
      const config = openaiSerializer.getDefaultConfig();
      
      const mockRecord = {
        id: 'test-id',
        provider: 'openai',
        name: 'Cached',
        isDefault: false,
        configJson: JSON.stringify(config),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (mockPrisma.voiceProviderConfig.findUnique as any).mockResolvedValue(mockRecord);
      
      // First call should hit database
      const result1 = await manager.getProviderConfig('openai', 'Cached');
      expect(mockPrisma.voiceProviderConfig.findUnique).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const result2 = await manager.getProviderConfig('openai', 'Cached');
      expect(mockPrisma.voiceProviderConfig.findUnique).toHaveBeenCalledTimes(1);
      
      expect(result1).toEqual(result2);
    });

    it('should clear cache when saving configuration', async () => {
      const openaiSerializer = new OpenAIRealtimeSerializer();
      const config = openaiSerializer.getDefaultConfig();
      
      const mockRecord = {
        id: 'test-id',
        provider: 'openai',
        name: 'Test',
        isDefault: false,
        configJson: JSON.stringify(config),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (mockPrisma.voiceProviderConfig.findUnique as any).mockResolvedValue(mockRecord);
      (mockPrisma.voiceProviderConfig.upsert as any).mockResolvedValue(mockRecord);
      
      // Cache a configuration
      await manager.getProviderConfig('openai', 'Test');
      expect(mockPrisma.voiceProviderConfig.findUnique).toHaveBeenCalledTimes(1);
      
      // Save configuration (should clear cache)
      await manager.saveProviderConfig('openai', 'Test', config);
      
      // Next get should hit database again
      await manager.getProviderConfig('openai', 'Test');
      expect(mockPrisma.voiceProviderConfig.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('Statistics', () => {
    it('should get configuration statistics', async () => {
      const mockRecords = [
        { provider: 'openai', name: 'Config 1', isDefault: true },
        { provider: 'openai', name: 'Config 2', isDefault: false },
        { provider: 'elevenlabs', name: 'Config 3', isDefault: true }
      ];
      
      (mockPrisma.voiceProviderConfig.findMany as any).mockResolvedValue(mockRecords);
      
      const stats = await manager.getConfigurationStats();
      
      expect(stats.totalConfigs).toBe(3);
      expect(stats.configsByProvider.openai).toBe(2);
      expect(stats.configsByProvider.elevenlabs).toBe(1);
      expect(stats.defaultConfigs.openai).toBe('Config 1');
      expect(stats.defaultConfigs.elevenlabs).toBe('Config 3');
    });
  });

  describe('Error Handling', () => {
    it('should throw ClientAIModelManagerError for database errors', async () => {
      const dbError = new Error('Database connection failed');
      (mockPrisma.voiceProviderConfig.findUnique as any).mockRejectedValue(dbError);
      
      await expect(
        manager.getProviderConfig('openai', 'Test')
      ).rejects.toThrow(ClientAIModelManagerError);
    });

    it('should handle serialization errors', async () => {
      const mockRecord = {
        id: 'test-id',
        provider: 'openai',
        name: 'Invalid',
        isDefault: false,
        configJson: 'invalid json',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (mockPrisma.voiceProviderConfig.findUnique as any).mockResolvedValue(mockRecord);
      
      await expect(
        manager.getProviderConfig('openai', 'Invalid')
      ).rejects.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getClientAIModelManager', () => {
      const instance1 = getClientAIModelManager();
      const instance2 = getClientAIModelManager();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = getClientAIModelManager();
      resetClientAIModelManager();
      const instance2 = getClientAIModelManager();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});