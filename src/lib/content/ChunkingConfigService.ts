/**
 * Chunking Configuration Service
 * 
 * Manages chunking configuration settings for semantic content management.
 * Provides database persistence and runtime configuration updates.
 */

import { prisma } from '@/lib/prisma';
import { estimateCost, getPreflightRates } from '@/lib/ai/pricing';

export interface ChunkingSettings {
  id: string;
  
  // Heading-bounded chunking strategy
  respectHeadingBoundaries: boolean;
  
  // Chunk sizing
  targetChunkSize: number;            // Ideal tokens per T3 chunk
  maxSectionSize: number;             // Max tokens before splitting section
  minSectionSize: number;             // Min tokens to avoid tiny chunks
  
  // Context continuity
  sectionBoundaryOverlap: number;     // Overlap tokens within sections
  
  // Splitting strategy
  splitStrategy: 'paragraph' | 'sentence' | 'token';
  
  // Embedding model
  embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large';
  
  // Summary generation
  t1MaxLength: number;                // Project summary max tokens
  t2MaxLength: number;                // Section summary max tokens
  
  // Change detection
  sectionChangePercent: number;       // % sections changed to trigger full regen
  minorChangeThreshold: number;       // Max sections for "minor" classification
  
  // Behavior
  defaultBehavior: 'auto' | 'manual' | 'prompt';
  draftModeSkipIndexing: boolean;
  
  // Batch mode preferences
  batchModeEnabled: boolean;
  batchModeMinChunks: number;         // Minimum chunks to use batch mode
  batchModeAutoSchedule: boolean;     // Auto-schedule overnight
  batchModeDefaultForRegeneration: boolean;
  batchModeDefaultForBulkOps: boolean;
  batchModeDefaultForInitialIndexing: boolean;
  
  // Metadata
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostImpact {
  embeddingCostChange: number;        // Change in embedding costs
  summarizationCostChange: number;    // Change in summarization costs
  totalCostChange: number;            // Total cost change
  affectedProjects: number;           // Number of projects affected
  regenerationRequired: boolean;      // Whether regeneration is needed
  estimatedRegenerationCost: number;  // Cost to regenerate with new settings
}

export class ChunkingConfigService {
  private static instance: ChunkingConfigService;
  private configCache = new Map<string, ChunkingSettings>();
  private defaultConfig: ChunkingSettings | null = null;

  static getInstance(): ChunkingConfigService {
    if (!ChunkingConfigService.instance) {
      ChunkingConfigService.instance = new ChunkingConfigService();
    }
    return ChunkingConfigService.instance;
  }

  /**
   * Get default configuration
   */
  async getDefaultConfig(): Promise<ChunkingSettings> {
    if (this.defaultConfig) {
      return this.defaultConfig;
    }

    // Try to get from database
    const dbConfig = await prisma.chunkingConfig.findFirst({
      where: { isDefault: true }
    });

    if (dbConfig) {
      this.defaultConfig = this.mapToSettings(dbConfig);
      return this.defaultConfig;
    }

    // Create default configuration
    const defaultConfig = await this.createDefaultConfig();
    this.defaultConfig = defaultConfig;
    return defaultConfig;
  }

  /**
   * Get configuration by name
   */
  async getConfig(name: string): Promise<ChunkingSettings | null> {
    // Check cache first
    if (this.configCache.has(name)) {
      return this.configCache.get(name)!;
    }

    // Get from database
    const config = await prisma.chunkingConfig.findFirst({
      where: { name }
    });

    if (!config) {
      return null;
    }

    const settings = this.mapToSettings(config);
    this.configCache.set(name, settings);
    return settings;
  }

