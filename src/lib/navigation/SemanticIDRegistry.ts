/**
 * SemanticIDRegistry - Stable ID Mapping System for Navigation
 * 
 * Provides stable, maintainable mapping between semantic navigation targets
 * and actual DOM elements. Implements ContentProvider interface for UIManager
 * integration with automatic registry updates and conflict detection.
 * 
 * Features:
 * - Stable semantic ID to DOM selector mapping
 * - Automatic registry population from data-semantic-id attributes
 * - Registry validation and conflict detection
 * - Integration with UIManager for reliable element targeting
 * - Graceful degradation when semantic IDs are not available
 */

import { ContentProvider, NavigationContext, SemanticSection } from './UIManager';
import { debugEventEmitter } from '../debug/debugEventEmitter';

// Registry entry structure
export interface SemanticIDEntry {
  selector: string;           // CSS selector to find the element
  aliases: string[];          // Alternative names for this semantic ID
  context?: string;           // Optional context (route, modal, project)
  fallbackId?: string;        // Fallback regular ID if semantic fails
  lastSeen?: number;          // Timestamp when element was last found
  isValid?: boolean;          // Whether the selector currently works
}

// Registry structure
export interface SemanticIDRegistry {
  [semanticId: string]: SemanticIDEntry;
}

// Registry validation result
export interface ValidationResult {
  isValid: boolean;
  conflicts: Array<{
    semanticId: string;
    conflictType: 'duplicate' | 'selector_conflict' | 'alias_conflict';
    details: string;
  }>;
  warnings: Array<{
    semanticId: string;
    warningType: 'missing_element' | 'stale_entry' | 'no_fallback';
    details: string;
  }>;
}

// Section discovery options
export interface SectionDiscoveryOptions {
  includeHidden?: boolean;
  contextFilter?: string;
  maxAge?: number;           // Max age in ms for cached entries
}

/**
 * SemanticIDRegistry - ContentProvider implementation for stable navigation
 */
export class SemanticIDRegistryProvider implements ContentProvider {
  name = 'semantic-id-registry';
  
  private _registry: SemanticIDRegistry = {};
  private _mutationObserver: MutationObserver | null = null;
  private _isInitialized: boolean = false;
  private _lastValidation: ValidationResult | null = null;
  private _validationCache: Map<string, { result: boolean; timestamp: number }> = new Map();
  private _cacheTimeout: number = 30000; // 30 seconds
  
  // Default semantic ID mappings for common elements
  private _defaultMappings: SemanticIDRegistry = {
    'contact': {
      selector: '[data-semantic-id="contact"], #contact, [id*="contact"]',
      aliases: ['contact-form', 'get-in-touch', 'reach-out'],
      fallbackId: 'contact'
    },
    'about': {
      selector: '[data-semantic-id="about"], #about, [id*="about"]',
      aliases: ['bio', 'background', 'profile'],
      fallbackId: 'about'
    },
    'projects': {
      selector: '[data-semantic-id="projects"], #projects, [id*="projects"]',
      aliases: ['portfolio', 'work', 'showcase'],
      fallbackId: 'projects'
    },
    'experience': {
      selector: '[data-semantic-id="experience"], #experience, [id*="experience"]',
      aliases: ['work-history', 'career', 'employment'],
      fallbackId: 'experience'
    },
    'skills': {
      selector: '[data-semantic-id="skills"], #skills, [id*="skills"]',
      aliases: ['technologies', 'expertise', 'capabilities'],
      fallbackId: 'skills'
    },
    'home': {
      selector: '[data-semantic-id="home"], #home, .hero-section, main',
      aliases: ['homepage', 'landing', 'intro'],
      fallbackId: 'home'
    }
  };

  constructor() {
    this._registry = { ...this._defaultMappings };
  }

