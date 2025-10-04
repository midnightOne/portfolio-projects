/**
 * Batch Embedding Service
 * 
 * Implements OpenAI Batch API for embedding generation with 50% cost savings.
 * Suitable for non-time-sensitive operations like overnight regeneration and bulk indexing.
 * 
 * Key Features:
 * - 50% cost reduction ($0.01 vs $0.02 per 1M tokens for text-embedding-3-small)
 * - 24-hour processing window
 * - Automatic fallback to standard API for time-sensitive operations
 * - Batch job queue management and prioritization
 * - Progress tracking and analytics
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { semanticBudgetManager } from './SemanticBudgetManager';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Prisma client with BatchEmbeddingJob model
const prisma = new PrismaClient();

export interface BatchEmbeddingRequest {
  id: string;
  content: string;
  metadata: {
    chunkId: string;
    projectId?: string;
    tier: number;
  };
}

export interface BatchJobConfig {
  model: string;
  priority: 'low' | 'normal' | 'high';
  estimatedTokens: number;
  estimatedCost: number;
  projectIds: string[];
}

export interface BatchJobStatus {
  id: string;
  status: 'validating' | 'in_progress' | 'finalizing' | 'completed' | 'failed' | 'expired' | 'cancelling' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  requestCount: number;
  completedCount: number;
  failedCount: number;
  estimatedCost: number;
  actualCost?: number;
  estimatedSavings: number;
  processingTime?: number;
}

export interface BatchOperationAnalytics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalCostSavings: number;
  averageProcessingTime: number;
  successRate: number;
}

export class BatchEmbeddingService {
  private openai: OpenAI;
  private readonly BATCH_COST_MULTIPLIER = 0.5; // 50% discount
  private readonly STANDARD_EMBEDDING_COST = 0.00002; // $0.02 per 1M tokens
  private readonly BATCH_EMBEDDING_COST = 0.00001; // $0.01 per 1M tokens
  private readonly MAX_BATCH_SIZE = 50000; // OpenAI limit
  private readonly POLL_INTERVAL = 60000; // 1 minute

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Submit batch embedding job
   */
  async submitBatchJob(
    requests: BatchEmbeddingRequest[],
    config: BatchJobConfig
  ): Promise<{
    batchId: string;
    status: BatchJobStatus;
  }> {
    // Validate batch size
    if (requests.length > this.MAX_BATCH_SIZE) {
      throw new Error(`Batch size ${requests.length} exceeds maximum ${this.MAX_BATCH_SIZE}`);
    }

    // Check budget before submission
    const affordCheck = await semanticBudgetManager.canAffordOperation(config.estimatedCost);
    if (!affordCheck.canAfford) {
      throw new Error(
        `Insufficient budget for batch operation. Required: ${config.estimatedCost.toFixed(4)}, ` +
        `Available: ${affordCheck.remainingFunds.toFixed(2)}`
      );
    }

    // Create JSONL file for batch API
    const batchFile = await this.createBatchFile(requests, config.model);

    try {
      // Upload batch file using stream
      const fileStream = createReadStream(batchFile);
      const file = await this.openai.files.create({
        file: fileStream as any, // OpenAI SDK accepts ReadStream
        purpose: 'batch'
      });

      // Create batch job
      const batch = await this.openai.batches.create({
        input_file_id: file.id,
        endpoint: '/v1/embeddings',
        completion_window: '24h',
        metadata: {
          priority: config.priority,
          projectIds: config.projectIds.join(','),
          estimatedCost: config.estimatedCost.toString(),
          estimatedSavings: (config.estimatedCost * 0.5).toString()
        }
      });

      // Store batch job in database
      const dbBatch = await (prisma as any).batchEmbeddingJob.create({
        data: {
          batchId: batch.id,
          status: batch.status,
          model: config.model,
          priority: config.priority,
          requestCount: requests.length,
          estimatedTokens: config.estimatedTokens,
          estimatedCost: config.estimatedCost,
          estimatedSavings: config.estimatedCost * 0.5,
          projectIds: config.projectIds,
          metadata: {
            fileId: file.id,
            requests: requests.map(r => ({
              id: r.id,
              chunkId: r.metadata.chunkId,
              projectId: r.metadata.projectId,
              tier: r.metadata.tier
            }))
          }
        }
      });

      // Clean up temp file
      await fs.unlink(batchFile);

      return {
        batchId: batch.id,
        status: {
          id: batch.id,
          status: batch.status,
          createdAt: new Date(batch.created_at * 1000),
          requestCount: requests.length,
          completedCount: 0,
          failedCount: 0,
          estimatedCost: config.estimatedCost,
          estimatedSavings: config.estimatedCost * 0.5
        }
      };
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(batchFile);
      } catch {}
      throw error;
    }
  }

  /**
   * Check batch job status
   */
  async checkBatchStatus(batchId: string): Promise<BatchJobStatus> {
    const batch = await this.openai.batches.retrieve(batchId);
    const dbBatch = await (prisma as any).batchEmbeddingJob.findUnique({
      where: { batchId }
    });

    if (!dbBatch) {
      throw new Error(`Batch job ${batchId} not found in database`);
    }

    // Update database status
    await (prisma as any).batchEmbeddingJob.update({
      where: { batchId },
      data: {
        status: batch.status,
        completedCount: batch.request_counts?.completed || 0,
        failedCount: batch.request_counts?.failed || 0,
        completedAt: batch.completed_at ? new Date(batch.completed_at * 1000) : null
      }
    });

    const processingTime = batch.completed_at 
      ? (batch.completed_at - batch.created_at) * 1000 
      : undefined;

    return {
      id: batch.id,
      status: batch.status,
      createdAt: new Date(batch.created_at * 1000),
      completedAt: batch.completed_at ? new Date(batch.completed_at * 1000) : undefined,
      requestCount: dbBatch.requestCount,
      completedCount: batch.request_counts?.completed || 0,
      failedCount: batch.request_counts?.failed || 0,
      estimatedCost: Number(dbBatch.estimatedCost),
      actualCost: dbBatch.actualCost ? Number(dbBatch.actualCost) : undefined,
      estimatedSavings: Number(dbBatch.estimatedSavings),
      processingTime
    };
  }

  /**
   * Poll batch job until completion
   */
  async pollBatchUntilComplete(
    batchId: string,
    onProgress?: (status: BatchJobStatus) => void
  ): Promise<BatchJobStatus> {
    let status = await this.checkBatchStatus(batchId);

    while (
      status.status === 'validating' || 
      status.status === 'in_progress' || 
      status.status === 'finalizing'
    ) {
      if (onProgress) {
        onProgress(status);
      }

      await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL));
      status = await this.checkBatchStatus(batchId);
    }

    return status;
  }

  /**
   * Process completed batch results
   */
  async processBatchResults(batchId: string): Promise<{
    embeddings: Array<{
      chunkId: string;
      embedding: number[];
      projectId?: string;
      tier: number;
    }>;
    actualCost: number;
    actualSavings: number;
  }> {
    const batch = await this.openai.batches.retrieve(batchId);
    
    if (batch.status !== 'completed') {
      throw new Error(`Batch ${batchId} is not completed (status: ${batch.status})`);
    }

    if (!batch.output_file_id) {
      throw new Error(`Batch ${batchId} has no output file`);
    }

    // Download results file
    const fileContent = await this.openai.files.content(batch.output_file_id);
    const results = await fileContent.text();
    
    // Parse JSONL results
    const lines = results.trim().split('\n');
    const embeddings: Array<{
      chunkId: string;
      embedding: number[];
      projectId?: string;
      tier: number;
    }> = [];

    let totalTokens = 0;

    for (const line of lines) {
      const result = JSON.parse(line);
      
      if (result.response?.status_code === 200) {
        const embedding = result.response.body.data[0].embedding;
        const customId = result.custom_id;
        
        // Parse custom_id to get metadata
        const metadata = this.parseCustomId(customId);
        
        embeddings.push({
          chunkId: metadata.chunkId,
          embedding,
          projectId: metadata.projectId,
          tier: metadata.tier
        });

        totalTokens += result.response.body.usage.total_tokens;
      }
    }

    // Calculate actual cost
    const actualCost = (totalTokens / 1000) * this.BATCH_EMBEDDING_COST;
    const standardCost = (totalTokens / 1000) * this.STANDARD_EMBEDDING_COST;
    const actualSavings = standardCost - actualCost;

    // Update database with actual costs
    await (prisma as any).batchEmbeddingJob.update({
      where: { batchId },
      data: {
        actualCost,
        actualSavings,
        actualTokens: totalTokens
      }
    });

    // Deduct cost from budget
    await semanticBudgetManager.deductCost({
      operationType: 'embedding',
      tokensUsed: totalTokens,
      cost: actualCost,
      model: 'text-embedding-3-small-batch',
      chunksProcessed: embeddings.length,
      tiersAffected: Array.from(new Set(embeddings.map(e => e.tier))),
      metadata: {
        batchId,
        batchMode: true,
        savings: actualSavings
      }
    });

    return {
      embeddings,
      actualCost,
      actualSavings
    };
  }

  /**
   * Cancel batch job
   */
  async cancelBatchJob(batchId: string): Promise<void> {
    await this.openai.batches.cancel(batchId);
    
    await (prisma as any).batchEmbeddingJob.update({
      where: { batchId },
      data: { status: 'cancelled' }
    });
  }

  /**
   * Get batch operation analytics
   */
  async getBatchAnalytics(options?: {
    startDate?: Date;
    endDate?: Date;
    projectId?: string;
  }): Promise<BatchOperationAnalytics> {
    const where: any = {};
    
    if (options?.startDate) {
      where.createdAt = { gte: options.startDate };
    }
    if (options?.endDate) {
      where.createdAt = { ...where.createdAt, lte: options.endDate };
    }
    if (options?.projectId) {
      where.projectIds = { has: options.projectId };
    }

    const jobs = await (prisma as any).batchEmbeddingJob.findMany({ where });

    const completed = jobs.filter(j => j.status === 'completed');
    const failed = jobs.filter(j => j.status === 'failed');
    
    const totalCostSavings = completed.reduce((sum, j) => sum + Number(j.actualSavings || j.estimatedSavings), 0);
    
    const processingTimes = completed
      .filter(j => j.completedAt)
      .map(j => j.completedAt!.getTime() - j.createdAt.getTime());
    
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
      : 0;

    return {
      totalJobs: jobs.length,
      completedJobs: completed.length,
      failedJobs: failed.length,
      totalCostSavings,
      averageProcessingTime,
      successRate: jobs.length > 0 ? completed.length / jobs.length : 0
    };
  }

  /**
   * List active batch jobs
   */
  async listActiveBatchJobs(): Promise<BatchJobStatus[]> {
    const jobs = await (prisma as any).batchEmbeddingJob.findMany({
      where: {
        status: {
          in: ['validating', 'in_progress', 'finalizing']
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return jobs.map(job => ({
      id: job.batchId,
      status: job.status as any,
      createdAt: job.createdAt,
      completedAt: job.completedAt || undefined,
      requestCount: job.requestCount,
      completedCount: job.completedCount,
      failedCount: job.failedCount,
      estimatedCost: Number(job.estimatedCost),
      actualCost: job.actualCost ? Number(job.actualCost) : undefined,
      estimatedSavings: Number(job.estimatedSavings),
      processingTime: job.completedAt 
        ? job.completedAt.getTime() - job.createdAt.getTime()
        : undefined
    }));
  }

  /**
   * Estimate cost comparison between standard and batch
   */
  estimateCostComparison(tokenCount: number): {
    standardCost: number;
    batchCost: number;
    savings: number;
    savingsPercentage: number;
  } {
    const standardCost = (tokenCount / 1000) * this.STANDARD_EMBEDDING_COST;
    const batchCost = (tokenCount / 1000) * this.BATCH_EMBEDDING_COST;
    const savings = standardCost - batchCost;

    return {
      standardCost,
      batchCost,
      savings,
      savingsPercentage: 50
    };
  }

  /**
   * Create JSONL batch file
   */
  private async createBatchFile(
    requests: BatchEmbeddingRequest[],
    model: string
  ): Promise<string> {
    const tempDir = os.tmpdir();
    const filename = `batch-${Date.now()}.jsonl`;
    const filepath = path.join(tempDir, filename);

    const lines = requests.map(req => {
      const customId = this.createCustomId(req.metadata);
      return JSON.stringify({
        custom_id: customId,
        method: 'POST',
        url: '/v1/embeddings',
        body: {
          model,
          input: req.content
        }
      });
    });

    await fs.writeFile(filepath, lines.join('\n'));
    return filepath;
  }

  /**
   * Create custom ID for batch request
   */
  private createCustomId(metadata: {
    chunkId: string;
    projectId?: string;
    tier: number;
  }): string {
    return `${metadata.chunkId}|${metadata.projectId || 'none'}|${metadata.tier}`;
  }

  /**
   * Parse custom ID from batch result
   */
  private parseCustomId(customId: string): {
    chunkId: string;
    projectId?: string;
    tier: number;
  } {
    const [chunkId, projectId, tierStr] = customId.split('|');
    return {
      chunkId,
      projectId: projectId !== 'none' ? projectId : undefined,
      tier: parseInt(tierStr, 10)
    };
  }
}

// Export singleton instance
let batchEmbeddingService: BatchEmbeddingService | null = null;

export function getBatchEmbeddingService(): BatchEmbeddingService {
  if (!batchEmbeddingService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    batchEmbeddingService = new BatchEmbeddingService(apiKey);
  }
  return batchEmbeddingService;
}
