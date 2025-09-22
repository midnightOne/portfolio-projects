/**
 * SemanticIDRegistry Tests
 * 
 * Tests for the semantic ID registry system including:
 * - Registry initialization and population
 * - DOM observation and updates
 * - Validation and conflict detection
 * - ContentProvider interface implementation
 * - UIManager integration
 */

import { SemanticIDRegistryProvider, getSemanticIDRegistry } from '../SemanticIDRegistry';
import { NavigationContext } from '../UIManager';

// Mock DOM environment
const mockElement = (id: string, semanticId?: string, aliases?: string, context?: string) => {
  const element = document.createElement('div');
  element.id = id;
  if (semanticId) {
    element.setAttribute('data-semantic-id', semanticId);
  }
  if (aliases) {
    element.setAttribute('data-semantic-aliases', aliases);
  }
  if (context) {
    element.setAttribute('data-semantic-context', context);
  }
  return element;
};

describe('SemanticIDRegistry', () => {
  let registry: SemanticIDRegistryProvider;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    
    // Create fresh registry instance
    registry = new SemanticIDRegistryProvider();
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('Initialization', () => {
    test('should initialize with default mappings', () => {
      const semanticIds = registry.getAllSemanticIDs();
      
      expect(semanticIds).toContain('contact');
      expect(semanticIds).toContain('about');
      expect(semanticIds).toContain('projects');
      expect(semanticIds).toContain('experience');
      expect(semanticIds).toContain('skills');
      expect(semanticIds).toContain('home');
    });

    test('should have correct ContentProvider interface', () => {
      expect(registry.name).toBe('semantic-id-registry');
      expect(typeof registry.discoverSections).toBe('function');
      expect(typeof registry.searchContent).toBe('function');
      expect(typeof registry.validateSection).toBe('function');
    });
  });

  describe('DOM Population', () => {
    test('should populate registry from DOM elements with data-semantic-id', () => {
      // Add elements to DOM
      const contactElement = mockElement('contact-form', 'contact', 'get-in-touch,reach-out');
      const aboutElement = mockElement('about-section', 'about', 'bio,profile');
      
      document.body.appendChild(contactElement);
      document.body.appendChild(aboutElement);

      registry.initialize();

      // Check that elements were registered
      const contactEntry = registry.getSemanticIDEntry('contact');
      expect(contactEntry).toBeDefined();
      expect(contactEntry?.aliases).toContain('get-in-touch');
      expect(contactEntry?.aliases).toContain('reach-out');

      const aboutEntry = registry.getSemanticIDEntry('about');
      expect(aboutEntry).toBeDefined();
      expect(aboutEntry?.aliases).toContain('bio');
      expect(aboutEntry?.aliases).toContain('profile');
    });

    test('should handle elements with context', () => {
      const projectElement = mockElement('project-overview', 'overview', '', 'project');
      document.body.appendChild(projectElement);

      registry.initialize();

      const entry = registry.getSemanticIDEntry('overview');
      expect(entry).toBeDefined();
      expect(entry?.context).toBe('project');
    });
  });

  describe('Registry Management', () => {
    test('should register new semantic IDs', () => {
      registry.registerSemanticID('custom-section', {
        selector: '#custom-section',
        aliases: ['custom', 'special'],
        fallbackId: 'custom-section'
      });

      const entry = registry.getSemanticIDEntry('custom-section');
      expect(entry).toBeDefined();
      expect(entry?.selector).toBe('#custom-section');
      expect(entry?.aliases).toEqual(['custom', 'special']);
      expect(entry?.fallbackId).toBe('custom-section');
    });

    test('should unregister semantic IDs', () => {
      registry.registerSemanticID('temp-section', {
        selector: '#temp',
        aliases: [],
        fallbackId: 'temp'
      });

      expect(registry.getSemanticIDEntry('temp-section')).toBeDefined();

      registry.unregisterSemanticID('temp-section');
      expect(registry.getSemanticIDEntry('temp-section')).toBeUndefined();
    });

    test('should find semantic ID by alias', () => {
      registry.registerSemanticID('unique-gallery', {
        selector: '#unique-gallery',
        aliases: ['unique-photos', 'unique-images'],
        fallbackId: 'unique-gallery'
      });

      expect(registry.findSemanticIDByAlias('unique-photos')).toBe('unique-gallery');
      expect(registry.findSemanticIDByAlias('unique-images')).toBe('unique-gallery');
      expect(registry.findSemanticIDByAlias('nonexistent')).toBeNull();
    });
  });

  describe('Element Resolution', () => {
    test('should resolve semantic ID to DOM element', () => {
      const element = mockElement('test-element', 'test-section');
      document.body.appendChild(element);

      registry.initialize();

      const resolved = registry.resolveSemanticID('test-section');
      expect(resolved).toBe(element);
    });

    test('should return null for non-existent semantic ID', () => {
      const resolved = registry.resolveSemanticID('non-existent');
      expect(resolved).toBeNull();
    });

    test('should return null for invalid selector', () => {
      registry.registerSemanticID('invalid', {
        selector: '[[invalid-selector]]',
        aliases: [],
        fallbackId: 'invalid'
      });

      const resolved = registry.resolveSemanticID('invalid');
      expect(resolved).toBeNull();
    });
  });

  describe('Validation', () => {
    test('should validate existing semantic IDs', async () => {
      const element = mockElement('valid-element', 'valid-section');
      document.body.appendChild(element);

      registry.initialize();

      const isValid = await registry.validateSection('valid-section');
      expect(isValid).toBe(true);
    });

    test('should invalidate non-existent semantic IDs', async () => {
      const isValid = await registry.validateSection('non-existent');
      expect(isValid).toBe(false);
    });

    test('should cache validation results', async () => {
      const element = mockElement('cached-element', 'cached-section');
      document.body.appendChild(element);

      registry.initialize();

      // First validation
      const isValid1 = await registry.validateSection('cached-section');
      expect(isValid1).toBe(true);

      // Remove element
      element.remove();

      // Second validation should still return cached result (within 5 seconds)
      const isValid2 = await registry.validateSection('cached-section');
      expect(isValid2).toBe(true);

      // Clear cache and validate again
      registry.clearValidationCache();
      const isValid3 = await registry.validateSection('cached-section');
      expect(isValid3).toBe(false);
    });
  });

  describe('Registry Validation', () => {
    test('should detect selector conflicts', () => {
      registry.registerSemanticID('section1', {
        selector: '#duplicate',
        aliases: [],
        fallbackId: 'section1'
      });

      registry.registerSemanticID('section2', {
        selector: '#duplicate',
        aliases: [],
        fallbackId: 'section2'
      });

      const validation = registry.validateRegistry();
      expect(validation.isValid).toBe(false);
      expect(validation.conflicts).toHaveLength(1);
      expect(validation.conflicts[0].conflictType).toBe('selector_conflict');
    });

    test('should detect alias conflicts', () => {
      registry.registerSemanticID('section1', {
        selector: '#section1',
        aliases: ['shared-alias'],
        fallbackId: 'section1'
      });

      registry.registerSemanticID('section2', {
        selector: '#section2',
        aliases: ['shared-alias'],
        fallbackId: 'section2'
      });

      const validation = registry.validateRegistry();
      expect(validation.isValid).toBe(false);
      expect(validation.conflicts).toHaveLength(1);
      expect(validation.conflicts[0].conflictType).toBe('alias_conflict');
    });

    test('should warn about missing elements', () => {
      registry.registerSemanticID('missing-section', {
        selector: '#does-not-exist',
        aliases: [],
        fallbackId: 'missing-section'
      });

      const validation = registry.validateRegistry();
      expect(validation.warnings).toContainEqual(
        expect.objectContaining({
          semanticId: 'missing-section',
          warningType: 'missing_element'
        })
      );
    });

    test('should warn about missing fallbacks', () => {
      registry.registerSemanticID('no-fallback', {
        selector: '#no-fallback',
        aliases: []
        // No fallbackId
      });

      const validation = registry.validateRegistry();
      expect(validation.warnings).toContainEqual(
        expect.objectContaining({
          semanticId: 'no-fallback',
          warningType: 'no_fallback'
        })
      );
    });
  });

  describe('ContentProvider Interface', () => {
    test('should discover sections from registry', async () => {
      const element1 = mockElement('section1', 'test-section1');
      const element2 = mockElement('section2', 'test-section2');
      
      document.body.appendChild(element1);
      document.body.appendChild(element2);

      registry.initialize();

      const context: NavigationContext = {
        currentRoute: 'home',
        currentProject: null,
        modalStack: [],
        visibleSections: [],
        canNavigate: true
      };

      const sections = await registry.discoverSections(context);
      
      const testSections = sections.filter(s => s.semanticId?.startsWith('test-section'));
      expect(testSections).toHaveLength(2);
      
      expect(testSections[0].semanticId).toBe('test-section1');
      expect(testSections[1].semanticId).toBe('test-section2');
    });

    test('should filter sections by context', async () => {
      const homeElement = mockElement('home-section', 'home-only', '', 'home');
      const projectElement = mockElement('project-section', 'project-only', '', 'project');
      
      document.body.appendChild(homeElement);
      document.body.appendChild(projectElement);

      registry.initialize();

      const homeContext: NavigationContext = {
        currentRoute: 'home',
        currentProject: null,
        modalStack: [],
        visibleSections: [],
        canNavigate: true
      };

      const sections = await registry.discoverSections(homeContext);
      const contextSections = sections.filter(s => s.semanticId === 'home-only' || s.semanticId === 'project-only');
      
      // Should only include home-only section
      expect(contextSections).toHaveLength(1);
      expect(contextSections[0].semanticId).toBe('home-only');
    });

    test('should search content by semantic IDs and aliases', async () => {
      registry.registerSemanticID('unique-gallery', {
        selector: '#unique-gallery',
        aliases: ['unique-photos', 'unique-images'],
        fallbackId: 'unique-gallery'
      });

      const element = mockElement('gallery-section', 'unique-gallery');
      document.body.appendChild(element);

      const results = await registry.searchContent('unique-photos');
      expect(results).toHaveLength(1);
      expect(results[0].semanticId).toBe('unique-gallery');
      expect(results[0].relevance).toBeGreaterThan(0);
    });

    test('should sort search results by relevance', async () => {
      registry.registerSemanticID('exact-match-test', {
        selector: '#exact-test',
        aliases: [],
        fallbackId: 'exact-test'
      });

      registry.registerSemanticID('partial-match-test', {
        selector: '#partial-test',
        aliases: ['exact-match-test-alias'],
        fallbackId: 'partial-test'
      });

      const element1 = mockElement('exact-element', 'exact-match-test');
      const element2 = mockElement('partial-element', 'partial-match-test');
      
      document.body.appendChild(element1);
      document.body.appendChild(element2);

      const results = await registry.searchContent('exact-match-test');
      expect(results).toHaveLength(2);
      
      // Exact semantic ID match should have higher relevance than alias match
      expect(results[0].semanticId).toBe('exact-match-test');
      expect(results[0].relevance).toBeGreaterThan(results[1].relevance);
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance from getSemanticIDRegistry', () => {
      const instance1 = getSemanticIDRegistry();
      const instance2 = getSemanticIDRegistry();
      
      expect(instance1).toBe(instance2);
    });
  });
});