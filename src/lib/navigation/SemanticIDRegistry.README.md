# Semantic ID Registry System

The Semantic ID Registry provides stable, maintainable mapping between semantic navigation targets and actual DOM elements. It enables reliable navigation that works even when DOM structure changes, making it ideal for AI-driven navigation and voice interfaces.

## Features

- **Stable Navigation**: Navigate using semantic IDs that remain consistent even when DOM structure changes
- **Automatic Discovery**: Automatically discovers elements with `data-semantic-id` attributes
- **Alias Support**: Multiple names for the same element (e.g., "contact", "get-in-touch", "reach-out")
- **Context Awareness**: Filter elements by context (homepage, project, modal, etc.)
- **Graceful Fallback**: Fallback to regular IDs when semantic IDs are not available
- **Validation & Conflict Detection**: Detect duplicate IDs, missing elements, and selector conflicts
- **UIManager Integration**: Seamlessly integrates with UIManager for declarative navigation
- **ContentProvider Interface**: Pluggable section discovery for dynamic content

## Quick Start

### 1. Initialize the Registry

```typescript
import { initializeSemanticIDRegistry } from '@/lib/navigation/SemanticIDRegistry';

// Initialize during app startup
const registry = initializeSemanticIDRegistry();
```

### 2. Add Semantic IDs to HTML

```html
<!-- Basic semantic ID -->
<section data-semantic-id="contact" id="contact-form">
  <h2>Contact Me</h2>
</section>

<!-- With aliases and context -->
<section 
  data-semantic-id="hero-cta"
  data-semantic-aliases="hero-button,main-cta,get-started"
  data-semantic-context="homepage"
  id="hero-section"
>
  <h1>Welcome</h1>
  <button>Get Started</button>
</section>
```

### 3. Navigate Using Semantic IDs

```typescript
import { UIManager } from '@/lib/navigation/UIManager';

const uiManager = UIManager.getInstance();

// Navigate with semantic ID and fallback
await uiManager.executeIntent({
  target: {
    type: 'semantic',
    semanticId: 'contact',
    fallbackId: 'contact-form'
  }
});
```

## HTML Attributes

### `data-semantic-id`
The primary semantic identifier for the element.

```html
<section data-semantic-id="about">
  <!-- content -->
</section>
```

### `data-semantic-aliases`
Comma-separated list of alternative names for the element.

```html
<section 
  data-semantic-id="projects"
  data-semantic-aliases="portfolio,work,showcase"
>
  <!-- content -->
</section>
```

### `data-semantic-context`
Context where this element appears (optional).

```html
<div 
  data-semantic-id="overview"
  data-semantic-context="project"
>
  <!-- content -->
</div>
```

## Programmatic API

### Registry Management

```typescript
import { getSemanticIDRegistry } from '@/lib/navigation/SemanticIDRegistry';

const registry = getSemanticIDRegistry();

// Register a semantic ID
registry.registerSemanticID('custom-section', {
  selector: '[data-semantic-id="custom-section"], #custom-section',
  aliases: ['custom', 'special'],
  fallbackId: 'custom-section',
  context: 'homepage'
});

// Get all semantic IDs
const allIds = registry.getAllSemanticIDs();

// Find by alias
const semanticId = registry.findSemanticIDByAlias('portfolio'); // returns 'projects'

// Unregister
registry.unregisterSemanticID('custom-section');
```

### Element Resolution

```typescript
// Resolve semantic ID to DOM element
const element = registry.resolveSemanticID('contact');
if (element) {
  element.scrollIntoView({ behavior: 'smooth' });
}

// Validate semantic ID exists
const isValid = await registry.validateSection('about');
console.log('About section exists:', isValid);
```

### Content Search

```typescript
// Search by semantic IDs and aliases
const results = await registry.searchContent('portfolio');
// Returns: [{ semanticId: 'projects', title: 'Projects', relevance: 80, ... }]
```

## UIManager Integration

The Semantic ID Registry integrates seamlessly with UIManager as a ContentProvider:

```typescript
import { UIManager } from '@/lib/navigation/UIManager';

const uiManager = UIManager.getInstance();
uiManager.initialize(); // Automatically registers semantic registry

// Use semantic navigation
await uiManager.executeIntent({
  target: { type: 'semantic', semanticId: 'hero-cta', fallbackId: 'hero' }
});

// Direct access to registry
const registry = uiManager.getSemanticIDRegistry();
const element = uiManager.resolveSemanticID('contact');
const isValid = await uiManager.validateSemanticID('about');
```

## Validation & Debugging

### Registry Validation

```typescript
// Validate entire registry
const validation = registry.validateRegistry();

if (!validation.isValid) {
  console.log('Conflicts:', validation.conflicts);
  // [{ semanticId: 'section1', conflictType: 'selector_conflict', details: '...' }]
}

console.log('Warnings:', validation.warnings);
// [{ semanticId: 'section2', warningType: 'missing_element', details: '...' }]
```

### Debug Information

```typescript
// Get registry entry details
const entry = registry.getSemanticIDEntry('contact');
console.log('Selector:', entry?.selector);
console.log('Aliases:', entry?.aliases);
console.log('Last seen:', entry?.lastSeen);
console.log('Is valid:', entry?.isValid);
```

## Default Semantic IDs

The registry comes with default mappings for common elements:

