/**
 * Content Search and Retrieval Service
 * 
 * Provides hybrid search capabilities combining semantic vector search with metadata filtering.
 * Implements MMR (Maximal Marginal Relevance) for result diversification and integrates
 * with UIManager for AI-driven navigation.
 * 
 * Features:
 * - Semantic search using pgvector cosine similarity
 * - Metadata filtering by tags, tech stack, project type, date ranges
 * - MMR diversification to avoid redundant results
 * - Token budget management for controlled context loading
 * - UIManager integration as ContentProvider
 * - Graceful fallback handling for robust navigation
 */

import { PrismaClient } from '@prisma/client';
import VectorOperations, { VectorSearchResult } from './VectorOperations';
import { debugEventEmitter } from '../debug/debugEventEmitter';
import OpenAI from 'openai';
import { ContentProvider, SemanticSection, NavigationContext } from '../navigation/UIManager';
import { embeddingCache } from './EmbeddingCache';

const prisma = new PrismaClient();

// Search interfaces
export interface ContentSearchParams {
  query: string;                        // Natural language query
  scope?: {
    route?: string;                     // Limit to current route context
    projectId?: string;                 // Limit to specific project
    entityType?: string;                // Limit to specific entity type
  };
  k?: number;                          // Number of results (default: 5)
  maxTier?: 1 | 2 | 3 | 4;            // Maximum content tier to return
  diversifyBy?: 'project' | 'type';    // Ensure results span different projects/types
  filters?: {
    tags?: string[];                   // Filter by tags
    technologies?: string[];           // Filter by tech stack
    dateRange?: {
      from?: Date;
      to?: Date;
    };
    minImportance?: number;            // Minimum importance score (0-1)
  };
}

export interface ContentSearchResult {
  items: Array<{
    id: string;
    project?: string;
    title: string;
    oneLiner: string;                   // T1 summary for quick scanning
    why: string;                        // 1 sentence justification for relevance
    navTarget: any;                     // UIIntentParams for navigation
    score: number;
    facets: {
      tech: string[];
      year?: number;
      type: string;
      tier: number;
    };
    content?: string;                   // Full content if requested
    tokenEstimate?: number;
  }>;
  more: boolean;                        // Whether more results available
  cursor?: string;                      // For pagination
  totalResults: number;
  searchMetadata: {
    semanticResults: number;
    filteredResults: number;
    diversifiedResults: number;
    queryEmbeddingTime: number;
    searchTime: number;
    timingBreakdown?: Record<string, number>;
    uiStateEnhanced?: boolean;
    originalResults?: number;
    rankedResults?: number;
    uiContext?: any;
  };
}

// Content retrieval interfaces
export interface ContentGetParams {
  ids: string[];                        // Specific content IDs to fetch
  maxTokens?: number;                   // Token budget for response (default: 900)
  includeTiers?: number[];              // Which tiers to include (default: [1,2,3])
}

export interface ContentGetResult {
  items: Array<{
    id: string;
    content: string;                    // HTML or markdown content
    tokenEstimate: number;
    tier: number;
    title?: string;
    metadata: Record<string, any>;
    chunkId?: string;                   // Semantic chunk ID for navigation
    project?: string;                   // Project slug if content belongs to a project
    navTarget?: any;
  }>;
  totalTokens: number;
  truncated: boolean;                   // Whether content was truncated due to budget
}

// MMR (Maximal Marginal Relevance) configuration
interface MMRConfig {
  lambda: number;                       // Balance between relevance and diversity (0-1)
  diversityThreshold: number;           // Minimum diversity score to include result
  maxSimilarResults: number;            // Max results from same project/type
}

// Search result for internal processing
interface InternalSearchResult {
  id: string;
  entityId: string;
  entityType: string;
  entitySlug: string;
  entityTitle: string | null;
  tier: number;
  chunkId: string;
  title: string | null;
  content: string;
  tokenCount: number;
  similarity: number;
  metadata: any;
  tags: string[];
  technologies: string[];
  createdAt: Date;
}

export class ContentSearchService implements ContentProvider {
  public readonly name = 'ContentSearchService';

  private vectorOps: VectorOperations;
  private openai: OpenAI | null;
  private embeddingModel = 'text-embedding-3-small';
  private embeddingDimensions = 1536;

  // MMR configuration
  private mmrConfig: MMRConfig = {
    lambda: 0.7,                        // 70% relevance, 30% diversity
    diversityThreshold: 0.3,            // Minimum 30% diversity
    maxSimilarResults: 2                // Max 2 results from same project
  };

  // Token estimation (rough approximation)
  private readonly TOKENS_PER_CHAR = 0.25;

