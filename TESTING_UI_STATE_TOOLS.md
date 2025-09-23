# Testing UI State-aware Content Tools

This guide provides comprehensive testing instructions for the UI state-aware content search and get tools implemented in task 8.4.

## Quick Start

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Run Integration Tests
```bash
npx tsx scripts/integration-test-ui-state-tools.ts
```

### 3. Run Agent Simulation Tests
```bash
npx tsx scripts/agent-test-ui-state-tools.ts
```

## Test Coverage

### Integration Tests (`integration-test-ui-state-tools.ts`)

1. **API Endpoint Accepts UI State** - Verifies the API endpoint correctly accepts and processes UI state
2. **Content Search UI State Ranking** - Tests context-aware result ranking
3. **Content Get Navigation Targets** - Verifies navigation target generation
4. **UI State Context Awareness** - Tests different UI contexts (home vs project routes)
5. **Request-scoped Caching** - Verifies caching performance improvements
6. **Error Handling with UI Context** - Tests graceful error handling with context preservation
7. **Tool Definitions Include UI State** - Verifies tool definitions include uiState parameter

### Agent Simulation Tests (`agent-test-ui-state-tools.ts`)

1. **Project-Focused Search** - User viewing specific project content
2. **Home Page General Search** - User on home page asking about skills
3. **Filtered Search Context** - User with active filters searching
4. **Modal Context Navigation** - User with project modal open

## Manual Testing with AI Agent

### Setup Your AI Agent

Configure your AI agent with these tools:

```typescript
const tools = [
  {
    name: "content_search",
    description: "Search portfolio content with UI state context awareness",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        uiState: {
          type: "object",
          properties: {
            breadcrumbPath: { type: "string" },
            currentRoute: { type: "string" },
            currentProject: { type: "string" },
            visibleAnchors: { type: "array", items: { type: "string" } },
            activeFilters: {
              type: "object",
              properties: {
                tags: { type: "array", items: { type: "string" } },
                techStack: { type: "array", items: { type: "string" } }
              }
            }
          }
        },
        k: { type: "number", default: 5 }
      },
      required: ["query"]
    }
  },
  {
    name: "content_get",
    description: "Get specific content with navigation targets",
    parameters: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" } },
        uiState: { type: "object" },
        maxTokens: { type: "number", default: 900 }
      },
      required: ["ids"]
    }
  }
];
```

### Test Questions for Your Agent

#### 1. Context-Aware Search
**User Context:** "I'm viewing the e-commerce project's shopping cart section"
**Question:** "Find more details about payment integration"

**Expected Agent Behavior:**
- Construct UIState with `currentProject: "e-commerce-platform"`
- Search should prioritize e-commerce project content
- Results should have higher scores for payment-related content

#### 2. Navigation Target Generation
**User Context:** "I'm on the home page"
**Question:** "Show me React projects and tell me how to navigate there"

**Expected Agent Behavior:**
- Construct UIState with `currentRoute: "home"`
- Return navigation targets compatible with home page context
- Provide actionable navigation instructions

#### 3. Filter-Enhanced Search
**User Context:** "I have AI and Python filters active"
**Question:** "Find machine learning projects"

**Expected Agent Behavior:**
- Include active filters in UIState
- Search should be enhanced with AI/ML and Python filters
- Results should prioritize Python/AI content

#### 4. Modal Context
**User Context:** "I have the task management project modal open"
**Question:** "Get more technical implementation details"

**Expected Agent Behavior:**
- Include modal context in UIState
- Generate navigation targets for modal context
- Focus on task management project content

### Sample Agent Implementation

```typescript
async function handleUserQuery(userMessage: string, userContext: any) {
  // 1. Construct UI state from user context
  const uiState = {
    breadcrumbPath: userContext.breadcrumbPath || 'home',
    currentRoute: userContext.currentRoute || 'home',
    currentProject: userContext.currentProject,
    visibleAnchors: userContext.visibleAnchors || [],
    activeFilters: userContext.activeFilters || {},
    lastUserAction: {
      type: 'navigate',
      timestamp: Date.now()
    }
  };

  // 2. Call content search with UI state
  const searchResult = await callTool('content_search', {
    query: extractSearchQuery(userMessage),
    uiState,
    k: 5
  });

  // 3. Process results and generate response
  if (searchResult.success && searchResult.data.items.length > 0) {
    const topResults = searchResult.data.items.slice(0, 3);
    
    // 4. Get detailed content if needed
    const detailsResult = await callTool('content_get', {
      ids: topResults.map(item => item.id),
      uiState,
      maxTokens: 800
    });

    // 5. Generate response with navigation guidance
    return generateResponseWithNavigation(
      topResults,
      detailsResult.data?.items || [],
      uiState
    );
  }
}
```

## Validation Checklist

### ✅ Core Functionality
- [ ] API endpoint accepts UI state parameter
- [ ] Content search uses UI state for ranking
- [ ] Content get generates navigation targets
- [ ] Request-scoped caching works
- [ ] Error handling preserves UI context

### ✅ Context Awareness
- [ ] Project context boosts relevant results
- [ ] Route context affects ranking
- [ ] Visible anchors influence scoring
- [ ] Active filters enhance search
- [ ] Modal context generates appropriate targets

### ✅ Performance
- [ ] Caching provides speed improvements
- [ ] UI state processing doesn't slow down requests
- [ ] Large UI state objects handled efficiently

### ✅ Agent Integration
- [ ] Agent can construct proper UI state
- [ ] Tools return actionable navigation targets
- [ ] Results are contextually relevant
- [ ] Error messages include UI context

## Troubleshooting

### Common Issues

1. **Server Not Running**
   ```bash
   npm run dev
   ```

2. **Database Connection Issues**
   ```bash
   npm run db:studio
   # Check database connectivity
   ```

3. **No Search Results**
   - Check if content has been ingested
   - Verify database has content entities and chunks
   - Run content search service tests

4. **UI State Not Applied**
   - Verify UI state is passed in request body
   - Check BackendToolService logs for UI state processing
   - Ensure tool definitions include uiState parameter

### Debug Commands

```bash
# Test content search service
npx tsx scripts/test-content-search-service.ts

# Test UI state tools
npx tsx scripts/test-ui-state-content-search.ts

# Check database content
npm run db:studio
```

## Expected Results

### Successful Integration Test Output
```
✅ Passed: 7/7 tests
❌ Failed: 0/7 tests

✅ 1. API Endpoint Accepts UI State (150ms)
✅ 2. Content Search UI State Ranking (300ms)
✅ 3. Content Get Navigation Targets (200ms)
✅ 4. UI State Context Awareness (400ms)
✅ 5. Request-scoped Caching (100ms)
✅ 6. Error Handling with UI Context (50ms)
✅ 7. Tool Definitions Include UI State (25ms)

🎉 All integration tests passed!
```

### Successful Agent Test Output
```
📋 Scenario 1: Project-Focused Search
✅ Content Search Results:
   - Found 5 results
   - UI State Enhanced: Yes
   - Top Result: "Shopping Cart Implementation" (score: 0.95)
   - Navigation Target: {"type":"section","id":"..."}

✅ Content Get Results:
   - Retrieved 1 items
   - Navigation Target Generated: Yes
```

This comprehensive testing approach ensures your UI state-aware content tools are working correctly and ready for production use with AI agents.