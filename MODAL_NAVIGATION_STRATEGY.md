# Modal Navigation Strategy

## Problem Statement

The current modal navigation system has inconsistencies:

- **Projects Page**: URL changes (`?project=e-commerce-platform`) ✅
- **Homepage**: No URL changes for modals ❌
- **Nested Modals**: No clear strategy for URL management ❌

This creates problems for:
- NavigationOrchestrator state tracking
- Browser back/forward functionality
- Shareable URLs
- Voice AI navigation reliability

## Proposed Solution: Hierarchical Modal Management

### 1. Modal Classification System

```typescript
interface ModalStackEntry {
  id: string;
  type: 'project' | 'example' | 'gallery' | 'generic';
  parentId?: string;
  urlTracked: boolean;        // Whether this modal affects URL
  level: number;              // Nesting level (0 = top level)
  context?: any;              // Additional context data
}
```

### 2. URL Tracking Strategy

#### **Level 0 (Top-Level Modals)**
- ✅ **Always tracked in URL**
- Examples: Project modals, main gallery modals
- URL: `?project=e-commerce-platform`

#### **Level 1 (Important Nested Modals)**
- ✅ **Selectively tracked in URL**
- Examples: Project sections, important sub-modals
- URL: `?project=e-commerce-platform&section=gallery`

#### **Level 2+ (Deep Nested Modals)**
- ❌ **Not tracked in URL**
- Examples: Image lightboxes, confirmation dialogs, tooltips
- Managed in memory only

### 3. Implementation Strategy

#### **Phase 1: Standardize Existing Modals**

**Homepage Modals:**
```typescript
// Before: No URL tracking
showModal('contact-form');

// After: Consistent URL tracking
await ui_intent({
  target: { type: 'modal', id: 'contact-form' },
  behavior: { urlStrategy: 'full' }
});
// URL becomes: /?modal=contact-form
```

**Projects Page Modals:**
```typescript
// Already working
await ui_intent({
  target: { type: 'project', id: 'e-commerce-platform' }
});
// URL: /projects?project=e-commerce-platform
```

#### **Phase 2: Nested Modal Support**

**Project → Section Navigation:**
```typescript
await ui_intent({
  target: { 
    type: 'section', 
    id: 'technical-details',
    projectId: 'e-commerce-platform'
  },
  behavior: { urlStrategy: 'minimal' }
});
// URL: /projects?project=e-commerce-platform&section=technical-details
```

**Project → Gallery → Image:**
```typescript
// Open gallery (tracked)
await ui_intent({
  target: { 
    type: 'modal', 
    id: 'gallery',
    parentContext: 'project:e-commerce-platform'
  },
  behavior: { urlStrategy: 'minimal' }
});
// URL: /projects?project=e-commerce-platform&modal=gallery

// Open specific image (not tracked)
await ui_intent({
  target: { 
    type: 'modal', 
    id: 'image-lightbox',
    parentContext: 'gallery:project-gallery'
  },
  behavior: { urlStrategy: 'none' }
});
// URL unchanged - managed in memory only
```

### 4. URL Strategy Options

```typescript
type URLStrategy = 'full' | 'minimal' | 'none';

// Full: Complete URL tracking with all parameters
behavior: { urlStrategy: 'full' }
// URL: /?modal=contact&form=inquiry&step=2

// Minimal: Only essential parameters
behavior: { urlStrategy: 'minimal' }
// URL: /?modal=contact

// None: No URL changes (memory only)
behavior: { urlStrategy: 'none' }
// URL unchanged
```

### 5. Modal Stack Management

#### **Stack Structure:**
```typescript
modalStack = [
  { id: 'e-commerce-platform', type: 'project', level: 0, urlTracked: true },
  { id: 'gallery', type: 'gallery', level: 1, urlTracked: true, parentId: 'e-commerce-platform' },
  { id: 'image-3', type: 'generic', level: 2, urlTracked: false, parentId: 'gallery' }
];
```

#### **URL Representation:**
```
/projects?project=e-commerce-platform&modal=gallery
```

#### **Browser Back/Forward Behavior:**
- **Back**: Closes `gallery` modal, stays in project
- **Back again**: Closes project modal, returns to projects list
- **Forward**: Reopens modals in sequence

### 6. NavigationOrchestrator Integration

#### **Enhanced State Tracking:**
```typescript
interface UIDescribeResponse {
  epoch: number;
  route: string;
  viewStack: string[];           // ["projects", "project:e-commerce", "gallery"]
  modalStack: ModalStackEntry[]; // Full modal hierarchy
  sections: Array<{ id: string; title: string; }>;
  transitions: Array<{ id: string; kind: string; target?: string; }>;
}
```