  /**
   * Create new configuration
   */
  async createConfig(
    configData: Omit<ChunkingSettings, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ChunkingSettings> {
    // If this is set as default, unset other defaults
    if (configData.isDefault) {
      await this.unsetAllDefaults();
    }

    // Store batch mode settings in defaultBehavior as JSON
    const batchModeSettings = {
      batchModeEnabled: configData.batchModeEnabled ?? true,
      batchModeMinChunks: configData.batchModeMinChunks ?? 100,
      batchModeAutoSchedule: configData.batchModeAutoSchedule ?? false,
      batchModeDefaultForRegeneration: configData.batchModeDefaultForRegeneration ?? false,
      batchModeDefaultForBulkOps: configData.batchModeDefaultForBulkOps ?? true,
      batchModeDefaultForInitialIndexing: configData.batchModeDefaultForInitialIndexing ?? true
    };

    const created = await prisma.chunkingConfig.create({
      data: {
        name: configData.name,
        isDefault: configData.isDefault,
        respectHeadingBoundaries: configData.respectHeadingBoundaries ?? true,
        targetChunkSize: configData.targetChunkSize ?? 300,
        maxSectionSize: configData.maxSectionSize ?? 500,
        minSectionSize: configData.minSectionSize ?? 50,
        sectionBoundaryOverlap: configData.sectionBoundaryOverlap ?? 25,
        splitStrategy: configData.splitStrategy ?? 'paragraph',
        embeddingModel: configData.embeddingModel ?? 'text-embedding-3-small',
        t1MaxLength: configData.t1MaxLength ?? 200,
        t2MaxLength: configData.t2MaxLength ?? 150,
        sectionChangePercent: configData.sectionChangePercent ?? 0.2,
        minorChangeThreshold: configData.minorChangeThreshold ?? 2,
        defaultBehavior: JSON.stringify({
          behavior: configData.defaultBehavior ?? 'prompt',
          ...batchModeSettings
        }),
        draftModeSkipIndexing: configData.draftModeSkipIndexing ?? true
      }
    });

    const settings = this.mapToSettings(created);
    this.configCache.set(settings.name, settings);
    
    if (settings.isDefault) {
      this.defaultConfig = settings;
    }

    return settings;
  }

  /**
   * Update existing configuration
   */
  async updateConfig(
    name: string,
    updates: Partial<Omit<ChunkingSettings, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ChunkingSettings | null> {
    const existing = await this.getConfig(name);
    if (!existing) {
      return null;
    }

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      await this.unsetAllDefaults();
    }

    // Parse existing batch mode settings safely
    const dbConfig = await prisma.chunkingConfig.findFirst({ where: { name } });
    let existingBehavior: any = {};
    
    if (dbConfig?.defaultBehavior) {
      const behaviorValue = dbConfig.defaultBehavior;
      
      // Check if it's a simple string like 'prompt', 'auto', or 'manual'
      if (typeof behaviorValue === 'string' && 
          ['auto', 'manual', 'prompt'].includes(behaviorValue)) {
        // It's a simple behavior string, not a JSON object
        existingBehavior = {};
      } else if (typeof behaviorValue === 'string') {
        // Try to parse as JSON
        try {
          existingBehavior = JSON.parse(behaviorValue);
        } catch (e) {
          console.warn(`[ChunkingConfigService] Failed to parse defaultBehavior: ${behaviorValue}`, e);
          existingBehavior = {};
        }
      } else if (typeof behaviorValue === 'object') {
        existingBehavior = behaviorValue;
      }
    }

    // Merge batch mode settings
    const batchModeSettings = {
      batchModeEnabled: updates.batchModeEnabled ?? existingBehavior.batchModeEnabled ?? true,
      batchModeMinChunks: updates.batchModeMinChunks ?? existingBehavior.batchModeMinChunks ?? 100,
      batchModeAutoSchedule: updates.batchModeAutoSchedule ?? existingBehavior.batchModeAutoSchedule ?? false,
      batchModeDefaultForRegeneration: updates.batchModeDefaultForRegeneration ?? existingBehavior.batchModeDefaultForRegeneration ?? false,
      batchModeDefaultForBulkOps: updates.batchModeDefaultForBulkOps ?? existingBehavior.batchModeDefaultForBulkOps ?? true,
      batchModeDefaultForInitialIndexing: updates.batchModeDefaultForInitialIndexing ?? existingBehavior.batchModeDefaultForInitialIndexing ?? true
    };

    const updated = await prisma.chunkingConfig.update({
      where: { id: existing.id },
      data: {
        name: updates.name ?? existing.name,
        isDefault: updates.isDefault ?? existing.isDefault,
        respectHeadingBoundaries: updates.respectHeadingBoundaries ?? existing.respectHeadingBoundaries,
        targetChunkSize: updates.targetChunkSize ?? existing.targetChunkSize,
        maxSectionSize: updates.maxSectionSize ?? existing.maxSectionSize,
        minSectionSize: updates.minSectionSize ?? existing.minSectionSize,
        sectionBoundaryOverlap: updates.sectionBoundaryOverlap ?? existing.sectionBoundaryOverlap,
        splitStrategy: updates.splitStrategy ?? existing.splitStrategy,
        embeddingModel: updates.embeddingModel ?? existing.embeddingModel,
        t1MaxLength: updates.t1MaxLength ?? existing.t1MaxLength,
        t2MaxLength: updates.t2MaxLength ?? existing.t2MaxLength,
        sectionChangePercent: updates.sectionChangePercent ?? existing.sectionChangePercent,
        minorChangeThreshold: updates.minorChangeThreshold ?? existing.minorChangeThreshold,
        defaultBehavior: JSON.stringify({
          behavior: updates.defaultBehavior ?? existing.defaultBehavior,
          ...batchModeSettings
        }),
        draftModeSkipIndexing: updates.draftModeSkipIndexing ?? existing.draftModeSkipIndexing
      }
    });

    const settings = this.mapToSettings(updated);
    this.configCache.set(settings.name, settings);
    
    if (settings.isDefault) {
      this.defaultConfig = settings;
    }

    return settings;
  }

  /**
   * Delete configuration
   */
  async deleteConfig(name: string): Promise<boolean> {
    const existing = await this.getConfig(name);
    if (!existing) {
      return false;
    }

    // Don't allow deleting the default config
    if (existing.isDefault) {
      throw new Error('Cannot delete default configuration');
    }

    await prisma.chunkingConfig.delete({
      where: { id: existing.id }
    });

    this.configCache.delete(name);
    return true;
  }

  /**
   * List all configurations
   */
  async listConfigs(): Promise<ChunkingSettings[]> {
    const configs = await prisma.chunkingConfig.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });

