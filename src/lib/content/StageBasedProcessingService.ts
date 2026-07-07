/**
 * Stage-Based Content Processing Service
 * 
 * Implements a stage-based processing architecture with persistent progress tracking,
 * granular admin control, and resumable operations.
 * 
 * Key Features:
 * - Independent stages: chunking → summaries → embeddings → validation
 * - Persistent progress tracking with checkpoints
 * - Granular control interface for stage selection
 * - Resumable operations from last successful stage
 * - Background processing without UI blocking
 * - Server-Sent Events (SSE) for real-time updates
 */

import { prisma } from '@/lib/database/connection';
import { SmartContentGenerator, TierContent } from './SmartContentGenerator';
import { SummaryGenerationService, getSummaryGenerationService } from './SummaryGenerationService';
import { BatchEmbeddingService } from './BatchEmbeddingService';
import { VectorOperations } from './VectorOperations';
import { SemanticBudgetManager } from './SemanticBudgetManager';
import { HierarchicalContentParser } from './HierarchicalContentParser';
import { IndexMaintenanceService } from '../database/IndexMaintenanceService';
import { EventEmitter } from 'events';
import OpenAI from 'openai';

// Processing stages
export type ProcessingStage = 'chunking' | 'summaries' | 'embeddings' | 'validation';

// Processing modes
export type ProcessingMode = 'immediate' | 'batch';

// Stage configuration
export interface StageConfig {
  stage: ProcessingStage;
  enabled: boolean;
  mode: ProcessingMode;
  options?: Record<string, any>;
}

// Processing request
export interface ProcessingRequest {
  operationId: string;
  scope: 'all' | 'project' | 'section';
  projectId?: string;
  sectionId?: string;
  stages: StageConfig[];
  resumeFromStage?: ProcessingStage;
  preserveManualEdits?: boolean;
}

// Processing progress
export interface ProcessingProgress {
  operationId: string;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';
  currentStage: ProcessingStage | null;
  stageProgress: {
    [K in ProcessingStage]: {
      status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
      progress: number; // 0-100
      itemsProcessed: number;
      totalItems: number;
      errors: string[];
      startedAt?: Date;
      completedAt?: Date;
      checkpoint?: any; // Stage-specific checkpoint data
    };
  };
  overallProgress: number; // 0-100
  totalItemsProcessed: number;
  totalItems: number;
  costAccumulated: number;
  tokensUsed: number;
  startedAt: Date;
  lastUpdatedAt: Date;
  completedAt?: Date;
  errors: ProcessingError[];
  canResume: boolean;
  nextStage?: ProcessingStage;
}

// Processing error
export interface ProcessingError {
  stage: ProcessingStage;
  itemId: string;
  itemTitle: string;
  error: string;
  retryable: boolean;
  timestamp: Date;
}

// Processing result
export interface ProcessingResult {
  operationId: string;
  success: boolean;
  stagesCompleted: ProcessingStage[];
  summary: {
    projectsProcessed: number;
    sectionsProcessed: number;
    chunksCreated: number;
    summariesGenerated: number;
    embeddingsGenerated: number;
    totalCost: number;
    processingTime: number;
  };
  errors: ProcessingError[];
}

// Checkpoint data interfaces
interface ChunkingCheckpoint {
  projectsProcessed: string[];
  sectionsProcessed: string[];
  chunksCreated: TierContent[];
}

interface SummariesCheckpoint {
  summariesGenerated: Array<{
    chunkId: string;
    summary: string;
    cost: number;
  }>;
  modifiedChunks?: TierContent[]; // Only chunks that were actually modified
}

interface EmbeddingsCheckpoint {
  embeddingsGenerated: Array<{
    chunkId: string;
    embedding: number[];
    cost: number;
  }>;
  batchJobIds?: string[];
  chunksWithEmbeddings?: TierContent[]; // Chunks with generated embeddings attached
}

interface ValidationCheckpoint {
  validatedChunks: string[];
  healthMetrics: any;
}

/**
 * Main Stage-Based Processing Service
 */
export class StageBasedProcessingService extends EventEmitter {
  private smartGenerator: SmartContentGenerator;
  private summaryService: SummaryGenerationService;
  private batchEmbeddingService: BatchEmbeddingService;
  private vectorOps: VectorOperations;
  private budgetManager: SemanticBudgetManager;
  private contentParser: HierarchicalContentParser;
  private indexMaintenance: IndexMaintenanceService;
  private openai: OpenAI | null;

  // Progress tracking
  private activeOperations = new Map<string, ProcessingProgress>();
  private progressCallbacks = new Map<string, (progress: ProcessingProgress) => void>();

