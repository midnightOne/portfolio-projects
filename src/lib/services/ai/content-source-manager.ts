/**
 * Content Source Manager
 * Pluggable architecture for managing different content sources in the AI context system
 * Supports automatic discovery and enable/disable toggles for content sources
 */

import { ContextSource, RelevantContent } from './context-manager';

export interface ContentSourceProvider {
  id: string;
  type: ContentSourceType;
  name: string;
  description: string;
  version: string;
  
  // Core methods
  isAvailable(): Promise<boolean>;
  getMetadata(): Promise<ContentSourceMetadata>;
  searchContent(query: string, options?: SearchOptions): Promise<RelevantContent[]>;
  
  // Optional methods for advanced features
  getSchema?(): ContentSourceSchema;
  validateConfig?(config: any): Promise<ValidationResult>;
  onConfigChange?(config: any): Promise<void>;
}

export interface ContentSourceMetadata {
  lastUpdated: Date;
  itemCount: number;
  size: number; // in bytes
  tags: string[];
  summary: string;
}

export interface ContentSourceSchema {
  configFields: ConfigField[];
  searchFilters: SearchFilter[];
  outputFormat: OutputFormat;
}

export interface ConfigField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: { value: any; label: string }[];
}

export interface SearchFilter {
  key: string;
  type: 'text' | 'date' | 'number' | 'select';
  label: string;
  description?: string;
}

export interface OutputFormat {
  fields: string[];
  supportedFormats: ('text' | 'json' | 'markdown')[];
}

export interface SearchOptions {
  maxResults?: number;
  minRelevanceScore?: number;
  filters?: Record<string, any>;
  sortBy?: 'relevance' | 'date' | 'title';
  includeMetadata?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type ContentSourceType = 
  | 'project' 
  | 'about' 
  | 'resume' 
  | 'blog' 
  | 'experience' 
  | 'education' 
  | 'skills' 
  | 'testimonials'
  | 'custom';

export interface ContentSourceConfig {
  id: string;
  providerId: string;
  enabled: boolean;
  priority: number; // 0-100, higher = more important
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentSourceRegistry {
  providers: Map<string, ContentSourceProvider>;
  configs: Map<string, ContentSourceConfig>;
}

/**
 * Main Content Source Manager class
 */
export class ContentSourceManager {
  private static instance: ContentSourceManager;
  private registry: ContentSourceRegistry = {
    providers: new Map(),
    configs: new Map()
  };

  static getInstance(): ContentSourceManager {
    if (!ContentSourceManager.instance) {
      ContentSourceManager.instance = new ContentSourceManager();
    }
    return ContentSourceManager.instance;
  }

  /**
   * Register a content source provider
   */
  registerProvider(provider: ContentSourceProvider): void {
    this.registry.providers.set(provider.id, provider);
    console.log(`Registered content source provider: ${provider.id}`);
  }

  /**
   * Unregister a content source provider
   */
  unregisterProvider(providerId: string): void {
    this.registry.providers.delete(providerId);
    console.log(`Unregistered content source provider: ${providerId}`);
  }

  /**
   * Get all registered providers
   */
  getProviders(): ContentSourceProvider[] {
    return Array.from(this.registry.providers.values());
  }

  /**
   * Get a specific provider
   */
  getProvider(providerId: string): ContentSourceProvider | undefined {
    return this.registry.providers.get(providerId);
  }

  /**
   * Auto-discover and register built-in content sources
   */
  async autoDiscoverSources(): Promise<void> {
    console.log('Auto-discovering content sources...');

    // Register built-in providers
    await this.registerBuiltInProviders();

    // Load configurations from database
    await this.loadConfigurations();

    // Auto-enable newly discovered sources
    await this.autoEnableNewSources();

    console.log(`Discovered ${this.registry.providers.size} content source providers`);
  }