    return configs.map(config => this.mapToSettings(config));
  }

  /**
   * Calculate cost impact of configuration changes
   */
  async calculateCostImpact(
    currentConfig: ChunkingSettings,
    newConfig: Partial<ChunkingSettings>
  ): Promise<CostImpact> {
    // Get all project entities with semantic chunks (entity-based post-D37)
    const projects = await prisma.contentEntity.findMany({
      where: { entityType: 'PROJECT' },
      include: {
        contentChunks: {
          select: {
            tier: true,
            tokenCount: true
          }
        }
      }
    });

    let embeddingCostChange = 0;
    let summarizationCostChange = 0;
    let affectedProjects = 0;
    let regenerationRequired = false;
    const rates = await getPreflightRates();

    // Check if embedding model changed
    if (newConfig.embeddingModel && newConfig.embeddingModel !== currentConfig.embeddingModel) {
      regenerationRequired = true;
      affectedProjects = projects.length;

      // Calculate embedding cost difference (per-1K rates from AIModelPricing, D38)
      const oldCost = await estimateCost(currentConfig.embeddingModel, { inputTokens: 1000 });
      const newCost = await estimateCost(newConfig.embeddingModel, { inputTokens: 1000 });

      for (const project of projects) {
        const totalTokens = project.contentChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
        embeddingCostChange += (newCost - oldCost) * totalTokens / 1000;
      }
    }

    // Check if chunk size changed significantly
    if (newConfig.targetChunkSize && 
        Math.abs(newConfig.targetChunkSize - currentConfig.targetChunkSize) > 50) {
      regenerationRequired = true;
      affectedProjects = projects.length;
    }

    // Check if summary max length changed
    if ((newConfig.t1MaxLength && newConfig.t1MaxLength !== currentConfig.t1MaxLength) ||
        (newConfig.t2MaxLength && newConfig.t2MaxLength !== currentConfig.t2MaxLength)) {
      regenerationRequired = true;
      
      // Estimate summarization cost change
      for (const project of projects) {
        const t1Chunks = project.contentChunks.filter(c => c.tier === 1).length;
        const t2Chunks = project.contentChunks.filter(c => c.tier === 2).length;
        
        const t1Change = newConfig.t1MaxLength ? (newConfig.t1MaxLength - currentConfig.t1MaxLength) : 0;
        const t2Change = newConfig.t2MaxLength ? (newConfig.t2MaxLength - currentConfig.t2MaxLength) : 0;
        
        // Rough estimate at the default-cheap summarization rate
        summarizationCostChange += (t1Chunks * t1Change + t2Chunks * t2Change) * rates.summarizationInputPer1kUsd / 1000;
      }
    }

    const totalCostChange = embeddingCostChange + summarizationCostChange;
    
    // Estimate regeneration cost if needed
    let estimatedRegenerationCost = 0;
    if (regenerationRequired) {
      const regenEmbeddingPer1k = newConfig.embeddingModel
        ? await estimateCost(newConfig.embeddingModel, { inputTokens: 1000 })
        : rates.embeddingPer1kUsd;
      for (const project of projects) {
        const totalTokens = project.contentChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
        const embeddingCost = regenEmbeddingPer1k * totalTokens / 1000;
        const summarizationCost = rates.summarizationInputPer1kUsd * totalTokens / 1000; // Rough estimate
        estimatedRegenerationCost += embeddingCost + summarizationCost;
      }
    }

    return {
      embeddingCostChange,
      summarizationCostChange,
      totalCostChange,
      affectedProjects,
      regenerationRequired,
      estimatedRegenerationCost
    };
  }