  constructor() {
    super();
    this.smartGenerator = new SmartContentGenerator();
    this.summaryService = getSummaryGenerationService();
    
    // Initialize services with proper parameters
    const apiKey = process.env.OPENAI_API_KEY || '';
    this.batchEmbeddingService = new BatchEmbeddingService(apiKey);
    this.vectorOps = new VectorOperations(prisma);
    this.budgetManager = new SemanticBudgetManager();
    this.contentParser = HierarchicalContentParser.getInstance();
    
    // Initialize index maintenance with optimized settings for embedding operations
    this.indexMaintenance = IndexMaintenanceService.getInstance(prisma, {
      autoAnalyzeThreshold: 50,    // Analyze after 50 embedding changes
      reindexThreshold: 1000,       // Reindex after 1k changes (more frequent for HNSW)
      enableAutoMaintenance: true
    });
    
    // Initialize OpenAI client for embedding generation
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('[StageBasedProcessingService] OpenAI client initialized for embeddings');
    } else {
      console.warn('[StageBasedProcessingService] OPENAI_API_KEY not found - embedding generation will fail');
      this.openai = null;
    }
  }

  /**
   * Start stage-based processing
   */
  async startProcessing(request: ProcessingRequest): Promise<string> {
    const { operationId } = request;

    console.log(`[StageBasedProcessingService] Starting processing for operation: ${operationId}`);
    console.log(`[StageBasedProcessingService] Active operations before: ${this.activeOperations.size}`);

    // Initialize progress tracking
    const progress = this.initializeProgress(request);
    this.activeOperations.set(operationId, progress);
    
    console.log(`[StageBasedProcessingService] Progress initialized and stored for ${operationId}`);
    console.log(`[StageBasedProcessingService] Active operations after: ${this.activeOperations.size}`);

    // Add to job queue
    await this.addToJobQueue(request);

    // Start processing asynchronously
    this.executeProcessing(request).catch(error => {
      console.error(`Processing operation ${operationId} failed:`, error);
      progress.status = 'failed';
      progress.errors.push({
        stage: progress.currentStage || 'chunking',
        itemId: 'system',
        itemTitle: 'System Error',
        error: error.message,
        retryable: false,
        timestamp: new Date()
      });
      this.notifyProgress(operationId, progress);
    });

    return operationId;
  }

  /**
   * Resume processing from a checkpoint
   */
  async resumeProcessing(operationId: string, fromStage?: ProcessingStage): Promise<void> {
    const progress = this.activeOperations.get(operationId);
    if (!progress) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    if (progress.status !== 'paused' && progress.status !== 'failed') {
      throw new Error(`Cannot resume operation in status: ${progress.status}`);
    }

    // Determine resume stage
    const resumeStage = fromStage || progress.nextStage || 'chunking';
    
    // Update progress
    progress.status = 'in_progress';
    progress.currentStage = resumeStage;
    progress.lastUpdatedAt = new Date();

    // Reconstruct request from progress
    const request: ProcessingRequest = {
      operationId,
      scope: 'project', // This would be stored in progress in a real implementation
      stages: Object.keys(progress.stageProgress).map(stage => ({
        stage: stage as ProcessingStage,
        enabled: progress.stageProgress[stage as ProcessingStage].status !== 'skipped',
        mode: 'immediate' // This would be stored in progress
      })),
      resumeFromStage: resumeStage
    };

    // Continue processing
    await this.executeProcessing(request);
  }

  /**
   * Pause processing at current stage
   */
  async pauseProcessing(operationId: string): Promise<void> {
    const progress = this.activeOperations.get(operationId);
    if (!progress) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    progress.status = 'paused';
    progress.lastUpdatedAt = new Date();
    this.notifyProgress(operationId, progress);
  }

  /**
   * Cancel processing operation
   */
  async cancelProcessing(operationId: string): Promise<void> {
    const progress = this.activeOperations.get(operationId);
    if (!progress) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    progress.status = 'failed';
    progress.completedAt = new Date();
    progress.errors.push({
      stage: progress.currentStage || 'chunking',
      itemId: 'system',
      itemTitle: 'User Cancellation',
      error: 'Operation cancelled by user',
      retryable: false,
      timestamp: new Date()
    });

    this.notifyProgress(operationId, progress);
    this.activeOperations.delete(operationId);
  }

  /**
   * Get processing progress
   */
  getProgress(operationId: string): ProcessingProgress | null {
    console.log(`[StageBasedProcessingService] getProgress called for ${operationId}`);
    console.log(`[StageBasedProcessingService] Active operations count: ${this.activeOperations.size}`);
    console.log(`[StageBasedProcessingService] Available operationIds:`, Array.from(this.activeOperations.keys()));
    const progress = this.activeOperations.get(operationId) || null;
    console.log(`[StageBasedProcessingService] Returning progress:`, progress ? 'FOUND' : 'NULL');
    return progress;
  }

  /**
   * Subscribe to progress updates
   */
  subscribeToProgress(
    operationId: string,
    callback: (progress: ProcessingProgress) => void
  ): void {
    this.progressCallbacks.set(operationId, callback);
  }

  /**
   * Unsubscribe from progress updates
   */
  unsubscribeFromProgress(operationId: string): void {
    this.progressCallbacks.delete(operationId);
  }

  /**
   * Initialize progress tracking
   */
  private initializeProgress(request: ProcessingRequest): ProcessingProgress {
    const stageProgress: ProcessingProgress['stageProgress'] = {
      chunking: {
        status: 'pending',
        progress: 0,
        itemsProcessed: 0,
        totalItems: 0,
        errors: []
      },
      summaries: {
        status: 'pending',
        progress: 0,
        itemsProcessed: 0,
        totalItems: 0,
        errors: []
      },
      embeddings: {
        status: 'pending',
        progress: 0,
        itemsProcessed: 0,
        totalItems: 0,
        errors: []
      },
      validation: {
        status: 'pending',
        progress: 0,
        itemsProcessed: 0,
        totalItems: 0,
        errors: []
      }
    };

    // Mark disabled stages as skipped
    for (const stageConfig of request.stages) {
      if (!stageConfig.enabled) {
        stageProgress[stageConfig.stage].status = 'skipped';
        stageProgress[stageConfig.stage].progress = 100;
      }
    }

    return {
      operationId: request.operationId,
      status: 'pending',
      currentStage: null,
      stageProgress,
      overallProgress: 0,
      totalItemsProcessed: 0,
      totalItems: 0,
      costAccumulated: 0,
      tokensUsed: 0,
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      errors: [],
      canResume: true,
      nextStage: this.getNextEnabledStage(request.stages, request.resumeFromStage)
    };
  }

  /**
   * Execute processing stages
   */
  private async executeProcessing(request: ProcessingRequest): Promise<void> {
    const progress = this.activeOperations.get(request.operationId);
    if (!progress) {
      throw new Error(`Operation not found: ${request.operationId}`);
    }

    console.log(`[ExecuteProcessing] Starting execution for ${request.operationId}`);
    console.log(`[ExecuteProcessing] Request stages:`, request.stages);

    progress.status = 'in_progress';
    this.updateJobQueueStatus(request.operationId, 'in_progress');
    this.notifyProgress(request.operationId, progress);

    try {
      // Execute stages in order
      const stages: ProcessingStage[] = ['chunking', 'summaries', 'embeddings', 'validation'];
      const enabledStages = request.stages.filter(s => s.enabled).map(s => s.stage);
      
      console.log(`[ExecuteProcessing] Enabled stages:`, enabledStages);
      
      // Start from resume stage if specified
      const startIndex = request.resumeFromStage 
        ? stages.indexOf(request.resumeFromStage)
        : 0;

      for (let i = startIndex; i < stages.length; i++) {
        const stage = stages[i];
        
        if (!enabledStages.includes(stage)) {
          console.log(`[ExecuteProcessing] Skipping disabled stage: ${stage}`);
          continue;
        }

        const stageConfig = request.stages.find(s => s.stage === stage);
        if (!stageConfig) {
          console.log(`[ExecuteProcessing] No config found for stage: ${stage}`);
          continue;
        }

        console.log(`[ExecuteProcessing] Executing stage: ${stage}`);

        progress.currentStage = stage;
        progress.stageProgress[stage].status = 'in_progress';
        progress.stageProgress[stage].startedAt = new Date();
        this.notifyProgress(request.operationId, progress);

        try {
          await this.executeStage(request, stage, stageConfig);
          
          console.log(`[ExecuteProcessing] Stage ${stage} completed successfully`);
          
          progress.stageProgress[stage].status = 'completed';
          progress.stageProgress[stage].completedAt = new Date();
          progress.stageProgress[stage].progress = 100;
          
        } catch (error) {
          console.error(`[ExecuteProcessing] Stage ${stage} failed:`, error);
          
          progress.stageProgress[stage].status = 'failed';
          progress.stageProgress[stage].errors.push(error.message);
          progress.errors.push({
            stage,
            itemId: 'stage',
            itemTitle: `Stage: ${stage}`,
            error: error.message,
            retryable: true,
            timestamp: new Date()
          });

          // Set next stage for resume capability
          progress.nextStage = stages[i + 1] as ProcessingStage;
          progress.canResume = true;
          this.updateJobQueueStatus(request.operationId, 'failed');
          throw error;
        }

        // Update overall progress
        this.updateOverallProgress(progress);
        this.notifyProgress(request.operationId, progress);
      }

      // Mark as completed
      progress.status = 'completed';
      progress.completedAt = new Date();
      progress.currentStage = null;
      progress.overallProgress = 100;
      progress.canResume = false;
      
      this.updateJobQueueStatus(request.operationId, 'completed');
      this.notifyProgress(request.operationId, progress);

      // Keep operation in memory for 2 minutes for SSE connections
      setTimeout(() => {
        this.activeOperations.delete(request.operationId);
        this.progressCallbacks.delete(request.operationId);
        console.log(`Cleaned up completed operation: ${request.operationId}`);
      }, 120000); // 2 minutes

    } catch (error) {
      progress.status = 'failed';
      progress.completedAt = new Date();
      this.updateJobQueueStatus(request.operationId, 'failed');
      this.notifyProgress(request.operationId, progress);

      // Keep failed operation in memory for 2 minutes for SSE connections
      setTimeout(() => {
        this.activeOperations.delete(request.operationId);
        this.progressCallbacks.delete(request.operationId);
        console.log(`Cleaned up failed operation: ${request.operationId}`);
      }, 120000); // 2 minutes
      
      throw error;
    }
  }

  /**
   * Execute a specific stage
   */
  private async executeStage(
    request: ProcessingRequest,
    stage: ProcessingStage,
    config: StageConfig
  ): Promise<void> {
    switch (stage) {
      case 'chunking':
        await this.executeChunkingStage(request, config);
        break;
      case 'summaries':
        await this.executeSummariesStage(request, config);
        break;
      case 'embeddings':
        await this.executeEmbeddingsStage(request, config);
        break;
      case 'validation':
        await this.executeValidationStage(request, config);
        break;
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }
  }

  /**
   * Execute chunking stage
   */
  private async executeChunkingStage(
    request: ProcessingRequest,
    config: StageConfig
  ): Promise<void> {
    const progress = this.activeOperations.get(request.operationId)!;
    const stageProgress = progress.stageProgress.chunking;

    // Get projects to process
    const projects = await this.getProjectsToProcess(request);
    
    // Set initial estimate (will update with actual count after generation)
    stageProgress.totalItems = projects.length;
    stageProgress.itemsProcessed = 0;

    const checkpoint: ChunkingCheckpoint = {
      projectsProcessed: [],
      sectionsProcessed: [],
      chunksCreated: []
    };

    for (const project of projects) {
      try {
        console.log(`[ChunkingStage] Processing project: ${project.id}`);
        console.log(`[ChunkingStage] Generating scaffold: T0 + T1/T2 placeholders + fully populated T3 chunks`);
        
        // Generate ONLY scaffold: T0, placeholders (T1, T2), and fully populated T3 chunks
        // NO AI summary generation - that happens in summaries stage
        const result = await this.smartGenerator.generateScaffoldOnly(project);
        
        console.log(`[ChunkingStage] Scaffold generated: ${result.tiers.length} total items`);
        console.log(`[ChunkingStage] Breakdown: T0=1, T1=1 (placeholder), T2=${result.tiers.filter(t => t.tier === 2).length} (placeholders), T3=${result.tiers.filter(t => t.tier === 3).length} (populated)`);
        
        checkpoint.chunksCreated.push(...result.tiers);
        checkpoint.projectsProcessed.push(project.id);
        
        stageProgress.itemsProcessed++;
        
        // Update total items to show chunk count once we have it
        stageProgress.totalItems = checkpoint.chunksCreated.length;
        stageProgress.progress = 100; // Chunking is complete once scaffold is generated
        
        // Store checkpoint
        stageProgress.checkpoint = checkpoint;
        
        console.log(`[ChunkingStage] Total scaffold items created: ${checkpoint.chunksCreated.length}`);
        this.notifyProgress(request.operationId, progress);

      } catch (error) {
        console.error(`[ChunkingStage] Error processing project ${project.id}:`, error);
        stageProgress.errors.push(`Project ${project.id}: ${error.message}`);
        throw error;
      }
    }
    
    // Save chunks to database after chunking completes
    console.log(`[ChunkingStage] Saving ${checkpoint.chunksCreated.length} chunks to database...`);
    await this.saveChunksToDatabase(request, checkpoint.chunksCreated, false); // false = no embeddings yet
    console.log(`[ChunkingStage] ✓ Chunks saved to database`);
  }

  /**
   * Execute summaries stage - Fill T1 and T2 placeholders with AI-generated summaries
   */
  private async executeSummariesStage(
    request: ProcessingRequest,
    config: StageConfig
  ): Promise<void> {
    const progress = this.activeOperations.get(request.operationId)!;
    const stageProgress = progress.stageProgress.summaries;

    console.log(`[SummariesStage] Starting AI summary generation for T1 and T2 placeholders`);

    // Get project to fetch actual content
    const projects = await this.getProjectsToProcess(request);
    const project = projects[0]; // Assuming single project for now

    // Get enhanced project index for content extraction
    const enhancedIndex = await this.contentParser.indexProjectHierarchical(project.id);

    // Get chunks - either from chunking checkpoint or from database
    const chunkingCheckpoint = progress.stageProgress.chunking.checkpoint as ChunkingCheckpoint;
    let allT1T2Chunks: TierContent[];
    let allT3Chunks: TierContent[];

    if (chunkingCheckpoint) {
      // Use chunks from the current processing run
      console.log(`[SummariesStage] Using chunks from current chunking checkpoint`);
      allT1T2Chunks = chunkingCheckpoint.chunksCreated.filter(chunk => chunk.tier === 1 || chunk.tier === 2);
      allT3Chunks = chunkingCheckpoint.chunksCreated.filter(chunk => chunk.tier === 3);
    } else {
      // Fetch existing chunks from database
      console.log(`[SummariesStage] No chunking checkpoint - fetching existing chunks from database`);
      
      // Get content entity
      const entity = await prisma.contentEntity.findFirst({
        where: { slug: project.slug }
      });

      if (!entity) {
        throw new Error(`No content entity found for project ${project.slug}`);
      }

      // Fetch all chunks from database
      const dbChunks = await prisma.contextChunk.findMany({
        where: { entityId: entity.id },
        orderBy: { tier: 'asc' }
      });

      console.log(`[SummariesStage] Found ${dbChunks.length} existing chunks in database`);

      // Convert database chunks to TierContent format
      // Note: Prisma automatically converts snake_case DB columns to camelCase
      const convertToTierContent = (dbChunk: any): TierContent => ({
        tier: dbChunk.tier,
        chunkId: dbChunk.chunkId,
        title: dbChunk.title,
        content: dbChunk.content,
        tokenCount: dbChunk.tokenCount,
        parentChunkId: dbChunk.parentChunkId || null,
        rootChunkId: dbChunk.rootChunkId || null,
        sectionGroup: dbChunk.sectionGroup || null,
        derivationPath: dbChunk.derivation_path || null, // Note: No @map in schema, stays snake_case
        sectionBounded: dbChunk.tier === 3 ? true : dbChunk.sectionBounded, // T3 chunks are always section-bounded
        metadata: dbChunk.metadata as any || {}
      });

      allT1T2Chunks = dbChunks
        .filter(chunk => chunk.tier === 1 || chunk.tier === 2)
        .map(convertToTierContent);
      
      allT3Chunks = dbChunks
        .filter(chunk => chunk.tier === 3)
        .map(convertToTierContent);
    }

    // Filter only placeholders that need AI generation (T1 and T2)
    // Auto-populated T2s (small sections that fit the budget) are already complete
    const autoPopulatedT2s = allT1T2Chunks.filter(chunk => chunk.tier === 2 && chunk.metadata.autoPopulated);
    const chunksNeedingSummaries = allT1T2Chunks.filter(chunk => chunk.metadata.needsAIGeneration);

    console.log(`[SummariesStage] T1/T2 Summary: ${allT1T2Chunks.length} total, ${autoPopulatedT2s.length} auto-populated, ${chunksNeedingSummaries.length} need AI`);
    stageProgress.totalItems = chunksNeedingSummaries.length;

    const checkpoint: SummariesCheckpoint = {
      summariesGenerated: []
    };

    for (const chunk of chunksNeedingSummaries) {
      try {
        console.log(`[SummariesStage] Generating ${chunk.tier === 1 ? 'T1' : 'T2'} summary for: ${chunk.chunkId}`);
        
        // Get the actual content to summarize
        let sourceContent: string;
        
        if (chunk.tier === 1) {
          // T1: Summarize entire project content
          sourceContent = allT3Chunks.map(c => c.content).join('\n\n');
          console.log(`[SummariesStage] T1: Using ${allT3Chunks.length} T3 chunks as source (${sourceContent.length} chars)`);
        } else {
          // T2: Summarize section content (all T3 chunks in this section)
          const sectionGroup = chunk.sectionGroup || chunk.chunkId;
          const sectionT3Chunks = allT3Chunks.filter(
            c => c.sectionGroup === sectionGroup
          );
          sourceContent = sectionT3Chunks.map(c => c.content).join('\n\n');
          console.log(`[SummariesStage] T2 (${chunk.chunkId}): Using ${sectionT3Chunks.length} T3 chunks as source (${sourceContent.length} chars)`);
        }

        // Skip if no source content available
        if (!sourceContent || sourceContent.length < 50) {
          console.log(`[SummariesStage] Skipping ${chunk.chunkId}: insufficient source content`);
          chunk.content = 'No content available for summary';
          chunk.metadata.needsAIGeneration = false;
          chunk.metadata.source = 'empty';
          continue;
        }

        // Generate summary using SummaryGenerationService
        const result = await this.summaryService.generateSummary({
          content: sourceContent,
          type: chunk.tier === 1 ? 'T1' : 'T2',
          projectId: request.projectId || '',
          sectionTitle: chunk.title,
          metadata: chunk.metadata
        });

        // Update chunk content with generated summary
        chunk.content = result.summary;
        chunk.tokenCount = this.estimateTokenCount(result.summary);
        chunk.metadata.aiGenerated = true;
        chunk.metadata.needsAIGeneration = false;
        chunk.metadata.placeholder = false;
        chunk.metadata.confidenceScore = result.confidenceScore;
        chunk.metadata.source = 'ai-generated';
        chunk.metadata.generationMode = 'ai';

        console.log(`[SummariesStage] Generated summary for ${chunk.chunkId}: ${result.summary.substring(0, 100)}...`);

        checkpoint.summariesGenerated.push({
          chunkId: chunk.chunkId,
          summary: result.summary,
          cost: result.cost
        });

        progress.costAccumulated += result.cost;
        progress.tokensUsed += result.tokensUsed;

        stageProgress.itemsProcessed++;
        stageProgress.progress = (stageProgress.itemsProcessed / stageProgress.totalItems) * 100;
        stageProgress.checkpoint = checkpoint;

        this.notifyProgress(request.operationId, progress);

      } catch (error) {
        console.error(`[SummariesStage] Error generating summary for ${chunk.chunkId}:`, error);
        stageProgress.errors.push(`Chunk ${chunk.chunkId}: ${error.message}`);
        throw error;
      }
    }

    // Store only the modified chunks (the ones that had summaries generated) in checkpoint for validation stage
    const modifiedChunkIds = new Set(checkpoint.summariesGenerated.map(s => s.chunkId));
    const modifiedChunks = chunksNeedingSummaries.filter(chunk => modifiedChunkIds.has(chunk.chunkId));
    checkpoint.modifiedChunks = modifiedChunks;
    stageProgress.checkpoint = checkpoint;

    console.log(`[SummariesStage] Complete: Generated ${checkpoint.summariesGenerated.length} summaries`);
    console.log(`[SummariesStage] Stored ${modifiedChunks.length} modified chunks in checkpoint`);
    
    // Update chunks in database with new summaries
    if (modifiedChunks.length > 0) {
      console.log(`[SummariesStage] Updating ${modifiedChunks.length} chunks in database with AI summaries...`);
      await this.updateChunksInDatabase(request, modifiedChunks);
      console.log(`[SummariesStage] ✓ Chunks updated in database`);
    }
  }

  /**
   * Estimate token count for text
   */
  private estimateTokenCount(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Execute embeddings stage
   */
  private async executeEmbeddingsStage(
    request: ProcessingRequest,
    config: StageConfig
  ): Promise<void> {
    const progress = this.activeOperations.get(request.operationId)!;
    const stageProgress = progress.stageProgress.embeddings;

    // Get chunks from previous stages (summaries, chunking, or database)
    const summariesCheckpoint = progress.stageProgress.summaries.checkpoint as SummariesCheckpoint;
    const chunkingCheckpoint = progress.stageProgress.chunking.checkpoint as ChunkingCheckpoint;
    let allChunks: TierContent[];

    if (summariesCheckpoint?.modifiedChunks && chunkingCheckpoint) {
      // MERGE modified chunks from summaries with unmodified chunks from chunking
      const modifiedChunkIds = new Set(summariesCheckpoint.modifiedChunks.map(c => c.chunkId));
      const unmodifiedChunks = chunkingCheckpoint.chunksCreated.filter(c => !modifiedChunkIds.has(c.chunkId));
      allChunks = [...summariesCheckpoint.modifiedChunks, ...unmodifiedChunks];
      console.log(`[EmbeddingsStage] Merged ${summariesCheckpoint.modifiedChunks.length} modified + ${unmodifiedChunks.length} unmodified = ${allChunks.length} total chunks`);
    } else if (summariesCheckpoint?.modifiedChunks) {
      // Only modified chunks from summaries stage (no chunking checkpoint)
      console.log(`[EmbeddingsStage] Using ${summariesCheckpoint.modifiedChunks.length} modified chunks from summaries checkpoint`);
      allChunks = summariesCheckpoint.modifiedChunks;
    } else if (chunkingCheckpoint) {
      // Use chunks from chunking stage
      console.log(`[EmbeddingsStage] Using ${chunkingCheckpoint.chunksCreated.length} chunks from chunking checkpoint`);
      allChunks = chunkingCheckpoint.chunksCreated;
    } else {
      // Fetch existing chunks from database
      console.log(`[EmbeddingsStage] No checkpoint found - fetching existing chunks from database`);
      
      const projects = await this.getProjectsToProcess(request);
      const project = projects[0];
      
      const entity = await prisma.contentEntity.findFirst({
        where: { slug: project.slug }
      });

      if (!entity) {
        throw new Error(`No content entity found for project ${project.slug}`);
      }

      const dbChunks = await prisma.contextChunk.findMany({
        where: { entityId: entity.id },
        orderBy: { tier: 'asc' }
      });

      console.log(`[EmbeddingsStage] Found ${dbChunks.length} existing chunks in database`);

      // Build a map of chunkId -> database UUID for parent resolution
      const chunkIdToDbId = new Map<string, string>();
      dbChunks.forEach(chunk => {
        chunkIdToDbId.set(chunk.chunkId, chunk.id);
      });

      // Convert database chunks to TierContent format and restore parent relationships
      // Note: Prisma automatically converts snake_case DB columns to camelCase
      allChunks = dbChunks.map(dbChunk => {
        let parentChunkId = dbChunk.parentChunkId;
        
        // If parent is missing and this is a T2+ chunk, try to infer it from the hierarchy
        if (!parentChunkId && dbChunk.tier > 1) {
          console.log(`[EmbeddingsStage] Chunk ${dbChunk.chunkId} (T${dbChunk.tier}) missing parent - attempting to restore`);
          
          if (dbChunk.tier === 2) {
            // T2 chunks should be parented to T1 "summary"
            const t1Parent = dbChunks.find(c => c.tier === 1 && c.chunkId === 'summary');
            if (t1Parent) {
              parentChunkId = t1Parent.id;
              console.log(`[EmbeddingsStage] Restored T2 parent to summary (${t1Parent.id})`);
            }
          } else if (dbChunk.tier === 3) {
            // T3 chunks should be parented to their T2 section
            // Try to find T2 parent by sectionGroup or by matching chunk ID pattern
            const sectionGroup = dbChunk.sectionGroup;
            if (sectionGroup) {
              const t2Parent = dbChunks.find(c => c.tier === 2 && c.chunkId === sectionGroup);
              if (t2Parent) {
                parentChunkId = t2Parent.id;
                console.log(`[EmbeddingsStage] Restored T3 parent to ${sectionGroup} (${t2Parent.id})`);
              }
            }
          }
        }
        
        return {
          tier: dbChunk.tier,
          chunkId: dbChunk.chunkId,
          title: dbChunk.title,
          content: dbChunk.content,
          tokenCount: dbChunk.tokenCount,
          parentChunkId: parentChunkId || null,
          rootChunkId: dbChunk.rootChunkId || null,
          sectionGroup: dbChunk.sectionGroup || null,
          derivationPath: dbChunk.derivation_path || null, // Note: No @map in schema, stays snake_case
          sectionBounded: dbChunk.tier === 3 ? true : dbChunk.sectionBounded, // T3 chunks are always section-bounded
          metadata: dbChunk.metadata as any || {}
        };
      });
    }

    stageProgress.totalItems = allChunks.length;
    console.log(`[EmbeddingsStage] Processing ${allChunks.length} chunks for embeddings`);

    const checkpoint: EmbeddingsCheckpoint = {
      embeddingsGenerated: [],
      batchJobIds: []
    };

    console.log(`[EmbeddingsStage] Mode: ${config.mode}`);

    if (config.mode === 'batch') {
      // Use batch processing for cost savings
      const batchRequests = allChunks.map(chunk => ({
        id: chunk.chunkId,
        content: chunk.content,
        metadata: {
          chunkId: chunk.chunkId,
          projectId: request.projectId,
          tier: chunk.tier
        }
      }));

      const { resolveModelAlias } = await import('@/lib/ai/model-registry');
      const { estimateCost } = await import('@/lib/ai/pricing');
      const embeddingModel = await resolveModelAlias('default-embedding');
      const totalBatchTokens = allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
      const batchConfig = {
        model: embeddingModel.modelId,
        priority: 'normal' as const,
        estimatedTokens: totalBatchTokens,
        estimatedCost: await estimateCost(embeddingModel.modelId, { inputTokens: totalBatchTokens }),
        projectIds: request.projectId ? [request.projectId] : []
      };

      const batchJob = await this.batchEmbeddingService.submitBatchJob(batchRequests, batchConfig);

      checkpoint.batchJobIds = [batchJob.batchId];
      stageProgress.checkpoint = checkpoint;

      // Monitor batch job progress
      await this.monitorBatchJob(request.operationId, batchJob.batchId);

    } else {
      // Immediate processing
      console.log(`[EmbeddingsStage] Starting immediate embedding generation for ${allChunks.length} chunks`);
      
      for (const chunk of allChunks) {
        try {
          console.log(`[EmbeddingsStage] Generating embedding for chunk ${chunk.chunkId} (${stageProgress.itemsProcessed + 1}/${allChunks.length})`);
          
          // Generate embedding through the shared provider (alias + fake-mode aware)
          const { embedding, costUsd: cost } = await this.generateEmbedding(chunk.content);
          chunk.embedding = embedding;

          checkpoint.embeddingsGenerated.push({
            chunkId: chunk.chunkId,
            embedding,
            cost
          });

          progress.costAccumulated += cost;

          stageProgress.itemsProcessed++;
          stageProgress.progress = (stageProgress.itemsProcessed / stageProgress.totalItems) * 100;
          stageProgress.checkpoint = checkpoint;

          this.notifyProgress(request.operationId, progress);
          
          console.log(`[EmbeddingsStage] Embedding generated for ${chunk.chunkId}, progress: ${stageProgress.progress.toFixed(1)}%`);

        } catch (error) {
          console.error(`[EmbeddingsStage] Error generating embedding for ${chunk.chunkId}:`, error);
          stageProgress.errors.push(`Chunk ${chunk.chunkId}: ${error.message}`);
          throw error;
        }
      }
      
      console.log(`[EmbeddingsStage] Completed immediate embedding generation: ${checkpoint.embeddingsGenerated.length} embeddings`);
      
      // Store chunks with embeddings in checkpoint for validation stage
      checkpoint.chunksWithEmbeddings = allChunks;
      stageProgress.checkpoint = checkpoint;
    }
    
    console.log(`[EmbeddingsStage] Stage complete. Chunks with embeddings: ${checkpoint.chunksWithEmbeddings?.length || 0}`);
    
    // Update chunks in database with embeddings
    if (checkpoint.chunksWithEmbeddings && checkpoint.chunksWithEmbeddings.length > 0) {
      console.log(`[EmbeddingsStage] Updating ${checkpoint.chunksWithEmbeddings.length} chunks in database with embeddings...`);
      await this.updateChunksInDatabase(request, checkpoint.chunksWithEmbeddings, true); // true = has embeddings
      console.log(`[EmbeddingsStage] ✓ Chunks with embeddings saved to database`);
      
      // Trigger HNSW index maintenance after embedding generation
      try {
        console.log(`[EmbeddingsStage] Triggering HNSW index maintenance after ${checkpoint.chunksWithEmbeddings.length} new embeddings...`);
        const maintenanceResult = await this.indexMaintenance.onContentChange('insert', checkpoint.chunksWithEmbeddings.length);
        
        if (maintenanceResult) {
          console.log(`[EmbeddingsStage] 🔧 Index maintenance completed: ${maintenanceResult.action} (${maintenanceResult.duration}ms)`);
          if (maintenanceResult.action === 'reindex') {
            console.log(`[EmbeddingsStage] ✅ HNSW index rebuilt - vector search performance optimized for O(log n)`);
          } else if (maintenanceResult.action === 'analyze') {
            console.log(`[EmbeddingsStage] ✅ Table statistics updated - query planner optimized`);
          }
        } else {
          console.log(`[EmbeddingsStage] ℹ️  No index maintenance needed (below threshold)`);
        }
      } catch (error) {
        console.warn(`[EmbeddingsStage] Index maintenance failed (non-critical):`, error);
        // Don't throw - index maintenance is optimization, not critical for embeddings
      }
    }
  }

  /**
   * Execute validation stage
   */
  private async executeValidationStage(
    request: ProcessingRequest,
    config: StageConfig
  ): Promise<void> {
    const progress = this.activeOperations.get(request.operationId)!;
    const stageProgress = progress.stageProgress.validation;

    console.log(`[ValidationStage] Starting validation for operation ${request.operationId}`);

    // Get chunks from previous stages (embeddings, summaries, chunking, or DB)
    const embeddingsCheckpoint = progress.stageProgress.embeddings.checkpoint as EmbeddingsCheckpoint;
    const summariesCheckpoint = progress.stageProgress.summaries.checkpoint as SummariesCheckpoint;
    const chunkingCheckpoint = progress.stageProgress.chunking.checkpoint as ChunkingCheckpoint;
    let allChunks: TierContent[];

    console.log(`[ValidationStage] Checking checkpoints:`, {
      hasEmbeddingsCheckpoint: !!embeddingsCheckpoint,
      hasChunksWithEmbeddings: !!embeddingsCheckpoint?.chunksWithEmbeddings,
      chunksWithEmbeddingsLength: embeddingsCheckpoint?.chunksWithEmbeddings?.length,
      hasSummariesCheckpoint: !!summariesCheckpoint,
      hasModifiedChunks: !!summariesCheckpoint?.modifiedChunks,
      modifiedChunksLength: summariesCheckpoint?.modifiedChunks?.length,
      hasChunkingCheckpoint: !!chunkingCheckpoint
    });

    if (embeddingsCheckpoint?.chunksWithEmbeddings && embeddingsCheckpoint.chunksWithEmbeddings.length > 0) {
      // Use chunks with embeddings from embeddings stage (has vectors attached)
      console.log(`[ValidationStage] Using ${embeddingsCheckpoint.chunksWithEmbeddings.length} chunks with embeddings from embeddings checkpoint`);
      allChunks = embeddingsCheckpoint.chunksWithEmbeddings;
    } else if (summariesCheckpoint?.modifiedChunks && summariesCheckpoint.modifiedChunks.length > 0 && chunkingCheckpoint) {
      // MERGE modified chunks from summaries with unmodified chunks from chunking
      // Modified chunks = T1/T2 with AI summaries
      // Unmodified chunks = T0, T3, and auto-populated T2s
      const modifiedChunkIds = new Set(summariesCheckpoint.modifiedChunks.map(c => c.chunkId));
      const unmodifiedChunks = chunkingCheckpoint.chunksCreated.filter(c => !modifiedChunkIds.has(c.chunkId));
      allChunks = [...summariesCheckpoint.modifiedChunks, ...unmodifiedChunks];
      console.log(`[ValidationStage] Merged ${summariesCheckpoint.modifiedChunks.length} modified + ${unmodifiedChunks.length} unmodified = ${allChunks.length} total chunks`);
    } else if (summariesCheckpoint?.modifiedChunks && summariesCheckpoint.modifiedChunks.length > 0) {
      // Only modified chunks (no chunking checkpoint - summaries ran independently)
      console.log(`[ValidationStage] Using ${summariesCheckpoint.modifiedChunks.length} modified chunks from summaries checkpoint (no chunking checkpoint)`);
      allChunks = summariesCheckpoint.modifiedChunks;
    } else if (chunkingCheckpoint) {
      // Use chunks from chunking stage (all chunks, since they're all new)
      console.log(`[ValidationStage] Using ${chunkingCheckpoint.chunksCreated.length} chunks from chunking checkpoint`);
      allChunks = chunkingCheckpoint.chunksCreated;
    } else {
      // Fetch existing chunks from database
      console.log(`[ValidationStage] No checkpoint found - fetching existing chunks from database`);
      
      const projects = await this.getProjectsToProcess(request);
      const project = projects[0];
      
      const entity = await prisma.contentEntity.findFirst({
        where: { slug: project.slug }
      });

      if (!entity) {
        throw new Error(`No content entity found for project ${project.slug}`);
      }

      const dbChunks = await prisma.contextChunk.findMany({
        where: { entityId: entity.id },
        orderBy: { tier: 'asc' }
      });

      console.log(`[ValidationStage] Found ${dbChunks.length} existing chunks in database`);

      // Convert database chunks to TierContent format
      // Note: Prisma automatically converts snake_case DB columns to camelCase
      allChunks = dbChunks.map(dbChunk => ({
        tier: dbChunk.tier,
        chunkId: dbChunk.chunkId,
        title: dbChunk.title,
        content: dbChunk.content,
        tokenCount: dbChunk.tokenCount,
        parentChunkId: dbChunk.parentChunkId || null,
        rootChunkId: dbChunk.rootChunkId || null,
        sectionGroup: dbChunk.sectionGroup || null,
        derivationPath: dbChunk.derivation_path || null, // Note: No @map in schema, stays snake_case
        sectionBounded: dbChunk.tier === 3 ? true : dbChunk.sectionBounded, // T3 chunks are always section-bounded
        metadata: dbChunk.metadata as any || {}
      }));
    }

    console.log(`[ValidationStage] Found ${allChunks.length} chunks to validate and store`);
    
    stageProgress.totalItems = allChunks.length;

    const checkpoint: ValidationCheckpoint = {
      validatedChunks: [],
      healthMetrics: {}
    };

    // Sort chunks by tier to ensure parents are created before children
    const sortedChunks = [...allChunks].sort((a, b) => a.tier - b.tier);
    
    // Validate all chunks (fast, no I/O)
    console.log(`[ValidationStage] Validating ${sortedChunks.length} chunks...`);
    for (const chunk of sortedChunks) {
      try {
        this.validateChunk(chunk);
      } catch (error) {
        console.error(`[ValidationStage] Validation failed for chunk ${chunk.chunkId}:`, error);
        stageProgress.errors.push(`Chunk ${chunk.chunkId}: ${error.message}`);
        throw error;
      }
    }
    console.log(`[ValidationStage] All chunks validated successfully`);
    
    // Mark all chunks as validated (no storage needed - already saved incrementally)
    checkpoint.validatedChunks = sortedChunks.map(c => c.chunkId);
    stageProgress.itemsProcessed = sortedChunks.length;
    stageProgress.progress = 100;
    
    console.log(`[ValidationStage] ✓ Validated ${checkpoint.validatedChunks.length} chunks (already persisted in previous stages)`);

    // Generate health metrics
    checkpoint.healthMetrics = {
      totalChunks: allChunks.length,
      tierDistribution: this.calculateTierDistribution(allChunks),
      averageTokenCount: allChunks.reduce((sum, c) => sum + c.tokenCount, 0) / allChunks.length,
      embeddingCoverage: allChunks.filter(c => c.embedding).length / allChunks.length
    };

    stageProgress.checkpoint = checkpoint;
  }

  /**
   * Monitor batch job progress
   */
  private async monitorBatchJob(operationId: string, batchJobId: string): Promise<void> {
    const progress = this.activeOperations.get(operationId)!;
    const stageProgress = progress.stageProgress.embeddings;

    // Poll batch job status
    const pollInterval = setInterval(async () => {
      try {
        // Simulate batch job monitoring since BatchEmbeddingService methods don't exist yet
        const jobStatus = {
          status: 'in_progress' as const,
          progress: Math.min(stageProgress.progress + 10, 100),
          completedItems: stageProgress.itemsProcessed + 1,
          error: null
        };
        
        stageProgress.progress = jobStatus.progress;
        stageProgress.itemsProcessed = jobStatus.completedItems;
        
        if (jobStatus.progress >= 100) {
          clearInterval(pollInterval);
          
          // Simulate completed batch job
          const checkpoint = stageProgress.checkpoint as EmbeddingsCheckpoint;
          
          // For now, just mark as completed
          stageProgress.progress = 100;
          stageProgress.itemsProcessed = stageProgress.totalItems;
          
          stageProgress.checkpoint = checkpoint;
        }

        this.notifyProgress(operationId, progress);

      } catch (error) {
        clearInterval(pollInterval);
        throw error;
      }
    }, 2000); // Poll every 2 seconds for testing
  }

  /**
   * Save chunks to database (used after chunking stage)
   */
  private async saveChunksToDatabase(
    request: ProcessingRequest,
    chunks: TierContent[],
    hasEmbeddings: boolean = false
  ): Promise<void> {
    const projects = await this.getProjectsToProcess(request);
    const project = projects[0];
    
    // Ensure content entity exists
    let entity = await prisma.contentEntity.findFirst({
      where: {
        slug: project.slug,
        entityType: 'PROJECT'
      }
    });

    if (!entity) {
      entity = await prisma.contentEntity.create({
        data: {
          slug: project.slug,
          entityType: 'PROJECT',
          title: project.title,
          description: project.description || project.summary || `AI context for ${project.title}`
        }
      });
    }

    // Use batch storage for efficiency
    if (!hasEmbeddings && chunks.length > 1) {
      await this.batchStoreChunks(chunks, request);
    } else {
      // Store one by one (with embeddings or single chunk)
      for (const chunk of chunks) {
        await this.storeValidatedChunk(chunk, request);
      }
    }
  }

  /**
   * Update existing chunks in database (used after summaries/embeddings stages)
   */
  private async updateChunksInDatabase(
    request: ProcessingRequest,
    chunks: TierContent[],
    hasEmbeddings: boolean = false
  ): Promise<void> {
    const projects = await this.getProjectsToProcess(request);
    const project = projects[0];
    
    const entity = await prisma.contentEntity.findFirst({
      where: { slug: project.slug }
    });

    if (!entity) {
      throw new Error(`Content entity not found for project ${project.slug}`);
    }

    // Update chunks one by one
    for (const chunk of chunks) {
      // Find existing chunk by chunkId
      const existingChunk = await prisma.contextChunk.findFirst({
        where: {
          entityId: entity.id,
          chunkId: chunk.chunkId
        }
      });

      if (existingChunk) {
        // Update with new content/embedding using raw SQL for efficiency
        if (hasEmbeddings && chunk.embedding) {
          // Update with embedding
          // NOTE: PostgreSQL pgvector requires vectors to be cast from string format.
          // We convert the number array [0.1, 0.2, ...] to a string "[0.1,0.2,...]"
          // and then cast it to vector(1536) type. Direct array insertion is not supported by pgvector.
          const embeddingString = `[${chunk.embedding.join(',')}]`;
          await prisma.$executeRaw`
            UPDATE context_chunks
            SET
              content = ${chunk.content},
              token_count = ${chunk.tokenCount},
              metadata = ${JSON.stringify(chunk.metadata || {})}::jsonb,
              embedding_vector = ${embeddingString}::vector(1536),
              embedding_generated_at = NOW(),
              embedding_model = 'text-embedding-3-small',
              updated_at = NOW()
            WHERE id = ${existingChunk.id}
          `;
        } else {
          // Update without embedding (just content)
          await prisma.contextChunk.update({
            where: { id: existingChunk.id },
            data: {
              content: chunk.content,
              tokenCount: chunk.tokenCount,
              metadata: chunk.metadata || {},
              updatedAt: new Date()
            }
          });
        }
        
        console.log(`[UpdateChunks] Updated chunk ${chunk.chunkId} (${chunk.tier === 1 ? 'T1' : chunk.tier === 2 ? 'T2' : chunk.tier === 3 ? 'T3' : 'T0'})`);
      } else {
        console.warn(`[UpdateChunks] Chunk ${chunk.chunkId} not found in database, skipping update`);
      }
    }
  }

  /**
   * Get projects to process based on request scope
   */
  private async getProjectsToProcess(request: ProcessingRequest): Promise<any[]> {
    switch (request.scope) {
      case 'all':
        return await prisma.project.findMany({
          where: { status: 'PUBLISHED' },
          include: {
            articleContent: true,
            tags: true
          }
        });
      
      case 'project':
        if (!request.projectId) {
          throw new Error('projectId required for project scope');
        }
        const project = await prisma.project.findUnique({
          where: { id: request.projectId },
          include: {
            articleContent: true,
            tags: true
          }
        });
        return project ? [project] : [];
      
      case 'section':
        // For section scope, we still need the full project
        if (!request.projectId) {
          throw new Error('projectId required for section scope');
        }
        const sectionProject = await prisma.project.findUnique({
          where: { id: request.projectId },
          include: {
            articleContent: true,
            tags: true
          }
        });
        return sectionProject ? [sectionProject] : [];
      
      default:
        throw new Error(`Invalid scope: ${request.scope}`);
    }
  }

  /**
   * Validate chunk structure
   */
  private validateChunk(chunk: TierContent): void {
    // Validate required fields
    if (!chunk.chunkId || !chunk.content || chunk.tier === undefined) {
      throw new Error(`Invalid chunk structure: missing required fields`);
    }

    // Validate tier relationships (T1 can have no parent, T2+ must have parents)
    if (chunk.tier > 1 && !chunk.parentChunkId) {
      throw new Error(`Chunk ${chunk.chunkId} missing parent relationship`);
    }

    // Validate heading boundaries for T3 chunks
    if (chunk.tier === 3 && chunk.sectionBounded !== true) {
      throw new Error(`T3 chunk ${chunk.chunkId} must be section-bounded`);
    }
  }

  /**
   * Batch store chunks in database (more efficient for multiple chunks without embeddings)
   */
  private async batchStoreChunks(chunks: TierContent[], request: ProcessingRequest): Promise<void> {
    console.log(`[batchStoreChunks] Batch storing ${chunks.length} chunks for projectId: ${request.projectId}`);
    
    const startTime = Date.now();
    
    // Get or create project and entity (once for all chunks)
    const projects = await this.getProjectsToProcess(request);
    const project = projects[0];
    
    if (!project) {
      throw new Error('No project found for batch storage');
    }
    
    console.log(`[batchStoreChunks] Found project: ${project.slug}`);
    
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
        description: project.description || '',
        tags: [],
        technologies: []
      },
      update: {
        title: project.title,
        description: project.description || ''
      }
    });
    
    console.log(`[batchStoreChunks] Entity and project index ready. Starting batch upsert...`);
    
    // Build a map of logical chunk IDs to database IDs for parent and root resolution
    const chunkIdToDbId = new Map<string, string>();
    let t0DbId: string | null = null;
    
    // Use Prisma transaction with individual upserts (Prisma doesn't have native upsertMany)
    // This is still faster than separate transactions per chunk
    await prisma.$transaction(async (tx) => {
      // First pass: Store T0 chunk to get its database ID
      const t0Chunk = chunks.find(c => c.tier === 0);
      if (t0Chunk) {
        const t0Result = await tx.contextChunk.upsert({
          where: {
            entityId_tier_chunkId: {
              entityId: entity.id,
              tier: 0,
              chunkId: t0Chunk.chunkId
            }
          },
          create: {
            entityId: entity.id,
            tier: 0,
            chunkId: t0Chunk.chunkId,
            title: t0Chunk.title ? t0Chunk.title.substring(0, 255) : null,
            content: t0Chunk.content,
            tokenCount: t0Chunk.tokenCount,
            metadata: t0Chunk.metadata || {},
            parentChunkId: null,
            rootChunkId: null, // Will be set to self after getting ID
            sectionGroup: t0Chunk.sectionGroup || null,
            derivation_path: t0Chunk.derivationPath || null,
            sectionBounded: false
          },
          update: {
            title: t0Chunk.title ? t0Chunk.title.substring(0, 255) : null,
            content: t0Chunk.content,
            tokenCount: t0Chunk.tokenCount,
            metadata: t0Chunk.metadata || {},
            updatedAt: new Date()
          }
        });
        
        t0DbId = t0Result.id;
        chunkIdToDbId.set(t0Chunk.chunkId, t0DbId);
        
        // Update T0's rootChunkId to point to itself
        await tx.contextChunk.update({
          where: { id: t0DbId },
          data: { rootChunkId: t0DbId }
        });
        
        console.log(`[batchStoreChunks] T0 chunk stored with ID: ${t0DbId}`);
      }
      
      // Second pass: Store all other chunks
      for (const chunk of chunks) {
        if (chunk.tier === 0) continue; // Already stored
        const truncatedTitle = chunk.title ? chunk.title.substring(0, 255) : null;
        
        // Resolve parent chunk ID from logical ID to database UUID
        let resolvedParentChunkId: string | null = null;
        if (chunk.parentChunkId && chunk.tier >= 1) {
          // T1+ chunks need parent resolution (T1 → T0, T2+ → T1 or other T2s).
          // Resolution order matters: logical IDs are slugs that can look cuid-like
          // (e.g. "chrono-kiln-controller" starts with 'c' and is >20 chars), so the
          // local map and DB lookup by chunkId run BEFORE the cuid fallback.
          if (chunkIdToDbId.has(chunk.parentChunkId)) {
            resolvedParentChunkId = chunkIdToDbId.get(chunk.parentChunkId)!;
            console.log(`[batchStoreChunks] Chunk ${chunk.chunkId}: Resolved parent "${chunk.parentChunkId}" from local map`);
          } else {
            const parentChunk = await tx.contextChunk.findFirst({
              where: {
                entityId: entity.id,
                chunkId: chunk.parentChunkId
              },
              select: { id: true }
            });

            if (parentChunk) {
              resolvedParentChunkId = parentChunk.id;
              chunkIdToDbId.set(chunk.parentChunkId, parentChunk.id);
              console.log(`[batchStoreChunks] Chunk ${chunk.chunkId}: Resolved parent "${chunk.parentChunkId}" from database`);
            } else if (/^c[a-z0-9]{19,}$/.test(chunk.parentChunkId)) {
              // Not a known logical ID and shaped like a cuid (no hyphens) — treat as DB id
              resolvedParentChunkId = chunk.parentChunkId;
              console.log(`[batchStoreChunks] Chunk ${chunk.chunkId}: Using existing DB parent ID: ${resolvedParentChunkId.substring(0, 8)}...`);
            } else {
              console.warn(`[batchStoreChunks] Parent chunk not found for ${chunk.chunkId} (parent: ${chunk.parentChunkId}), proceeding without parent`);
            }
          }
        }
        
        // Resolve rootChunkId: 'metadata' to T0's database UUID
        let resolvedRootChunkId = chunk.rootChunkId;
        if (chunk.rootChunkId === 'metadata' && t0DbId) {
          resolvedRootChunkId = t0DbId;
        }
        
        const result = await tx.contextChunk.upsert({
          where: {
            entityId_tier_chunkId: {
              entityId: entity.id,
              tier: chunk.tier,
              chunkId: chunk.chunkId
            }
          },
          create: {
            entityId: entity.id,
            tier: chunk.tier,
            chunkId: chunk.chunkId,
            title: truncatedTitle,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            metadata: chunk.metadata || {},
            parentChunkId: resolvedParentChunkId,
            rootChunkId: resolvedRootChunkId || null,
            sectionGroup: chunk.sectionGroup || null,
            derivation_path: chunk.derivationPath || null,
            sectionBounded: chunk.tier === 3 ? true : (chunk.sectionBounded || false)
          },
          update: {
            title: truncatedTitle,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            metadata: chunk.metadata || {},
            parentChunkId: resolvedParentChunkId,
            rootChunkId: resolvedRootChunkId || null,
            sectionGroup: chunk.sectionGroup || null,
            derivation_path: chunk.derivationPath || null,
            sectionBounded: chunk.tier === 3 ? true : (chunk.sectionBounded || false),
            updatedAt: new Date()
          }
        });
        
        // Store the database ID for this chunk (for use as parent by subsequent chunks)
        chunkIdToDbId.set(chunk.chunkId, result.id);
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`[batchStoreChunks] Successfully batch stored ${chunks.length} chunks in ${duration}ms (avg ${Math.round(duration / chunks.length)}ms per chunk)`);
  }

  /**
   * Store validated chunk in database
   */
  private async storeValidatedChunk(chunk: TierContent, request: ProcessingRequest): Promise<void> {
    console.log(`[storeValidatedChunk] Storing chunk: ${chunk.chunkId} (T${chunk.tier}), projectId: ${request.projectId}`);
    
    // Get or create content entity
    const project = await prisma.project.findUnique({
      where: { id: request.projectId },
      select: { slug: true, title: true }
    });

    if (!project) {
      throw new Error(`Project not found: ${request.projectId}`);
    }

    console.log(`[storeValidatedChunk] Found project: ${project.slug}`);

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
        title: project.title || chunk.title || '',
        description: '',
        tags: [],
        technologies: []
      },
      update: {}
    });

    // Resolve parent chunk ID from logical ID to database UUID
    let resolvedParentChunkId = null;
    if (chunk.parentChunkId && chunk.tier >= 1) {
      // T1+ chunks need parent resolution (T1 → T0, T2+ → T1 or other T2s).
      // Look up by logical chunkId first — slugs can look cuid-like ("chrono-kiln-controller"
      // starts with 'c' and is >20 chars), so the cuid fallback runs last (cuids have no hyphens).
      const parentChunk = await prisma.contextChunk.findFirst({
        where: {
          entityId: entity.id,
          chunkId: chunk.parentChunkId
        },
        select: { id: true }
      });

      if (parentChunk) {
        resolvedParentChunkId = parentChunk.id;
        console.log(`[storeValidatedChunk] Resolved parent "${chunk.parentChunkId}" from database for ${chunk.chunkId}`);
      } else if (/^c[a-z0-9]{19,}$/.test(chunk.parentChunkId)) {
        resolvedParentChunkId = chunk.parentChunkId;
        console.log(`[storeValidatedChunk] Using existing DB parent ID for ${chunk.chunkId}`);
      } else {
        console.warn(`[storeValidatedChunk] Parent chunk not found for ${chunk.chunkId} (parent: ${chunk.parentChunkId}), proceeding without parent`);
      }
    }

    // Resolve rootChunkId: 'metadata' to T0's database UUID
    let resolvedRootChunkId = chunk.rootChunkId;
    if (chunk.rootChunkId === 'metadata') {
      const t0Chunk = await prisma.contextChunk.findFirst({
        where: {
          entityId: entity.id,
          tier: 0
        },
        select: { id: true }
      });
      
      if (t0Chunk) {
        resolvedRootChunkId = t0Chunk.id;
        console.log(`[storeValidatedChunk] Resolved rootChunkId 'metadata' to T0 database UUID: ${t0Chunk.id}`);
      } else if (chunk.tier === 0) {
        // This IS the T0 chunk - rootChunkId will be set to self after creation
        resolvedRootChunkId = null;
      }
    }

    // Store chunk using VectorOperations
    const result = await this.vectorOps.upsertContextChunkWithVector({
      entityId: entity.id,
      tier: chunk.tier,
      chunkId: chunk.chunkId,
      title: chunk.title,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
      parentChunkId: resolvedParentChunkId,
      rootChunkId: resolvedRootChunkId,
      sectionGroup: chunk.sectionGroup,
      derivationPath: chunk.derivationPath
    });
    
    // If this is T0 and we didn't have a rootChunkId, update it to point to itself
    if (chunk.tier === 0 && !resolvedRootChunkId) {
      await prisma.contextChunk.update({
        where: { id: result.id },
        data: { rootChunkId: result.id }
      });
      console.log(`[storeValidatedChunk] Updated T0 rootChunkId to self: ${result.id}`);
    }
    
    console.log(`[storeValidatedChunk] Chunk ${chunk.chunkId} stored successfully`);
  }

  /**
   * Calculate tier distribution
   */
  private calculateTierDistribution(chunks: TierContent[]): Record<number, number> {
    const distribution: Record<number, number> = {};
    for (const chunk of chunks) {
      distribution[chunk.tier] = (distribution[chunk.tier] || 0) + 1;
    }
    return distribution;
  }

  /**
   * Generate one embedding via the shared provider (default-embedding alias, D4;
   * AI_FAKE_MODE-aware) and mirror the actual spend to the unified ledger (D32).
   */
  private async generateEmbedding(content: string): Promise<{ embedding: number[]; tokensUsed: number; costUsd: number }> {
    try {
      const { generateEmbedding: sharedGenerateEmbedding } = await import('@/lib/ai/embeddings');
      const { estimateCost } = await import('@/lib/ai/pricing');
      const { recordUsage } = await import('@/lib/ai/ledger');

      const result = await sharedGenerateEmbedding(content);
      const costUsd = await estimateCost(result.modelId, { inputTokens: result.tokensUsed });
      await recordUsage({
        feature: 'semantic',
        usageType: 'embedding',
        provider: result.provider,
        modelId: result.modelId,
        inputTokens: result.tokensUsed,
        costUsd,
      });
      return { embedding: result.vector, tokensUsed: result.tokensUsed, costUsd };
    } catch (error) {
      console.error('[StageBasedProcessingService] Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get next enabled stage
   */
  private getNextEnabledStage(
    stages: StageConfig[],
    currentStage?: ProcessingStage
  ): ProcessingStage | undefined {
    const stageOrder: ProcessingStage[] = ['chunking', 'summaries', 'embeddings', 'validation'];
    const enabledStages = stages.filter(s => s.enabled).map(s => s.stage);
    
    if (!currentStage) {
      return enabledStages[0];
    }

    const currentIndex = stageOrder.indexOf(currentStage);
    for (let i = currentIndex + 1; i < stageOrder.length; i++) {
      if (enabledStages.includes(stageOrder[i])) {
        return stageOrder[i];
      }
    }

    return undefined;
  }

  /**
   * Update overall progress
   */
  private updateOverallProgress(progress: ProcessingProgress): void {
    const stages = Object.values(progress.stageProgress);
    const totalProgress = stages.reduce((sum, stage) => sum + stage.progress, 0);
    progress.overallProgress = totalProgress / stages.length;
    
    progress.totalItemsProcessed = stages.reduce((sum, stage) => sum + stage.itemsProcessed, 0);
    progress.totalItems = stages.reduce((sum, stage) => sum + stage.totalItems, 0);
    
    progress.lastUpdatedAt = new Date();
  }

  /**
   * Add job to queue
   */
  private async addToJobQueue(request: ProcessingRequest): Promise<void> {
    try {
      const enabledStages = request.stages.filter(s => s.enabled);
      const processingType = this.determineProcessingType(enabledStages);
      
      // Note: Job queue functionality moved to internal tracking
      // const { jobQueue } = await import('../../app/api/admin/semantic/processing/queue/route');
      
      const job = {
        operationId: request.operationId,
        projectId: request.projectId,
        type: processingType as 'full' | 'chunking' | 'summaries' | 'embeddings' | 'validation',
        status: 'queued' as const,
        startedAt: new Date(),
        estimatedDuration: this.getEstimatedDuration(enabledStages),
        stages: enabledStages.map(s => s.stage)
      };

      // jobQueue.set(request.operationId, job);
      console.log(`Job tracking: ${request.operationId} (${processingType})`);
    } catch (error) {
      console.warn('Failed to add job to queue:', error);
      // Don't fail the operation if queue update fails
    }
  }

  /**
   * Determine processing type from enabled stages
   */
  private determineProcessingType(stages: StageConfig[]): string {
    const enabledStageNames = stages.map(s => s.stage);
    
    if (enabledStageNames.length === 4) {
      return 'full';
    } else if (enabledStageNames.includes('chunking') && enabledStageNames.length <= 2) {
      return 'chunking';
    } else if (enabledStageNames.includes('summaries') && enabledStageNames.length <= 2) {
      return 'summaries';
    } else if (enabledStageNames.includes('embeddings') && enabledStageNames.length <= 2) {
      return 'embeddings';
    } else if (enabledStageNames.includes('validation') && enabledStageNames.length === 1) {
      return 'validation';
    } else {
      return 'custom';
    }
  }

  /**
   * Get estimated duration for stages
   */
  private getEstimatedDuration(stages: StageConfig[]): string {
    const hasBatch = stages.some(s => s.mode === 'batch');
    const stageCount = stages.length;
    
    if (hasBatch) {
      return '~24 hours (batch processing)';
    } else if (stageCount >= 4) {
      return '~2-3 minutes';
    } else if (stageCount >= 2) {
      return '~1 minute';
    } else {
      return '~30 seconds';
    }
  }

  /**
   * Update job queue status
   */
  private async updateJobQueueStatus(operationId: string, status: 'queued' | 'in_progress' | 'paused' | 'completed' | 'failed'): Promise<void> {
    try {
      // Job queue status tracking is now handled internally
      console.log(`Job status update: ${operationId} -> ${status}`);
    } catch (error) {
      console.warn('Failed to update job queue status:', error);
    }
  }

  /**
   * Notify progress update
   */
  private notifyProgress(operationId: string, progress: ProcessingProgress): void {
    const callback = this.progressCallbacks.get(operationId);
    if (callback) {
      callback(progress);
    }

    // Emit event for other listeners
    this.emit('progress', { operationId, progress });
  }


}

export default StageBasedProcessingService;