| Semantic ID | Aliases | Default Selector |
|-------------|---------|------------------|
| `contact` | contact-form, get-in-touch, reach-out | `[data-semantic-id="contact"], #contact, [id*="contact"]` |
| `about` | bio, background, profile | `[data-semantic-id="about"], #about, [id*="about"]` |
| `projects` | portfolio, work, showcase | `[data-semantic-id="projects"], #projects, [id*="projects"]` |
| `experience` | work-history, career, employment | `[data-semantic-id="experience"], #experience, [id*="experience"]` |
| `skills` | technologies, expertise, capabilities | `[data-semantic-id="skills"], #skills, [id*="skills"]` |
| `home` | homepage, landing, intro | `[data-semantic-id="home"], #home, .hero-section, main` |

## Voice Agent Integration

Voice agents can use semantic navigation for natural language commands:

```typescript
// Voice command: "Show me the contact form"
// Maps to semantic navigation:
await uiManager.executeIntent({
  target: { 
    type: 'semantic', 
    semanticId: 'contact',
    fallbackId: 'contact-form'
  }
});

// Voice command: "Go to my portfolio"
// Uses alias mapping: portfolio → projects
const semanticId = registry.findSemanticIDByAlias('portfolio'); // 'projects'
await uiManager.executeIntent({
  target: { type: 'semantic', semanticId }
});
```

## Best Practices

### 1. Semantic ID Naming
- Use descriptive names that reflect content purpose, not visual appearance
- Use kebab-case: `hero-cta`, `project-overview`, `contact-form`
- Avoid implementation details: `contact` not `contact-modal-section`

### 2. Aliases
- Include natural language variations: `about`, `bio`, `background`
- Consider user terminology: `portfolio`, `work`, `projects`
- Add common misspellings if relevant

### 3. Fallback Strategy
- Always provide fallback IDs for graceful degradation
- Use existing element IDs as fallbacks when possible
- Test navigation with and without semantic IDs

### 4. Context Usage
- Use context for elements that appear in multiple places
- Common contexts: `homepage`, `project`, `modal`, `admin`
- Keep context names consistent across the application

### 5. Validation
- Validate registry in tests to catch conflicts early
- Use registry validation in development builds
- Monitor for missing elements and stale entries

### 6. Performance
- Registry caches validation results for 5 seconds
- Section discovery is cached for 30 seconds
- Manual cache clearing available: `registry.clearValidationCache()`

## Testing

```typescript
import { SemanticIDRegistryProvider } from '@/lib/navigation/SemanticIDRegistry';

describe('Semantic Navigation', () => {
  let registry: SemanticIDRegistryProvider;

  beforeEach(() => {
    registry = new SemanticIDRegistryProvider();
    registry.initialize();
  });

  afterEach(() => {
    registry.destroy();
  });

  test('should resolve semantic IDs', () => {
    const element = document.createElement('div');
    element.setAttribute('data-semantic-id', 'test-section');
    document.body.appendChild(element);

    registry.updateFromDOM();

    const resolved = registry.resolveSemanticID('test-section');
    expect(resolved).toBe(element);
  });
});
```

## Migration Guide

### From Direct Element Targeting

**Before:**
```typescript
// Brittle - breaks when DOM structure changes
const element = document.querySelector('#contact-form-section .contact-form');
element?.scrollIntoView();
```

**After:**
```typescript
// Stable - works even when DOM structure changes
const element = registry.resolveSemanticID('contact');
element?.scrollIntoView();
```

### From UIManager Direct Navigation

**Before:**
```typescript
await uiManager.executeIntent({
  target: { type: 'section', id: 'contact-form-section' }
});
```

**After:**
```typescript
await uiManager.executeIntent({
  target: { 
    type: 'semantic', 
    semanticId: 'contact',
    fallbackId: 'contact-form-section'
  }
});
```

## Architecture

The Semantic ID Registry implements the ContentProvider interface and integrates with UIManager's pluggable section discovery system:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   UIManager     │────│ ContentProvider  │────│ SemanticID      │
│                 │    │ Interface        │    │ Registry        │
│ - executeIntent │    │                  │    │                 │
│ - describe      │    │ - discoverSections│    │ - resolveID     │
│ - validate      │    │ - searchContent  │    │ - validateID    │
└─────────────────┘    │ - validateSection│    │ - searchContent │
                       └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │ DOM Elements    │
                                               │ with semantic   │
                                               │ IDs             │
                                               └─────────────────┘
```

## Error Handling

The registry handles errors gracefully:

- **Invalid selectors**: Returns null instead of throwing
- **Missing elements**: Returns false for validation, null for resolution
- **Duplicate IDs**: Detected in validation, last registered wins
- **DOM changes**: Automatically updates via mutation observer (disabled in tests)
- **Initialization failures**: UIManager continues to work without semantic features

## Performance Considerations

- Registry initialization scans DOM once for `data-semantic-id` attributes
- Mutation observer watches for DOM changes (disabled in test environment)
- Validation results cached for 5 seconds to avoid repeated DOM queries
- Section discovery cached for 30 seconds with automatic invalidation
- Search operations are in-memory and very fast

## Browser Support

- Modern browsers with `MutationObserver` support
- Graceful degradation in older browsers (no automatic DOM updates)
- Works in server-side rendering environments (no DOM operations during SSR)
- Full support in Jest/JSDOM test environments