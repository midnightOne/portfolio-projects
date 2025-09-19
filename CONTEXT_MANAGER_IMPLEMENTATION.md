# Context Manager Implementation

## Overview

The Context Manager is a core component of the Client-Side AI Assistant system that provides intelligent context building for AI conversations. It integrates with the existing project indexing system and provides session-based caching with a 15-minute TTL.

## Features Implemented

### ✅ Core Context Management
- **Intelligent Context Building**: Searches and prioritizes relevant content from projects, about section, and resume data
- **Session-based Caching**: 15-minute TTL cache per session to reduce API calls and improve performance
- **Content Prioritization**: Relevance-based scoring and content type prioritization (about > project > resume > custom)
- **Token Optimization**: Automatic context size optimization to fit within specified token limits

### ✅ Integration Points
- **Project Indexer Integration**: Uses the existing project indexing system for content search
- **Data & API Layer Integration**: Fetches public project data and homepage configuration
- **Portfolio Owner Profile**: Extracts profile information from homepage about section

### ✅ API Endpoints
- `POST /api/ai/context` - Build context with caching support
- `GET /api/ai/context/cache` - Get cache statistics
- `DELETE /api/ai/context/cache` - Clear cache (all or specific session)

### ✅ React Integration
- **useContextManager Hook**: Client-side hook for context building
- **useAutoContextManager Hook**: Automatic context building with query changes
- **TypeScript Support**: Full type definitions for all interfaces

### ✅ Testing
- **Unit Tests**: Comprehensive tests for context manager functionality
- **API Tests**: Tests for API endpoint integration
- **Integration Tests**: End-to-end testing with mocked dependencies

## Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   React Hook        │    │   API Endpoints     │    │   Context Manager   │
│   useContextManager │────│   /api/ai/context   │────│   Service           │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                                                │
                           ┌─────────────────────┐              │
                           │   Session Cache     │              │
                           │   (15-min TTL)      │◄─────────────┘
                           └─────────────────────┘
                                                                │
┌─────────────────────┐    ┌─────────────────────┐              │
│   Project Indexer   │◄───│   Data Sources      │◄─────────────┘
│   (Existing)        │    │   - Projects API    │
└─────────────────────┘    │   - Homepage Config │
                           │   - Resume Data     │
                           └─────────────────────┘
```

## Key Components

### ContextManager Service
- **Location**: `src/lib/services/ai/context-manager.ts`
- **Purpose**: Core service for building and caching AI context
- **Key Methods**:
  - `buildContext()` - Build context from sources and query
  - `buildContextWithCaching()` - Build context with session caching
  - `searchRelevantContent()` - Search across all content sources
  - `prioritizeContent()` - Sort content by relevance and importance
  - `optimizeContextSize()` - Fit context within token limits

### API Endpoints
- **Location**: `src/app/api/ai/context/`
- **Purpose**: HTTP interface for context building
- **Features**:
  - Request validation
  - Error handling
  - CORS support
  - Performance tracking

### React Hooks
- **Location**: `src/lib/hooks/use-context-manager.ts`
- **Purpose**: Client-side integration
- **Features**:
  - Session management
  - Loading states
  - Error handling
  - Auto-building context

## Usage Examples

### Basic Context Building
```typescript
import { useContextManager } from '@/lib/hooks/use-context-manager';

function AIChat() {
  const { buildContext, isLoading, error } = useContextManager();
  
  const handleQuery = async (query: string) => {
    try {
      const result = await buildContext(query);
      console.log('Context:', result.context);
      console.log('From cache:', result.fromCache);
    } catch (err) {
      console.error('Failed to build context:', err);
    }
  };
}
```

### Auto Context Building
```typescript
import { useAutoContextManager } from '@/lib/hooks/use-context-manager';

function SmartChat({ query }: { query: string }) {
  const { result, isLoading, error } = useAutoContextManager(
    query,
    [], // sources
    { maxTokens: 2000, enabled: query.length > 2 }
  );
  
  if (isLoading) return <div>Building context...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>Context ready: {result?.context}</div>;
}
```

### Direct API Usage
```typescript
// Build context
const response = await fetch('/api/ai/context', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'user-session-123',
    query: 'React developer experience',
    sources: [],
    options: { maxTokens: 2000 },
    useCache: true
  })
});

const data = await response.json();
console.log('Context:', data.data.context);
```

## Configuration Options

### ContextBuildOptions
```typescript
interface ContextBuildOptions {
  maxTokens?: number;           // Default: 4000
  includeProjects?: boolean;    // Default: true
  includeAbout?: boolean;       // Default: true
  includeResume?: boolean;      // Default: true
  prioritizeRecent?: boolean;   // Default: true
  minRelevanceScore?: number;   // Default: 0.1
}
```

### Cache Configuration
- **TTL**: 15 minutes (900,000 ms)
- **Storage**: In-memory Map (per server instance)
- **Cleanup**: Automatic cleanup of expired entries
- **Statistics**: Available via cache stats API

## Performance Characteristics

### Caching Benefits
- **Cache Hit**: ~1-5ms response time
- **Cache Miss**: ~100-500ms (depending on content size)
- **Memory Usage**: ~1-10KB per cached session
- **Token Estimation**: ~4 characters per token (rough approximation)

### Content Prioritization
1. **Relevance Score** (0-1): Based on query term matches
2. **Content Type Priority**: about > project > resume > custom
3. **Section Importance**: From project indexer importance scores
4. **Title Length**: Shorter titles often more focused

## Requirements Satisfied

### ✅ Requirement 2.4
- **WHEN providing project information THEN the system SHALL offer to show relevant sections with highlighting**
- Context manager identifies and prioritizes relevant project sections

### ✅ Requirement 2.5
- **WHEN users request technical details THEN the system SHALL access full project content for comprehensive answers**
- Context manager provides full project content access through project indexer integration

### ✅ Requirement 6.4
- **WHEN loading project content THEN the system SHALL cache project summaries per session to avoid repeated loading**
- Session-based caching with 15-minute TTL implemented

### ✅ Requirement 6.5
- **WHEN managing context THEN the system SHALL implement intelligent context caching to reduce API calls**
- Intelligent caching with relevance-based content selection and token optimization

## Integration with Existing Systems

### Project Indexer
- Uses existing `projectIndexer.searchRelevantContent()` method
- Leverages indexed sections with keywords and importance scores
- Maintains compatibility with existing project indexing workflow

### Data & API Layer
- Fetches public projects via `/api/projects` endpoint
- Retrieves profile information via `/api/homepage-config-public` endpoint
- Respects existing API patterns and error handling

### UI System Integration Ready
- Provides React hooks for easy component integration
- TypeScript interfaces for type safety
- Error handling and loading states for UI feedback

## Next Steps

The Context Manager is now ready for integration with:

1. **AI Chat Interface** (Task 4.1) - Use context for conversation building
2. **Job Analysis System** (Task 6.1-6.3) - Provide context for job matching
3. **Voice Integration** (Tasks 12-15) - Same context for voice conversations
4. **Navigation System** (Task 5.1-5.4) - Context-aware navigation suggestions

## Testing

Run tests with:
```bash
npm test -- --testPathPatterns="context-manager|context-api|context-integration"
```

All tests pass with comprehensive coverage of:
- Context building functionality
- Caching behavior
- Content prioritization
- Token optimization
- Error handling
- API integration