  constructor() {
    this.vectorOps = new VectorOperations(prisma);

    // Initialize OpenAI client for embedding generation
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('OPENAI_API_KEY not found - semantic search will be limited to existing embeddings');
      this.openai = null;
    }
  }

  /**
   * Search content using hybrid semantic + metadata approach (internal method)
   */
  async searchContentInternal(params: ContentSearchParams): Promise<ContentSearchResult> {
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    const {
      query,
      scope = {},
      k = 5,
      maxTier = 3,
      diversifyBy = 'project',
      filters = {}
    } = params;

    debugEventEmitter.emit('content-search-start', {
      query,
      scope,
      k,
      maxTier,
      diversifyBy,
      filters,
      timestamp: startTime
    });

    try {
      // Step 1: Generate query embedding for semantic search
      const embeddingStartTime = Date.now();
      let queryEmbedding: number[] = [];
      let cacheHit = false;
      const embeddingTimings: Record<string, number> = {};

      if (this.openai && query.trim()) {
        try {
          // Check cache first
          const cacheCheckStart = Date.now();
          const cachedEmbedding = embeddingCache.get(query, this.embeddingModel);
          embeddingTimings.cacheCheck = Date.now() - cacheCheckStart;

          if (cachedEmbedding) {
            queryEmbedding = cachedEmbedding;
            cacheHit = true;
            embeddingTimings.cacheRetrieval = Date.now() - cacheCheckStart;
          } else {
            // Generate new embedding
            const apiCallStart = Date.now();
            const response = await this.openai.embeddings.create({
              model: this.embeddingModel,
              input: query,
              dimensions: this.embeddingDimensions
            });
            embeddingTimings.openaiApiCall = Date.now() - apiCallStart;

            const extractionStart = Date.now();
            queryEmbedding = response.data[0].embedding;
            embeddingTimings.dataExtraction = Date.now() - extractionStart;

            // Cache the result
            const cacheStoreStart = Date.now();
            embeddingCache.set(query, queryEmbedding, this.embeddingModel);
            embeddingTimings.cacheStore = Date.now() - cacheStoreStart;
          }
        } catch (error) {
          console.error('Failed to generate query embedding:', error);
          // Continue with metadata-only search
        }
      }

      timings.queryEmbeddingTime = Date.now() - embeddingStartTime;
      // Store embedding timings separately - they'll be merged into timingBreakdown later
      Object.assign(timings, embeddingTimings);

      // Step 2: Perform semantic search with metadata filtering
      const hybridSearchStartTime = Date.now();
      const searchResults = await this._performHybridSearch(
        queryEmbedding,
        query,
        scope,
        maxTier,
        filters,
        k * 3 // Get more results for diversification
      );
      timings.hybridSearchTime = Date.now() - hybridSearchStartTime;

      // Step 3: Apply MMR diversification
      const mmrStartTime = Date.now();
      const diversifiedResults = this._applyMMR(searchResults, k, diversifyBy);
      timings.mmrTime = Date.now() - mmrStartTime;

      // Step 4: Format results for return
      const formatStartTime = Date.now();
      const formattedResults = await this._formatSearchResults(diversifiedResults, query);
      timings.formatTime = Date.now() - formatStartTime;

      timings.totalTime = Date.now() - startTime;

      // Enhanced debug logging with detailed timings
      debugEventEmitter.emit('content-search-complete', {
        query,
        totalResults: formattedResults.length,
        semanticResults: searchResults.length,
        diversifiedResults: diversifiedResults.length,
        timings,
        timestamp: Date.now()
      });

      // Log performance breakdown for debugging
      console.log(`[ContentSearch] Performance breakdown for query "${query}":`, {
        embedding: `${timings.queryEmbeddingTime}ms${timings.embeddingCacheHit ? ' (cached)' : ' (API)'}`,
        hybridSearch: `${timings.hybridSearchTime}ms`,
        mmr: `${timings.mmrTime}ms`,
        format: `${timings.formatTime}ms`,
        total: `${timings.totalTime}ms`,
        results: `${searchResults.length} → ${diversifiedResults.length} → ${formattedResults.length}`
      });

      // Log detailed embedding breakdown if not cached
      if (!timings.embeddingCacheHit && timings.embeddingBreakdown) {
        console.log(`[ContentSearch] Embedding generation breakdown:`, timings.embeddingBreakdown);
      }

      return {
        items: formattedResults,
        more: searchResults.length > diversifiedResults.length,
        cursor: diversifiedResults.length > 0 ?
          `${diversifiedResults[diversifiedResults.length - 1].id}_${diversifiedResults.length}` :
          undefined,
        totalResults: searchResults.length,
        searchMetadata: {
          semanticResults: searchResults.length,
          filteredResults: searchResults.length,
          diversifiedResults: diversifiedResults.length,
          queryEmbeddingTime: timings.queryEmbeddingTime,
          searchTime: timings.totalTime,
          // Add detailed timing breakdown
          timingBreakdown: timings
        }
      };

    } catch (error) {
      const errorMsg = `Content search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

      debugEventEmitter.emit('content-search-error', {
        query,
        error: errorMsg,
        timestamp: Date.now()
      });

      // Return empty results on error
      return {
        items: [],
        more: false,
        totalResults: 0,
        searchMetadata: {
          semanticResults: 0,
          filteredResults: 0,
          diversifiedResults: 0,
          queryEmbeddingTime: 0,
          searchTime: Date.now() - startTime,
          timingBreakdown: {}
        }
      };
    }
  }

  /**
   * Test method to verify changes are working
   */
  async getContentWithChunkId(params: ContentGetParams): Promise<ContentGetResult> {
    console.log('TEST METHOD CALLED!');
    const result = await this.getContent(params);

    // Add chunkId and project to existing results
    const enhancedItems = [];
    for (const item of result.items) {
      // Get the chunk data again to add missing fields
      const chunk = await prisma.contextChunk.findUnique({
        where: { id: item.id },
        include: { entity: true }
      });

      enhancedItems.push({
        ...item,
        chunkId: chunk?.chunkId,
        project: chunk?.entity?.entityType === 'PROJECT' ? chunk.entity.slug : undefined
      });
    }

    return {
      ...result,
      items: enhancedItems
    };
  }

  /**
   * Retrieve specific content by IDs with token budget management
   */
  async getContent(params: ContentGetParams): Promise<ContentGetResult> {
    const {
      ids,
      maxTokens = 900,
      includeTiers = [1, 2, 3]
    } = params;

    console.log(`[ContentSearchService] getContent called with:`, { ids, maxTokens, includeTiers });

    debugEventEmitter.emit('content-get-start', {
      ids,
      maxTokens,
      includeTiers,
      timestamp: Date.now()
    });

    try {
      // Fetch content chunks by IDs (support both database IDs and semantic IDs)
      const chunks = await prisma.contextChunk.findMany({
        where: {
          OR: [
            { id: { in: ids } }, // Database IDs
            { chunkId: { in: ids } }, // Semantic chunk IDs
            // Handle project-scoped semantic IDs (format: "project-slug:chunk-id")
            ...ids.filter(id => id.includes(':')).map(id => {
              const [projectSlug, chunkId] = id.split(':');
              return {
                AND: [
                  { chunkId },
                  { entity: { slug: projectSlug } }
                ]
              };
            })
          ],
          tier: { in: includeTiers }
        },
        include: {
          entity: true
        },
        orderBy: [
          { tier: 'asc' },
          { tokenCount: 'asc' }
        ]
      });

      // Apply token budget management
      const results: ContentGetResult['items'] = [];
      let totalTokens = 0;
      let truncated = false;

      for (const chunk of chunks) {
        const estimatedTokens = chunk.tokenCount || this._estimateTokenCount(chunk.content);

        if (totalTokens + estimatedTokens > maxTokens) {
          truncated = true;
          break;
        }

        const chunkId = chunk.chunkId;
        const project = chunk.entity?.entityType === 'PROJECT' ? chunk.entity.slug : undefined;

        console.log(`[ContentSearchService] Adding chunk: ${chunk.id}, chunkId: ${chunkId}, project: ${project}`);

        results.push({
          id: chunk.id,
          content: chunk.content,
          tokenEstimate: estimatedTokens,
          tier: chunk.tier,
          title: chunk.title || undefined,
          metadata: chunk.metadata as Record<string, any>,
          chunkId: chunkId, // Add chunkId for navigation
          project: project // Add project info
        });

        totalTokens += estimatedTokens;
      }

      debugEventEmitter.emit('content-get-complete', {
        requestedIds: ids.length,
        returnedItems: results.length,
        totalTokens,
        truncated,
        timestamp: Date.now()
      });

      return {
        items: results,
        totalTokens,
        truncated
      };

    } catch (error) {
      const errorMsg = `Content retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

      debugEventEmitter.emit('content-get-error', {
        ids,
        error: errorMsg,
        timestamp: Date.now()
      });

      return {
        items: [],
        totalTokens: 0,
        truncated: false
      };
    }
  }

  /**
   * ContentProvider interface: Discover sections for UIManager
   */
  async discoverSections(context: NavigationContext): Promise<SemanticSection[]> {
    try {
      // Use current route and project context to discover relevant sections
      const searchParams: ContentSearchParams = {
        query: context.currentProject || context.currentRoute || 'overview',
        scope: {
          route: context.currentRoute,
          projectId: context.currentProject || undefined
        },
        k: 10,
        maxTier: 2 // Use T1-T2 for section discovery
      };

      const searchResult = await this.searchContentInternal(searchParams);

      // Convert search results to semantic sections
      const sections: SemanticSection[] = searchResult.items.map(item => ({
        id: item.id,
        semanticId: `content-${item.id}`,
        title: item.title,
        type: item.project ? 'project' : 'content',
        projectId: item.project,
        level: item.facets.tier,
        metadata: {
          score: item.score,
          facets: item.facets,
          contentType: 'search-result'
        }
      }));

      debugEventEmitter.emit('content-sections-discovered', {
        context: context.currentRoute,
        projectId: context.currentProject,
        sectionsFound: sections.length,
        timestamp: Date.now()
      });

      return sections;

    } catch (error) {
      console.error('Failed to discover sections:', error);
      return [];
    }
  }



  /**
   * Public API: Search content with full parameters (maintains original API)
   */
  async searchContent(params: ContentSearchParams): Promise<ContentSearchResult>;
  /**
   * ContentProvider interface: Search content (required by ContentProvider interface)
   */
  async searchContent(query: string, options?: any): Promise<any[]>;
  /**
   * Implementation for both overloads
   */
  async searchContent(
    paramsOrQuery: ContentSearchParams | string,
    options?: any
  ): Promise<ContentSearchResult | any[]> {
    if (typeof paramsOrQuery === 'string') {
      // ContentProvider interface call
      const params: ContentSearchParams = {
        query: paramsOrQuery,
        ...options
      };
      const result = await this.searchContentInternal(params);
      return result.items;
    } else {
      // Full API call
      return this.searchContentInternal(paramsOrQuery);
    }
  }

  /**
   * ContentProvider interface: Validate section exists
   */
  async validateSection(sectionId: string): Promise<boolean> {
    try {
      const chunk = await prisma.contextChunk.findUnique({
        where: { id: sectionId }
      });
      return chunk !== null;
    } catch (error) {
      console.error('Failed to validate section:', error);
      return false;
    }
  }

  /**
   * UIManager integration: Navigate to content based on search query
   */
  async navigateToContent(query: string, uiManager?: any): Promise<{ success: boolean; message: string; target?: any }> {
    try {
      // Search for relevant content
      const searchResult = await this.searchContentInternal({
        query,
        k: 1, // Get best match
        maxTier: 2
      });

      if (searchResult.items.length === 0) {
        return {
          success: false,
          message: `No content found for query: "${query}"`
        };
      }

      const bestMatch = searchResult.items[0];

      // If UIManager is provided, execute navigation
      if (uiManager && typeof uiManager.executeIntent === 'function') {
        try {
          const result = await uiManager.executeIntent(bestMatch.navTarget);
          return {
            success: result.success,
            message: result.message || `Navigated to: ${bestMatch.title}`,
            target: bestMatch.navTarget
          };
        } catch (navError) {
          // Graceful fallback - return target without executing
          return {
            success: true,
            message: `Found content but navigation failed: ${bestMatch.title}`,
            target: bestMatch.navTarget
          };
        }
      }

      // Return navigation target without executing
      return {
        success: true,
        message: `Found content: ${bestMatch.title}`,
        target: bestMatch.navTarget
      };

    } catch (error) {
      const errorMsg = `Content navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

      debugEventEmitter.emit('content-navigation-error', {
        query,
        error: errorMsg,
        timestamp: Date.now()
      });

      return {
        success: false,
        message: errorMsg
      };
    }
  }

  /**
   * Configure MMR parameters for result diversification
   */
  configureMMR(config: Partial<MMRConfig>): void {
    this.mmrConfig = { ...this.mmrConfig, ...config };

    debugEventEmitter.emit('content-search-mmr-configured', {
      config: this.mmrConfig,
      timestamp: Date.now()
    });
  }

  /**
   * Get content hierarchy for a specific chunk
   */
  async getContentHierarchy(chunkId: string): Promise<{
    ancestors: any[];
    descendants: any[];
    siblings: any[];
  }> {
    return await this.vectorOps.getContentHierarchy(chunkId);
  }

  /**
   * Search within a content section group
   */
  async searchWithinSection(
    sectionGroup: string,
    query: string,
    maxTier: number = 4
  ): Promise<InternalSearchResult[]> {
    // Generate query embedding
    let queryEmbedding: number[] = [];
    if (this.openai && query.trim()) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.embeddingModel,
          input: query,
          dimensions: this.embeddingDimensions
        });
        queryEmbedding = response.data[0].embedding;
      } catch (error) {
        console.error('Failed to generate query embedding:', error);
      }
    }

    if (queryEmbedding.length > 0) {
      const results = await this.vectorOps.searchWithinSection(sectionGroup, queryEmbedding, 10, maxTier);
      return results.map(result => ({
        id: result.id,
        entityId: result.entity_id || '',
        entityType: result.entity_type,
        entitySlug: result.entity_slug,
        entityTitle: result.entity_title,
        tier: result.tier,
        chunkId: result.chunk_id,
        title: result.title,
        content: result.content,
        tokenCount: 0, // Would need to be fetched separately
        similarity: result.similarity_score,
        metadata: {},
        tags: [],
        technologies: [],
        createdAt: new Date()
      }));
    }

    return [];
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
    fullContent: any[];
  }> {
    return await this.vectorOps.getRelatedContentAcrossTiers(rootChunkId, includeTiers);
  }
  /**
   * Get search statistics for monitoring
   */
  async getSearchStats(): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    entitiesByType: Record<string, number>;
    chunksByTier: Record<number, number>;
    embeddingCache: any;
  }> {
    try {
      const [
        totalChunks,
        chunksWithEmbeddings,
        entitiesByType,
        chunksByTier
      ] = await Promise.all([
        prisma.contextChunk.count(),
        this.vectorOps.getVectorCount(),
        prisma.contentEntity.groupBy({
          by: ['entityType'],
          _count: { id: true }
        }),
        prisma.contextChunk.groupBy({
          by: ['tier'],
          _count: { id: true }
        })
      ]);

      return {
        totalChunks,
        chunksWithEmbeddings,
        entitiesByType: entitiesByType.reduce((acc, item) => {
          acc[item.entityType] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        chunksByTier: chunksByTier.reduce((acc, item) => {
          acc[item.tier] = item._count.id;
          return acc;
        }, {} as Record<number, number>),
        embeddingCache: embeddingCache.getStats()
      };
    } catch (error) {
      console.error('Failed to get search stats:', error);
      return {
        totalChunks: 0,
        chunksWithEmbeddings: 0,
        entitiesByType: {},
        chunksByTier: {},
        embeddingCache: embeddingCache.getStats()
      };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Perform hybrid search combining semantic and metadata filtering
   */
  private async _performHybridSearch(
    queryEmbedding: number[],
    query: string,
    scope: ContentSearchParams['scope'] = {},
    maxTier: number,
    filters: ContentSearchParams['filters'] = {},
    limit: number
  ): Promise<InternalSearchResult[]> {

    const hybridTimings: Record<string, number> = {};
    let results: InternalSearchResult[] = [];

    // If we have embeddings, use semantic search
    if (queryEmbedding.length > 0) {
      try {
        // Time the vector search operation
        const vectorSearchStart = Date.now();
        const semanticResults = await this.vectorOps.semanticSearch(
          queryEmbedding,
          limit,
          maxTier
        );
        hybridTimings.vectorSearchTime = Date.now() - vectorSearchStart;

        // Time the batch chunk fetch
        const chunkFetchStart = Date.now();
        const chunkIds = semanticResults.map(result => result.id);

        const chunks = await prisma.contextChunk.findMany({
          where: {
            id: { in: chunkIds }
          },
          include: {
            entity: true
          }
        });
        hybridTimings.chunkFetchTime = Date.now() - chunkFetchStart;

        // Time the result processing
        const processingStart = Date.now();
        const chunkMap = new Map(chunks.map(chunk => [chunk.id, chunk]));

        // Convert to internal format and apply additional filtering
        for (const result of semanticResults) {
          const chunk = chunkMap.get(result.id);
          if (!chunk || !chunk.entity) continue;

          // Apply metadata filters
          if (!this._matchesFilters(chunk, filters)) continue;
          if (!this._matchesScope(chunk, scope)) continue;

          results.push({
            id: result.id,
            entityId: chunk.entityId,
            entityType: chunk.entity.entityType,
            entitySlug: chunk.entity.slug,
            entityTitle: chunk.entity.title,
            tier: result.tier,
            chunkId: result.chunk_id,
            title: result.title,
            content: result.content,
            tokenCount: chunk.tokenCount,
            similarity: result.similarity_score,
            metadata: chunk.metadata as any,
            tags: chunk.entity.tags as string[],
            technologies: chunk.entity.technologies as string[],
            createdAt: chunk.createdAt
          });
        }
        hybridTimings.processingTime = Date.now() - processingStart;

      } catch (error) {
        console.error('Semantic search failed, falling back to metadata search:', error);
      }
    }

    // If semantic search failed or returned few results, supplement with metadata search using raw SQL
    if (results.length < limit / 2) {
      try {
        const metadataSearchStart = Date.now();
        const metadataResults = await this._performMetadataSearchRawSQL(
          query,
          scope,
          maxTier,
          filters,
          limit
        );
        hybridTimings.metadataSearchTime = Date.now() - metadataSearchStart;

        // Time the result merging
        const mergingStart = Date.now();
        const existingIds = new Set(results.map(r => r.id));

        for (const result of metadataResults) {
          if (existingIds.has(result.id)) continue;

          results.push({
            id: result.id,
            entityId: result.entityId,
            entityType: result.entityType,
            entitySlug: result.entitySlug,
            entityTitle: result.entityTitle,
            tier: result.tier,
            chunkId: result.chunkId,
            title: result.title,
            content: result.content,
            tokenCount: result.tokenCount,
            similarity: 0.5, // Default similarity for metadata matches
            metadata: result.metadata,
            tags: result.tags,
            technologies: result.technologies,
            createdAt: result.createdAt
          });
        }
        hybridTimings.mergingTime = Date.now() - mergingStart;

      } catch (error) {
        console.error('Metadata search failed:', error);
      }
    }

    // Log hybrid search performance breakdown
    console.log(`[HybridSearch] Performance breakdown:`, {
      vectorSearch: hybridTimings.vectorSearchTime ? `${hybridTimings.vectorSearchTime}ms` : 'skipped',
      chunkFetch: hybridTimings.chunkFetchTime ? `${hybridTimings.chunkFetchTime}ms` : 'skipped',
      processing: hybridTimings.processingTime ? `${hybridTimings.processingTime}ms` : 'skipped',
      metadataSearch: hybridTimings.metadataSearchTime ? `${hybridTimings.metadataSearchTime}ms` : 'skipped',
      merging: hybridTimings.mergingTime ? `${hybridTimings.mergingTime}ms` : 'skipped',
      totalResults: results.length
    });

    return results.slice(0, limit);
  }

  /**
   * Perform metadata search using raw SQL to avoid Prisma JSON limitations
   */
  private async _performMetadataSearchRawSQL(
    query: string,
    scope: ContentSearchParams['scope'] = {},
    maxTier: number,
    filters: ContentSearchParams['filters'] = {},
    limit: number
  ): Promise<InternalSearchResult[]> {

    // Build the base SQL query
    let sql = `
      SELECT 
        c.id,
        c.entity_id as "entityId",
        c.tier,
        c.chunk_id as "chunkId", 
        c.title,
        c.content,
        c.token_count as "tokenCount",
        c.metadata,
        c.created_at as "createdAt",
        e.id as entity_id,
        e."entityType",
        e.slug as "entitySlug",
        e.title as "entityTitle",
        e.tags,
        e.technologies
      FROM context_chunks c
      JOIN content_entities e ON c.entity_id = e.id
      WHERE c.tier <= $1
    `;

    const params: any[] = [maxTier];
    let paramIndex = 2;

    // Add scope filtering
    if (scope.projectId) {
      sql += ` AND e."entityType" = 'PROJECT' AND e.slug = $${paramIndex}`;
      params.push(scope.projectId);
      paramIndex++;
    } else if (scope.entityType) {
      sql += ` AND e."entityType" = $${paramIndex}`;
      params.push(scope.entityType);
      paramIndex++;
    }

    // Add tag filtering using JSON operations
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map((_, index) =>
        `e.tags::jsonb ? $${paramIndex + index}`
      ).join(' OR ');
      sql += ` AND (${tagConditions})`;
      params.push(...filters.tags);
      paramIndex += filters.tags.length;
    }

    // Add technology filtering using JSON operations
    if (filters.technologies && filters.technologies.length > 0) {
      const techConditions = filters.technologies.map((_, index) =>
        `e.technologies::jsonb ? $${paramIndex + index}`
      ).join(' OR ');
      sql += ` AND (${techConditions})`;
      params.push(...filters.technologies);
      paramIndex += filters.technologies.length;
    }

    // Add date range filtering
    if (filters.dateRange) {
      if (filters.dateRange.from) {
        sql += ` AND c.created_at >= $${paramIndex}`;
        params.push(filters.dateRange.from);
        paramIndex++;
      }
      if (filters.dateRange.to) {
        sql += ` AND c.created_at <= $${paramIndex}`;
        params.push(filters.dateRange.to);
        paramIndex++;
      }
    }

    // Add text search conditions
    if (query.trim()) {
      sql += ` AND (
        c.content ILIKE $${paramIndex} OR 
        c.title ILIKE $${paramIndex} OR 
        e.title ILIKE $${paramIndex}
      )`;
      params.push(`%${query}%`);
      paramIndex++;
    }

    // Add ordering and limit
    sql += ` ORDER BY c.tier ASC, c.token_count DESC LIMIT $${paramIndex}`;
    params.push(limit);

    try {
      const rawResults = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

      return rawResults.map(row => ({
        id: row.id,
        entityId: row.entityId,
        entityType: row.entityType,
        entitySlug: row.entitySlug,
        entityTitle: row.entityTitle,
        tier: row.tier,
        chunkId: row.chunkId,
        title: row.title,
        content: row.content,
        tokenCount: row.tokenCount,
        similarity: 0.5, // Default for metadata search
        metadata: row.metadata,
        tags: Array.isArray(row.tags) ? row.tags : [],
        technologies: Array.isArray(row.technologies) ? row.technologies : [],
        createdAt: row.createdAt
      }));

    } catch (error) {
      console.error('Raw SQL metadata search failed:', error);
      return [];
    }
  }

  /**
   * Apply MMR (Maximal Marginal Relevance) for result diversification
   */
  private _applyMMR(
    results: InternalSearchResult[],
    k: number,
    diversifyBy: 'project' | 'type'
  ): InternalSearchResult[] {
    if (results.length <= k) {
      return results;
    }

    const selected: InternalSearchResult[] = [];
    const remaining = [...results];
    const { lambda, maxSimilarResults } = this.mmrConfig;

    // Always select the highest scoring result first
    if (remaining.length > 0) {
      const best = remaining.shift()!;
      selected.push(best);
    }

    // Select remaining results using MMR
    while (selected.length < k && remaining.length > 0) {
      let bestIndex = -1;
      let bestScore = -1;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];

        // Calculate relevance score (similarity)
        const relevance = candidate.similarity;

        // Calculate diversity score
        const diversity = this._calculateDiversity(candidate, selected, diversifyBy);

        // Check if we already have too many results from same project/type
        const similarCount = this._countSimilarResults(candidate, selected, diversifyBy);
        if (similarCount >= maxSimilarResults) {
          continue; // Skip this candidate
        }

        // MMR score: λ * relevance + (1-λ) * diversity
        const mmrScore = lambda * relevance + (1 - lambda) * diversity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        selected.push(remaining.splice(bestIndex, 1)[0]);
      } else {
        break; // No more suitable candidates
      }
    }

    return selected;
  }

  /**
   * Calculate diversity score for MMR
   */
  private _calculateDiversity(
    candidate: InternalSearchResult,
    selected: InternalSearchResult[],
    diversifyBy: 'project' | 'type'
  ): number {
    if (selected.length === 0) return 1.0;

    let minDiversity = 1.0;

    for (const selectedResult of selected) {
      let diversity = 0.0;

      if (diversifyBy === 'project') {
        // Diversity based on project
        if (candidate.entitySlug !== selectedResult.entitySlug) {
          diversity += 0.5;
        }
        if (candidate.entityType !== selectedResult.entityType) {
          diversity += 0.3;
        }
        if (candidate.tier !== selectedResult.tier) {
          diversity += 0.2;
        }
      } else if (diversifyBy === 'type') {
        // Diversity based on content type
        if (candidate.entityType !== selectedResult.entityType) {
          diversity += 0.4;
        }
        if (candidate.tier !== selectedResult.tier) {
          diversity += 0.3;
        }
        // Technology diversity
        const techOverlap = this._calculateArrayOverlap(
          candidate.technologies,
          selectedResult.technologies
        );
        diversity += (1 - techOverlap) * 0.3;
      }

      minDiversity = Math.min(minDiversity, diversity);
    }

    return minDiversity;
  }

  /**
   * Count similar results for MMR filtering
   */
  private _countSimilarResults(
    candidate: InternalSearchResult,
    selected: InternalSearchResult[],
    diversifyBy: 'project' | 'type'
  ): number {
    return selected.filter(result => {
      if (diversifyBy === 'project') {
        return result.entitySlug === candidate.entitySlug;
      } else {
        return result.entityType === candidate.entityType;
      }
    }).length;
  }

  /**
   * Calculate overlap between two arrays (0-1)
   */
  private _calculateArrayOverlap(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 && arr2.length === 0) return 1.0;
    if (arr1.length === 0 || arr2.length === 0) return 0.0;

    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Format search results for return
   */
  private async _formatSearchResults(
    results: InternalSearchResult[],
    query: string
  ): Promise<ContentSearchResult['items']> {
    const formatted: ContentSearchResult['items'] = [];

    for (const result of results) {
      // Generate one-liner (use T1 content or create from title)
      const oneLiner = result.tier === 1 ?
        result.content.substring(0, 100) + (result.content.length > 100 ? '...' : '') :
        result.title || result.entityTitle || 'Content';

      // Generate relevance justification
      const why = this._generateRelevanceJustification(result, query);

      // Create navigation target
      const navTarget = this._createNavigationTarget(result);

      // Extract facets
      const facets = {
        tech: result.technologies,
        year: result.createdAt ? result.createdAt.getFullYear() : undefined,
        type: result.entityType,
        tier: result.tier
      };

      formatted.push({
        id: result.id,
        project: result.entityType === 'PROJECT' ? result.entitySlug : undefined,
        title: result.title || result.entityTitle || 'Untitled',
        oneLiner,
        why,
        navTarget,
        score: result.similarity,
        facets,
        tokenEstimate: result.tokenCount
      });
    }

    return formatted;
  }

  /**
   * Generate relevance justification for search result
   */
  private _generateRelevanceJustification(result: InternalSearchResult, query: string): string {
    const reasons: string[] = [];

    // Check for direct content matches
    const queryLower = query.toLowerCase();
    const contentLower = result.content.toLowerCase();
    const titleLower = (result.title || '').toLowerCase();

    if (titleLower.includes(queryLower)) {
      reasons.push('matches title');
    } else if (contentLower.includes(queryLower)) {
      reasons.push('contains query terms');
    }

    // Check for technology matches
    const matchingTech = result.technologies.filter(tech =>
      tech.toLowerCase().includes(queryLower) || queryLower.includes(tech.toLowerCase())
    );
    if (matchingTech.length > 0) {
      reasons.push(`uses ${matchingTech[0]}`);
    }

    // Check for tag matches
    const matchingTags = result.tags.filter(tag =>
      tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())
    );
    if (matchingTags.length > 0) {
      reasons.push(`tagged as ${matchingTags[0]}`);
    }

    // Semantic similarity
    if (result.similarity > 0.8) {
      reasons.push('highly relevant');
    } else if (result.similarity > 0.6) {
      reasons.push('semantically related');
    }

    // Default reason
    if (reasons.length === 0) {
      reasons.push('related content');
    }

    return `Relevant because it ${reasons.slice(0, 2).join(' and ')}.`;
  }

  /**
   * Create navigation target for UIManager
   */
  private _createNavigationTarget(result: InternalSearchResult): any {
    // Use chunkId directly (now stores proper anchor IDs)
    const sectionId = result.chunkId;

    if (result.entityType === 'PROJECT') {
      return {
        type: 'project',
        id: result.entitySlug,
        sectionId: sectionId !== 'metadata' ? sectionId : undefined
      };
    } else {
      return {
        type: 'section',
        id: sectionId,
        projectId: result.entitySlug
      };
    }
  }

  /**
   * Check if chunk matches metadata filters
   */
  private _matchesFilters(chunk: any, filters: ContentSearchParams['filters'] = {}): boolean {
    // Tag filtering
    if (filters.tags && filters.tags.length > 0) {
      const chunkTags = chunk.entity.tags as string[];
      const hasMatchingTag = filters.tags.some(tag =>
        chunkTags.some(chunkTag =>
          chunkTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
      if (!hasMatchingTag) return false;
    }

    // Technology filtering
    if (filters.technologies && filters.technologies.length > 0) {
      const chunkTech = chunk.entity.technologies as string[];
      const hasMatchingTech = filters.technologies.some(tech =>
        chunkTech.some(chunkTech =>
          chunkTech.toLowerCase().includes(tech.toLowerCase())
        )
      );
      if (!hasMatchingTech) return false;
    }

    // Date range filtering
    if (filters.dateRange) {
      const chunkDate = chunk.createdAt;
      if (filters.dateRange.from && chunkDate < filters.dateRange.from) return false;
      if (filters.dateRange.to && chunkDate > filters.dateRange.to) return false;
    }

    // Importance filtering (from metadata)
    if (filters.minImportance !== undefined) {
      const importance = chunk.metadata?.importance || 0;
      if (importance < filters.minImportance) return false;
    }

    return true;
  }

  /**
   * Check if chunk matches scope filters
   */
  private _matchesScope(chunk: any, scope: ContentSearchParams['scope'] = {}): boolean {
    if (scope.projectId && chunk.entity.slug !== scope.projectId) {
      return false;
    }

    if (scope.entityType && chunk.entity.entityType !== scope.entityType) {
      return false;
    }

    return true;
  }

  /**
   * Estimate token count for content
   */
  private _estimateTokenCount(content: string): number {
    return Math.ceil(content.length * this.TOKENS_PER_CHAR);
  }
}

export default ContentSearchService;