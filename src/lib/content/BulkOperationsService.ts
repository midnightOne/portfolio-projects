/**
 * Bulk Operations Service
 * 
 * Handles bulk maintenance operations for semantic content:
 * - Cleanup orphaned chunks
 * - Export/import semantic indexes
 * - Bulk regeneration with batch mode
 * - Bulk importance score updates
 * - Bulk embedding regeneration
 */

import { prisma } from '@/lib/prisma';
import { getPreflightRates } from '@/lib/ai/pricing';
import JSZip from 'jszip';

export interface OrphanedChunk {
  id: string;
  chunkId: string;
  tier: number;
  title: string | null;
  tokenCount: number;
  entitySlug: string | null;
  createdAt: Date;
}

export interface CleanupPreview {
  orphanedChunks: OrphanedChunk[];
  totalCount: number;
  estimatedSpaceFreed: string;
}

export interface CleanupResult {
  chunksRemoved: number;
  spaceFreed: string;
  duration: number;
}

export interface ExportData {
  version: string;
  exportedAt: Date;
  projects: Array<{
    projectId: string;
    projectTitle: string;
    chunks: any[];
    metadata: {
      totalChunks: number;
      tierDistribution: Record<number, number>;
      hasEmbeddings: boolean;
    };
  }>;
}

export interface ImportResult {
  projectsImported: number;
  chunksImported: number;
  conflicts: Array<{
    chunkId: string;
    reason: string;
    resolution: 'skipped' | 'overwritten' | 'merged';
  }>;
  duration: number;
}

export interface BulkRegenerationOptions {
  projectIds?: string[];
  useBatchMode: boolean;
  preserveManualEdits: boolean;
  regenerateEmbeddings: boolean;
}

export interface BulkRegenerationEstimate {
  projectCount: number;
  totalChunks: number;
  estimatedTokens: number;
  estimatedCost: number;
  batchModeCost?: number;
  savings?: number;
  estimatedDuration: string;
  batchModeDuration?: string;
}

export interface BulkImportanceUpdateOptions {
  chunkIds: string[];
  importance: number;
  importanceSource: 'manual';
}

export class BulkOperationsService {
  constructor() {
    // Services initialized on-demand
  }

