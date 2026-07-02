# Existing Content and Database Architecture Analysis

## Executive Summary

This analysis examines the current content management and database architecture to understand how to integrate the new content system (content.search and content.get tools) without duplicating functionality. The existing system has a robust foundation with ProjectIndexer, ContextManager, and comprehensive database schema that can be leveraged and extended.

## Database Schema Analysis

### Current Content Storage Models

**Primary Content Models:**
- `Project` - Main project entities with rich metadata
- `ArticleContent` - Tiptap JSON content with markdown conversion
- `MediaItem` - Media assets with metadata and relationships
- `ProjectAIIndex` - AI-generated summaries and keywords
- `Tag` - Categorization system

**Key Findings:**
- **Rich Content Structure**: Tiptap JSON content with markdown conversion capabilities
- **AI Integration Ready**: `ProjectAIIndex` table already exists for AI-generated metadata
- **Vector Search Support**: `search_vector` field with GIN index for full-text search
- **Hierarchical Content**: Support for sections, media carousels, interactive examples
- **Comprehensive Metadata**: Tags, technologies, topics already tracked

### Existing Content Services Architecture

#### 1. ProjectIndexer Service (`src/lib/services/project-indexer.ts`)

**Current Capabilities:**
- **Tiptap Content Processing**: Extracts sections from Tiptap JSON structure
- **Hierarchical Indexing**: Creates `IndexedSection[]` with importance scoring
- **Keyword Extraction**: Automatic keyword and technology detection
- **Media Context**: Extracts media context from carousels, interactive content
- **Caching**: 15-minute TTL cache with content hash change detection
- **Search Functionality**: `searchRelevantContent()` with relevance scoring

**Integration Points for Content System:**
```typescript
// Existing interfaces that can be leveraged
interface IndexedSection {
  id: string;
  title: string;
  summary: string;
  content: string;
  markdownContent: string;
  keywords: string[];
  importance: number; // 0-1 relevance score
  nodeType: string; // Tiptap node type
  projectId?: string;
}

interface ProjectIndex {
  projectId: string;
  summary: string;
  sections: IndexedSection[];
  keywords: string[];
  topics: string[];
  technologies: string[];
  mediaContext: MediaContext[];
}
```

#### 2. ContextManager Service (`src/lib/services/ai/context-manager.ts`)

**Current Capabilities:**
- **Intelligent Context Building**: Token-aware context assembly
- **Multi-Source Search**: Projects, about, resume content
- **Relevance Scoring**: Advanced relevance calculation
- **Session Caching**: 15-minute TTL with distributed cache support
- **Content Prioritization**: Relevance + recency + type priority

**Integration Points:**
```typescript
interface RelevantContent {
  id: string;
  type: 'project' | 'about' | 'resume' | 'experience' | 'skills' | 'custom';
  title: string;
  content: string;
  summary: string;
  relevanceScore: number; // 0-1
  keywords: string[];
  projectId?: string;
  sectionId?: string;
}
```

#### 3. BackendToolService (`src/lib/ai/tools/BackendToolService.ts`)

**Current Tool Handlers:**
- `loadProjectContext` - Project-specific context loading
- `searchProjects` - Project search with relevance scoring
- `getProjectSummary` - Comprehensive project overview
- `openProject` - Search + navigation integration

**Architecture Pattern:**
```typescript
async executeTool(
  toolName: string,
  parameters: Record<string, any>,
  sessionId: string,
  accessLevel: 'basic' | 'limited' | 'premium',
  reflinkId?: string
): Promise<UnifiedToolResult>
```

## API Endpoint Analysis

### Existing Content APIs

**Project APIs:**
- `GET /api/projects` - List projects with filtering
- `GET /api/projects/[slug]` - Individual project details
- `GET /api/projects/search/ai-context` - AI-specific search (directory exists)

**Context APIs:**
- `POST /api/ai/context/load` - Dynamic context loading with access control
- `GET /api/ai/context` - General context retrieval
- `POST /api/ai/context/inject` - Server-side context injection

**Tool Execution:**
- `POST /api/ai/tools/execute` - Unified tool execution endpoint

### Integration Strategy for Content Tools

**Recommended Approach:**
1. **Extend BackendToolService** - Add content.search and content.get handlers
2. **Leverage ProjectIndexer** - Use existing search and indexing capabilities
3. **Integrate with UnifiedToolRegistry** - Register new tools in existing system
4. **Reuse API Patterns** - Follow existing `/api/ai/tools/execute` pattern

## Caching System Analysis

### Current Caching Patterns

**ProjectIndexer Caching:**
- In-memory Map with 15-minute TTL
- Content hash-based invalidation
- Project-specific cache clearing

**ContextManager Caching:**
- Session-based context caching
- Distributed cache support mentioned
- Token count tracking