  /**
   * Initialize the registry with DOM observation
   */
  initialize(): void {
    if (this._isInitialized) {
      return;
    }

    this._populateRegistryFromDOM();
    this._setupMutationObserver();
    this._isInitialized = true;

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'semantic_registry_initialized',
        registrySize: Object.keys(this._registry).length,
        defaultMappings: Object.keys(this._defaultMappings).length
      },
      'semantic-id-registry'
    );

    console.log('SemanticIDRegistry initialized with', Object.keys(this._registry).length, 'entries');
  }

  /**
   * ContentProvider interface: Discover sections based on semantic IDs
   */
  async discoverSections(context: NavigationContext): Promise<SemanticSection[]> {
    const sections: SemanticSection[] = [];
    const currentTime = Date.now();

    for (const [semanticId, entry] of Object.entries(this._registry)) {
      // Skip stale entries if maxAge is specified
      if (entry.lastSeen && (currentTime - entry.lastSeen) > this._cacheTimeout) {
        continue;
      }

      // Filter by context if specified
      if (entry.context && context.currentRoute && entry.context !== context.currentRoute) {
        continue;
      }

      // Try to find the element to verify it exists
      const element = this._findElementByEntry(entry);
      if (!element) {
        continue;
      }

      // Extract section information
      const title = this._extractSectionTitle(element, semanticId);
      const type = this._determineSectionType(semanticId, context);

      sections.push({
        id: semanticId,
        semanticId: semanticId,
        title: title,
        type: type,
        projectId: context.currentProject || undefined,
        containerId: this._getContainerId(element),
        // Future semantic features
        keywords: [semanticId, ...entry.aliases],
        metadata: {
          selector: entry.selector,
          aliases: entry.aliases,
          fallbackId: entry.fallbackId,
          lastSeen: entry.lastSeen
        }
      });
    }

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'sections_discovered',
        provider: this.name,
        sectionsFound: sections.length,
        context: context.currentRoute
      },
      'semantic-id-registry'
    );

    return sections;
  }

  /**
   * ContentProvider interface: Search content by semantic IDs and aliases
   */
  async searchContent(query: string, options?: any): Promise<any[]> {
    const results: any[] = [];
    const queryLower = query.toLowerCase();

    for (const [semanticId, entry] of Object.entries(this._registry)) {
      // Check if query matches semantic ID or aliases
      const matches = [semanticId, ...entry.aliases].some(term => 
        term.toLowerCase().includes(queryLower) || queryLower.includes(term.toLowerCase())
      );

      if (matches) {
        // For search, we don't require the element to exist in DOM
        // This allows searching for semantic concepts even if not currently rendered
        results.push({
          semanticId,
          title: this._extractSectionTitle(null, semanticId),
          selector: entry.selector,
          aliases: entry.aliases,
          relevance: this._calculateRelevance(queryLower, semanticId, entry.aliases)
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  /**
   * ContentProvider interface: Validate that a section exists
   */
  async validateSection(sectionId: string): Promise<boolean> {
    // Check cache first
    const cached = this._validationCache.get(sectionId);
    if (cached && (Date.now() - cached.timestamp) < 5000) { // 5 second cache
      return cached.result;
    }

    const entry = this._registry[sectionId];
    if (!entry) {
      this._validationCache.set(sectionId, { result: false, timestamp: Date.now() });
      return false;
    }

    const element = this._findElementByEntry(entry);
    const isValid = element !== null;

    // Update entry validity
    entry.isValid = isValid;
    if (isValid) {
      entry.lastSeen = Date.now();
    }

    // Cache result
    this._validationCache.set(sectionId, { result: isValid, timestamp: Date.now() });

    return isValid;
  }

  /**
   * Register a new semantic ID mapping
   */
  registerSemanticID(semanticId: string, entry: Omit<SemanticIDEntry, 'lastSeen' | 'isValid'>): void {
    const fullEntry: SemanticIDEntry = {
      ...entry,
      lastSeen: Date.now(),
      isValid: true
    };

    this._registry[semanticId] = fullEntry;

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'semantic_id_registered',
        semanticId,
        selector: entry.selector,
        aliases: entry.aliases
      },
      'semantic-id-registry'
    );
  }

  /**
   * Unregister a semantic ID
   */
  unregisterSemanticID(semanticId: string): void {
    delete this._registry[semanticId];
    this._validationCache.delete(semanticId);

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'semantic_id_unregistered',
        semanticId
      },
      'semantic-id-registry'
    );
  }

  /**
   * Get semantic ID entry by ID
   */
  getSemanticIDEntry(semanticId: string): SemanticIDEntry | undefined {
    return this._registry[semanticId];
  }

  /**
   * Resolve semantic ID to actual DOM element
   */
  resolveSemanticID(semanticId: string): Element | null {
    const entry = this._registry[semanticId];
    if (!entry) {
      return null;
    }

    return this._findElementByEntry(entry);
  }

  /**
   * Get all registered semantic IDs
   */
  getAllSemanticIDs(): string[] {
    return Object.keys(this._registry);
  }

  /**
   * Find semantic ID by alias
   */
  findSemanticIDByAlias(alias: string): string | null {
    // Search in reverse order to prioritize recently registered entries
    const entries = Object.entries(this._registry).reverse();
    for (const [semanticId, entry] of entries) {
      if (entry.aliases.includes(alias)) {
        return semanticId;
      }
    }
    return null;
  }

  /**
   * Validate the entire registry for conflicts and issues
   */
  validateRegistry(): ValidationResult {
    const conflicts: ValidationResult['conflicts'] = [];
    const warnings: ValidationResult['warnings'] = [];
    const seenSelectors = new Map<string, string>();
    const seenAliases = new Map<string, string>();

    for (const [semanticId, entry] of Object.entries(this._registry)) {
      // Check for duplicate selectors
      if (seenSelectors.has(entry.selector)) {
        conflicts.push({
          semanticId,
          conflictType: 'selector_conflict',
          details: `Selector "${entry.selector}" already used by "${seenSelectors.get(entry.selector)}"`
        });
      } else {
        seenSelectors.set(entry.selector, semanticId);
      }

      // Check for alias conflicts
      for (const alias of entry.aliases) {
        if (seenAliases.has(alias)) {
          conflicts.push({
            semanticId,
            conflictType: 'alias_conflict',
            details: `Alias "${alias}" already used by "${seenAliases.get(alias)}"`
          });
        } else {
          seenAliases.set(alias, semanticId);
        }
      }

      // Check if element exists
      const element = this._findElementByEntry(entry);
      if (!element) {
        warnings.push({
          semanticId,
          warningType: 'missing_element',
          details: `No element found for selector "${entry.selector}"`
        });
      }

      // Check for missing fallback
      if (!entry.fallbackId) {
        warnings.push({
          semanticId,
          warningType: 'no_fallback',
          details: 'No fallback ID specified'
        });
      }

      // Check for stale entries
      if (entry.lastSeen && (Date.now() - entry.lastSeen) > this._cacheTimeout) {
        warnings.push({
          semanticId,
          warningType: 'stale_entry',
          details: `Entry not seen for ${Math.round((Date.now() - entry.lastSeen) / 1000)}s`
        });
      }
    }

    const result: ValidationResult = {
      isValid: conflicts.length === 0,
      conflicts,
      warnings
    };

    this._lastValidation = result;

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'registry_validated',
        isValid: result.isValid,
        conflictsCount: conflicts.length,
        warningsCount: warnings.length
      },
      'semantic-id-registry'
    );

    return result;
  }

  /**
   * Get the last validation result
   */
  getLastValidation(): ValidationResult | null {
    return this._lastValidation;
  }

  /**
   * Update registry from current DOM state
   */
  updateFromDOM(): void {
    this._populateRegistryFromDOM();
  }

  /**
   * Clear validation cache
   */
  clearValidationCache(): void {
    this._validationCache.clear();
  }

  /**
   * Destroy the registry and clean up observers
   */
  destroy(): void {
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }

    this._registry = {};
    this._validationCache.clear();
    this._isInitialized = false;

    debugEventEmitter.emit(
      'navigation_event',
      {
        type: 'semantic_registry_destroyed'
      },
      'semantic-id-registry'
    );
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Populate registry from DOM elements with data-semantic-id attributes
   */
  private _populateRegistryFromDOM(): void {
    const elementsWithSemanticIds = document.querySelectorAll('[data-semantic-id]');
    let newEntriesCount = 0;

    elementsWithSemanticIds.forEach(element => {
      const semanticId = element.getAttribute('data-semantic-id');
      if (!semanticId) return;

      // Skip if already registered (don't override existing entries)
      if (this._registry[semanticId]) {
        // Update lastSeen timestamp
        this._registry[semanticId].lastSeen = Date.now();
        this._registry[semanticId].isValid = true;
        return;
      }

      // Create new entry
      const selector = `[data-semantic-id="${semanticId}"]`;
      const aliases = this._extractAliasesFromElement(element);
      const context = this._extractContextFromElement(element);
      const fallbackId = element.id || undefined;

      this._registry[semanticId] = {
        selector,
        aliases,
        context,
        fallbackId,
        lastSeen: Date.now(),
        isValid: true
      };

      newEntriesCount++;
    });

    if (newEntriesCount > 0) {
      debugEventEmitter.emit(
        'navigation_event',
        {
          type: 'registry_updated_from_dom',
          newEntries: newEntriesCount,
          totalEntries: Object.keys(this._registry).length
        },
        'semantic-id-registry'
      );
    }
  }

  /**
   * Set up mutation observer to watch for DOM changes
   */
  private _setupMutationObserver(): void {
    if (typeof window === 'undefined' || this._mutationObserver) {
      return;
    }

    // Skip mutation observer in test environment to avoid JSDOM issues
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this._mutationObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach(mutation => {
        // Check for added nodes with semantic IDs
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.hasAttribute('data-semantic-id') || 
                element.querySelector('[data-semantic-id]')) {
              shouldUpdate = true;
            }
          }
        });

        // Check for removed nodes
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.hasAttribute('data-semantic-id') || 
                element.querySelector('[data-semantic-id]')) {
              shouldUpdate = true;
            }
          }
        });

        // Check for attribute changes
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'data-semantic-id') {
          shouldUpdate = true;
        }
      });

      if (shouldUpdate) {
        // Debounce updates to avoid excessive processing
        setTimeout(() => this._populateRegistryFromDOM(), 100);
      }
    });

    this._mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-semantic-id']
    });
  }

  /**
   * Find element using registry entry
   */
  private _findElementByEntry(entry: SemanticIDEntry): Element | null {
    try {
      return document.querySelector(entry.selector);
    } catch (error) {
      console.error(`Invalid selector in semantic registry: ${entry.selector}`, error);
      return null;
    }
  }

  /**
   * Extract section title from element
   */
  private _extractSectionTitle(element: Element | null, fallbackId: string): string {
    if (element) {
      // Try various methods to get a meaningful title
      const titleAttr = element.getAttribute('data-title') || element.getAttribute('title');
      if (titleAttr) return titleAttr;

      // Look for heading elements within
      const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading?.textContent) return heading.textContent.trim();

      // Look for aria-label
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
    }

    // Use semantic ID as fallback, formatted nicely
    return fallbackId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Determine section type based on semantic ID and context
   */
  private _determineSectionType(semanticId: string, context: NavigationContext): 'homepage' | 'project' | 'content' {
    if (context.currentProject) {
      return 'project';
    }

    if (context.currentRoute === 'home' || semanticId === 'home') {
      return 'homepage';
    }

    return 'content';
  }

  /**
   * Get container ID for element
   */
  private _getContainerId(element: Element): string | undefined {
    // Look for parent modal or container
    const modal = element.closest('[data-modal-id], .modal, [role="dialog"]');
    if (modal) {
      return modal.getAttribute('data-modal-id') || modal.id || 'modal';
    }

    // Look for main content containers
    const container = element.closest('[data-container-id], main, section');
    if (container) {
      return container.getAttribute('data-container-id') || container.id || undefined;
    }

    return undefined;
  }

  /**
   * Extract aliases from element attributes
   */
  private _extractAliasesFromElement(element: Element): string[] {
    const aliasesAttr = element.getAttribute('data-semantic-aliases');
    if (aliasesAttr) {
      return aliasesAttr.split(',').map(alias => alias.trim()).filter(Boolean);
    }

    // Generate some default aliases based on common patterns
    const semanticId = element.getAttribute('data-semantic-id') || '';
    const aliases: string[] = [];

    // Add class-based aliases
    const classList = Array.from(element.classList);
    classList.forEach(className => {
      if (className.includes(semanticId) || semanticId.includes(className)) {
        aliases.push(className);
      }
    });

    return aliases;
  }

  /**
   * Extract context from element
   */
  private _extractContextFromElement(element: Element): string | undefined {
    return element.getAttribute('data-semantic-context') || undefined;
  }

  /**
   * Calculate relevance score for search results
   */
  private _calculateRelevance(query: string, semanticId: string, aliases: string[]): number {
    let score = 0;

    // Exact match gets highest score
    if (semanticId.toLowerCase() === query) {
      score += 100;
    } else if (semanticId.toLowerCase().includes(query)) {
      score += 50;
    } else if (query.includes(semanticId.toLowerCase())) {
      score += 30;
    }

    // Check aliases
    for (const alias of aliases) {
      if (alias.toLowerCase() === query) {
        score += 80;
      } else if (alias.toLowerCase().includes(query)) {
        score += 40;
      } else if (query.includes(alias.toLowerCase())) {
        score += 20;
      }
    }

    return score;
  }
}

// Singleton instance
let semanticIDRegistryInstance: SemanticIDRegistryProvider | null = null;

/**
 * Get the singleton SemanticIDRegistry instance
 */
export function getSemanticIDRegistry(): SemanticIDRegistryProvider {
  if (!semanticIDRegistryInstance) {
    semanticIDRegistryInstance = new SemanticIDRegistryProvider();
  }
  return semanticIDRegistryInstance;
}

/**
 * Initialize the semantic ID registry (call this once during app startup)
 */
export function initializeSemanticIDRegistry(): SemanticIDRegistryProvider {
  const registry = getSemanticIDRegistry();
  registry.initialize();
  return registry;
}