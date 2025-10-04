/**
 * Enhanced Content Ingestion Service with Hybrid Tier Generation
 * 
 * This service implements a hybrid approach to content tier generation:
 * 1. User-defined section markers take precedence (<!-- T1: ... -->, <!-- T2: ... -->, <!-- T3: ... -->)
 * 2. Automatic tier generation fallback using OpenAI API when markers are missing
 * 3. OpenAI embedding generation for semantic search
 * 4. UIManager integration for real-time section discovery
 * 5. Batch processing with progress tracking and cost estimation
 * 
 * NOTE: pgvector operations use raw SQL queries (see VectorOperations.ts):
 * - prisma/sql/findSimilarContent.sql
 * - prisma/sql/insertContextChunk.sql  
 * - prisma/sql/semanticSearch.sql
 * - prisma/sql/updateEmbedding.sql
 */

import { PrismaClient } from '@prisma/client';
import { ProjectIndexer } from '../services/project-indexer';
import { ContextManager } from '../services/ai/context-manager';
import { debugEventEmitter } from '../debug/debugEventEmitter';
import VectorOperations from './VectorOperations';
import { IndexMaintenanceService } from '../database/IndexMaintenanceService';
import { SmartContentGenerator, SmartGenerationResult } from './SmartContentGenerator';
import OpenAI from 'openai';
import { EventEmitter } from 'events';

const prisma = new PrismaClient();

// Content tier interfaces
export interface TierContent {
  tier: number;
  chunkId: string;
  title?: string;
  content: string;
  tokenCount: number;
  embedding?: number[];
  metadata: Record<string, any>;
}

export interface ContentIngestionResult {
  entityId: string;
  entityType: string;
  slug: string;
  tiersCreated: number[];
  totalChunks: number;
  embeddingsGenerated: number;
  costEstimate: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

// User-defined tier marker interfaces
export interface UserDefinedTierMarkers {
  T1?: string; // One-liner summary
  T2?: string[]; // Key bullet points
  T3?: string; // Detailed summary
}

// Progress tracking for batch operations
export interface IngestionProgress {
  totalItems: number;
  processedItems: number;
  currentItem: string;
  estimatedCost: number;
  actualCost: number;
  startTime: number;
  estimatedTimeRemaining: number;
  errors: string[];
}

// Content ingestion result interface
export interface ContentIngestionResult {
  entityId: string;
  entityType: string;
  slug: string;
  tiersCreated: number[];
  totalChunks: number;
  embeddingsGenerated: number;
  costEstimate: number;
  processingTime: number;
  success: boolean;
  error?: string;
}

// Event types for UIManager integration
export interface ContentIngestionEvents {
  'content-updated': { entityType: string; slug: string; sections: string[] };
  'sections-discovered': { entityType: string; slug: string; sections: Array<{ id: string; title: string }> };
  'ingestion-progress': IngestionProgress;
  'ingestion-complete': ContentIngestionResult[];
  'ingestion-error': { error: string; context: any };
}

export class ContentIngestionService extends EventEmitter {
  private projectIndexer: ProjectIndexer;
  private contextManager: ContextManager;
  private vectorOps: VectorOperations;
  private indexMaintenance: IndexMaintenanceService;
  private smartGenerator: SmartContentGenerator;
  private openai: OpenAI;
  private embeddingModel = 'text-embedding-3-small';
  private embeddingDimensions = 1536;
  
  // Cost tracking (approximate costs in USD)
  private readonly EMBEDDING_COST_PER_1K_TOKENS = 0.00002; // $0.02 per 1M tokens
  private readonly GPT4_MINI_COST_PER_1K_TOKENS = 0.00015; // $0.15 per 1M input tokens
  
  // Chunking configuration (now handled by SmartContentGenerator for T3 tier)
  // T3 chunks are heading-bounded and use intelligent splitting

  constructor() {
    super();
    this.projectIndexer = ProjectIndexer.getInstance();
    this.contextManager = new ContextManager();
    this.vectorOps = new VectorOperations(prisma);
    this.smartGenerator = new SmartContentGenerator();
    this.indexMaintenance = IndexMaintenanceService.getInstance(prisma, {
      autoAnalyzeThreshold: 50,    // Analyze after 50 changes (more frequent for better performance)
      reindexThreshold: 5000,      // Reindex after 5k changes
      enableAutoMaintenance: true
    });
    
    // Initialize OpenAI client (optional for testing)
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      console.warn('OPENAI_API_KEY not found - embedding generation and auto-tier generation will be skipped');
      this.openai = null as any;
    }
  }

