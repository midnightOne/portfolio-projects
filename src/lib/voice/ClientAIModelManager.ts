/**
 * Client-Side AI Model Manager
 * 
 * Provides centralized configuration management for client-side voice AI systems
 * with JSON-based database storage, provider-specific serializers, and hot-reload capabilities.
 * 
 * This replaces the backend AIServiceManager for voice AI configurations only.
 */

import { PrismaClient } from '@prisma/client';
import {
  VoiceConfigSerializer,
  BaseVoiceProviderConfig,
  getSerializerForProvider,
  ConfigSerializationError,
  ConfigValidationError,
  OpenAIRealtimeConfig,
  ElevenLabsConfig
} from './config-serializers';
import { VoiceProvider } from '../../types/voice-agent';

// Union type for all provider configurations
export type VoiceProviderConfig = OpenAIRealtimeConfig | ElevenLabsConfig;

// Database record interface
export interface VoiceProviderConfigRecord {
  id: string;
  provider: string;
  name: string;
  isDefault: boolean;
  configJson: string;
  createdAt: Date;
  updatedAt: Date;
}

// Configuration with metadata
export interface VoiceProviderConfigWithMetadata {
  id: string;
  provider: VoiceProvider;
  name: string;
  isDefault: boolean;
  config: VoiceProviderConfig;
  createdAt: Date;
  updatedAt: Date;
}

// Cache entry interface
interface CacheEntry {
  config: VoiceProviderConfigWithMetadata;
  timestamp: number;
  ttl: number;
}

// Configuration cache options
interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached entries
}

// Manager options
interface ClientAIModelManagerOptions {
  cache?: CacheOptions;
  autoReload?: boolean;
  reloadInterval?: number;
}

export class ClientAIModelManagerError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: VoiceProvider,
    public configName?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ClientAIModelManagerError';
  }
}

export class ClientAIModelManager {
  private prisma: PrismaClient;
  private cache: Map<string, CacheEntry> = new Map();
  private options: Required<ClientAIModelManagerOptions>;
  private reloadTimer?: NodeJS.Timeout;
  
  // Default cache options
  private static readonly DEFAULT_CACHE_OPTIONS: CacheOptions = {
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 100
  };
  
  // Default manager options
  private static readonly DEFAULT_OPTIONS: Required<ClientAIModelManagerOptions> = {
    cache: ClientAIModelManager.DEFAULT_CACHE_OPTIONS,
    autoReload: true,
    reloadInterval: 5 * 60 * 1000 // 5 minutes
  };

  constructor(
    prisma?: PrismaClient,
    options: ClientAIModelManagerOptions = {}
  ) {
    this.prisma = prisma || new PrismaClient();
    this.options = { ...ClientAIModelManager.DEFAULT_OPTIONS, ...options };
    
    if (this.options.autoReload) {
      this.startAutoReload();
    }
  }

