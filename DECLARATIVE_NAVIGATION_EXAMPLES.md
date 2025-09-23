# Declarative Navigation Examples

## Complex Navigation Scenario: Project Modal Switching with Section Navigation

### Scenario: Viewing Project A modal → Navigate to Section XX in Project B

**Current State:**
- User is on `/projects?project=aurora-avatar` (viewing Project A modal)
- User wants to navigate to the "technical-details" section in Project B (`e-commerce-platform`)

**AI Intent:**
```typescript
await ui_intent({
  target: { 
    type: 'section', 
    id: 'technical-details', 
    projectId: 'e-commerce-platform' 
  },
  behavior: { 
    closeBlocking: true,     // Close current modal if it blocks target
    waitForReadyMs: 1500,    // Wait for modal transitions
    scrollBehavior: 'smooth' 
  }
});
```

**NavigationOrchestrator Execution Steps:**

1. **Analyze Current State**
   - Current path: `/projects`
   - Current project: `aurora-avatar`
   - Target project: `e-commerce-platform`
   - Target section: `technical-details`

2. **Generate Navigation Plan**
   ```typescript
   [
     {
       id: 'close_current_project_modal',
       type: 'close',
       // Closes aurora-avatar modal
     },
     {
       id: 'wait_300ms',
       type: 'wait',
       // Brief wait for close animation
     },
     {
       id: 'open_project_e-commerce-platform',
       type: 'modal',
       // Opens e-commerce-platform modal
     },
     {
       id: 'wait_1500ms', 
       type: 'wait',
       // Wait for modal content to load
     },
     {
       id: 'scroll_to_technical-details',
       type: 'scroll',
       // Scrolls to technical-details section
     }
   ]
   ```

3. **Execute Steps Sequentially**
   - ✅ Close current modal (aurora-avatar)
   - ✅ Wait for close animation (300ms)
   - ✅ Open target modal (e-commerce-platform)
   - ✅ Wait for content loading (1500ms)
   - ✅ Scroll to target section (technical-details)

**Result:**
- User is now viewing `/projects?project=e-commerce-platform`
- Modal shows e-commerce-platform project
- Page is scrolled to technical-details section
- Smooth transitions with proper timing

## Alternative Syntax Options

### Option 1: Project with Section
```typescript
await ui_intent({
  target: { 
    type: 'project', 
    id: 'e-commerce-platform',
    sectionId: 'technical-details'
  }
});
```

### Option 2: Section with Project Context
```typescript
await ui_intent({
  target: { 
    type: 'section', 
    id: 'technical-details',
    projectId: 'e-commerce-platform'
  }
});
```

Both approaches generate the same navigation plan and execute identically.

## Other Complex Navigation Scenarios

### Scenario 1: Home → Project Section
**Current:** Home page  
**Target:** Technical details in Aurora Avatar project

```typescript
await ui_intent({
  target: { 
    type: 'section', 
    id: 'technical-details',
    projectId: 'aurora-avatar'
  }
});
```

**Steps:**
1. Navigate to `/projects`
2. Open `aurora-avatar` modal
3. Wait for loading
4. Scroll to `technical-details`

### Scenario 2: Different Route → Project Section
**Current:** `/about` page  
**Target:** Overview section in Task Management project

```typescript
await ui_intent({
  target: { 
    type: 'project', 
    id: 'task-management-app',
    sectionId: 'overview'
  }
});
```

**Steps:**
1. Navigate to `/projects`
2. Open `task-management-app` modal
3. Wait for loading
4. Scroll to `overview`

### Scenario 3: Same Project, Different Section
**Current:** `/projects?project=aurora-avatar` (viewing overview)  
**Target:** Technical details in same project

```typescript
await ui_intent({
  target: { 
    type: 'section', 
    id: 'technical-details'
  }
});
```

**Steps:**
1. Scroll to `technical-details` (no modal changes needed)

## Error Handling and Resilience

### Automatic Retry Logic
- Each step has configurable retry attempts (default: 2)
- Exponential backoff between retries (1s, 2s, 3s)
- Timeout protection (default: 5s per step)

### Graceful Degradation
- If modal close fails, continues with open attempt
- If section not found, completes navigation to project
- Comprehensive error reporting with step-level granularity

### Idempotency Protection
```typescript
await ui_intent({
  target: { type: 'project', id: 'aurora-avatar' },
  idempotencyKey: 'nav-to-aurora-2024-01-15-001'
});

// Second call with same key returns cached result
await ui_intent({
  target: { type: 'project', id: 'aurora-avatar' },
  idempotencyKey: 'nav-to-aurora-2024-01-15-001'  // Returns immediately
});
```

## Comparison: Before vs After

### Before (Step-by-Step Navigation)
```typescript
// Multiple tool calls, race conditions possible
await navigateTo({ path: '/projects' });
await showProjectDetails({ projectId: 'e-commerce-platform' });
// Wait manually - timing issues
setTimeout(async () => {
  await scrollIntoView({ selector: 'technical-details' });
}, 2000);
```

**Issues:**
- 3+ separate tool calls
- Manual timing coordination
- Race conditions between steps
- No automatic error recovery
- No idempotency protection

### After (Declarative Navigation)
```typescript
// Single tool call, automatic coordination
await ui_intent({
  target: { 
    type: 'section', 
    id: 'technical-details',
    projectId: 'e-commerce-platform'
  }
});
```

**Benefits:**
- Single tool call
- Automatic step sequencing
- Built-in error handling
- Proper timing coordination
- Idempotency support
- Comprehensive debugging

## Debug and Monitoring

### Navigation Events
```typescript
// Emitted debug events during execution
'navigation_event' {
  type: 'intent_start' | 'plan_start' | 'step_start' | 'step_complete' | 'intent_complete',
  planId: 'nav_intent_uuid',
  stepId?: 'close_current_project_modal',
  result?: { success: true, message: '...' },
  executionTime?: 1250
}
```

### Performance Metrics
- Total navigation time
- Step-by-step execution timing
- Success/failure rates
- Error pattern analysis

### Correlation IDs
- Each navigation intent gets unique correlation ID
- All related events share the same correlation ID
- Easy debugging across complex navigation sequences

## Voice AI Integration

### Natural Language → Navigation Intent
**User:** "Show me the technical details in the e-commerce project"

**AI Processing:**
1. Parse intent: section navigation with project context
2. Generate tool call:
   ```typescript
   ui_intent({
     target: { 
       type: 'section', 
       id: 'technical-details',
       projectId: 'e-commerce-platform'
     }
   })
   ```
3. Execute declarative navigation
4. Provide feedback: "Navigated to technical details in e-commerce project"

### Context Awareness
- AI knows current navigation state via `ui_describe`
- Can optimize navigation based on current context
- Provides intelligent suggestions for next actions

This declarative approach transforms complex multi-step navigation into simple, reliable, single-call operations while providing comprehensive error handling and debugging capabilities.