  /**
   * Ingest all existing portfolio content with progress tracking
   */
  async ingestAllContent(): Promise<ContentIngestionResult[]> {
    const startTime = Date.now();
    const results: ContentIngestionResult[] = [];

    try {
      // Get all projects to process
      const projects = await prisma.project.findMany({
        where: { status: 'PUBLISHED' },
        include: {
          articleContent: true,
          tags: true,
          aiIndex: true
        }
      });

      const progress: IngestionProgress = {
        totalItems: projects.length + 3, // +3 for static content
        processedItems: 0,
        currentItem: '',
        estimatedCost: 0,
        actualCost: 0,
        startTime,
        estimatedTimeRemaining: 0,
        errors: []
      };

      // Estimate total cost
      progress.estimatedCost = await this.estimateTotalCost(projects);
      this.emit('ingestion-progress', progress);

      // Process each project
      for (const project of projects) {
        progress.currentItem = `Project: ${project.title}`;
        progress.estimatedTimeRemaining = this.calculateEstimatedTime(progress);
        this.emit('ingestion-progress', progress);

        try {
          const result = await this.ingestProject(project);
          results.push(result);
          progress.actualCost += result.costEstimate;
        } catch (error) {
          const errorMsg = `Failed to ingest project ${project.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          progress.errors.push(errorMsg);
          
          results.push({
            entityId: '',
            entityType: 'PROJECT',
            slug: project.slug,
            tiersCreated: [],
            totalChunks: 0,
            embeddingsGenerated: 0,
            costEstimate: 0,
            processingTime: 0,
            success: false,
            error: errorMsg
          });
        }

        progress.processedItems++;
        this.emit('ingestion-progress', progress);
      }

      // Process static content
      progress.currentItem = 'Static Content';
      this.emit('ingestion-progress', progress);
      
      const staticResults = await this.ingestStaticContent();
      results.push(...staticResults);
      progress.processedItems += staticResults.length;

      this.emit('ingestion-complete', results);
      return results;

    } catch (error) {
      const errorMsg = `Content ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.emit('ingestion-error', { error: errorMsg, context: { startTime } });
      throw new Error(errorMsg);
    }
  }

  /**
   * Ingest a single project with hybrid tier generation
   */
  async ingestProject(project: any): Promise<ContentIngestionResult> {
    const startTime = Date.now();
    let totalCost = 0;
    let embeddingsGenerated = 0;

    try {
      debugEventEmitter.emit('content-ingestion-start', {
        projectId: project.id,
        slug: project.slug,
        timestamp: Date.now()
      });

      // Create or update content entity
      const entity = await prisma.contentEntity.upsert({
        where: {
          entityType_slug: {
            entityType: 'PROJECT',
            slug: project.slug
          }
        },
        create: {
          entityType: 'PROJECT',
          slug: project.slug,
          title: project.title,
          description: project.description,
          tags: project.tags?.map((tag: any) => tag.name) || [],
          technologies: project.aiIndex?.technologies || []
        },
        update: {
          title: project.title,
          description: project.description,
          tags: project.tags?.map((tag: any) => tag.name) || [],
          technologies: project.aiIndex?.technologies || []
        }
      });

      // Generate hierarchical content with simplified T0-T3 structure and heading-bounded chunking
      // This replaces the legacy tier generation logic with the new SmartContentGenerator
      const generationResult = await this.smartGenerator.generateHierarchicalContent(project);
      const tierContents = generationResult.tiers;

      console.log(`[ContentIngestionService] Using SmartContentGenerator for ${project.slug}:`, {
        tiersGenerated: tierContents.length,
        tierTypes: tierContents.map(t => `T${t.tier}`).join(', '),
        costSavings: generationResult.costSavings.estimatedCostSaved.toFixed(4),
        processingTime: `${generationResult.processingStats.processingTime}ms`
      });

      // Log cost savings and performance stats
      console.log(`🎯 Smart Generation Results for ${project.slug}:`, {
        sectionsSkipped: generationResult.costSavings.sectionsSkipped,
        tokensSkipped: generationResult.costSavings.tokensSkipped,
        costSaved: `$${generationResult.costSavings.estimatedCostSaved.toFixed(4)}`,
        processingTime: `${generationResult.processingStats.processingTime}ms`,
        efficiency: `${Math.round((generationResult.processingStats.reusedSections / generationResult.processingStats.totalSections) * 100)}% reused`
      });

      // Generate embeddings for all tiers
      for (const tierContent of tierContents) {
        if (tierContent.content.trim()) {
          const embedding = await this.generateEmbedding(tierContent.content);
          tierContent.embedding = embedding;
          embeddingsGenerated++;
          totalCost += this.calculateEmbeddingCost(tierContent.tokenCount);
        }
      }

      // Store tier content as context chunks using VectorOperations for embedding support
      const chunks = [];
      for (const tierContent of tierContents) {
        const chunkResult = await this.vectorOps.upsertContextChunkWithVector({
          entityId: entity.id,
          projectIndexId: project.id,
          tier: tierContent.tier,
          chunkId: tierContent.chunkId,
          title: tierContent.title,
          content: tierContent.content,
          tokenCount: tierContent.tokenCount,
          embedding: tierContent.embedding,
          metadata: tierContent.metadata,
          // Include hierarchical relationship data from TierContent
          parentChunkId: tierContent.parentChunkId,
          rootChunkId: tierContent.rootChunkId,
          sectionGroup: tierContent.sectionGroup,
          derivationPath: tierContent.derivationPath
        });
        
        // Get the full chunk data for return
        const chunk = await prisma.contextChunk.findUnique({
          where: { id: chunkResult.id }
        });
        if (chunk) chunks.push(chunk);
      }

      // Create content version record
      const contentHash = this.generateContentHash(project);
      await this.createContentVersion(entity.id, contentHash, 'Hybrid tier generation with embeddings');

      // Extract sections for UIManager integration
      const sections = this.extractSectionsFromTiers(tierContents);
      
      // Emit events for UIManager integration
      this.emit('sections-discovered', {
        entityType: 'PROJECT',
        slug: project.slug,
        sections: sections.map(s => ({ id: s.id, title: s.title }))
      });

      this.emit('content-updated', {
        entityType: 'PROJECT',
        slug: project.slug,
        sections: sections.map(s => s.id)
      });

      const processingTime = Date.now() - startTime;

      // Trigger index maintenance after content changes
      try {
        const maintenanceResult = await this.indexMaintenance.onContentChange('insert', chunks.length);
        if (maintenanceResult) {
          console.log(`🔧 Index maintenance triggered: ${maintenanceResult.action} (${maintenanceResult.duration}ms)`);
        }
      } catch (error) {
        console.warn('Index maintenance failed (non-critical):', error);
      }

      debugEventEmitter.emit('content-ingestion-complete', {
        projectId: project.id,
        slug: project.slug,
        tiersCreated: tierContents.map(t => t.tier),
        totalChunks: chunks.length,
        embeddingsGenerated,
        costEstimate: totalCost,
        processingTime,
        timestamp: Date.now()
      });

      return {
        entityId: entity.id,
        entityType: 'PROJECT',
        slug: project.slug,
        tiersCreated: tierContents.map(t => t.tier),
        totalChunks: chunks.length,
        embeddingsGenerated,
        costEstimate: totalCost,
        processingTime,
        success: true
      };

    } catch (error) {
      const errorMsg = `Failed to ingest project ${project.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      debugEventEmitter.emit('content-ingestion-error', {
        projectId: project.id,
        slug: project.slug,
        error: errorMsg,
        timestamp: Date.now()
      });

      return {
        entityId: '',
        entityType: 'PROJECT',
        slug: project.slug,
        tiersCreated: [],
        totalChunks: 0,
        embeddingsGenerated: 0,
        costEstimate: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Parse user-defined tier markers from content
   */
  private parseUserDefinedTierMarkers(content: string): UserDefinedTierMarkers {
    const markers: UserDefinedTierMarkers = {};

    // T1 marker: <!-- T1: One-liner summary -->
    const t1Match = content.match(/<!--\s*T1:\s*(.+?)\s*-->/i);
    if (t1Match) {
      markers.T1 = t1Match[1].trim();
    }

    // T2 markers: <!-- T2: Problem: ... | Solution: ... | Impact: ... -->
    const t2Match = content.match(/<!--\s*T2:\s*(.+?)\s*-->/i);
    if (t2Match) {
      const t2Content = t2Match[1].trim();
      // Split by | or similar delimiters
      markers.T2 = t2Content.split(/\s*\|\s*/).map(bullet => bullet.trim());
    }

    // T3 marker: <!-- T3: Detailed summary -->
    const t3Match = content.match(/<!--\s*T3:\s*(.+?)\s*-->/i);
    if (t3Match) {
      markers.T3 = t3Match[1].trim();
    }

    return markers;
  }

  /**
   * Generate T0-T3 tier content with hybrid approach and hierarchical relationships (simplified structure)
   */
  private async generateProjectTiersHybrid(project: any, userMarkers: UserDefinedTierMarkers): Promise<TierContent[]> {
    const tiers: TierContent[] = [];
    let autoGenerationCost = 0;

    // Get project index for structured content
    const projectIndex = await this.projectIndexer.indexProject(project.id);
    
    // Track relationships for hierarchical structure
    const relationshipMap = new Map<string, string>(); // chunkId -> parentChunkId
    const sectionGroups = new Map<string, string[]>(); // groupId -> chunkIds

    // T0: Metadata only (always auto-generated, root of hierarchy)
    const t0ChunkId = 'metadata';
    tiers.push({
      tier: 0,
      chunkId: t0ChunkId,
      title: 'Project Metadata',
      content: JSON.stringify({
        title: project.title,
        tags: project.tags?.map((tag: any) => tag.name) || [],
        technologies: projectIndex?.technologies || [],
        workDate: project.workDate
      }),
      tokenCount: this.estimateTokenCount(project.title + (project.tags?.map((t: any) => t.name).join(' ') || '')),
      metadata: {
        type: 'metadata',
        importance: 1.0,
        source: 'auto-generated',
        // NEW: Hierarchical relationship metadata
        parentChunkId: null,
        rootChunkId: t0ChunkId,
        sectionGroup: 'root',
        derivationPath: 'T0'
      }
    });

    // T1: One-liner summary (user marker or auto-generated, child of T0)
    const t1ChunkId = 'summary';
    let t1Content: string;
    
    if (userMarkers.T1) {
      t1Content = userMarkers.T1;
    } else {
      // Auto-generate T1 using OpenAI
      t1Content = await this.generateT1Summary(project) || 
                  [project.description, project.briefOverview].filter(Boolean).join('\n\n');
      if (t1Content !== [project.description, project.briefOverview].filter(Boolean).join('\n\n')) {
        autoGenerationCost += this.GPT4_MINI_COST_PER_1K_TOKENS * 2; // Estimate 2k tokens for generation
      }
    }

    if (t1Content) {
      tiers.push({
        tier: 1,
        chunkId: t1ChunkId,
        title: 'Project Summary',
        content: t1Content,
        tokenCount: this.estimateTokenCount(t1Content),
        metadata: {
          type: 'summary',
          importance: 0.9,
          source: userMarkers.T1 ? 'user-defined' : 'auto-generated',
          // NEW: Hierarchical relationship metadata
          parentChunkId: t0ChunkId,
          rootChunkId: t0ChunkId,
          sectionGroup: 'root',
          derivationPath: 'T0→T1'
        }
      });
    }

    // T2: Key bullet points (user markers or auto-generated, children of T1)
    if (userMarkers.T2 && userMarkers.T2.length > 0) {
      userMarkers.T2.forEach((bullet, index) => {
        const chunkId = `key-bullet-${index}`;
        const sectionGroup = `key-points`;
        
        tiers.push({
          tier: 2,
          chunkId,
          title: `Key Point ${index + 1}`,
          content: bullet,
          tokenCount: this.estimateTokenCount(bullet),
          metadata: {
            type: 'key-bullet',
            importance: 0.8,
            source: 'user-defined',
            // NEW: Hierarchical relationship metadata
            parentChunkId: t1ChunkId,
            rootChunkId: t0ChunkId,
            sectionGroup,
            derivationPath: `T0→T1→T2.${index + 1}`
          }
        });
      });
    } else {
      // Auto-generate T2 using high importance sections
      if (projectIndex?.sections) {
        const keySections = projectIndex.sections
          .filter(section => section.importance > 0.7)
          .slice(0, 3);

        if (keySections.length === 0) {
          // Generate T2 bullets using OpenAI
          const t2Bullets = await this.generateT2Bullets(project);
          t2Bullets.forEach((bullet, index) => {
            const chunkId = `key-bullet-${index}`;
            const sectionGroup = `key-points`;
            
            tiers.push({
              tier: 2,
              chunkId,
              title: `Key Point ${index + 1}`,
              content: bullet,
              tokenCount: this.estimateTokenCount(bullet),
              metadata: {
                type: 'key-bullet',
                importance: 0.8,
                source: 'auto-generated',
                // NEW: Hierarchical relationship metadata
                parentChunkId: t1ChunkId,
                rootChunkId: t0ChunkId,
                sectionGroup,
                derivationPath: `T0→T1→T2.${index + 1}`
              }
            });
          });
          autoGenerationCost += this.GPT4_MINI_COST_PER_1K_TOKENS * 2;
        } else {
          keySections.forEach((section, index) => {
            const chunkId = `key-section-${index}`;
            const sectionGroup = `section-${this.slugify(section.title)}`;
            
            tiers.push({
              tier: 2,
              chunkId,
              title: section.title,
              content: section.summary || section.content,
              tokenCount: this.estimateTokenCount(section.summary || section.content),
              metadata: {
                type: 'key-section',
                importance: section.importance,
                keywords: section.keywords,
                source: 'project-indexer',
                // NEW: Hierarchical relationship metadata
                parentChunkId: t1ChunkId,
                rootChunkId: t0ChunkId,
                sectionGroup,
                derivationPath: `T0→T1→T2.${index + 1}`
              }
            });

            // Track section group for T3 chunks
            if (!sectionGroups.has(sectionGroup)) {
              sectionGroups.set(sectionGroup, []);
            }
            sectionGroups.get(sectionGroup)!.push(chunkId);
          });
        }
      }
    }

    // T3: Detailed sections (user marker or auto-generated, children of T2 sections)
    if (userMarkers.T3) {
      tiers.push({
        tier: 3,
        chunkId: 'detailed-summary',
        title: 'Detailed Summary',
        content: userMarkers.T3,
        tokenCount: this.estimateTokenCount(userMarkers.T3),
        metadata: {
          type: 'detailed-summary',
          importance: 0.7,
          source: 'user-defined',
          // NEW: Hierarchical relationship metadata
          parentChunkId: t1ChunkId, // Direct child of T1 if user-defined
          rootChunkId: t0ChunkId,
          sectionGroup: 'detailed-summary',
          derivationPath: 'T0→T1→T3'
        }
      });
    } else {
      // Use all sections from ProjectIndexer or auto-generate
      if (projectIndex?.sections && projectIndex.sections.length > 0) {
        projectIndex.sections.forEach((section, index) => {
          const chunkId = `section-${index}`;
          const sectionGroup = `section-${this.slugify(section.title)}`;
          
          // Find parent T2 chunk for this section
          const parentT2ChunkId = tiers.find(t => 
            t.tier === 2 && 
            t.metadata.sectionGroup === sectionGroup
          )?.chunkId || t1ChunkId; // Fallback to T1 if no T2 parent

          tiers.push({
            tier: 3,
            chunkId,
            title: section.title,
            content: section.content,
            tokenCount: this.estimateTokenCount(section.content),
            metadata: {
              type: 'section',
              importance: section.importance,
              keywords: section.keywords,
              nodeType: section.nodeType,
              source: 'project-indexer',
              // NEW: Hierarchical relationship metadata
              parentChunkId: parentT2ChunkId,
              rootChunkId: t0ChunkId,
              sectionGroup,
              derivationPath: `T0→T1→T2.x→T3.${index + 1}`
            }
          });
        });
      } else {
        // Auto-generate T3 detailed summary
        const t3Content = await this.generateT3DetailedSummary(project);
        if (t3Content) {
          tiers.push({
            tier: 3,
            chunkId: 'detailed-summary',
            title: 'Detailed Summary',
            content: t3Content,
            tokenCount: this.estimateTokenCount(t3Content),
            metadata: {
              type: 'detailed-summary',
              importance: 0.7,
              source: 'auto-generated',
              // NEW: Hierarchical relationship metadata
              parentChunkId: t1ChunkId,
              rootChunkId: t0ChunkId,
              sectionGroup: 'detailed-summary',
              derivationPath: 'T0→T1→T3'
            }
          });
          autoGenerationCost += this.GPT4_MINI_COST_PER_1K_TOKENS * 3;
        }
      }
    }

    // Note: T3 is now the terminal tier with heading-bounded chunking
    // Full content chunking is handled by SmartContentGenerator's T3 generation

    return tiers;
  }

  /**
   * Generate T1 one-liner summary using OpenAI
   */
  private async generateT1Summary(project: any): Promise<string | null> {
    if (!this.openai) {
      console.warn('OpenAI client not available - skipping T1 auto-generation');
      return null;
    }

    try {
      const prompt = `Create a concise one-liner summary (20-30 words) for this project:

Title: ${project.title}
Description: ${project.description}
Brief Overview: ${project.briefOverview || 'N/A'}

Focus on the key innovation, technology, or impact. Make it engaging and specific.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('Failed to generate T1 summary:', error);
      return null;
    }
  }

  /**
   * Generate T2 key bullet points using OpenAI
   */
  private async generateT2Bullets(project: any): Promise<string[]> {
    if (!this.openai) {
      console.warn('OpenAI client not available - skipping T2 auto-generation');
      return [];
    }

    try {
      const prompt = `Create 3 key bullet points for this project following the format "Problem: X | Solution: Y | Impact: Z":

Title: ${project.title}
Description: ${project.description}
Brief Overview: ${project.briefOverview || 'N/A'}
Content Preview: ${project.articleContent?.content?.substring(0, 500) || 'N/A'}

Each bullet should be 15-25 words and highlight different aspects: technical challenge, solution approach, and measurable impact.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        return content.split('\n').filter(line => line.trim()).slice(0, 3);
      }
      return [];
    } catch (error) {
      console.error('Failed to generate T2 bullets:', error);
      return [];
    }
  }

  /**
   * Generate T3 detailed summary using OpenAI
   */
  private async generateT3DetailedSummary(project: any): Promise<string | null> {
    if (!this.openai) {
      console.warn('OpenAI client not available - skipping T3 auto-generation');
      return null;
    }

    try {
      const prompt = `Create a detailed technical summary (100-150 words) for this project:

Title: ${project.title}
Description: ${project.description}
Brief Overview: ${project.briefOverview || 'N/A'}
Content: ${project.articleContent?.content?.substring(0, 1000) || 'N/A'}

Include: technical architecture, key features, implementation details, technologies used, and measurable outcomes. Be specific and technical.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.6
      });

      return response.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('Failed to generate T3 detailed summary:', error);
      return null;
    }
  }