  /**
   * Get provider configuration by name or default
   */
  async getProviderConfig(
    provider: VoiceProvider,
    configName?: string
  ): Promise<VoiceProviderConfigWithMetadata | null> {
    try {
      const cacheKey = this.getCacheKey(provider, configName);
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Query database
      const record = await this.queryProviderConfig(provider, configName);
      if (!record) {
        return null;
      }
      
      // Deserialize and cache
      const config = this.deserializeConfig(record);
      this.setCache(cacheKey, config);
      
      return config;
    } catch (error) {
      throw new ClientAIModelManagerError(
        `Failed to get provider config: ${provider}${configName ? `:${configName}` : ''}`,
        'GET_CONFIG_ERROR',
        provider,
        configName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get all configurations for a specific provider
   */
  async getAllProviderConfigs(
    provider: VoiceProvider
  ): Promise<VoiceProviderConfigWithMetadata[]> {
    try {
      const records = await this.prisma.voiceProviderConfig.findMany({
        where: { provider },
        orderBy: [
          { isDefault: 'desc' },
          { name: 'asc' }
        ]
      });
      
      return records.map(record => this.deserializeConfig(record));
    } catch (error) {
      throw new ClientAIModelManagerError(
        `Failed to get all provider configs: ${provider}`,
        'GET_ALL_CONFIGS_ERROR',
        provider,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Save provider configuration to database
   */
  async saveProviderConfig(
    provider: VoiceProvider,
    name: string,
    config: VoiceProviderConfig,
    isDefault: boolean = false
  ): Promise<VoiceProviderConfigWithMetadata> {
    try {
      // Validate configuration
      const serializer = getSerializerForProvider(provider);
      const validation = serializer.validate(config);
      
      if (!validation.valid) {
        throw new ConfigValidationError(
          'Configuration validation failed',
          provider,
          validation.errors
        );
      }
      
      // Serialize configuration
      const configJson = serializer.serialize(config);
      
      // Handle default configuration logic
      if (isDefault) {
        // Unset current default for this provider
        await this.prisma.voiceProviderConfig.updateMany({
          where: { 
            provider,
            isDefault: true
          },
          data: { isDefault: false }
        });
      }
      
      // Upsert configuration
      const record = await this.prisma.voiceProviderConfig.upsert({
        where: {
          provider_name: {
            provider,
            name
          }
        },
        update: {
          configJson,
          isDefault,
          updatedAt: new Date()
        },
        create: {
          provider,
          name,
          configJson,
          isDefault
        }
      });
      
      // Clear cache for this provider
      this.clearProviderCache(provider);
      
      return this.deserializeConfig(record);
    } catch (error) {
      if (error instanceof ConfigValidationError || error instanceof ConfigSerializationError) {
        throw error;
      }
      
      throw new ClientAIModelManagerError(
        `Failed to save provider config: ${provider}:${name}`,
        'SAVE_CONFIG_ERROR',
        provider,
        name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Delete provider configuration
   */
  async deleteProviderConfig(
    provider: VoiceProvider,
    name: string
  ): Promise<boolean> {
    try {
      const result = await this.prisma.voiceProviderConfig.delete({
        where: {
          provider_name: {
            provider,
            name
          }
        }
      });
      
      // Clear cache
      this.clearProviderCache(provider);
      
      return !!result;
    } catch (error) {
      // If record doesn't exist, return false
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        return false;
      }
      
      throw new ClientAIModelManagerError(
        `Failed to delete provider config: ${provider}:${name}`,
        'DELETE_CONFIG_ERROR',
        provider,
        name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get the default provider configuration
   */
  async getDefaultProvider(): Promise<VoiceProvider | null> {
    try {
      const defaultConfigs = await this.prisma.voiceProviderConfig.findMany({
        where: { isDefault: true },
        select: { provider: true }
      });
      
      // Return the first default provider found
      return defaultConfigs.length > 0 ? defaultConfigs[0].provider as VoiceProvider : null;
    } catch (error) {
      throw new ClientAIModelManagerError(
        'Failed to get default provider',
        'GET_DEFAULT_PROVIDER_ERROR',
        undefined,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Set default provider by updating the specified configuration
   */
  async setDefaultProvider(
    provider: VoiceProvider,
    configName: string
  ): Promise<boolean> {
    try {
      // First, unset all defaults for this provider
      await this.prisma.voiceProviderConfig.updateMany({
        where: { 
          provider,
          isDefault: true
        },
        data: { isDefault: false }
      });
      
      // Set the specified config as default
      const result = await this.prisma.voiceProviderConfig.updateMany({
        where: {
          provider,
          name: configName
        },
        data: { isDefault: true }
      });
      
      // Clear cache
      this.clearProviderCache(provider);
      
      return result.count > 0;
    } catch (error) {
      throw new ClientAIModelManagerError(
        `Failed to set default provider: ${provider}:${configName}`,
        'SET_DEFAULT_PROVIDER_ERROR',
        provider,
        configName,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validate configuration using provider-specific serializer
   */
  validateConfig(
    provider: VoiceProvider,
    config: Partial<VoiceProviderConfig>
  ): { valid: boolean; errors: string[]; warnings?: string[] } {
    try {
      const serializer = getSerializerForProvider(provider);
      const validation = serializer.validate(config);
      
      return {
        valid: validation.valid,
        errors: validation.errors.map(e => `${e.field}: ${e.message}`),
        warnings: validation.warnings?.map(w => `${w.field}: ${w.message}`)
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Get available voice models for a provider
   */
  async getAvailableVoiceModels(provider?: VoiceProvider): Promise<string[]> {
    try {
      const providers = provider ? [provider] : (['openai', 'elevenlabs'] as VoiceProvider[]);
      const models: string[] = [];
      
      for (const p of providers) {
        const configs = await this.getAllProviderConfigs(p);
        for (const config of configs) {
          if (config.config.enabled) {
            if (p === 'openai' && 'model' in config.config) {
              models.push(config.config.model);
            } else if (p === 'elevenlabs' && 'model' in config.config) {
              models.push(config.config.model);
            }
          }
        }
      }
      
      return Array.from(new Set(models)); // Remove duplicates
    } catch (error) {
      throw new ClientAIModelManagerError(
        `Failed to get available voice models${provider ? ` for ${provider}` : ''}`,
        'GET_VOICE_MODELS_ERROR',
        provider,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Hot-reload configuration from database
   */
  async reloadConfiguration(): Promise<void> {
    try {
      // Clear all cache
      this.cache.clear();
      
      // Optionally pre-load default configurations
      const providers: VoiceProvider[] = ['openai', 'elevenlabs'];
      
      for (const provider of providers) {
        try {
          await this.getProviderConfig(provider); // This will cache the default config
        } catch (error) {
          // Ignore errors for individual providers during reload
          console.warn(`Failed to reload config for provider ${provider}:`, error);
        }
      }
    } catch (error) {
      throw new ClientAIModelManagerError(
        'Failed to reload configuration',
        'RELOAD_CONFIG_ERROR',
        undefined,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get configuration statistics
   */
  async getConfigurationStats(): Promise<{
    totalConfigs: number;
    configsByProvider: Record<VoiceProvider, number>;
    defaultConfigs: Record<VoiceProvider, string | null>;
    cacheSize: number;
    cacheHitRate?: number;
  }> {
    try {
      const allConfigs = await this.prisma.voiceProviderConfig.findMany({
        select: {
          provider: true,
          name: true,
          isDefault: true
        }
      });
      
      const configsByProvider: Record<VoiceProvider, number> = {
        openai: 0,
        elevenlabs: 0
      };
      
      const defaultConfigs: Record<VoiceProvider, string | null> = {
        openai: null,
        elevenlabs: null
      };
      
      for (const config of allConfigs) {
        const provider = config.provider as VoiceProvider;
        configsByProvider[provider]++;
        
        if (config.isDefault) {
          defaultConfigs[provider] = config.name;
        }
      }
      
      return {
        totalConfigs: allConfigs.length,
        configsByProvider,
        defaultConfigs,
        cacheSize: this.cache.size
      };
    } catch (error) {
      throw new ClientAIModelManagerError(
        'Failed to get configuration statistics',
        'GET_STATS_ERROR',
        undefined,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = undefined;
    }
    
    this.cache.clear();
  }

  // Private helper methods

  private getCacheKey(provider: VoiceProvider, configName?: string): string {
    return `${provider}:${configName || 'default'}`;
  }

  private getFromCache(key: string): VoiceProviderConfigWithMetadata | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.config;
  }

  private setCache(key: string, config: VoiceProviderConfigWithMetadata): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.options.cache.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      config,
      timestamp: Date.now(),
      ttl: this.options.cache.ttl
    });
  }

  private clearProviderCache(provider: VoiceProvider): void {
    const keysToDelete: string[] = [];
    
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (key.startsWith(`${provider}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  private async queryProviderConfig(
    provider: VoiceProvider,
    configName?: string
  ): Promise<VoiceProviderConfigRecord | null> {
    if (configName) {
      // Get specific named configuration
      return await this.prisma.voiceProviderConfig.findUnique({
        where: {
          provider_name: {
            provider,
            name: configName
          }
        }
      });
    } else {
      // Get default configuration for provider
      return await this.prisma.voiceProviderConfig.findFirst({
        where: {
          provider,
          isDefault: true
        }
      });
    }
  }

  private deserializeConfig(record: VoiceProviderConfigRecord): VoiceProviderConfigWithMetadata {
    try {
      const serializer = getSerializerForProvider(record.provider as VoiceProvider);
      const config = serializer.deserialize(record.configJson);
      
      return {
        id: record.id,
        provider: record.provider as VoiceProvider,
        name: record.name,
        isDefault: record.isDefault,
        config,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      };
    } catch (error) {
      throw new ConfigSerializationError(
        `Failed to deserialize config for ${record.provider}:${record.name}`,
        record.provider as VoiceProvider,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private startAutoReload(): void {
    this.reloadTimer = setInterval(() => {
      this.reloadConfiguration().catch(error => {
        console.warn('Auto-reload failed:', error);
      });
    }, this.options.reloadInterval);
  }
}

// Singleton instance for application-wide use
let clientAIModelManagerInstance: ClientAIModelManager | null = null;

/**
 * Get the singleton ClientAIModelManager instance
 */
export function getClientAIModelManager(
  prisma?: PrismaClient,
  options?: ClientAIModelManagerOptions
): ClientAIModelManager {
  if (!clientAIModelManagerInstance) {
    clientAIModelManagerInstance = new ClientAIModelManager(prisma, options);
  }
  
  return clientAIModelManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetClientAIModelManager(): void {
  if (clientAIModelManagerInstance) {
    clientAIModelManagerInstance.destroy();
    clientAIModelManagerInstance = null;
  }
}