  /**
   * Get all available content sources with their configurations
   */
  async getAvailableSources(): Promise<ContextSource[]> {
    const sources: ContextSource[] = [];

    for (const [providerId, provider] of this.registry.providers) {
      try {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) continue;

        const config = this.registry.configs.get(providerId);
        const metadata = await provider.getMetadata();

        sources.push({
          id: providerId,
          type: provider.type as any,
          title: provider.name,
          enabled: config?.enabled ?? true,
          summary: metadata.summary,
          lastUpdated: metadata.lastUpdated,
          priority: config?.priority ?? 50
        });
      } catch (error) {
        console.error(`Error getting source ${providerId}:`, error);
      }
    }

    return sources.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Search content across enabled sources
   */
  async searchContent(
    query: string, 
    options: SearchOptions = {}
  ): Promise<RelevantContent[]> {
    const results: RelevantContent[] = [];
    const enabledConfigs = Array.from(this.registry.configs.values())
      .filter(config => config.enabled);

    for (const config of enabledConfigs) {
      const provider = this.registry.providers.get(config.providerId);
      if (!provider) continue;

      try {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) continue;

        const providerResults = await provider.searchContent(query, {
          ...options,
          ...config.config
        });

        // Apply priority weighting to relevance scores
        const weightedResults = providerResults.map(result => ({
          ...result,
          relevanceScore: result.relevanceScore * (config.priority / 100)
        }));

        results.push(...weightedResults);
      } catch (error) {
        console.error(`Error searching provider ${config.providerId}:`, error);
      }
    }

    // Sort by relevance score and apply limits
    const sortedResults = results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    if (options.maxResults) {
      return sortedResults.slice(0, options.maxResults);
    }

    return sortedResults;
  }

