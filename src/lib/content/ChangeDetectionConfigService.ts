/**
 * Change Detection Configuration Service
 * 
 * Manages configurable thresholds and settings for content change detection.
 * Provides database persistence and runtime configuration updates.
 * Updated to use correct Prisma model names.
 */

import { prisma } from '@/lib/database/connection';

export interface ChangeDetectionSettings {
  id: string;
  sectionChangePercent: number;     // % sections changed to trigger full regen
  minorChangeThreshold: number;     // Max sections for "minor" classification
  characterChangeThreshold: number; // % character change for "moderate"
  headingMatchThreshold: number;    // Similarity threshold for heading matching
  costPerToken: number;             // Cost estimation per token
  enableAutoDetection: boolean;     // Auto-trigger on project save
  enableCostEstimation: boolean;    // Show cost estimates
  enableAuditTrail: boolean;        // Store detection results
  name: string;                     // Configuration name
  isDefault: boolean;               // Default configuration
  createdAt: Date;
  updatedAt: Date;
}

export class ChangeDetectionConfigService {
  private static instance: ChangeDetectionConfigService;
  private configCache = new Map<string, ChangeDetectionSettings>();
  private defaultConfig: ChangeDetectionSettings | null = null;

  static getInstance(): ChangeDetectionConfigService {
    if (!ChangeDetectionConfigService.instance) {
      ChangeDetectionConfigService.instance = new ChangeDetectionConfigService();
    }
    return ChangeDetectionConfigService.instance;
  }

  /**
   * Get default configuration
   */
  async getDefaultConfig(): Promise<ChangeDetectionSettings> {
    if (this.defaultConfig) {
      return this.defaultConfig;
    }

    // Try to get from database
    const dbConfig = await this.getConfigFromDatabase('default');
    if (dbConfig) {
      this.defaultConfig = dbConfig;
      return dbConfig;
    }

    // Create default configuration
    const defaultConfig: Omit<ChangeDetectionSettings, 'id' | 'createdAt' | 'updatedAt'> = {
      sectionChangePercent: 0.2,        // 20% sections changed = major
      minorChangeThreshold: 2,          // ≤2 sections = minor
      characterChangeThreshold: 0.05,   // 5% character change = moderate
      headingMatchThreshold: 0.7,       // 70% similarity for heading match
      costPerToken: 0.00015,            // gpt-4o-mini cost per token
      enableAutoDetection: true,        // Auto-trigger on save
      enableCostEstimation: true,       // Show cost estimates
      enableAuditTrail: true,           // Store results
      name: 'Default',
      isDefault: true
    };

    const created = await this.createConfig(defaultConfig);
    this.defaultConfig = created;
    return created;
  }

  /**
   * Get configuration by name
   */
  async getConfig(name: string): Promise<ChangeDetectionSettings | null> {
    // Check cache first
    if (this.configCache.has(name)) {
      return this.configCache.get(name)!;
    }

    // Get from database
    const config = await this.getConfigFromDatabase(name);
    if (config) {
      this.configCache.set(name, config);
    }

    return config;
  }

