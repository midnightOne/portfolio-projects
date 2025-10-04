# Vector Dimensions Strategy

## Current Implementation

The database schema is currently configured with `vector(1536)` dimensions, optimized for OpenAI embedding models:

- **text-embedding-3-small**: 1536 dimensions
- **text-embedding-3-large**: 3072 dimensions (requires migration)
- **text-embedding-ada-002**: 1536 dimensions (legacy)

## Why 1536 Dimensions?

1. **OpenAI Standard**: Most OpenAI embedding models use 1536 dimensions
2. **Performance**: Smaller dimension vectors are faster for similarity searches
3. **Storage**: Lower storage requirements compared to larger dimension models

## Handling Different Embedding Models

### Current Strategy
The `embeddingModel` field in `ContextChunk` tracks which model was used:

```typescript
interface ContextChunk {
  embeddingModel?: string;           // e.g., 'text-embedding-3-small'
  embeddingGeneratedAt?: Date;       // When embedding was created
  embeddingVector?: number[];        // 1536 dimensions (OpenAI)
}
```

### Future Model Support

When adding support for models with different dimensions:

#### Option 1: Schema Migration (Recommended)
```sql
-- Migrate to larger dimensions to support all models
ALTER TABLE context_chunks 
ALTER COLUMN embedding_vector TYPE vector(3072);
```

#### Option 2: Multiple Vector Columns
```sql
-- Add separate columns for different dimensions
ALTER TABLE context_chunks 
ADD COLUMN embedding_vector_1536 vector(1536),
ADD COLUMN embedding_vector_3072 vector(3072);
```

#### Option 3: Model-Specific Tables
```sql
-- Separate tables for different embedding dimensions
CREATE TABLE context_chunks_1536 (LIKE context_chunks INCLUDING ALL);
CREATE TABLE context_chunks_3072 (LIKE context_chunks INCLUDING ALL);
```

## Embedding Model Compatibility

| Model | Dimensions | Status | Migration Required |
|-------|------------|--------|-------------------|
| text-embedding-3-small | 1536 | ✅ Supported | No |
| text-embedding-ada-002 | 1536 | ✅ Supported | No |
| text-embedding-3-large | 3072 | ⚠️ Requires migration | Yes |
| Claude embeddings | 1024 | ⚠️ Requires migration | Yes |
| Cohere embeddings | 4096 | ⚠️ Requires migration | Yes |

## Implementation Guidelines

### When Adding New Embedding Models

1. **Check dimensions** of the new model
2. **If dimensions match (1536)**: No changes needed
3. **If dimensions differ**: Choose migration strategy
4. **Update `embeddingModel` validation** to include new model names
5. **Test vector operations** with new dimensions

### Migration Script Template

```typescript
// Example migration for text-embedding-3-large (3072 dimensions)
async function migrateToLargerDimensions() {
  // 1. Create new column with larger dimensions
  await prisma.$executeRaw`
    ALTER TABLE context_chunks 
    ADD COLUMN embedding_vector_3072 vector(3072)
  `;
  
  // 2. Migrate existing embeddings (re-generate or pad/truncate)
  const chunks = await prisma.contextChunk.findMany({
    where: { embeddingVector: { not: null } }
  });
  
  for (const chunk of chunks) {
    // Re-generate embedding with new model
    const newEmbedding = await generateEmbedding(chunk.content, 'text-embedding-3-large');
    
    await prisma.$executeRaw`
      UPDATE context_chunks 
      SET embedding_vector_3072 = ${newEmbedding}::vector(3072),
          embedding_model = 'text-embedding-3-large'
      WHERE id = ${chunk.id}
    `;
  }
  
  // 3. Drop old column and rename new one
  await prisma.$executeRaw`
    ALTER TABLE context_chunks DROP COLUMN embedding_vector;
    ALTER TABLE context_chunks RENAME COLUMN embedding_vector_3072 TO embedding_vector;
  `;
}
```

## Performance Considerations

### Vector Index Performance by Dimensions
- **1536 dimensions**: Excellent performance, recommended for most use cases
- **3072 dimensions**: Good performance, ~2x slower than 1536
- **4096+ dimensions**: Acceptable performance, consider chunking strategies

### Storage Impact
- **1536 dimensions**: ~6KB per vector
- **3072 dimensions**: ~12KB per vector  
- **4096 dimensions**: ~16KB per vector

## Recommendations

1. **Start with 1536 dimensions** (current implementation)
2. **Use text-embedding-3-small** for cost-effectiveness
3. **Monitor performance** as vector count grows
4. **Plan migration strategy** before adding new embedding models
5. **Consider hybrid approach** for different content types

## Current Configuration

The semantic content management system is configured with:
- **Default model**: `text-embedding-3-small`
- **Dimensions**: 1536
- **Index type**: HNSW (Hierarchical Navigable Small World)
- **Distance metric**: Cosine similarity

This configuration provides the best balance of performance, cost, and accuracy for most portfolio content use cases.