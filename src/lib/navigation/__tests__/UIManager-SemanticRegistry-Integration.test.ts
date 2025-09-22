/**
 * UIManager + SemanticIDRegistry Integration Tests
 * 
 * Tests the integration between UIManager and SemanticIDRegistry
 * to ensure semantic navigation works correctly.
 */

import { UIManager } from '../UIManager';
import { getSemanticIDRegistry, SemanticIDRegistryProvider } from '../SemanticIDRegistry';

// Mock DOM environment
const mockElement = (id: string, semanticId?: string) => {
  const element = document.createElement('div');
  element.id = id;
  if (semanticId) {
    element.setAttribute('data-semantic-id', semanticId);
  }
  return element;
};

describe('UIManager + SemanticIDRegistry Integration', () => {
  let registry: SemanticIDRegistryProvider;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    
    // Create fresh registry instance (avoid singleton issues)
    registry = new SemanticIDRegistryProvider();
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('ContentProvider Interface', () => {
    test('should implement ContentProvider interface correctly', () => {
      expect(registry.name).toBe('semantic-id-registry');
      expect(typeof registry.discoverSections).toBe('function');
      expect(typeof registry.searchContent).toBe('function');
      expect(typeof registry.validateSection).toBe('function');
    });

    test('should discover sections using semantic registry', async () => {
      // Add elements with semantic IDs to DOM
      const contactElement = mockElement('contact-form', 'contact');
      const aboutElement = mockElement('about-section', 'about');
      const customElement = mockElement('custom-section', 'custom-feature');
      
      document.body.appendChild(contactElement);
      document.body.appendChild(aboutElement);
      document.body.appendChild(customElement);

      // Initialize registry
      registry.initialize();

      // Create navigation context
      const context = {
        currentRoute: 'home',
        currentProject: null,
        modalStack: [],
        visibleSections: [],
        canNavigate: true
      };

      // Get sections from registry
      const sections = await registry.discoverSections(context);

      // Check that semantic sections are discovered
      const semanticSections = sections.filter(s => s.semanticId);
      expect(semanticSections.length).toBeGreaterThan(0);

      // Check for specific semantic IDs
      const semanticIds = semanticSections.map(s => s.semanticId);
      expect(semanticIds).toContain('contact');
      expect(semanticIds).toContain('about');
      expect(semanticIds).toContain('custom-feature');
    });
  });

  describe('Element Resolution', () => {
    test('should resolve semantic IDs to elements', () => {
      const testElement = mockElement('test-element', 'test-semantic');
      document.body.appendChild(testElement);

      registry.initialize();

      const resolved = registry.resolveSemanticID('test-semantic');
      expect(resolved).toBe(testElement);
    });

    test('should validate semantic IDs', async () => {
      const testElement = mockElement('valid-element', 'valid-semantic');
      document.body.appendChild(testElement);

      registry.initialize();

      const isValid = await registry.validateSection('valid-semantic');
      expect(isValid).toBe(true);

      const isInvalid = await registry.validateSection('non-existent-semantic');
      expect(isInvalid).toBe(false);
    });

    test('should handle graceful fallback for missing elements', () => {
      registry.initialize();

      // Should return null for non-existent semantic ID
      const resolved = registry.resolveSemanticID('non-existent-semantic');
      expect(resolved).toBeNull();
    });
  });

  describe('Registry Updates', () => {
    test('should update registry when DOM changes', async () => {
      registry.initialize();

      // Initial state - no custom element
      expect(registry.resolveSemanticID('dynamic-element')).toBeNull();

      // Add element dynamically
      const dynamicElement = mockElement('dynamic-section', 'dynamic-element');
      document.body.appendChild(dynamicElement);

      // Manually trigger registry update instead of relying on mutation observer
      registry.updateFromDOM();

      // Registry should now find the element
      const resolved = registry.resolveSemanticID('dynamic-element');
      expect(resolved).toBe(dynamicElement);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid selectors gracefully', () => {
      registry.registerSemanticID('invalid-selector-test', {
        selector: '[[invalid-css-selector]]',
        aliases: [],
        fallbackId: 'invalid'
      });

      // Should return null instead of throwing
      const resolved = registry.resolveSemanticID('invalid-selector-test');
      expect(resolved).toBeNull();
    });

    test('should handle missing elements gracefully', async () => {
      registry.registerSemanticID('missing-element-test', {
        selector: '#does-not-exist',
        aliases: [],
        fallbackId: 'missing'
      });

      // Should return false for validation
      const isValid = await registry.validateSection('missing-element-test');
      expect(isValid).toBe(false);
    });
  });

  describe('Performance', () => {
    test('should cache validation results', async () => {
      const testElement = mockElement('cached-element', 'cached-semantic');
      document.body.appendChild(testElement);

      registry.initialize();

      // First validation
      const start1 = performance.now();
      const result1 = await registry.validateSection('cached-semantic');
      const time1 = performance.now() - start1;

      // Second validation (should be cached)
      const start2 = performance.now();
      const result2 = await registry.validateSection('cached-semantic');
      const time2 = performance.now() - start2;

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      
      // Second call should be faster due to caching
      // Note: This is a rough performance test and may be flaky
      expect(time2).toBeLessThanOrEqual(time1 + 1); // Allow 1ms tolerance
    });
  });
});