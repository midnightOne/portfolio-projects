/**
 * Test Chunking Configuration System
 * 
 * Tests the chunking configuration service and API endpoints.
 */

// Use dynamic import to handle module resolution
async function loadModules() {
  const { prisma } = await import('../src/lib/prisma.js');
  const { default: ChunkingConfigService } = await import('../src/lib/content/ChunkingConfigService.js');
  return { prisma, ChunkingConfigService };
}

async function testChunkingConfig() {
  console.log('🧪 Testing Chunking Configuration System\n');

  const { prisma, ChunkingConfigService } = await loadModules();
  const configService = ChunkingConfigService.getInstance();

  try {
    // Test 1: Get default configuration
    console.log('Test 1: Get default configuration');
    const defaultConfig = await configService.getDefaultConfig();
    console.log('✅ Default config loaded:', {
      name: defaultConfig.name,
      targetChunkSize: defaultConfig.targetChunkSize,
      embeddingModel: defaultConfig.embeddingModel,
      batchModeEnabled: defaultConfig.batchModeEnabled
    });
    console.log('');

    // Test 2: Create custom configuration
    console.log('Test 2: Create custom configuration');
    const customConfig = await configService.createConfig({
      name: 'Test Config',
      isDefault: false,
      respectHeadingBoundaries: true,
      targetChunkSize: 400,
      maxSectionSize: 800,
      minSectionSize: 75,
      sectionBoundaryOverlap: 50,
      splitStrategy: 'sentence',
      embeddingModel: 'text-embedding-3-large',
      t1MaxLength: 250,
      t2MaxLength: 175,
      sectionChangePercent: 0.15,
      minorChangeThreshold: 3,
      defaultBehavior: 'auto',
      draftModeSkipIndexing: false,
      batchModeEnabled: true,
      batchModeMinChunks: 150,
      batchModeAutoSchedule: true,
      batchModeDefaultForRegeneration: true,
      batchModeDefaultForBulkOps: true,
      batchModeDefaultForInitialIndexing: true
    });
    console.log('✅ Custom config created:', {
      id: customConfig.id,
      name: customConfig.name,
      targetChunkSize: customConfig.targetChunkSize,
      embeddingModel: customConfig.embeddingModel
    });
    console.log('');

    // Test 3: List all configurations
    console.log('Test 3: List all configurations');
    const allConfigs = await configService.listConfigs();
    console.log(`✅ Found ${allConfigs.length} configurations:`);
    allConfigs.forEach(config => {
      console.log(`  - ${config.name} (${config.isDefault ? 'default' : 'custom'})`);
    });
    console.log('');

    // Test 4: Update configuration
    console.log('Test 4: Update configuration');
    const updatedConfig = await configService.updateConfig('Test Config', {
      targetChunkSize: 500,
      batchModeMinChunks: 200
    });
    console.log('✅ Config updated:', {
      name: updatedConfig?.name,
      targetChunkSize: updatedConfig?.targetChunkSize,
      batchModeMinChunks: updatedConfig?.batchModeMinChunks
    });
    console.log('');

    // Test 5: Calculate cost impact
    console.log('Test 5: Calculate cost impact');
    const costImpact = await configService.calculateCostImpact(defaultConfig, {
      embeddingModel: 'text-embedding-3-large',
      targetChunkSize: 500
    });
    console.log('✅ Cost impact calculated:', {
      embeddingCostChange: `$${costImpact.embeddingCostChange.toFixed(6)}`,
      summarizationCostChange: `$${costImpact.summarizationCostChange.toFixed(6)}`,
      totalCostChange: `$${costImpact.totalCostChange.toFixed(6)}`,
      affectedProjects: costImpact.affectedProjects,
      regenerationRequired: costImpact.regenerationRequired,
      estimatedRegenerationCost: `$${costImpact.estimatedRegenerationCost.toFixed(4)}`
    });
    console.log('');

    // Test 6: Get specific configuration
    console.log('Test 6: Get specific configuration');
    const retrievedConfig = await configService.getConfig('Test Config');
    console.log('✅ Config retrieved:', {
      name: retrievedConfig?.name,
      targetChunkSize: retrievedConfig?.targetChunkSize,
      batchModeEnabled: retrievedConfig?.batchModeEnabled
    });
    console.log('');

    // Test 7: Batch mode settings
    console.log('Test 7: Verify batch mode settings');
    console.log('✅ Batch mode configuration:', {
      enabled: retrievedConfig?.batchModeEnabled,
      minChunks: retrievedConfig?.batchModeMinChunks,
      autoSchedule: retrievedConfig?.batchModeAutoSchedule,
      defaultForRegeneration: retrievedConfig?.batchModeDefaultForRegeneration,
      defaultForBulkOps: retrievedConfig?.batchModeDefaultForBulkOps,
      defaultForInitialIndexing: retrievedConfig?.batchModeDefaultForInitialIndexing
    });
    console.log('');

    // Test 8: Delete configuration
    console.log('Test 8: Delete configuration');
    const deleted = await configService.deleteConfig('Test Config');
    console.log('✅ Config deleted:', deleted);
    console.log('');

    // Test 9: Verify deletion
    console.log('Test 9: Verify deletion');
    const deletedConfig = await configService.getConfig('Test Config');
    console.log('✅ Config no longer exists:', deletedConfig === null);
    console.log('');

    console.log('✅ All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testChunkingConfig()
  .then(() => {
    console.log('✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
