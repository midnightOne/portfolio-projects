# Prisma + pgvector Best Practices Guide

## Overview

This project uses Prisma with PostgreSQL's pgvector extension for vector embeddings. Since Prisma doesn't fully support pgvector, we need to follow specific practices to maintain schema stability.

## Critical Rules

### ❌ NEVER DO THIS

```bash
# This will break vector dimensions!
npx prisma db pull
```

**Why?** `prisma db pull` introspects the database and rewrites the schema, but it doesn't preserve vector dimensions. It will change `vector(1536)` to just `vector`, breaking our embedding operations.

### ✅ ALWAYS DO THIS

```bash
# After schema changes
npx prisma generate

# To verify schema
npx tsx scripts/verify-schema-stability.ts
```

## Schema Configuration

### Vector Fields

Always specify dimensions for vector fields:

```prisma
model ContextChunk {
  // ✅ CORRECT - Specifies 1536 dimensions for OpenAI embeddings
  embeddingVector Unsupported("vector(1536)")? @map("embedding_vector")
  
  // ❌ WRONG - No dimensions specified
  embeddingVector Unsupported("vector")? @map("embedding_vector")
}
```

### Important Comment

Keep this comment in the schema to remind developers:

```prisma
// Hierarchical Content Storage Models for T0-T3 Tier System
// NOTE: pgvector fields (embeddingVector) use Unsupported("vector(1536)") type
// Currently optimized for OpenAI embeddings (1536 dimensions).
// For other embedding models with different dimensions, a schema migration will be needed.
// Vector fields are not accessible via Prisma client. Use raw SQL queries instead.
```

## Working with Vectors

### ❌ Don't Use Prisma Client for Vectors

```typescript
// This won't work - Prisma doesn't support vector operations
const chunks = await prisma.contextChunk.findMany({
  where: {
    embeddingVector: { /* no vector operations available */ }
  }
});
```

### ✅ Use Raw SQL for Vector Operations

```typescript
// Correct - Use raw SQL for vector similarity search
const similarChunks = await prisma.$queryRaw<Array<{
  id: string;
  content: string;
  similarity: number;
}>>`
  SELECT 
    id,
    content,
    1 - (embedding_vector <=> ${embedding}::vector) as similarity
  FROM context_chunks
  WHERE embedding_vector IS NOT NULL
  ORDER BY embedding_vector <=> ${embedding}::vector
  LIMIT ${limit}
`;
```

### Inserting Vectors

```typescript
// Use raw SQL for inserting vectors
await prisma.$executeRaw`
  INSERT INTO context_chunks (
    id, entity_id, tier, chunk_id, content, embedding_vector
  ) VALUES (
    ${id},
    ${entityId},
    ${tier},
    ${chunkId},
    ${content},
    ${JSON.stringify(embedding)}::vector(1536)
  )
`;
```

## Schema Migration Workflow

### 1. Making Schema Changes

```bash
# 1. Edit prisma/schema.prisma
# 2. Create migration
npx prisma migrate dev --name descriptive_name

# 3. Generate Prisma client
npx prisma generate

# 4. Verify stability
npx tsx scripts/verify-schema-stability.ts
```

### 2. If Schema Gets Out of Sync

```bash
# DON'T use db pull!
# Instead, restore from git:
git restore prisma/schema.prisma

# Then regenerate client
npx prisma generate
```

### 3. Adding New Vector Fields

When adding new vector fields, always specify dimensions:

```prisma
model NewModel {
  id              String   @id @default(cuid())
  // Specify dimensions based on embedding model:
  // - text-embedding-3-small: 1536
  // - text-embedding-3-large: 3072
  // - text-embedding-ada-002: 1536
  embeddingVector Unsupported("vector(1536)")? @map("embedding_vector")
}
```

## Common Issues and Solutions

### Issue 1: "Property 'embeddingVector' does not exist"

**Cause:** Prisma client not regenerated after schema changes.