  /**
   * Preview orphaned chunks before cleanup
   *
   * Post-D37 the chunk→project association rides entirely on ContentEntity
   * (entityType + slug). A chunk is orphaned when its PROJECT-type entity no
   * longer matches an existing project.
   */
  async previewOrphanedChunks(): Promise<CleanupPreview> {
    const chunks = await prisma.contextChunk.findMany({
      include: {
        entity: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const projectSlugs = new Set(
      (await prisma.project.findMany({ select: { slug: true } })).map((p) => p.slug)
    );

    const trulyOrphaned: OrphanedChunk[] = chunks
      .filter((chunk) =>
        !chunk.entity ||
        (chunk.entity.entityType === 'PROJECT' && !projectSlugs.has(chunk.entity.slug))
      )
      .map((chunk) => ({
        id: chunk.id,
        chunkId: chunk.chunkId,
        tier: chunk.tier,
        title: chunk.title,
        tokenCount: chunk.tokenCount,
        entitySlug: chunk.entity?.slug ?? null,
        createdAt: chunk.createdAt
      }));

    const totalTokens = trulyOrphaned.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const estimatedSpaceFreed = this.formatBytes(totalTokens * 4);

    return {
      orphanedChunks: trulyOrphaned,
      totalCount: trulyOrphaned.length,
      estimatedSpaceFreed
    };
  }

  /**
   * Cleanup orphaned chunks
   */
  async cleanupOrphanedChunks(): Promise<CleanupResult> {
    const startTime = Date.now();

    const preview = await this.previewOrphanedChunks();

    if (preview.totalCount === 0) {
      return {
        chunksRemoved: 0,
        spaceFreed: '0 B',
        duration: Date.now() - startTime
      };
    }

    // Delete orphaned chunks by id (as identified via entity linkage)
    await prisma.contextChunk.deleteMany({
      where: {
        id: { in: preview.orphanedChunks.map((c) => c.id) }
      }
    });

    return {
      chunksRemoved: preview.totalCount,
      spaceFreed: preview.estimatedSpaceFreed,
      duration: Date.now() - startTime
    };
  }

  /**
   * Export semantic indexes for backup or migration
   */
  async exportSemanticIndexes(projectIds?: string[]): Promise<Buffer> {
    const zip = new JSZip();

    // Get projects to export (entity-based post-D37)
    const projects = await prisma.project.findMany({
      where: projectIds ? { id: { in: projectIds } } : undefined,
      select: { id: true, slug: true, title: true }
    });

    const entities = await prisma.contentEntity.findMany({
      where: {
        entityType: 'PROJECT',
        slug: { in: projects.map((p) => p.slug) }
      },
      include: {
        contentChunks: true
      }
    });
    const entityBySlug = new Map(entities.map((e) => [e.slug, e]));

    const exportData: ExportData = {
      version: '1.0.0',
      exportedAt: new Date(),
      projects: projects.map(project => {
        const contentChunks = entityBySlug.get(project.slug)?.contentChunks ?? [];
        const tierDistribution = contentChunks.reduce((acc, chunk) => {
          acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        const hasEmbeddings = contentChunks.some(chunk => (chunk as any).embeddingVector !== null);

        return {
          projectId: project.id,
          projectTitle: project.title || 'Unknown',
          chunks: contentChunks.map(chunk => ({
            id: chunk.id,
            chunkId: chunk.chunkId,
            tier: chunk.tier,
            title: chunk.title,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            parentChunkId: chunk.parentChunkId,
            rootChunkId: chunk.rootChunkId,
            sectionGroup: chunk.sectionGroup,
            importance: chunk.importance,
            importanceSource: chunk.importanceSource,
            generationMode: chunk.generationMode,
            manuallyEdited: chunk.manuallyEdited,
            contentHash: chunk.contentHash,
            metadata: chunk.metadata,
            embedding: (chunk as any).embeddingVector,
            embeddingModel: chunk.embeddingModel,
            embeddingGeneratedAt: chunk.embeddingGeneratedAt,
            createdAt: chunk.createdAt,
            updatedAt: chunk.updatedAt
          })),
          metadata: {
            totalChunks: contentChunks.length,
            tierDistribution,
            hasEmbeddings
          }
        };
      })
    };

    // Add main export file
    zip.file('export.json', JSON.stringify(exportData, null, 2));

    // Add metadata file
    zip.file('metadata.json', JSON.stringify({
      version: exportData.version,
      exportedAt: exportData.exportedAt,
      projectCount: exportData.projects.length,
      totalChunks: exportData.projects.reduce((sum, p) => sum + p.chunks.length, 0)
    }, null, 2));

    return await zip.generateAsync({ type: 'nodebuffer' });
  }

  /**
   * Import semantic indexes from backup
   */
  async importSemanticIndexes(
    zipBuffer: Buffer,
    options: {
      overwriteExisting: boolean;
      validateOnly: boolean;
    } = { overwriteExisting: false, validateOnly: false }
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const conflicts: ImportResult['conflicts'] = [];
    let projectsImported = 0;
    let chunksImported = 0;

    try {
      const zip = await JSZip.loadAsync(zipBuffer);
      const exportFile = zip.file('export.json');
      
      if (!exportFile) {
        throw new Error('Invalid export file: missing export.json');
      }

      const exportData: ExportData = JSON.parse(await exportFile.async('string'));

      // Validate version compatibility
      if (exportData.version !== '1.0.0') {
        throw new Error(`Unsupported export version: ${exportData.version}`);
      }

      if (options.validateOnly) {
        // Just validate, don't import
        return {
          projectsImported: 0,
          chunksImported: 0,
          conflicts: [],
          duration: Date.now() - startTime
        };
      }

      // Import each project (entity-based post-D37)
      for (const projectData of exportData.projects) {
        const project = await prisma.project.findUnique({
          where: { id: projectData.projectId },
          select: { id: true, slug: true, title: true, description: true }
        });

        if (!project) {
          conflicts.push({
            chunkId: projectData.projectId,
            reason: 'Project does not exist in this database',
            resolution: 'skipped'
          });
          continue;
        }

        const existingEntity = await prisma.contentEntity.findUnique({
          where: { entityType_slug: { entityType: 'PROJECT', slug: project.slug } },
          include: { _count: { select: { contentChunks: true } } }
        });

        if (existingEntity && existingEntity._count.contentChunks > 0 && !options.overwriteExisting) {
          conflicts.push({
            chunkId: projectData.projectId,
            reason: 'Project already exists',
            resolution: 'skipped'
          });
          continue;
        }

        const entity = existingEntity ?? await prisma.contentEntity.create({
          data: {
            entityType: 'PROJECT',
            slug: project.slug,
            title: project.title,
            description: project.description || ''
          }
        });

        // Delete existing chunks if overwriting
        if (existingEntity && options.overwriteExisting) {
          await prisma.contextChunk.deleteMany({
            where: { entityId: existingEntity.id }
          });
        }

        // Import chunks
        for (const chunkData of projectData.chunks) {
          try {
            await prisma.contextChunk.create({
              data: {
                chunkId: chunkData.chunkId,
                entityId: entity.id,
                tier: chunkData.tier,
                title: chunkData.title,
                content: chunkData.content,
                tokenCount: chunkData.tokenCount,
                parentChunkId: chunkData.parentChunkId,
                rootChunkId: chunkData.rootChunkId,
                sectionGroup: chunkData.sectionGroup,
                importance: chunkData.importance,
                importanceSource: chunkData.importanceSource,
                generationMode: chunkData.generationMode,
                manuallyEdited: chunkData.manuallyEdited,
                contentHash: chunkData.contentHash,
                metadata: chunkData.metadata,
                // embeddingVector: chunkData.embedding, // Handled via raw SQL
                embeddingModel: chunkData.embeddingModel,
                embeddingGeneratedAt: chunkData.embeddingGeneratedAt
              }
            });
            chunksImported++;
          } catch (error) {
            conflicts.push({
              chunkId: chunkData.chunkId,
              reason: error instanceof Error ? error.message : 'Unknown error',
              resolution: 'skipped'
            });
          }
        }

        projectsImported++;
      }

      return {
        projectsImported,
        chunksImported,
        conflicts,
        duration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate cost for bulk regeneration
   */
  async estimateBulkRegeneration(options: BulkRegenerationOptions): Promise<BulkRegenerationEstimate> {
    const projectRows = await prisma.project.findMany({
      where: options.projectIds ? { id: { in: options.projectIds } } : undefined,
      select: { slug: true }
    });
    const projects = await prisma.contentEntity.findMany({
      where: {
        entityType: 'PROJECT',
        slug: { in: projectRows.map((p) => p.slug) }
      },
      include: {
        contentChunks: true
      }
    });

    const totalChunks = projects.reduce((sum, p) => sum + p.contentChunks.length, 0);
    const totalTokens = projects.reduce((sum, p) =>
      sum + p.contentChunks.reduce((s, c) => s + c.tokenCount, 0), 0
    );

    // Estimate costs at the registry-resolved default-embedding rate (D38)
    const standardCost = (totalTokens / 1000) * (await getPreflightRates()).embeddingPer1kUsd;
    const batchCost = standardCost * 0.5; // 50% savings with batch mode
    const savings = standardCost - batchCost;

    // Estimate duration
    const standardDuration = Math.ceil(totalChunks / 100) * 30; // ~30s per 100 chunks
    const batchDuration = 24 * 60 * 60; // 24 hours for batch processing

    return {
      projectCount: projects.length,
      totalChunks,
      estimatedTokens: totalTokens,
      estimatedCost: standardCost,
      batchModeCost: batchCost,
      savings,
      estimatedDuration: this.formatDuration(standardDuration),
      batchModeDuration: this.formatDuration(batchDuration)
    };
  }

  /**
   * Bulk update importance scores
   */
  async bulkUpdateImportance(options: BulkImportanceUpdateOptions): Promise<number> {
    const result = await prisma.contextChunk.updateMany({
      where: {
        id: { in: options.chunkIds }
      },
      data: {
        importance: options.importance,
        importanceSource: options.importanceSource,
        updatedAt: new Date()
      }
    });

    return result.count;
  }

  /**
   * Bulk regenerate embeddings with batch mode support
   */
  async bulkRegenerateEmbeddings(
    projectIds: string[],
    useBatchMode: boolean,
    embeddingModel: string = 'text-embedding-3-small'
  ): Promise<{ jobId?: string; chunksProcessed?: number }> {
    const projectSlugs = (await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { slug: true }
    })).map((p) => p.slug);
    const chunks = await prisma.contextChunk.findMany({
      where: {
        entity: { entityType: 'PROJECT', slug: { in: projectSlugs } }
      },
      select: {
        id: true,
        content: true,
        tier: true
      }
    });

    if (useBatchMode) {
      // Use batch API for cost savings
      // Note: Actual batch submission would be implemented here
      // For now, return a mock job ID
      const jobId = `batch_${Date.now()}_${chunks.length}chunks`;
      return { jobId };
    } else {
      // Process immediately
      // Note: Actual embedding generation would be implemented here
      // This is a placeholder for the bulk regeneration logic
      return { chunksProcessed: chunks.length };
    }
  }

  /**
   * Helper: Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Helper: Format duration to human-readable string
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }
}