  /**
   * Generate OpenAI embedding for content
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    if (!this.openai) {
      console.warn('OpenAI client not available - skipping embedding generation');
      return [];
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: content,
        dimensions: this.embeddingDimensions
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      return [];
    }
  }

  /**
   * Chunk content into smaller pieces with overlap
   */
  private chunkContent(content: string, chunkSize: number, overlap: number): string[] {
    const words = content.split(/\s+/);
    const chunks: string[] = [];
    
    // Rough approximation: 1 token ≈ 0.75 words
    const wordsPerChunk = Math.floor(chunkSize * 0.75);
    const overlapWords = Math.floor(overlap * 0.75);
    
    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Extract sections from tier content for UIManager integration
   */
  private extractSectionsFromTiers(tierContents: TierContent[]): Array<{ id: string; title: string; tier: number }> {
    const sections: Array<{ id: string; title: string; tier: number }> = [];
    
    tierContents.forEach(tier => {
      if (tier.title && tier.tier >= 2) { // Only T2+ tiers have meaningful sections
        sections.push({
          id: tier.chunkId,
          title: tier.title,
          tier: tier.tier
        });
      }
    });
    
    return sections;
  }

  /**
   * Ingest static content (bio, resume, etc.)
   */
  private async ingestStaticContent(): Promise<ContentIngestionResult[]> {
    const results: ContentIngestionResult[] = [];

    const staticEntities = [
      { type: 'BIO', slug: 'bio', title: 'Professional Bio' },
      { type: 'RESUME', slug: 'resume', title: 'Resume & Experience' },
      { type: 'SKILLS', slug: 'skills', title: 'Technical Skills' }
    ];

    for (const entityData of staticEntities) {
      const startTime = Date.now();
      
      try {
        const entity = await prisma.contentEntity.upsert({
          where: {
            entityType_slug: {
              entityType: entityData.type as any,
              slug: entityData.slug
            }
          },
          create: {
            entityType: entityData.type as any,
            slug: entityData.slug,
            title: entityData.title,
            description: `${entityData.title} content placeholder`,
            tags: [],
            technologies: []
          },
          update: {
            title: entityData.title
          }
        });

        // Create basic T0 metadata tier
        const metadataContent = JSON.stringify({
          title: entityData.title,
          type: entityData.type,
          slug: entityData.slug
        });

        await prisma.contextChunk.upsert({
          where: {
            entityId_tier_chunkId: {
              entityId: entity.id,
              tier: 0,
              chunkId: 'metadata'
            }
          },
          create: {
            entityId: entity.id,
            tier: 0,
            chunkId: 'metadata',
            title: 'Metadata',
            content: metadataContent,
            tokenCount: this.estimateTokenCount(metadataContent),
            metadata: { type: 'metadata', source: 'static' }
          },
          update: {
            content: metadataContent,
            tokenCount: this.estimateTokenCount(metadataContent)
          }
        });

        results.push({
          entityId: entity.id,
          entityType: entityData.type,
          slug: entityData.slug,
          tiersCreated: [0],
          totalChunks: 1,
          embeddingsGenerated: 0,
          costEstimate: 0,
          processingTime: Date.now() - startTime,
          success: true
        });

      } catch (error) {
        results.push({
          entityId: '',
          entityType: entityData.type,
          slug: entityData.slug,
          tiersCreated: [],
          totalChunks: 0,
          embeddingsGenerated: 0,
          costEstimate: 0,
          processingTime: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Update content for a specific entity with change detection
   */
  async updateEntityContent(entityType: string, slug: string): Promise<ContentIngestionResult> {
    if (entityType === 'PROJECT') {
      const project = await prisma.project.findUnique({
        where: { slug },
        include: {
          articleContent: true,
          tags: true,
          aiIndex: true
        }
      });

      if (!project) {
        throw new Error(`Project not found: ${slug}`);
      }

      // Check if content has changed
      const newContentHash = this.generateContentHash(project);
      const entity = await prisma.contentEntity.findUnique({
        where: {
          entityType_slug: {
            entityType: 'PROJECT',
            slug
          }
        }
      });

      if (!entity) {
        throw new Error(`Entity not found: ${slug}`);
      }

      const lastVersion = await prisma.contentVersion.findFirst({
        where: { 
          entityId: entity.id
        },
        orderBy: { versionNumber: 'desc' }
      });

      if (lastVersion && lastVersion.contentHash === newContentHash) {
        // Content hasn't changed, skip processing
        return {
          entityId: lastVersion.entityId,
          entityType: 'PROJECT',
          slug,
          tiersCreated: [],
          totalChunks: 0,
          embeddingsGenerated: 0,
          costEstimate: 0,
          processingTime: 0,
          success: true
        };
      }

      return await this.ingestProject(project);
    }

    throw new Error(`Entity type ${entityType} not supported for updates yet`);
  }

  /**
   * Estimate total cost for batch processing
   */
  private async estimateTotalCost(projects: any[]): Promise<number> {
    let totalCost = 0;
    
    for (const project of projects) {
      const contentLength = (project.articleContent?.content || '').length;
      const estimatedTokens = this.estimateTokenCount(project.articleContent?.content || '');
      
      // Embedding costs (all tiers)
      totalCost += this.calculateEmbeddingCost(estimatedTokens);
      
      // Auto-generation costs (if no user markers)
      const userMarkers = this.parseUserDefinedTierMarkers(project.articleContent?.content || '');
      if (!userMarkers.T1) totalCost += this.GPT4_MINI_COST_PER_1K_TOKENS * 2;
      if (!userMarkers.T2) totalCost += this.GPT4_MINI_COST_PER_1K_TOKENS * 2;
      if (!userMarkers.T3) totalCost += this.GPT4_MINI_COST_PER_1K_TOKENS * 3;
    }
    
    return totalCost;
  }

  /**
   * Calculate embedding cost for given token count
   */
  private calculateEmbeddingCost(tokenCount: number): number {
    return (tokenCount / 1000) * this.EMBEDDING_COST_PER_1K_TOKENS;
  }

  /**
   * Calculate estimated time remaining for batch processing
   */
  private calculateEstimatedTime(progress: IngestionProgress): number {
    if (progress.processedItems === 0) return 0;
    
    const elapsedTime = Date.now() - progress.startTime;
    const avgTimePerItem = elapsedTime / progress.processedItems;
    const remainingItems = progress.totalItems - progress.processedItems;
    
    return remainingItems * avgTimePerItem;
  }

  /**
   * Create a content version record for tracking changes
   */
  private async createContentVersion(entityId: string, contentHash: string, changesSummary: string): Promise<void> {
    const lastVersion = await prisma.contentVersion.findFirst({
      where: { entityId },
      orderBy: { versionNumber: 'desc' }
    });

    const nextVersion = (lastVersion?.versionNumber || 0) + 1;

    await prisma.contentVersion.create({
      data: {
        entityId,
        versionNumber: nextVersion,
        contentHash,
        changesSummary
      }
    });
  }

  /**
   * Generate a content hash for change detection
   */
  private generateContentHash(project: any): string {
    const content = JSON.stringify({
      title: project.title,
      description: project.description,
      briefOverview: project.briefOverview,
      articleContent: project.articleContent?.content,
      updatedAt: project.updatedAt
    });

    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Estimate token count for content (rough approximation)
   */
  private estimateTokenCount(content: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(content.length / 4);
  }

  /**
   * Helper method to find best parent chunk based on content similarity
   */
  private findBestParentChunk(content: string, candidateParents: TierContent[]): string | null {
    if (candidateParents.length === 0) return null;
    
    // Simple keyword-based matching (could be enhanced with embeddings)
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    let bestMatch = candidateParents[0];
    let bestScore = 0;
    
    for (const candidate of candidateParents) {
      const candidateWords = new Set(candidate.content.toLowerCase().split(/\s+/));
      const intersection = new Set([...contentWords].filter(x => candidateWords.has(x)));
      const score = intersection.size / Math.max(contentWords.size, candidateWords.size);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }
    
    return bestScore > 0.1 ? bestMatch.chunkId : null; // Minimum similarity threshold
  }

  /**
   * Helper method to create URL-friendly slugs
   */
  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /**
   * Clean up orphaned content chunks
   */
  async cleanupOrphanedChunks(): Promise<number> {
    const result = await prisma.contextChunk.deleteMany({
      where: {
        entity: null
      }
    });

    return result.count;
  }

  /**
   * Get ingestion statistics
   */
  async getIngestionStats(): Promise<{
    totalEntities: number;
    totalChunks: number;
    totalEmbeddings: number;
    tierDistribution: Record<number, number>;
    sourceDistribution: Record<string, number>;
  }> {
    const totalEntities = await prisma.contentEntity.count();
    const totalChunks = await prisma.contextChunk.count();
    
    // Count chunks with embeddings using raw SQL (since embeddingVector is Unsupported)
    const embeddingCountResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count 
      FROM context_chunks 
      WHERE embedding_vector IS NOT NULL
    `;
    const chunksWithEmbeddings = Number(embeddingCountResult[0]?.count || 0);

    const tierDistribution = await prisma.contextChunk.groupBy({
      by: ['tier'],
      _count: { tier: true }
    });

    const sourceDistribution = await prisma.contextChunk.groupBy({
      by: ['metadata'],
      _count: { metadata: true }
    });

    return {
      totalEntities,
      totalChunks,
      totalEmbeddings: chunksWithEmbeddings,
      tierDistribution: tierDistribution.reduce((acc, item) => {
        acc[item.tier] = item._count.tier;
        return acc;
      }, {} as Record<number, number>),
      sourceDistribution: sourceDistribution.reduce((acc, item) => {
        const source = (item.metadata as any)?.source || 'unknown';
        acc[source] = (acc[source] || 0) + item._count.metadata;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export default ContentIngestionService;