**Solution:**
```bash
npx prisma generate
```

### Issue 2: Vector dimensions lost

**Cause:** Used `prisma db pull` which removed dimensions.

**Solution:**
```bash
git restore prisma/schema.prisma
npx prisma generate
```

### Issue 3: Type errors with new fields

**Cause:** Prisma client cache or TypeScript server not updated.

**Solution:**
```bash
# Regenerate Prisma client
npx prisma generate

# Restart TypeScript server in your IDE
# VS Code: Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"
```

### Issue 4: Migration conflicts

**Cause:** Database state doesn't match schema.

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# If needed, reset (WARNING: deletes data)
npx prisma migrate reset

# Or create a new migration to fix
npx prisma migrate dev --name fix_schema_drift
```

## Vector Index Management

### Creating Vector Indexes

Vector indexes must be created with raw SQL:

```typescript
// Create HNSW index for fast similarity search
await prisma.$executeRaw`
  CREATE INDEX IF NOT EXISTS idx_context_chunks_embedding_hnsw
  ON context_chunks
  USING hnsw (embedding_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
`;
```

### Index Types

- **HNSW**: Fast approximate search, good for production
- **IVFFlat**: Faster indexing, slower search
- **No index**: Exact search, slow for large datasets

## Testing Vector Operations

Use the verification script to ensure everything works:

```bash
npx tsx scripts/verify-schema-stability.ts
```

This checks:
- Vector dimensions in database
- Table existence
- Index creation
- Basic CRUD operations
- Vector similarity search

## Embedding Model Compatibility

### OpenAI Models

| Model | Dimensions | Schema Type |
|-------|-----------|-------------|
| text-embedding-3-small | 1536 | `vector(1536)` |
| text-embedding-3-large | 3072 | `vector(3072)` |
| text-embedding-ada-002 | 1536 | `vector(1536)` |

### Changing Embedding Models

If you need to change embedding models with different dimensions:

1. Create a migration to alter the column:
```sql
ALTER TABLE context_chunks 
ALTER COLUMN embedding_vector TYPE vector(3072);
```

2. Update the schema:
```prisma
embeddingVector Unsupported("vector(3072)")? @map("embedding_vector")
```

3. Regenerate all embeddings with the new model

## Development Workflow

### Daily Development

```bash
# 1. Pull latest code
git pull

# 2. Install dependencies (if package.json changed)
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations (if new migrations exist)
npx prisma migrate dev

# 5. Verify schema stability
npx tsx scripts/verify-schema-stability.ts
```

### Before Committing

```bash
# 1. Verify schema is correct
git diff prisma/schema.prisma

# 2. Ensure vector(1536) is present
grep "vector(1536)" prisma/schema.prisma

# 3. Run verification
npx tsx scripts/verify-schema-stability.ts

# 4. Commit if all checks pass
git add prisma/schema.prisma
git commit -m "Update schema: [description]"
```

## Troubleshooting Checklist

When you encounter Prisma/pgvector issues:

- [ ] Check if `vector(1536)` is in schema (not just `vector`)
- [ ] Run `npx prisma generate`
- [ ] Restart TypeScript server
- [ ] Run `npx tsx scripts/verify-schema-stability.ts`
- [ ] Check git diff for unintended schema changes
- [ ] Verify database connection
- [ ] Check migration status with `npx prisma migrate status`

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- Project: `VECTOR_DIMENSIONS_STRATEGY.md`
- Project: `SEMANTIC_SCHEMA_IMPLEMENTATION_SUMMARY.md`

## Summary

**Key Takeaways:**
1. ✅ Always use `vector(1536)` in schema
2. ❌ Never use `prisma db pull`
3. ✅ Use raw SQL for vector operations
4. ✅ Run `verify-schema-stability.ts` regularly
5. ✅ Keep the helpful comment in schema
6. ✅ Regenerate Prisma client after changes

Following these practices ensures stable, reliable vector operations throughout the semantic content management system.