#### **Smart Navigation Planning:**
```typescript
// User wants to go from: Project A → Gallery → Image 3
// To: Project B → Technical Details

// NavigationOrchestrator automatically:
// 1. Closes Image 3 (level 2, not URL tracked)
// 2. Closes Gallery (level 1, URL tracked)
// 3. Closes Project A (level 0, URL tracked)
// 4. Opens Project B (level 0, URL tracked)
// 5. Scrolls to Technical Details section
```

### 7. Implementation Examples

#### **Homepage Contact Modal:**
```typescript
// Add URL tracking to homepage modals
await ui_intent({
  target: { type: 'modal', id: 'contact-form' },
  behavior: { 
    urlStrategy: 'full',
    waitForReadyMs: 300 
  }
});

// URL: /?modal=contact-form
// Browser back: closes modal, returns to homepage
// Shareable: Yes
```

#### **Complex Project Navigation:**
```typescript
// Navigate to specific section in different project
await ui_intent({
  target: { 
    type: 'section', 
    id: 'performance-metrics',
    projectId: 'task-management-app'
  },
  behavior: { 
    urlStrategy: 'minimal',
    closeBlocking: true 
  }
});

// NavigationOrchestrator handles:
// 1. Close any open modals
// 2. Navigate to /projects if needed
// 3. Open task-management-app modal
// 4. Scroll to performance-metrics section
// URL: /projects?project=task-management-app&section=performance-metrics
```

#### **Nested Modal Chain:**
```typescript
// Open project → gallery → specific image
await ui_intent({
  target: { type: 'project', id: 'portfolio-website' }
});

await ui_intent({
  target: { 
    type: 'modal', 
    id: 'screenshot-gallery',
    parentContext: 'project:portfolio-website'
  },
  behavior: { urlStrategy: 'minimal' }
});

await ui_intent({
  target: { 
    type: 'modal', 
    id: 'screenshot-1',
    parentContext: 'gallery:screenshot-gallery'
  },
  behavior: { urlStrategy: 'none' }
});

// Final URL: /projects?project=portfolio-website&modal=screenshot-gallery
// Modal stack: [project, gallery, image] - only first two tracked
```

### 8. Benefits of This Approach

#### **For Users:**
- ✅ Consistent browser back/forward behavior
- ✅ Shareable URLs for important modal states
- ✅ Clean URLs (no deep nesting pollution)
- ✅ Fast navigation (deep modals don't affect URL)

#### **For Voice AI:**
- ✅ Reliable state tracking across all pages
- ✅ Predictable navigation behavior
- ✅ Clear modal hierarchy understanding
- ✅ Robust error recovery

#### **For Developers:**
- ✅ Consistent modal management API
- ✅ Flexible URL strategy per use case
- ✅ Automatic browser integration
- ✅ Comprehensive debug information

### 9. Migration Plan

#### **Phase 1: Homepage Consistency (Week 1)**
- Add URL tracking to homepage modals
- Update existing modal components
- Test browser navigation

#### **Phase 2: Enhanced NavigationOrchestrator (Week 2)**
- Implement modal stack management
- Add URL strategy options
- Update tool definitions

#### **Phase 3: Nested Modal Support (Week 3)**
- Implement hierarchical modal system
- Add parent context tracking
- Test complex navigation scenarios

#### **Phase 4: Integration & Testing (Week 4)**
- Full voice AI integration testing
- Performance optimization
- Documentation and examples

### 10. Technical Implementation

#### **Modal Stack API:**
```typescript
// Get current modal state
const modalStack = orchestrator.getModalStack();
const isModalOpen = modalStack.some(m => m.id === 'contact-form');

// Listen for modal state changes
orchestrator.addModalStateListener((stack) => {
  console.log('Modal stack changed:', stack);
  updateUIState(stack);
});

// Manual modal management (if needed)
orchestrator.pushModal({
  id: 'custom-modal',
  type: 'generic',
  urlTracked: true
});
```

#### **URL Strategy Configuration:**
```typescript
// Configure default URL strategies
orchestrator.configureTiming({
  defaultURLStrategy: 'minimal',
  maxURLTrackedModals: 2,
  urlUpdateDebounceMs: 100
});
```

This strategy provides a robust, scalable solution for modal navigation that works consistently across all pages while maintaining clean URLs and excellent user experience.