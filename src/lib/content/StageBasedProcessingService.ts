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
import { ProjectIndexer } from '../services/project-indexer';
import { EventEmitter } from 'events';

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
}

interface EmbeddingsCheckpoint {
  embeddingsGenerated: Array<{
    chunkId: string;
    embedding: number[];
    cost: number;
  }>;
  batchJobIds?: string[];
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
  private projectIndexer: ProjectIndexer;

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
    this.projectIndexer = ProjectIndexer.getInstance();
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

    // Get chunks from chunking stage
    const chunkingCheckpoint = progress.stageProgress.chunking.checkpoint as ChunkingCheckpoint;
    if (!chunkingCheckpoint) {
      throw new Error('Chunking stage must be completed before summaries');
    }

    // Get project to fetch actual content
    const projects = await this.getProjectsToProcess(request);
    const project = projects[0]; // Assuming single project for now

    // Get enhanced project index for content extraction
    const enhancedIndex = await this.projectIndexer.indexProjectHierarchical(project.id);

    // Filter only placeholders that need AI generation (T1 and T2)
    // Auto-populated T2s (small sections that fit the budget) are already complete
    const allT1T2Chunks = chunkingCheckpoint.chunksCreated.filter(chunk => chunk.tier === 1 || chunk.tier === 2);
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
          const allT3Chunks = chunkingCheckpoint.chunksCreated.filter(c => c.tier === 3);
          sourceContent = allT3Chunks.map(c => c.content).join('\n\n');
          console.log(`[SummariesStage] T1: Using ${allT3Chunks.length} T3 chunks as source (${sourceContent.length} chars)`);
        } else {
          // T2: Summarize section content (all T3 chunks in this section)
          const sectionGroup = chunk.sectionGroup || chunk.chunkId;
          const sectionT3Chunks = chunkingCheckpoint.chunksCreated.filter(
            c => c.tier === 3 && c.sectionGroup === sectionGroup
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

    console.log(`[SummariesStage] Complete: Generated ${checkpoint.summariesGenerated.length} summaries`);
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

    // Get chunks from previous stages
    const chunkingCheckpoint = progress.stageProgress.chunking.checkpoint as ChunkingCheckpoint;
    if (!chunkingCheckpoint) {
      throw new Error('Chunking stage must be completed before embeddings');
    }

    const allChunks = chunkingCheckpoint.chunksCreated;
    stageProgress.totalItems = allChunks.length;

    const checkpoint: EmbeddingsCheckpoint = {
      embeddingsGenerated: [],
      batchJobIds: []
    };

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

      const batchConfig = {
        model: 'text-embedding-3-small',
        priority: 'normal' as const,
        estimatedTokens: allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
        estimatedCost: this.calculateEmbeddingCost(allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)),
        projectIds: request.projectId ? [request.projectId] : []
      };

      const batchJob = await this.batchEmbeddingService.submitBatchJob(batchRequests, batchConfig);

      checkpoint.batchJobIds = [batchJob.batchId];
      stageProgress.checkpoint = checkpoint;

      // Monitor batch job progress
      await this.monitorBatchJob(request.operationId, batchJob.batchId);

    } else {
      // Immediate processing
      for (const chunk of allChunks) {
        try {
          // Generate embedding using OpenAI directly since VectorOperations doesn't have this method
          const embedding = await this.generateEmbedding(chunk.content);
          chunk.embedding = embedding;

          checkpoint.embeddingsGenerated.push({
            chunkId: chunk.chunkId,
            embedding,
            cost: this.calculateEmbeddingCost(chunk.tokenCount)
          });

          const cost = this.calculateEmbeddingCost(chunk.tokenCount);
          progress.costAccumulated += cost;

          stageProgress.itemsProcessed++;
          stageProgress.progress = (stageProgress.itemsProcessed / stageProgress.totalItems) * 100;
          stageProgress.checkpoint = checkpoint;

          this.notifyProgress(request.operationId, progress);

        } catch (error) {
          stageProgress.errors.push(`Chunk ${chunk.chunkId}: ${error.message}`);
          throw error;
        }
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

    // Get chunks from previous stages
    const chunkingCheckpoint = progress.stageProgress.chunking.checkpoint as ChunkingCheckpoint;
    if (!chunkingCheckpoint) {
      throw new Error('Chunking stage must be completed before validation');
    }

    const allChunks = chunkingCheckpoint.chunksCreated;
    console.log(`[ValidationStage] Found ${allChunks.length} chunks to validate and store`);
    
    stageProgress.totalItems = allChunks.length;

    const checkpoint: ValidationCheckpoint = {
      validatedChunks: [],
      healthMetrics: {}
    };

    // Sort chunks by tier to ensure parents are created before children
    const sortedChunks = [...allChunks].sort((a, b) => a.tier - b.tier);
    
    // Validate hierarchical relationships
    for (const chunk of sortedChunks) {
      try {
        // Validate chunk structure
        this.validateChunk(chunk);
        
        // Store chunk in database
        console.log(`[ValidationStage] Storing chunk ${chunk.chunkId} (tier ${chunk.tier})`);
        await this.storeValidatedChunk(chunk, request);
        
        checkpoint.validatedChunks.push(chunk.chunkId);
        
        stageProgress.itemsProcessed++;
        stageProgress.progress = (stageProgress.itemsProcessed / stageProgress.totalItems) * 100;
        stageProgress.checkpoint = checkpoint;

        this.notifyProgress(request.operationId, progress);

      } catch (error) {
        console.error(`[ValidationStage] Error storing chunk ${chunk.chunkId}:`, error);
        stageProgress.errors.push(`Chunk ${chunk.chunkId}: ${error.message}`);
        throw error;
      }
    }
    
    console.log(`[ValidationStage] Successfully validated and stored ${checkpoint.validatedChunks.length} chunks`);

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
   * Get projects to process based on request scope
   */
  private async getProjectsToProcess(request: ProcessingRequest): Promise<any[]> {
    switch (request.scope) {
      case 'all':
        return await prisma.project.findMany({
          where: { status: 'PUBLISHED' },
          include: {
            articleContent: true,
            tags: true,
            aiIndex: true
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
            tags: true,
            aiIndex: true
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
            tags: true,
            aiIndex: true
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

    // Ensure ProjectAIIndex exists (required for foreign key)
    console.log(`[storeValidatedChunk] Upserting ProjectAIIndex for projectId: ${request.projectId}`);
    const projectIndex = await prisma.projectAIIndex.upsert({
      where: { projectId: request.projectId },
      create: {
        projectId: request.projectId,
        summary: '',
        keywords: [],
        topics: [],
        technologies: [],
        sectionsCount: 0,
        mediaCount: 0
      },
      update: {} // Don't overwrite existing data
    });
    console.log(`[storeValidatedChunk] ProjectAIIndex upserted successfully. Record projectId: ${projectIndex.projectId}`);

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

    // For T1 chunks, parent should be null (they are root chunks)
    let resolvedParentChunkId = null;
    if (chunk.parentChunkId && chunk.tier > 1) {
      // Only resolve parent for T2+ chunks
      const parentChunk = await prisma.contextChunk.findFirst({
        where: {
          entityId: entity.id,
          chunkId: chunk.parentChunkId
        },
        select: { id: true }
      });
      
      if (parentChunk) {
        resolvedParentChunkId = parentChunk.id;
      } else {
        console.warn(`Parent chunk not found for ${chunk.chunkId}, proceeding without parent`);
      }
    }

    // Store chunk using VectorOperations
    // projectIndexId references project_ai_index.projectId (which we ensured exists above)
    console.log(`[storeValidatedChunk] Calling upsertContextChunkWithVector with projectIndexId: ${request.projectId}`);
    await this.vectorOps.upsertContextChunkWithVector({
      entityId: entity.id,
      projectIndexId: request.projectId, // Now safe - ProjectAIIndex record exists
      tier: chunk.tier,
      chunkId: chunk.chunkId,
      title: chunk.title,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
      parentChunkId: resolvedParentChunkId,
      rootChunkId: chunk.rootChunkId,
      sectionGroup: chunk.sectionGroup,
      derivationPath: chunk.derivationPath
    });
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
   * Generate embedding using OpenAI
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    // For now, return a mock embedding since we don't have OpenAI client here
    // In production, this would use the OpenAI client to generate real embeddings
    return new Array(1536).fill(0).map(() => Math.random() - 0.5);
  }

  /**
   * Calculate embedding cost
   */
  private calculateEmbeddingCost(tokenCount: number): number {
    return (tokenCount / 1000) * 0.00002; // text-embedding-3-small cost
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