/**
 * ClientAIModelManager Integration Tests
 * 
 * Tests the ClientAIModelManager with actual database integration.
 * These tests require a running database connection.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { 
  ClientAIModelManager,
  resetClientAIModelManager
} from '../ClientAIModelManager';
import { OpenAIRealtimeSerializer } from '../config-serializers/OpenAIRealtimeSerializer';
import { ElevenLabsSerializer } from '../config-serializers/ElevenLabsSerializer';

// Skip these tests if no database is available
const shouldSkip = !process.env.DATABASE_URL;

const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('ClientAIModelManager Integration Tests', () => {
  let prisma: PrismaClient;
  let manager: ClientAIModelManager;
  
  beforeAll(async () => {
    
    prisma = new PrismaClient();
    
    // Test database connection
    try {
      await prisma.$connect();
    } catch (error) {
      console.warn('Database connection failed, skipping integration tests');
      return;
    }
  });
  
  afterAll(async () => {
    if (!prisma) return;
    
    try {
      await prisma.$disconnect();
    } catch (error) {
      // Ignore disconnect errors in test environment
      console.warn('Prisma disconnect error (expected in test environment):', error);
    }
    resetClientAIModelManager();
  });
  
  beforeEach(async () => {
    if (!prisma) return;
    
    // Clean up any existing test data
    await prisma.voiceProviderConfig.deleteMany({
      where: {
        name: {
          startsWith: 'Test'
        }
      }
    });
    
    manager = new ClientAIModelManager(prisma, { autoReload: false });
  });

  it('should save and retrieve OpenAI configuration from database', async () => {
    
    const serializer = new OpenAIRealtimeSerializer();
    const config = serializer.getDefaultConfig();
    config.displayName = 'Test OpenAI Config';
    config.description = 'Integration test configuration';
    
    // Save configuration
    const saved = await manager.saveProviderConfig('openai', 'TestOpenAI', config, true);
    
    expect(saved.id).toBeDefined();
    expect(saved.provider).toBe('openai');
    expect(saved.name).toBe('TestOpenAI');
    expect(saved.isDefault).toBe(true);
    expect(saved.config.displayName).toBe('Test OpenAI Config');
    
    // Retrieve configuration
    const retrieved = await manager.getProviderConfig('openai', 'TestOpenAI');
    
    expect(retrieved).toBeTruthy();
    expect(retrieved!.id).toBe(saved.id);
    expect(retrieved!.config).toEqual(config);
    
    // Verify it's in the database
    const dbRecord = await prisma.voiceProviderConfig.findUnique({
      where: {
        provider_name: {
          provider: 'openai',
          name: 'TestOpenAI'
        }
      }
    });
    
    expect(dbRecord).toBeTruthy();
    expect(dbRecord!.isDefault).toBe(true);
  });

  it('should save and retrieve ElevenLabs configuration from database', async () => {
    
    const serializer = new ElevenLabsSerializer();
    const config = serializer.getDefaultConfig();
    config.displayName = 'Test ElevenLabs Config';
    config.description = 'Integration test configuration';
    config.agentId = 'test-agent-123';
    config.voiceId = 'test-voice-456';
    
    // Save configuration
    const saved = await manager.saveProviderConfig('elevenlabs', 'TestElevenLabs', config, false);
    
    expect(saved.provider).toBe('elevenlabs');
    expect(saved.name).toBe('TestElevenLabs');
    expect(saved.isDefault).toBe(false);
    expect(saved.config.agentId).toBe('test-agent-123');
    
    // Retrieve configuration
    const retrieved = await manager.getProviderConfig('elevenlabs', 'TestElevenLabs');
    
    expect(retrieved).toBeTruthy();
    expect(retrieved!.config).toEqual(config);
  });

  it('should handle default configuration switching', async () => {
    
    const serializer = new OpenAIRealtimeSerializer();
    
    // Create two configurations
    const config1 = { ...serializer.getDefaultConfig(), displayName: 'Config 1' };
    const config2 = { ...serializer.getDefaultConfig(), displayName: 'Config 2' };
    
    // Save first as default
    await manager.saveProviderConfig('openai', 'TestConfig1', config1, true);
    
    // Save second as non-default
    await manager.saveProviderConfig('openai', 'TestConfig2', config2, false);
    
    // Verify first is default
    let defaultConfig = await manager.getProviderConfig('openai');
    expect(defaultConfig?.name).toBe('TestConfig1');
    
    // Switch default to second
    await manager.setDefaultProvider('openai', 'TestConfig2');
    
    // Verify second is now default
    defaultConfig = await manager.getProviderConfig('openai');
    expect(defaultConfig?.name).toBe('TestConfig2');
    
    // Verify in database
    const dbRecords = await prisma.voiceProviderConfig.findMany({
      where: { provider: 'openai' },
      select: { name: true, isDefault: true }
    });
    
    const defaultRecord = dbRecords.find(r => r.isDefault);
    expect(defaultRecord?.name).toBe('TestConfig2');
  });

  it('should delete configuration from database', async () => {
    
    const serializer = new OpenAIRealtimeSerializer();
    const config = serializer.getDefaultConfig();
    
    // Save configuration
    await manager.saveProviderConfig('openai', 'TestDelete', config);
    
    // Verify it exists
    let retrieved = await manager.getProviderConfig('openai', 'TestDelete');
    expect(retrieved).toBeTruthy();
    
    // Delete configuration
    const deleted = await manager.deleteProviderConfig('openai', 'TestDelete');
    expect(deleted).toBe(true);
    
    // Verify it's gone
    retrieved = await manager.getProviderConfig('openai', 'TestDelete');
    expect(retrieved).toBeNull();
    
    // Verify it's gone from database
    const dbRecord = await prisma.voiceProviderConfig.findUnique({
      where: {
        provider_name: {
          provider: 'openai',
          name: 'TestDelete'
        }
      }
    });
    
    expect(dbRecord).toBeNull();
  });

  it('should get all configurations for a provider', async () => {
    
    const serializer = new OpenAIRealtimeSerializer();
    
    // Create multiple configurations
    const configs = [
      { name: 'TestMulti1', config: { ...serializer.getDefaultConfig(), displayName: 'Multi 1' }, isDefault: true },
      { name: 'TestMulti2', config: { ...serializer.getDefaultConfig(), displayName: 'Multi 2' }, isDefault: false },
      { name: 'TestMulti3', config: { ...serializer.getDefaultConfig(), displayName: 'Multi 3' }, isDefault: false }
    ];
    
    // Save all configurations
    for (const { name, config, isDefault } of configs) {
      await manager.saveProviderConfig('openai', name, config, isDefault);
    }
    
    // Retrieve all configurations
    const allConfigs = await manager.getAllProviderConfigs('openai');
    
    expect(allConfigs.length).toBeGreaterThanOrEqual(3);
    
    // Find our test configs
    const testConfigs = allConfigs.filter(c => c.name.startsWith('TestMulti'));
    expect(testConfigs).toHaveLength(3);
    
    // Verify default is first (due to ordering)
    expect(testConfigs[0].isDefault).toBe(true);
    expect(testConfigs[0].name).toBe('TestMulti1');
  });

  it('should get configuration statistics', async () => {
    
    const openaiSerializer = new OpenAIRealtimeSerializer();
    const elevenLabsSerializer = new ElevenLabsSerializer();
    
    // Save configurations for both providers
    await manager.saveProviderConfig('openai', 'TestStats1', openaiSerializer.getDefaultConfig(), true);
    await manager.saveProviderConfig('openai', 'TestStats2', openaiSerializer.getDefaultConfig(), false);
    
    const elevenLabsConfig = elevenLabsSerializer.getDefaultConfig();
    elevenLabsConfig.agentId = 'test-agent';
    elevenLabsConfig.voiceId = 'test-voice';
    await manager.saveProviderConfig('elevenlabs', 'TestStats3', elevenLabsConfig, true);
    
    // Get statistics
    const stats = await manager.getConfigurationStats();
    
    expect(stats.totalConfigs).toBeGreaterThanOrEqual(3);
    expect(stats.configsByProvider.openai).toBeGreaterThanOrEqual(2);
    expect(stats.configsByProvider.elevenlabs).toBeGreaterThanOrEqual(1);
    expect(stats.defaultConfigs.openai).toBe('TestStats1');
    expect(stats.defaultConfigs.elevenlabs).toBe('TestStats3');
  });

  it('should handle concurrent access correctly', async () => {
    
    const serializer = new OpenAIRealtimeSerializer();
    
    // Create multiple managers (simulating concurrent access)
    const manager1 = new ClientAIModelManager(prisma, { autoReload: false });
    const manager2 = new ClientAIModelManager(prisma, { autoReload: false });
    
    try {
      // Save configurations concurrently
      const promises = [
        manager1.saveProviderConfig('openai', 'TestConcurrent1', serializer.getDefaultConfig()),
        manager2.saveProviderConfig('openai', 'TestConcurrent2', serializer.getDefaultConfig())
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0].name).toBe('TestConcurrent1');
      expect(results[1].name).toBe('TestConcurrent2');
      
      // Verify both can retrieve each other's configurations
      const config1FromManager2 = await manager2.getProviderConfig('openai', 'TestConcurrent1');
      const config2FromManager1 = await manager1.getProviderConfig('openai', 'TestConcurrent2');
      
      expect(config1FromManager2).toBeTruthy();
      expect(config2FromManager1).toBeTruthy();
      
    } finally {
      manager1.destroy();
      manager2.destroy();
    }
  });
});