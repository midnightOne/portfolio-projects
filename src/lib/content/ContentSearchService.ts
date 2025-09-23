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
          // Continue with metadata-only search
        }
      }
      
      const queryEmbeddingTime = Date.now() - embeddingStartTime;

      // Step 2: Perform semantic search with metadata filtering
      const searchResults = await this._performHybridSearch(
        queryEmbedding,
        query,
        scope,
        maxTier,
        filters,
        k * 3 // Get more results for diversification
      );

      // Step 3: Apply MMR diversification
      const diversifiedResults = this._applyMMR(searchResults, k, diversifyBy);

      // Step 4: Format results for return
      const formattedResults = await this._formatSearchResults(diversifiedResults, query);

      const searchTime = Date.now() - startTime;

      debugEventEmitter.emit('content-search-complete', {
        query,
        totalResults: formattedResults.length,
        semanticResults: searchResults.length,
        diversifiedResults: diversifiedResults.length,
        searchTime,
        queryEmbeddingTime,
        timestamp: Date.now()
      });

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
          queryEmbeddingTime,
          searchTime
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
          searchTime: Date.now() - startTime
        }
      };
    }
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

    debugEventEmitter.emit('content-get-start', {
      ids,
      maxTokens,
      includeTiers,
      timestamp: Date.now()
    });

    try {
      // Fetch content chunks by IDs
      const chunks = await prisma.contextChunk.findMany({
        where: {
          id: { in: ids },
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

        results.push({
          id: chunk.id,
          content: chunk.content,
          tokenEstimate: estimatedTokens,
          tier: chunk.tier,
          title: chunk.title || undefined,
          metadata: chunk.metadata as Record<string, any>
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
   * Get search statistics for monitoring
   */
  async getSearchStats(): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    entitiesByType: Record<string, number>;
    chunksByTier: Record<number, number>;
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
        }, {} as Record<number, number>)
      };
    } catch (error) {
      console.error('Failed to get search stats:', error);
      return {
        totalChunks: 0,
        chunksWithEmbeddings: 0,
        entitiesByType: {},
        chunksByTier: {}
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
    
    // Build WHERE conditions for metadata filtering
    const whereConditions: any = {
      tier: { lte: maxTier }
    };

    // Scope filtering
    if (scope.projectId) {
      whereConditions.entity = {
        entityType: 'PROJECT',
        slug: scope.projectId
      };
    } else if (scope.entityType) {
      whereConditions.entity = {
        entityType: scope.entityType
      };
    }

    // Tag filtering - use array_contains for JSON arrays
    if (filters.tags && filters.tags.length > 0) {
      whereConditions.entity = {
        ...whereConditions.entity,
        tags: {
          hasSome: filters.tags
        }
      };
    }

    // Technology filtering - use array_contains for JSON arrays
    if (filters.technologies && filters.technologies.length > 0) {
      whereConditions.entity = {
        ...whereConditions.entity,
        technologies: {
          hasSome: filters.technologies
        }
      };
    }

    // Date range filtering
    if (filters.dateRange) {
      const dateFilter: any = {};
      if (filters.dateRange.from) {
        dateFilter.gte = filters.dateRange.from;
      }
      if (filters.dateRange.to) {
        dateFilter.lte = filters.dateRange.to;
      }
      if (Object.keys(dateFilter).length > 0) {
        whereConditions.createdAt = dateFilter;
      }
    }

    let results: InternalSearchResult[] = [];

    // If we have embeddings, use semantic search
    if (queryEmbedding.length > 0) {
      try {
        const semanticResults = await this.vectorOps.semanticSearch(
          queryEmbedding,
          limit,
          maxTier
        );

        // Convert to internal format and apply additional filtering
        for (const result of semanticResults) {
          // Get full entity and chunk data
          const chunk = await prisma.contextChunk.findUnique({
            where: { id: result.id },
            include: {
              entity: true
            }
          });

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
      } catch (error) {
        console.error('Semantic search failed, falling back to metadata search:', error);
      }
    }

    // If semantic search failed or returned few results, supplement with metadata search
    if (results.length < limit / 2) {
      try {
        // Add text search conditions
        const textSearchConditions = {
          ...whereConditions,
          OR: [
            { content: { contains: query, mode: 'insensitive' as const } },
            { title: { contains: query, mode: 'insensitive' as const } },
            { entity: { title: { contains: query, mode: 'insensitive' as const } } }
          ]
        };

        const metadataResults = await prisma.contextChunk.findMany({
          where: textSearchConditions,
          include: {
            entity: true
          },
          orderBy: [
            { tier: 'asc' },
            { tokenCount: 'desc' }
          ],
          take: limit
        });

        // Add metadata results that aren't already in semantic results
        const existingIds = new Set(results.map(r => r.id));
        
        for (const chunk of metadataResults) {
          if (existingIds.has(chunk.id) || !chunk.entity) continue;

          results.push({
            id: chunk.id,
            entityId: chunk.entityId,
            entityType: chunk.entity.entityType,
            entitySlug: chunk.entity.slug,
            entityTitle: chunk.entity.title,
            tier: chunk.tier,
            chunkId: chunk.chunkId,
            title: chunk.title,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            similarity: 0.5, // Default similarity for metadata matches
            metadata: chunk.metadata as any,
            tags: chunk.entity.tags as string[],
            technologies: chunk.entity.technologies as string[],
            createdAt: chunk.createdAt
          });
        }
      } catch (error) {
        console.error('Metadata search failed:', error);
      }
    }

    return results.slice(0, limit);
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
    if (result.entityType === 'PROJECT') {
      return {
        type: 'project',
        id: result.entitySlug,
        sectionId: result.chunkId !== 'metadata' ? result.chunkId : undefined
      };
    } else {
      return {
        type: 'section',
        id: result.chunkId,
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