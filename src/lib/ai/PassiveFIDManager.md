# PassiveFIDManager - Client-Side F-I-D Context Management

The PassiveFIDManager is a client-side implementation of the F-I-D (Frame/Index/Details) context pattern, designed for browser environments with intelligent caching and server API integration.

## Overview

The PassiveFIDManager provides:
- **Session-based caching** using `Map<string, FIDContext>` storage
- **Cache-first strategy** with automatic server fallback
- **Intelligent cache key generation** using `${route}-${projectId}-${intentHash}` format
- **Automatic cache cleanup** with 20min TTL and memory management
- **Optional proactive content search** functionality
- **Integration with `/api/ai/context/fid` endpoint**

## Usage

### Basic Usage

```typescript
import { passiveFIDManager } from '@/lib/services/ai';
import { UIState } from '@/lib/ai/tools/types';

// Get F-I-D context for current UI state
const uiState: UIState = {
  breadcrumbPath: 'projects.aurora-avatar',
  visibleAnchors: ['technical-details', 'implementation'],
  currentRoute: 'projects',
  currentProject: 'aurora-avatar'
};

const context = await passiveFIDManager.getOrFetchContext(uiState);

// Access context components
console.log('Frame:', context.frame);
console.log('Index:', context.index);
console.log('Details:', context.details);
```

### Setting User Intent

```typescript
// Set user intent for proactive content search
passiveFIDManager.setUserIntent('Show me technical projects with machine learning');

// Subsequent context requests will include intent-based content
const context = await passiveFIDManager.getOrFetchContext(uiState);
console.log('Intent-based content:', context.details.intentBasedContent);
```

### Cache Management

```typescript
// Clear cache for specific project
passiveFIDManager.clearCache('aurora-avatar');

// Clear entire cache
passiveFIDManager.clearCache();

// Get cache statistics
const stats = passiveFIDManager.getCacheStats();
console.log('Cache size:', stats.size);
console.log('Memory usage:', stats.memoryUsage);
```

## Context Structure

The PassiveFIDManager returns a `FIDContext` object with three main components:

### Frame Context
Contains system-level information that rarely changes:
```typescript
interface FrameContext {
  portfolioOwner: string;           // Portfolio owner identifier
  currentCapabilities: string[];   // Available AI capabilities
  uiContext: string;               // Current UI context description
}
```

### Index Context
Contains route-aware metadata and navigation information:
```typescript
interface IndexContext {
  route: string;                   // Current route ('home', 'projects', etc.)
  availableProjects: ProjectSummary[]; // Available project summaries
  currentProject?: string;         // Current project slug if viewing project
  visibleSections: string[];       // Currently visible content sections
}
```

### Details Context
Contains specific content and search results:
```typescript
interface DetailsContext {
  projectSummary?: string;         // Current project summary if available
  intentBasedContent?: ContentSearchResult[]; // Intent-based search results
  selectedText?: string;           // Selected text if any
}
```

## Caching Strategy

### Cache Key Generation
Cache keys are generated using the format: `${route}-${projectId}-${intentHash}:${anchorsHash}`

- **route**: Current route ('home', 'projects', 'about')
- **projectId**: Current project slug or 'none'
- **intentHash**: Hash of user intent or 'none'
- **anchorsHash**: Hash of visible anchors for specificity

### Cache Lifecycle
- **TTL**: 20 minutes default (configurable)
- **Size Limit**: 50 entries maximum (with automatic eviction)
- **Cleanup**: Automatic cleanup every 5 minutes
- **Invalidation**: Project-specific or full cache clearing

### Memory Management
- Automatic eviction of oldest entries when cache size limit is reached
- Periodic cleanup of expired entries
- Memory usage estimation and reporting
- Proper resource cleanup on manager destruction

## Integration with Voice Adapters

The PassiveFIDManager is designed to work seamlessly with voice adapters for providing contextual awareness:

```typescript
// In OpenAIRealtimeAdapter or ElevenLabsAdapter
import { passiveFIDManager } from '@/lib/services/ai';

class VoiceAdapter {
  async updateContext(uiState: UIState) {
    const fidContext = await passiveFIDManager.getOrFetchContext(uiState);
    
    // Use context for AI conversation
    await this.pushPassiveContext(fidContext);
  }
}
```

## Error Handling

The PassiveFIDManager provides graceful error handling:

- **Network errors**: Returns minimal fallback context
- **Server errors**: Logs error and provides fallback
- **Malformed responses**: Handles gracefully with fallback
- **Cache corruption**: Automatic cache invalidation and retry

## Performance Considerations

- **Cache-first strategy**: Minimizes server requests
- **Intelligent cache keys**: Ensures proper cache hit/miss behavior
- **Memory management**: Prevents memory leaks with automatic cleanup
- **Debounced updates**: Prevents excessive API calls from rapid UI changes

## Debugging and Monitoring

The PassiveFIDManager emits debug events for monitoring:

- `fid-context-cache-hit`: Cache hit events
- `fid-context-cache-miss`: Cache miss events  
- `fid-context-loaded`: Context loading events
- `fid-context-error`: Error events
- `fid-cache-cleared`: Cache clearing events
- `fid-cache-cleanup`: Automatic cleanup events

## Testing

Comprehensive test suite covers:
- Singleton pattern behavior
- Cache key generation consistency
- Server API integration
- Error handling scenarios
- Cache management operations
- Memory management limits
- Resource cleanup

Run tests with:
```bash
npm run test:single -- src/lib/ai/__tests__/PassiveFIDManager.test.ts
```