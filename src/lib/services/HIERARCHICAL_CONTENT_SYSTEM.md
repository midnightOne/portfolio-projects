# Hierarchical Content Storage System

## Overview

The Hierarchical Content Storage System implements a T0-T4 tier structure for organizing portfolio content to enable efficient semantic search and AI context management. This system provides the foundation for the `content.search` and `content.get` tools in the client-side AI system.

## Architecture

### Database Schema

#### Content Entities
- **Purpose**: Top-level containers for different types of content
- **Types**: PROJECT, BIO, RESUME, EXPERIENCE, SKILLS, CUSTOM
- **Key Fields**: entityType, slug, title, description, tags, technologies

#### Context Chunks
- **Purpose**: Hierarchical content storage with T0-T4 tiers
- **Key Fields**: tier, chunkId, content, tokenCount, embeddingVector, metadata
- **Relationships**: Links to ContentEntity and optionally ProjectAIIndex

#### Content Versions
- **Purpose**: Track content changes and enable rollback
- **Key Fields**: versionNumber, contentHash, changesSummary

### Tier Structure (T0-T4)

#### T0: Metadata Only
- **Content**: Title, tags, technologies, basic metadata
- **Token Count**: ~10-50 tokens
- **Use Case**: Quick filtering and categorization
- **Example**: `{"title": "E-commerce Platform", "tags": ["React", "Node.js"], "technologies": ["TypeScript", "PostgreSQL"]}`

#### T1: Brief Summary
- **Content**: Project description and brief overview
- **Token Count**: ~50-200 tokens
- **Use Case**: Quick context for AI responses
- **Example**: "A full-stack e-commerce platform built with React and Node.js, featuring user authentication, product catalog, and payment processing."

#### T2: Key Sections
- **Content**: Most important sections (importance > 0.7)
- **Token Count**: ~200-500 tokens per section
- **Use Case**: Detailed context for specific topics
- **Example**: Architecture overview, key features, technical challenges

#### T3: All Sections
- **Content**: Complete content breakdown by sections
- **Token Count**: ~500-1500 tokens per section
- **Use Case**: Comprehensive context for detailed discussions
- **Example**: All project sections including implementation details

#### T4: Full Content
- **Content**: Complete article content
- **Token Count**: ~1500+ tokens
- **Use Case**: Complete context when needed
- **Example**: Full project documentation and article content

## Services

### ContentIngestionPipeline

The main service for ingesting existing portfolio content into the hierarchical system.

#### Key Methods

```typescript
// Ingest all portfolio content
async ingestAllContent(): Promise<ContentIngestionResult[]>

// Ingest a single project
async ingestProject(project: any): Promise<ContentIngestionResult>

// Update content for a specific entity
async updateEntityContent(entityType: string, slug: string): Promise<ContentIngestionResult>

// Clean up orphaned content chunks
async cleanupOrphanedChunks(): Promise<number>
```

#### Usage Example

```typescript
import { ContentIngestionPipeline } from '@/lib/services/content-ingestion';

const pipeline = new ContentIngestionPipeline();

// Ingest all content
const results = await pipeline.ingestAllContent();

// Update specific project
const result = await pipeline.updateEntityContent('PROJECT', 'ecommerce-platform');
```

## Database Setup

### 1. Run Migrations

```bash
# Apply the hierarchical content storage schema
npm run db:migrate
```

### 2. Seed Content

```bash
# Ingest existing portfolio content into hierarchical storage
npm run db:seed-content
```

### 3. Setup pgvector (Optional)

```bash
# Setup pgvector extension for semantic search (when available)
npm run db:setup-pgvector
```

## Vector Embeddings

### Current Implementation
- **Storage**: TEXT columns for compatibility
- **Future**: Will be converted to `vector(1536)` type when pgvector is available
- **Indexing**: Prepared for ivfflat indexes with cosine similarity

### Embedding Generation
- **Model**: OpenAI text-embedding-ada-002 (1536 dimensions)
- **Content**: Generated for each context chunk
- **Similarity**: Cosine similarity for semantic search

### Setup Process
1. **Phase 1**: Store embeddings as TEXT (current)
2. **Phase 2**: Enable pgvector extension
3. **Phase 3**: Convert columns to vector(1536) type
4. **Phase 4**: Create similarity indexes