  /**
   * Update content source configuration
   */
  async updateSourceConfig(
    sourceId: string, 
    updates: Partial<ContentSourceConfig>
  ): Promise<void> {
    const existingConfig = this.registry.configs.get(sourceId);
    const provider = this.registry.providers.get(sourceId);

    if (!provider) {
      throw new Error(`Provider ${sourceId} not found`);
    }

    // Validate configuration if provider supports it
    if (provider.validateConfig && updates.config) {
      const validation = await provider.validateConfig(updates.config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
    }

    const newConfig: ContentSourceConfig = {
      id: sourceId,
      providerId: sourceId,
      enabled: updates.enabled ?? existingConfig?.enabled ?? true,
      priority: updates.priority ?? existingConfig?.priority ?? 50,
      config: { ...existingConfig?.config, ...updates.config },
      createdAt: existingConfig?.createdAt ?? new Date(),
      updatedAt: new Date()
    };

    this.registry.configs.set(sourceId, newConfig);

    // Notify provider of config change
    if (provider.onConfigChange) {
      await provider.onConfigChange(newConfig.config);
    }

    // Save to database
    await this.saveConfiguration(newConfig);
  }

  /**
   * Enable/disable a content source
   */
  async toggleSource(sourceId: string, enabled: boolean): Promise<void> {
    await this.updateSourceConfig(sourceId, { enabled });
  }

  /**
   * Set source priority
   */
  async setSourcePriority(sourceId: string, priority: number): Promise<void> {
    if (priority < 0 || priority > 100) {
      throw new Error('Priority must be between 0 and 100');
    }
    await this.updateSourceConfig(sourceId, { priority });
  }

  /**
   * Get source configuration
   */
  getSourceConfig(sourceId: string): ContentSourceConfig | undefined {
    return this.registry.configs.get(sourceId);
  }

  /**
   * Set source configuration (used for loading from database)
   */
  setSourceConfig(sourceId: string, config: ContentSourceConfig): void {
    this.registry.configs.set(sourceId, config);
  }

  /**
   * Get source schema for configuration UI
   */
  async getSourceSchema(sourceId: string): Promise<ContentSourceSchema | null> {
    const provider = this.registry.providers.get(sourceId);
    if (!provider || !provider.getSchema) {
      return null;
    }
    return provider.getSchema();
  }

  /**
   * Register built-in content source providers
   */
  private async registerBuiltInProviders(): Promise<void> {
    // Register project provider
    const projectProvider = new ProjectContentProvider();
    this.registerProvider(projectProvider);

    // Register about provider
    const aboutProvider = new AboutContentProvider();
    this.registerProvider(aboutProvider);

    // Register resume provider (if available)
    const resumeProvider = new ResumeContentProvider();
    this.registerProvider(resumeProvider);

    // Register experience provider
    const experienceProvider = new ExperienceContentProvider();
    this.registerProvider(experienceProvider);

    // Register skills provider
    const skillsProvider = new SkillsContentProvider();
    this.registerProvider(skillsProvider);
  }

  /**
   * Load configurations from database
   */
  private async loadConfigurations(): Promise<void> {
    try {
      // Skip loading configurations if we're in a server context to avoid circular dependency
      if (typeof window === 'undefined') {
        console.log('Skipping configuration loading in server context');
        return;
      }
      
      const response = await fetch('/api/admin/ai/content-sources');
      if (response.ok) {
        const data = await response.json();
        const configs = data.data?.configs || [];
        
        for (const config of configs) {
          this.registry.configs.set(config.id, config);
        }
      }
    } catch (error) {
      console.error('Error loading content source configurations:', error);
    }
  }

  /**
   * Auto-enable newly discovered sources
   */
  private async autoEnableNewSources(): Promise<void> {
    for (const [providerId, provider] of this.registry.providers) {
      if (!this.registry.configs.has(providerId)) {
        // New source discovered - create default configuration
        const defaultConfig: ContentSourceConfig = {
          id: providerId,
          providerId,
          enabled: true, // Auto-enable new sources
          priority: 50,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        this.registry.configs.set(providerId, defaultConfig);
        await this.saveConfiguration(defaultConfig);
        
        console.log(`Auto-enabled new content source: ${provider.name}`);
      }
    }
  }

  /**
   * Save configuration to database
   */
  private async saveConfiguration(config: ContentSourceConfig): Promise<void> {
    try {
      await fetch('/api/admin/ai/content-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
    } catch (error) {
      console.error('Error saving content source configuration:', error);
    }
  }
}

/**
 * Built-in Content Source Providers
 */

class ProjectContentProvider implements ContentSourceProvider {
  id = 'projects';
  type: ContentSourceType = 'project';
  name = 'Projects';
  description = 'Portfolio projects and case studies';
  version = '1.0.0';

  async isAvailable(): Promise<boolean> {
    // Skip availability check in server context to avoid fetch issues
    if (typeof window === 'undefined') {
      return true; // Assume available in server context
    }
    
    try {
      const response = await fetch('/api/projects?limit=1');
      return response.ok;
    } catch {
      return false;
    }
  }

  async getMetadata(): Promise<ContentSourceMetadata> {
    // Return placeholder metadata in server context to avoid fetch issues
    if (typeof window === 'undefined') {
      return {
        lastUpdated: new Date(),
        itemCount: 0,
        size: 0,
        tags: [],
        summary: 'Projects content source (server context)'
      };
    }
    
    const response = await fetch('/api/projects?status=PUBLISHED&visibility=PUBLIC');
    const data = await response.json();
    const projects = data.data?.projects || [];

    return {
      lastUpdated: new Date(),
      itemCount: projects.length,
      size: JSON.stringify(projects).length,
      tags: [...new Set(projects.flatMap((p: any) => (p.tags || []).map((tag: any) => typeof tag === 'string' ? tag : tag.name || '')))].filter((tag): tag is string => typeof tag === 'string'),
      summary: `${projects.length} published projects available for AI context`
    };
  }

  async searchContent(query: string, options: SearchOptions = {}): Promise<RelevantContent[]> {
    // Use existing project search functionality
    const response = await fetch(`/api/projects/search/ai-context?q=${encodeURIComponent(query)}&limit=${options.maxResults || 20}`);
    const data = await response.json();
    return data.data?.results || [];
  }
}

class AboutContentProvider implements ContentSourceProvider {
  id = 'about';
  type: ContentSourceType = 'about';
  name = 'About';
  description = 'Personal information and bio';
  version = '1.0.0';

  async isAvailable(): Promise<boolean> {
    // Skip availability check in server context to avoid fetch issues
    if (typeof window === 'undefined') {
      return true; // Assume available in server context
    }
    
    try {
      const response = await fetch('/api/homepage-config-public');
      const data = await response.json();
      const aboutSection = data.data?.config?.sections?.find((s: any) => s.type === 'about');
      return !!aboutSection;
    } catch {
      return false;
    }
  }

  async getMetadata(): Promise<ContentSourceMetadata> {
    // Return placeholder metadata in server context to avoid fetch issues
    if (typeof window === 'undefined') {
      return {
        lastUpdated: new Date(),
        itemCount: 1,
        size: 0,
        tags: [],
        summary: 'About content source (server context)'
      };
    }
    
    const response = await fetch('/api/homepage-config-public');
    const data = await response.json();
    const aboutSection = data.data?.config?.sections?.find((s: any) => s.type === 'about');
    const content = aboutSection?.config?.content || '';

    return {
      lastUpdated: new Date(),
      itemCount: 1,
      size: content.length,
      tags: aboutSection?.config?.skills || [],
      summary: 'Personal bio and background information'
    };
  }

  async searchContent(query: string, options: SearchOptions = {}): Promise<RelevantContent[]> {
    const response = await fetch('/api/homepage-config-public');
    const data = await response.json();
    const aboutSection = data.data?.config?.sections?.find((s: any) => s.type === 'about');
    
    if (!aboutSection) return [];

    const content = aboutSection.config?.content || '';
    const skills = aboutSection.config?.skills || [];
    
    // Simple relevance scoring
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const skillsText = skills.join(' ').toLowerCase();
    
    let relevanceScore = 0;
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
    
    queryTerms.forEach(term => {
      if (contentLower.includes(term)) relevanceScore += 0.3;
      if (skillsText.includes(term)) relevanceScore += 0.5;
    });

    if (relevanceScore < (options.minRelevanceScore || 0.1)) {
      return [];
    }

    return [{
      id: 'about-main',
      type: 'about',
      title: 'About',
      content,
      summary: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
      relevanceScore: Math.min(relevanceScore, 1),
      keywords: skills
    }];
  }
}

class ResumeContentProvider implements ContentSourceProvider {
  id = 'resume';
  type: ContentSourceType = 'resume';
  name = 'Resume';
  description = 'Professional resume and CV information';
  version = '1.0.0';

  async isAvailable(): Promise<boolean> {
    // Check if resume data exists in the system
    // This would depend on how resume data is stored
    return false; // Placeholder - implement based on actual resume storage
  }

  async getMetadata(): Promise<ContentSourceMetadata> {
    return {
      lastUpdated: new Date(),
      itemCount: 0,
      size: 0,
      tags: [],
      summary: 'Resume data not available'
    };
  }

  async searchContent(query: string, options: SearchOptions = {}): Promise<RelevantContent[]> {
    // Placeholder implementation
    return [];
  }
}

class ExperienceContentProvider implements ContentSourceProvider {
  id = 'experience';
  type: ContentSourceType = 'experience';
  name = 'Experience';
  description = 'Work experience and professional history';
  version = '1.0.0';

  async isAvailable(): Promise<boolean> {
    // Skip availability check in server context to avoid fetch issues
    if (typeof window === 'undefined') {
      return true; // Assume available in server context
    }
    
    // Check if experience data is available in homepage config
    try {
      const response = await fetch('/api/homepage-config-public');
      const data = await response.json();
      const experienceSection = data.data?.config?.sections?.find((s: any) => s.type === 'experience');
      return !!experienceSection;
    } catch {
      return false;
    }
  }

  async getMetadata(): Promise<ContentSourceMetadata> {
    // Return placeholder metadata in server context to avoid fetch issues
    if (typeof window === 'undefined') {
      return {
        lastUpdated: new Date(),
        itemCount: 0,
        size: 0,
        tags: [],
        summary: 'Experience content source (server context)'
      };
    }
    
    const response = await fetch('/api/homepage-config-public');
    const data = await response.json();
    const experienceSection = data.data?.config?.sections?.find((s: any) => s.type === 'experience');
    const experiences = experienceSection?.config?.experiences || [];

    return {
      lastUpdated: new Date(),
      itemCount: experiences.length,
      size: JSON.stringify(experiences).length,
      tags: [...new Set(experiences.flatMap((e: any) => (e.skills || []).map((skill: any) => typeof skill === 'string' ? skill : String(skill))))].filter((tag): tag is string => typeof tag === 'string'),
      summary: `${experiences.length} work experiences available`
    };
  }

  async searchContent(query: string, options: SearchOptions = {}): Promise<RelevantContent[]> {
    const response = await fetch('/api/homepage-config-public');
    const data = await response.json();
    const experienceSection = data.data?.config?.sections?.find((s: any) => s.type === 'experience');
    
    if (!experienceSection) return [];

    const experiences = experienceSection.config?.experiences || [];
    const results: RelevantContent[] = [];
    const queryLower = query.toLowerCase();

    experiences.forEach((exp: any, index: number) => {
      const searchText = [
        exp.title || '',
        exp.company || '',
        exp.description || '',
        ...(exp.skills || [])
      ].join(' ').toLowerCase();

      let relevanceScore = 0;
      const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
      
      queryTerms.forEach(term => {
        if (searchText.includes(term)) {
          relevanceScore += 0.2;
        }
      });

      if (relevanceScore >= (options.minRelevanceScore || 0.1)) {
        results.push({
          id: `experience-${index}`,
          type: 'experience',
          title: `${exp.title} at ${exp.company}`,
          content: exp.description || '',
          summary: `${exp.title} role at ${exp.company}`,
          relevanceScore: Math.min(relevanceScore, 1),
          keywords: exp.skills || []
        });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

class SkillsContentProvider implements ContentSourceProvider {
  id = 'skills';
  type: ContentSourceType = 'skills';
  name = 'Skills';
  description = 'Technical and professional skills';
  version = '1.0.0';

  async isAvailable(): Promise<boolean> {
    // Skip availability check in server context to avoid fetch issues
    if (typeof window === 'undefined') {
      return true; // Assume available in server context
    }
    
    try {
      const response = await fetch('/api/homepage-config-public');
      const data = await response.json();
      const aboutSection = data.data?.config?.sections?.find((s: any) => s.type === 'about');
      return !!(aboutSection?.config?.skills?.length > 0);
    } catch {
      return false;
    }
  }

  async getMetadata(): Promise<ContentSourceMetadata> {
    // Return placeholder metadata in server context to avoid fetch issues
    if (typeof window === 'undefined') {
      return {
        lastUpdated: new Date(),
        itemCount: 0,
        size: 0,
        tags: [],
        summary: 'Skills content source (server context)'
      };
    }
    
    const response = await fetch('/api/homepage-config-public');
    const data = await response.json();
    const aboutSection = data.data?.config?.sections?.find((s: any) => s.type === 'about');
    const skills = aboutSection?.config?.skills || [];

    return {
      lastUpdated: new Date(),
      itemCount: skills.length,
      size: skills.join(', ').length,
      tags: skills,
      summary: `${skills.length} skills available`
    };
  }

  async searchContent(query: string, options: SearchOptions = {}): Promise<RelevantContent[]> {
    const response = await fetch('/api/homepage-config-public');
    const data = await response.json();
    const aboutSection = data.data?.config?.sections?.find((s: any) => s.type === 'about');
    
    if (!aboutSection) return [];

    const skills = aboutSection.config?.skills || [];
    const queryLower = query.toLowerCase();
    
    const matchingSkills = skills.filter((skill: string) => 
      skill.toLowerCase().includes(queryLower) ||
      queryLower.split(/\s+/).some(term => skill.toLowerCase().includes(term))
    );

    if (matchingSkills.length === 0) return [];

    return [{
      id: 'skills-main',
      type: 'skills',
      title: 'Skills',
      content: matchingSkills.join(', '),
      summary: `Relevant skills: ${matchingSkills.slice(0, 5).join(', ')}`,
      relevanceScore: Math.min(matchingSkills.length / skills.length + 0.2, 1),
      keywords: matchingSkills
    }];
  }
}

// Export singleton instance
export const contentSourceManager = ContentSourceManager.getInstance();