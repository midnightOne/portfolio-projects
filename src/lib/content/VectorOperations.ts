/**
 * Vector Operations Service
 * 
 * Handles pgvector operations using raw SQL since Prisma doesn't fully support
 * vector operations yet. This service provides type-safe wrappers around
 * raw SQL queries for vector operations.
 */

import { PrismaClient } from '@prisma/client';

export interface VectorSearchResult {
  id: string;
  title: string | null;
  content: string;
  tier: number;
  chunk_id: string;
  entity_title: string | null;
  entity_slug: string;
  entity_type: string;
  similarity_score: number;
}

export interface L2DistanceResult {
  id: string;
  title: string | null;
  content: string;
  tier: number;
  token_count: number;
  entity_title: string | null;
  entity_slug: string;
  l2_distance: number;
}

export class VectorOperations {
  constructor(private prisma: PrismaClient) {}

  /**
   * Insert or update a context chunk with vector embedding using raw SQL
   */
  async upsertContextChunkWithVector(data: {
    entityId: string;
    projectIndexId?: string;
    tier: number;
    chunkId: string;
    title?: string;
    content: string;
    tokenCount: number;
    embedding?: number[];
    metadata?: any;
  }): Promise<{ id: string; created_at: Date }> {
    const embeddingString = data.embedding ? `[${data.embedding.join(',')}]` : null;
    
    // Truncate title to fit database constraint (255 chars)
    const truncatedTitle = data.title && data.title.length > 255 
      ? data.title.substring(0, 252) + '...' 
      : data.title;
    
    // First try to find existing chunk
    const existing = await this.prisma.contextChunk.findUnique({
      where: {
        entityId_tier_chunkId: {
          entityId: data.entityId,
          tier: data.tier,
          chunkId: data.chunkId
        }
      }
    });

    if (existing) {
      // Update existing chunk with vector
      let result;
      if (embeddingString) {
        result = await this.prisma.$queryRaw<{ id: string; updated_at: Date }[]>`
          UPDATE context_chunks 
          SET 
            title = ${truncatedTitle || null},
            content = ${data.content},
            token_count = ${data.tokenCount},
            embedding_vector = ${embeddingString}::vector(1536),
            metadata = ${JSON.stringify(data.metadata || {})}::jsonb,
            updated_at = NOW()
          WHERE id = ${existing.id}
          RETURNING id, updated_at
        `;
      } else {
        result = await this.prisma.$queryRaw<{ id: string; updated_at: Date }[]>`
          UPDATE context_chunks 
          SET 
            title = ${truncatedTitle || null},
            content = ${data.content},
            token_count = ${data.tokenCount},
            embedding_vector = NULL,
            metadata = ${JSON.stringify(data.metadata || {})}::jsonb,
            updated_at = NOW()
          WHERE id = ${existing.id}
          RETURNING id, updated_at
        `;
      }
      return { id: result[0].id, created_at: result[0].updated_at };
    } else {
      // Create new chunk with vector
      let result;
      if (embeddingString) {
        result = await this.prisma.$queryRaw<{ id: string; created_at: Date }[]>`
          INSERT INTO context_chunks (
            id, entity_id, project_index_id, tier, chunk_id, title, content, token_count, 
            embedding_vector, metadata, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${data.entityId},
            ${data.projectIndexId || null},
            ${data.tier},
            ${data.chunkId},
            ${truncatedTitle || null},
            ${data.content},
            ${data.tokenCount},
            ${embeddingString}::vector(1536),
            ${JSON.stringify(data.metadata || {})}::jsonb,
            NOW(),
            NOW()
          )
          RETURNING id, created_at
        `;
      } else {
        result = await this.prisma.$queryRaw<{ id: string; created_at: Date }[]>`
          INSERT INTO context_chunks (
            id, entity_id, project_index_id, tier, chunk_id, title, content, token_count, 
            embedding_vector, metadata, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${data.entityId},
            ${data.projectIndexId || null},
            ${data.tier},
            ${data.chunkId},
            ${truncatedTitle || null},
            ${data.content},
            ${data.tokenCount},
            NULL,
            ${JSON.stringify(data.metadata || {})}::jsonb,
            NOW(),
            NOW()
          )
          RETURNING id, created_at
        `;
      }
      return result[0];
    }
  }

  /**
   * Perform semantic search using cosine similarity
   */
  async semanticSearch(
    embedding: number[], 
    limit: number = 10,
    tierFilter?: number
  ): Promise<VectorSearchResult[]> {
    const embeddingString = `[${embedding.join(',')}]`;
    
    const tierCondition = tierFilter !== undefined ? 
      `AND c.tier <= ${tierFilter}` : '';

    const results = await this.prisma.$queryRaw<VectorSearchResult[]>`
      SELECT 
        c.id,
        c.title,
        c.content,
        c.tier,
        c.chunk_id,
        e.title as entity_title,
        e.slug as entity_slug,
        e."entityType" as entity_type,
        (1 - (c.embedding_vector <=> ${embeddingString}::vector(1536))) as similarity_score
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
      ${tierCondition}
      ORDER BY c.embedding_vector <=> ${embeddingString}::vector(1536)
      LIMIT ${limit}
    `;

    return results;
  }

  /**
   * Perform L2 distance search
   */
  async l2DistanceSearch(
    embedding: number[], 
    limit: number = 10,
    maxTier?: number
  ): Promise<L2DistanceResult[]> {
    const embeddingString = `[${embedding.join(',')}]`;
    
    const tierCondition = maxTier !== undefined ? 
      `AND c.tier <= ${maxTier}` : '';

    const results = await this.prisma.$queryRaw<L2DistanceResult[]>`
      SELECT 
        c.id,
        c.title,
        c.content,
        c.tier,
        c.token_count,
        e.title as entity_title,
        e.slug as entity_slug,
        (c.embedding_vector <-> ${embeddingString}::vector(1536)) as l2_distance
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
      ${tierCondition}
      ORDER BY c.embedding_vector <-> ${embeddingString}::vector(1536)
      LIMIT ${limit}
    `;

    return results;
  }

  /**
   * Update project AI index with vector embedding
   */
  async updateProjectIndexVector(
    projectId: string, 
    embedding: number[]
  ): Promise<void> {
    const embeddingString = `[${embedding.join(',')}]`;
    
    await this.prisma.$queryRaw`
      UPDATE project_ai_index 
      SET 
        "embeddingVector" = ${embeddingString}::vector(1536),
        updated_at = NOW()
      WHERE "projectId" = ${projectId}
    `;
  }

  /**
   * Get vector count for performance monitoring
   */
  async getVectorCount(): Promise<number> {
    const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count 
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
    `;
    
    return Number(result[0].count);
  }
}

export default VectorOperations;