**API Route Caching:**
- Basic cache management in `/api/admin/cache`
- Project and project detail caches

### Content System Caching Strategy

**Recommended Approach:**
1. **Extend Existing Caches** - Add content search results to ProjectIndexer cache
2. **Hierarchical Caching** - Cache T0-T4 tiers separately with different TTLs
3. **Vector Embedding Cache** - Cache embeddings for semantic search
4. **Query Result Cache** - Cache search results by query hash

## Performance Considerations

### Current Optimizations

**Database Level:**
- GIN indexes on search_vector, keywords, topics, technologies
- Proper foreign key relationships and cascading deletes
- Optimized queries with selective field loading

**Application Level:**
- Content hash change detection
- Relevance score caching
- Token-aware context building
- Incremental content loading

### Content System Performance Strategy

**Database Integration:**
```sql
-- Extend existing ProjectAIIndex table
ALTER TABLE project_ai_index ADD COLUMN content_tiers JSONB;
ALTER TABLE project_ai_index ADD COLUMN embedding_vector vector(1536); -- for pgvector
CREATE INDEX ON project_ai_index USING ivfflat (embedding_vector vector_cosine_ops);
```

**Caching Strategy:**
- **T0 (Metadata)**: Cache indefinitely, invalidate on project update
- **T1-T2 (Summaries)**: Cache for 1 hour, regenerate on content change
- **T3-T4 (Full Content)**: Cache for 30 minutes, stream for large content
- **Search Results**: Cache for 15 minutes, invalidate on content updates

## Tool Registry Integration

### Current Tool System

**UnifiedToolRegistry:**
- Centralized tool definition management
- Provider-specific formatters (OpenAI, ElevenLabs)
- Client/server execution context separation
- Validation and error handling

**Existing Server Tools:**
- 11 server-side tools already defined
- Access control integration
- Reflink-based permissions
- Comprehensive error handling

### Content Tools Integration

**New Tool Definitions to Add:**
```typescript
// Add to server-tools.ts
export const contentSearchToolDefinition: UnifiedToolDefinition = {
  name: 'content.search',
  description: 'Search portfolio content semantically across projects and sections.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query' },
      scope: {
        type: 'object',
        properties: {
          route: { type: 'string' },
          projectId: { type: 'string' }
        }
      },
      k: { type: 'number', default: 5 },
      maxTier: { type: 'number', enum: [1, 2, 3, 4], default: 2 }
    },
    required: ['query']
  },
  executionContext: 'server'
};

export const contentGetToolDefinition: UnifiedToolDefinition = {
  name: 'content.get',
  description: 'Fetch specific content details by ID with token budget control.',
  parameters: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' } },
      maxTokens: { type: 'number', default: 900 }
    },
    required: ['ids']
  },
  executionContext: 'server'
};
```

## Recommended Integration Approach

### Phase 1: Extend Existing Services

1. **Enhance ProjectIndexer**
   - Add T0-T4 tier generation
   - Implement semantic search capabilities
   - Add vector embedding support

2. **Extend BackendToolService**
   - Add `handleContentSearch()` method
   - Add `handleContentGet()` method
   - Integrate with existing access control

3. **Update Database Schema**
   - Add content_tiers to ProjectAIIndex
   - Add vector embedding column
   - Create appropriate indexes

### Phase 2: Content Tool Implementation

1. **Register New Tools**
   - Add content tools to serverToolDefinitions
   - Update UnifiedToolRegistry
   - Test tool execution pipeline

2. **Implement Search Logic**
   - Leverage existing ProjectIndexer.searchRelevantContent()
   - Add tier-based content filtering
   - Implement token budget management

3. **Add Caching Layer**
   - Extend existing cache patterns
   - Add content-specific cache keys
   - Implement cache invalidation

### Phase 3: Performance Optimization

1. **Vector Search Integration**
   - Add pgvector extension
   - Generate embeddings for content
   - Implement semantic similarity search

2. **Advanced Caching**
   - Implement distributed caching
   - Add query result caching
   - Optimize cache hit rates

## Conclusion

The existing architecture provides an excellent foundation for the content system:

**Strengths to Leverage:**
- Robust ProjectIndexer with section extraction
- Comprehensive ContextManager with relevance scoring
- Unified tool execution pipeline
- Access control and reflink integration
- Existing caching patterns

**Integration Strategy:**
- **Extend, Don't Replace**: Build on existing services
- **Reuse Patterns**: Follow established API and caching patterns
- **Maintain Consistency**: Use existing interfaces and error handling
- **Preserve Performance**: Leverage existing optimizations

**Next Steps:**
1. Implement content.search and content.get in BackendToolService
2. Extend ProjectIndexer with tier generation
3. Add content tools to UnifiedToolRegistry
4. Test integration with existing voice adapters

This approach ensures minimal disruption while maximizing reuse of existing, well-tested infrastructure.