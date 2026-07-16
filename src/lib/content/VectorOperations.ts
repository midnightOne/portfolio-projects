/**
 * Vector Operations Service
 * 
 * Handles pgvector operations using raw SQL since Prisma doesn't fully support
 * vector operations yet. This service provides type-safe wrappers around
 * raw SQL queries for vector operations.
 */

import { PrismaClient } from '@prisma/client';
import type { SourceExclusions } from './source-registry';

export interface VectorSearchResult {
  id: string;
  title: string | null;
  content: string;
  tier: number;
  chunk_id: string;
  entity_id:string;
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
    tier: number;
    chunkId: string;
    title?: string;
    content: string;
    tokenCount: number;
    embedding?: number[];
    embeddingModel?: string; // actual model id used for `embedding` (D4 — never hardcoded)
    metadata?: any;
    // NEW: Hierarchical relationship fields
    parentChunkId?: string;
    rootChunkId?: string;
    sectionGroup?: string;
    derivationPath?: string;
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
      // Update existing chunk with vector and hierarchical relationships
      let result;
      if (embeddingString) {
        result = await this.prisma.$queryRaw<{ id: string; updated_at: Date }[]>`
          UPDATE context_chunks 
          SET 
            title = ${truncatedTitle || null},
            content = ${data.content},
            token_count = ${data.tokenCount},
            embedding_vector = ${embeddingString}::vector(1536),
            embedding_generated_at = NOW(),
            embedding_model = ${data.embeddingModel || null},
            metadata = ${JSON.stringify(data.metadata || {})}::jsonb,
            parent_chunk_id = ${data.parentChunkId || null},
            root_chunk_id = ${data.rootChunkId || null},
            section_group = ${data.sectionGroup || null},
            derivation_path = ${data.derivationPath || null},
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
            parent_chunk_id = ${data.parentChunkId || null},
            root_chunk_id = ${data.rootChunkId || null},
            section_group = ${data.sectionGroup || null},
            derivation_path = ${data.derivationPath || null},
            updated_at = NOW()
          WHERE id = ${existing.id}
          RETURNING id, updated_at
        `;
      }
      return { id: result[0].id, created_at: result[0].updated_at };
    } else {
      // Create new chunk with vector and hierarchical relationships
      let result;
      if (embeddingString) {
        result = await this.prisma.$queryRaw<{ id: string; created_at: Date }[]>`
          INSERT INTO context_chunks (
            id, entity_id, tier, chunk_id, title, content, token_count, 
            embedding_vector, embedding_generated_at, embedding_model,
            metadata, parent_chunk_id, root_chunk_id, section_group, 
            derivation_path, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${data.entityId},
            ${data.tier},
            ${data.chunkId},
            ${truncatedTitle || null},
            ${data.content},
            ${data.tokenCount},
            ${embeddingString}::vector(1536),
            NOW(),
            ${data.embeddingModel || null},
            ${JSON.stringify(data.metadata || {})}::jsonb,
            ${data.parentChunkId || null},
            ${data.rootChunkId || null},
            ${data.sectionGroup || null},
            ${data.derivationPath || null},
            NOW(),
            NOW()
          )
          RETURNING id, created_at
        `;
      } else {
        result = await this.prisma.$queryRaw<{ id: string; created_at: Date }[]>`
          INSERT INTO context_chunks (
            id, entity_id, tier, chunk_id, title, content, token_count, 
            embedding_vector, metadata, parent_chunk_id, root_chunk_id, section_group, 
            derivation_path, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${data.entityId},
            ${data.tier},
            ${data.chunkId},
            ${truncatedTitle || null},
            ${data.content},
            ${data.tokenCount},
            NULL,
            ${JSON.stringify(data.metadata || {})}::jsonb,
            ${data.parentChunkId || null},
            ${data.rootChunkId || null},
            ${data.sectionGroup || null},
            ${data.derivationPath || null},
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
    tierFilter?: number,
    publicOnly = false,
    exclusions?: SourceExclusions,
  ): Promise<VectorSearchResult[]> {
    const startTime = Date.now();
    
    // Time the embedding string conversion
    const embeddingConversionStart = Date.now();
    const embeddingString = `[${embedding.join(',')}]`;
    const embeddingConversionTime = Date.now() - embeddingConversionStart;
    
    // Build the query dynamically to handle optional tier filtering
    const queryBuildStart = Date.now();
    let query = `
      SELECT 
        c.id,
        c.title,
        c.content,
        c.tier,
        c.chunk_id,
        e.title as entity_title,
        e.slug as entity_slug,
        e."entityType" as entity_type,
        (1 - (c.embedding_vector <=> $1::vector(1536))) as similarity_score
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
    `;

    if (publicOnly) {
      // PUBLIC-visibility enforcement in SQL (mcp-server Req 3.2/3.6)
      query += ` AND (e."entityType" <> 'PROJECT' OR EXISTS (
        SELECT 1 FROM projects p WHERE p.slug = e.slug AND p.visibility = 'PUBLIC'
      ))`;
    }

    const params: any[] = [embeddingString];

    if (exclusions?.hasAny) {
      const typeParam = params.length + 1;
      const entityParam = params.length + 2;
      query += ` AND NOT (
        e."entityType"::text = ANY($${typeParam}::text[])
        OR (e."entityType"::text || ':' || e.slug) = ANY($${entityParam}::text[])
      )`;
      params.push(Array.from(exclusions.entityTypes), Array.from(exclusions.entities));
    }

    if (tierFilter !== undefined) {
      const tierParam = params.length + 1;
      query += ` AND c.tier <= $${tierParam}`;
      params.push(tierFilter);
      const limitParam = params.length + 1;
      query += ` ORDER BY c.embedding_vector <=> $1::vector(1536) LIMIT $${limitParam}`;
      params.push(limit);
    } else {
      const limitParam = params.length + 1;
      query += ` ORDER BY c.embedding_vector <=> $1::vector(1536) LIMIT $${limitParam}`;
      params.push(limit);
    }
    const queryBuildTime = Date.now() - queryBuildStart;

    // Time the actual database query execution
    const dbQueryStart = Date.now();
    const results = await this.prisma.$queryRawUnsafe<VectorSearchResult[]>(query, ...params);
    const dbQueryTime = Date.now() - dbQueryStart;
    
    const totalTime = Date.now() - startTime;

    // Log detailed vector search performance
    console.log(`[VectorOps] Semantic search performance:`, {
      embeddingConversion: `${embeddingConversionTime}ms`,
      queryBuild: `${queryBuildTime}ms`,
      dbQuery: `${dbQueryTime}ms`,
      total: `${totalTime}ms`,
      results: results.length,
      limit,
      tierFilter
    });

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
    
    // Build the query dynamically to handle optional tier filtering
    let query = `
      SELECT 
        c.id,
        c.title,
        c.content,
        c.tier,
        c.token_count,
        e.title as entity_title,
        e.slug as entity_slug,
        (c.embedding_vector <-> $1::vector(1536)) as l2_distance
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
    `;
    
    const params: any[] = [embeddingString];
    
    if (maxTier !== undefined) {
      query += ` AND c.tier <= $2`;
      params.push(maxTier);
      query += ` ORDER BY c.embedding_vector <-> $1::vector(1536) LIMIT $3`;
      params.push(limit);
    } else {
      query += ` ORDER BY c.embedding_vector <-> $1::vector(1536) LIMIT $2`;
      params.push(limit);
    }

    const results = await this.prisma.$queryRawUnsafe<L2DistanceResult[]>(query, ...params);

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

  /**
   * Get content hierarchy for a specific chunk
   */
  async getContentHierarchy(chunkId: string): Promise<{
    ancestors: any[];
    descendants: any[];
    siblings: any[];
  }> {
    // Get ancestors (parent chain to root)
    const ancestors = await this.prisma.$queryRaw<any[]>`
      WITH RECURSIVE ancestor_chain AS (
        SELECT id, parent_chunk_id, tier, chunk_id, title, content, section_group, derivation_path, 0 as depth
        FROM context_chunks 
        WHERE id = ${chunkId}
        
        UNION ALL
        
        SELECT c.id, c.parent_chunk_id, c.tier, c.chunk_id, c.title, c.content, c.section_group, c.derivation_path, ac.depth + 1
        FROM context_chunks c
        INNER JOIN ancestor_chain ac ON c.id = ac.parent_chunk_id
      )
      SELECT * FROM ancestor_chain WHERE depth > 0 ORDER BY depth DESC
    `;

    // Get descendants (all children recursively)
    const descendants = await this.prisma.$queryRaw<any[]>`
      WITH RECURSIVE descendant_tree AS (
        SELECT id, parent_chunk_id, tier, chunk_id, title, content, section_group, derivation_path, 0 as depth
        FROM context_chunks 
        WHERE parent_chunk_id = ${chunkId}
        
        UNION ALL
        
        SELECT c.id, c.parent_chunk_id, c.tier, c.chunk_id, c.title, c.content, c.section_group, c.derivation_path, dt.depth + 1
        FROM context_chunks c
        INNER JOIN descendant_tree dt ON c.parent_chunk_id = dt.id
      )
      SELECT * FROM descendant_tree ORDER BY depth, tier, chunk_id
    `;

    // Get siblings (same parent, same tier)
    const siblings = await this.prisma.$queryRaw<any[]>`
      SELECT c2.id, c2.tier, c2.chunk_id, c2.title, c2.content, c2.section_group, c2.derivation_path
      FROM context_chunks c1
      JOIN context_chunks c2 ON c1.parent_chunk_id = c2.parent_chunk_id AND c1.tier = c2.tier
      WHERE c1.id = ${chunkId} AND c2.id != ${chunkId}
      ORDER BY c2.chunk_id
    `;

    return { ancestors, descendants, siblings };
  }

  /**
   * Search within a content section group
   */
  async searchWithinSection(
    sectionGroup: string, 
    embedding: number[], 
    limit: number = 10,
    maxTier: number = 3
  ): Promise<VectorSearchResult[]> {
    const embeddingString = `[${embedding.join(',')}]`;
    
    const results = await this.prisma.$queryRawUnsafe<VectorSearchResult[]>(`
      SELECT 
        c.id,
        c.title,
        c.content,
        c.tier,
        c.chunk_id,
        c.section_group,
        c.derivation_path,
        e.title as entity_title,
        e.slug as entity_slug,
        e."entityType" as entity_type,
        (1 - (c.embedding_vector <=> $1::vector(1536))) as similarity_score
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.embedding_vector IS NOT NULL
        AND c.section_group = $2
        AND c.tier <= $3
      ORDER BY c.embedding_vector <=> $1::vector(1536)
      LIMIT $4
    `, embeddingString, sectionGroup, maxTier, limit);

    return results;
  }

  /**
   * Get related content across tiers for a topic
   */
  async getRelatedContentAcrossTiers(
    rootChunkId: string,
    includeTiers: number[] = [1, 2, 3]
  ): Promise<{
    summary: any | null;
    keyPoints: any[];
    details: any[];
  }> {
    const tierList = includeTiers.join(',');
    
    const chunks = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        c.id, c.tier, c.chunk_id, c.title, c.content, c.section_group, 
        c.derivation_path, c.metadata,
        e.title as entity_title, e.slug as entity_slug
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.root_chunk_id = $1 AND c.tier = ANY($2::int[])
      ORDER BY c.tier, c.chunk_id
    `, rootChunkId, includeTiers);

    return {
      summary: chunks.find(c => c.tier === 1) || null,
      keyPoints: chunks.filter(c => c.tier === 2),
      details: chunks.filter(c => c.tier === 3)
      // Note: T3 is now the terminal tier in simplified structure
    };
  }
}

export default VectorOperations;