  /**
   * Reset to factory defaults
   */
  async resetToDefaults(): Promise<ChunkingSettings> {
    // Clear cache
    this.configCache.clear();
    this.defaultConfig = null;

    // Delete all existing configs
    await prisma.chunkingConfig.deleteMany({});

    // Create new default
    return await this.createDefaultConfig();
  }

  // Private methods

  private async createDefaultConfig(): Promise<ChunkingSettings> {
    const batchModeSettings = {
      batchModeEnabled: true,
      batchModeMinChunks: 100,
      batchModeAutoSchedule: false,
      batchModeDefaultForRegeneration: false,
      batchModeDefaultForBulkOps: true,
      batchModeDefaultForInitialIndexing: true
    };

    const created = await prisma.chunkingConfig.create({
      data: {
        name: 'Default',
        isDefault: true,
        respectHeadingBoundaries: true,
        targetChunkSize: 300,
        maxSectionSize: 500,
        minSectionSize: 50,
        sectionBoundaryOverlap: 25,
        splitStrategy: 'paragraph',
        embeddingModel: 'text-embedding-3-small',
        t1MaxLength: 200,
        t2MaxLength: 150,
        sectionChangePercent: 0.2,
        minorChangeThreshold: 2,
        defaultBehavior: JSON.stringify({
          behavior: 'prompt',
          ...batchModeSettings
        }),
        draftModeSkipIndexing: true
      }
    });

    return this.mapToSettings(created);
  }

  private mapToSettings(config: any): ChunkingSettings {
    // Handle defaultBehavior - it can be a string or JSON object
    let behaviorData: any = {};
    let defaultBehavior: 'auto' | 'manual' | 'prompt' = 'prompt';
    
    if (typeof config.defaultBehavior === 'string') {
      // If it's a simple string like 'prompt', 'auto', or 'manual'
      if (['auto', 'manual', 'prompt'].includes(config.defaultBehavior)) {
        defaultBehavior = config.defaultBehavior as 'auto' | 'manual' | 'prompt';
      } else {
        // Try parsing as JSON
        try {
          behaviorData = JSON.parse(config.defaultBehavior);
          defaultBehavior = behaviorData.behavior || 'prompt';
        } catch {
          defaultBehavior = 'prompt';
        }
      }
    } else if (typeof config.defaultBehavior === 'object') {
      behaviorData = config.defaultBehavior;
      defaultBehavior = behaviorData.behavior || 'prompt';
    }
    
    return {
      id: config.id,
      name: config.name,
      isDefault: config.isDefault,
      respectHeadingBoundaries: config.respectHeadingBoundaries,
      targetChunkSize: config.targetChunkSize,
      maxSectionSize: config.maxSectionSize,
      minSectionSize: config.minSectionSize,
      sectionBoundaryOverlap: config.sectionBoundaryOverlap,
      splitStrategy: config.splitStrategy as 'paragraph' | 'sentence' | 'token',
      embeddingModel: config.embeddingModel as 'text-embedding-3-small' | 'text-embedding-3-large',
      t1MaxLength: config.t1MaxLength,
      t2MaxLength: config.t2MaxLength,
      sectionChangePercent: config.sectionChangePercent,
      minorChangeThreshold: config.minorChangeThreshold,
      defaultBehavior,
      draftModeSkipIndexing: config.draftModeSkipIndexing,
      batchModeEnabled: config.batchModeEnabled ?? behaviorData.batchModeEnabled ?? true,
      batchModeMinChunks: config.batchModeMinChunks ?? behaviorData.batchModeMinChunks ?? 100,
      batchModeAutoSchedule: config.batchModeAutoSchedule ?? behaviorData.batchModeAutoSchedule ?? false,
      batchModeDefaultForRegeneration: config.batchModeDefaultForRegeneration ?? behaviorData.batchModeDefaultForRegeneration ?? false,
      batchModeDefaultForBulkOps: behaviorData.batchModeDefaultForBulkOps ?? true,
      batchModeDefaultForInitialIndexing: behaviorData.batchModeDefaultForInitialIndexing ?? true,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  }

  private async unsetAllDefaults(): Promise<void> {
    await prisma.chunkingConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });

    this.defaultConfig = null;
  }
}

export default ChunkingConfigService;