  /**
   * Create new configuration
   */
  async createConfig(
    configData: Omit<ChangeDetectionSettings, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ChangeDetectionSettings> {
    // If this is set as default, unset other defaults
    if (configData.isDefault) {
      await this.unsetAllDefaults();
    }

    // Store in chunking_configs table (reusing existing table)
    const created = await prisma.chunkingConfig.create({
      data: {
        name: configData.name,
        isDefault: configData.isDefault,
        // Store change detection settings in existing fields where possible
        sectionChangePercent: configData.sectionChangePercent,
        minorChangeThreshold: configData.minorChangeThreshold,
        // Use existing fields creatively for our settings
        targetChunkSize: Math.round(configData.characterChangeThreshold * 1000), // Store as integer
        maxSectionSize: Math.round(configData.headingMatchThreshold * 1000),     // Store as integer
        minSectionSize: Math.round(configData.costPerToken * 1000000),           // Store as integer
        // Use boolean fields
        respectHeadingBoundaries: configData.enableAutoDetection,
        draftModeSkipIndexing: configData.enableCostEstimation,
        // Store additional settings in defaultBehavior as JSON string
        defaultBehavior: JSON.stringify({
          enableAuditTrail: configData.enableAuditTrail
        })
      }
    });

    const config: ChangeDetectionSettings = {
      id: created.id,
      name: created.name,
      isDefault: created.isDefault,
      sectionChangePercent: created.sectionChangePercent,
      minorChangeThreshold: created.minorChangeThreshold,
      characterChangeThreshold: created.targetChunkSize / 1000,
      headingMatchThreshold: created.maxSectionSize / 1000,
      costPerToken: created.minSectionSize / 1000000,
      enableAutoDetection: created.respectHeadingBoundaries,
      enableCostEstimation: created.draftModeSkipIndexing,
      enableAuditTrail: JSON.parse(created.defaultBehavior || '{}').enableAuditTrail || true,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    };

    // Cache the result
    this.configCache.set(config.name, config);
    
    // Update default cache if this is the default
    if (config.isDefault) {
      this.defaultConfig = config;
    }

    return config;
  }

  /**
   * Update existing configuration
   */
  async updateConfig(
    name: string,
    updates: Partial<Omit<ChangeDetectionSettings, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ChangeDetectionSettings | null> {
    const existing = await this.getConfig(name);
    if (!existing) {
      return null;
    }

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      await this.unsetAllDefaults();
    }

    // Update in database
    const updated = await prisma.chunkingConfig.update({
      where: { id: existing.id },
      data: {
        name: updates.name || existing.name,
        isDefault: updates.isDefault ?? existing.isDefault,
        sectionChangePercent: updates.sectionChangePercent ?? existing.sectionChangePercent,
        minorChangeThreshold: updates.minorChangeThreshold ?? existing.minorChangeThreshold,
        targetChunkSize: updates.characterChangeThreshold 
          ? Math.round(updates.characterChangeThreshold * 1000)
          : Math.round(existing.characterChangeThreshold * 1000),
        maxSectionSize: updates.headingMatchThreshold
          ? Math.round(updates.headingMatchThreshold * 1000)
          : Math.round(existing.headingMatchThreshold * 1000),
        minSectionSize: updates.costPerToken
          ? Math.round(updates.costPerToken * 1000000)
          : Math.round(existing.costPerToken * 1000000),
        respectHeadingBoundaries: updates.enableAutoDetection ?? existing.enableAutoDetection,
        draftModeSkipIndexing: updates.enableCostEstimation ?? existing.enableCostEstimation,
        defaultBehavior: JSON.stringify({
          enableAuditTrail: updates.enableAuditTrail ?? existing.enableAuditTrail
        })
      }
    });

    const config: ChangeDetectionSettings = {
      id: updated.id,
      name: updated.name,
      isDefault: updated.isDefault,
      sectionChangePercent: updated.sectionChangePercent,
      minorChangeThreshold: updated.minorChangeThreshold,
      characterChangeThreshold: updated.targetChunkSize / 1000,
      headingMatchThreshold: updated.maxSectionSize / 1000,
      costPerToken: updated.minSectionSize / 1000000,
      enableAutoDetection: updated.respectHeadingBoundaries,
      enableCostEstimation: updated.draftModeSkipIndexing,
      enableAuditTrail: JSON.parse(updated.defaultBehavior || '{}').enableAuditTrail || true,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };

    // Update cache
    this.configCache.set(config.name, config);
    
    // Update default cache if this is the default
    if (config.isDefault) {
      this.defaultConfig = config;
    }

    return config;
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

    // Remove from cache
    this.configCache.delete(name);

    return true;
  }

  /**
   * List all configurations
   */
  async listConfigs(): Promise<ChangeDetectionSettings[]> {
    const configs = await prisma.chunkingConfig.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });

    return configs.map(config => ({
      id: config.id,
      name: config.name,
      isDefault: config.isDefault,
      sectionChangePercent: config.sectionChangePercent,
      minorChangeThreshold: config.minorChangeThreshold,
      characterChangeThreshold: config.targetChunkSize / 1000,
      headingMatchThreshold: config.maxSectionSize / 1000,
      costPerToken: config.minSectionSize / 1000000,
      enableAutoDetection: config.respectHeadingBoundaries,
      enableCostEstimation: config.draftModeSkipIndexing,
      enableAuditTrail: JSON.parse(config.defaultBehavior || '{}').enableAuditTrail || true,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }));
  }

  /**
   * Reset to factory defaults
   */
  async resetToDefaults(): Promise<ChangeDetectionSettings> {
    // Clear cache
    this.configCache.clear();
    this.defaultConfig = null;

    // Delete all existing configs
    await prisma.chunkingConfig.deleteMany({});

    // Create new default
    return await this.getDefaultConfig();
  }

  // Private methods

  private async getConfigFromDatabase(name: string): Promise<ChangeDetectionSettings | null> {
    const config = await prisma.chunkingConfig.findFirst({
      where: { name }
    });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      name: config.name,
      isDefault: config.isDefault,
      sectionChangePercent: config.sectionChangePercent,
      minorChangeThreshold: config.minorChangeThreshold,
      characterChangeThreshold: config.targetChunkSize / 1000,
      headingMatchThreshold: config.maxSectionSize / 1000,
      costPerToken: config.minSectionSize / 1000000,
      enableAutoDetection: config.respectHeadingBoundaries,
      enableCostEstimation: config.draftModeSkipIndexing,
      enableAuditTrail: JSON.parse(config.defaultBehavior || '{}').enableAuditTrail || true,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  }

  private async unsetAllDefaults(): Promise<void> {
    await prisma.chunkingConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    });

    // Clear default cache
    this.defaultConfig = null;
  }
}

export default ChangeDetectionConfigService;