## Integration Points

### ProjectIndexer Service
- **Reuses**: Existing section extraction and keyword detection
- **Extends**: Adds tier generation and hierarchical storage
- **Maintains**: Existing caching and performance optimizations

### ContextManager Service
- **Integrates**: With new hierarchical content for context building
- **Enhances**: Relevance scoring with tier-based prioritization
- **Preserves**: Existing token budget management

### BackendToolService
- **Extends**: With content.search and content.get tool handlers
- **Leverages**: Existing access control and reflink integration
- **Maintains**: Consistent error handling and response formats

## Performance Considerations

### Caching Strategy
- **T0 (Metadata)**: Cache indefinitely, invalidate on project update
- **T1-T2 (Summaries)**: Cache for 1 hour, regenerate on content change
- **T3-T4 (Full Content)**: Cache for 30 minutes, stream for large content
- **Search Results**: Cache for 15 minutes, invalidate on content updates

### Query Optimization
- **Tier Filtering**: Query specific tiers to control response size
- **Token Budgets**: Respect token limits in content.get operations
- **Batch Operations**: Efficient bulk ingestion and updates

### Indexing Strategy
- **GIN Indexes**: On tags and technologies for fast filtering
- **Vector Indexes**: ivfflat indexes for semantic similarity (when available)
- **Composite Indexes**: On (entityId, tier, chunkId) for efficient lookups

## Content Versioning

### Change Detection
- **Content Hash**: Generated from project content and metadata
- **Version Numbers**: Incremental versioning for each entity
- **Change Summary**: Human-readable description of changes

### Rollback Support
- **Version History**: Complete history of content changes
- **Selective Rollback**: Ability to rollback specific entities
- **Diff Generation**: Compare versions to understand changes

## Monitoring and Maintenance

### Health Checks
- **Entity Count**: Monitor number of content entities
- **Chunk Distribution**: Ensure balanced tier distribution
- **Orphaned Chunks**: Regular cleanup of orphaned content

### Performance Metrics
- **Ingestion Time**: Track time to ingest content
- **Query Performance**: Monitor search and retrieval times
- **Cache Hit Rates**: Optimize caching strategies

### Maintenance Tasks
- **Regular Ingestion**: Update content when projects change
- **Cache Cleanup**: Remove stale cache entries
- **Index Maintenance**: Rebuild indexes when needed

## Future Enhancements

### Semantic Search
- **Vector Similarity**: Full semantic search with pgvector
- **Hybrid Search**: Combine keyword and semantic search
- **Relevance Tuning**: Machine learning for relevance scoring

### Content Intelligence
- **Auto-Tagging**: AI-powered tag generation
- **Content Suggestions**: Recommend related content
- **Quality Scoring**: Assess content quality and completeness

### Advanced Features
- **Multi-Language**: Support for multiple languages
- **Content Templates**: Standardized content structures
- **Collaborative Editing**: Version control for content updates

## Troubleshooting

### Common Issues

#### Migration Failures
```bash
# Reset database and reapply migrations
npm run db:migrate reset --force
npm run db:migrate
```

#### Ingestion Errors
```bash
# Check logs for specific project failures
npm run db:seed-content
```

#### Performance Issues
```bash
# Analyze query performance
npm run db:studio
# Check index usage in PostgreSQL
```

### Debug Commands

```typescript
// Check entity distribution
const entities = await prisma.contentEntity.groupBy({
  by: ['entityType'],
  _count: { entityType: true }
});

// Check tier distribution
const tiers = await prisma.contextChunk.groupBy({
  by: ['tier'],
  _count: { tier: true }
});

// Find orphaned chunks
const orphaned = await prisma.contextChunk.findMany({
  where: { entity: null }
});
```

## API Integration

The hierarchical content system integrates with the existing API structure:

- **Tool Execution**: `/api/ai/tools/execute`
- **Content Search**: `content.search` tool handler
- **Content Retrieval**: `content.get` tool handler
- **Access Control**: Existing reflink and session management

This system provides the foundation for intelligent content discovery and context-aware AI interactions across the portfolio platform.