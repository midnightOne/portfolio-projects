/**
 * Selective Section Regeneration Engine
 *
 * Surgical regeneration for changed sections WITH ancestor invalidation
 * (semantic-content Req 9.3, task 9.2): when a section changes, its subtree
 * (T3 chunks + T2s) regenerates AND every ancestor summary (parent T2 chain
 * up to T1) is re-summarized from cumulative sources and re-embedded, so a
 * parent summary can never describe stale descendants.
 *
 * Key properties:
 * - Section-level cost estimation (only affected sections)
 * - Unchanged sibling sections are preserved (no API calls)
 * - Bottom-up summary regeneration via the shared summary-source module
 * - Manual edit preservation with override option
 * - Durable operation state (semantic_processing_operations projection)
 */

import { prisma } from '@/lib/database/connection';
import { SmartContentGenerator, TierContent } from './SmartContentGenerator';
import { ContentChangeDetector } from './ContentChangeDetector';
import { HierarchicalContentParser } from './HierarchicalContentParser';
import { getSummaryGenerationService, SummaryGenerationService } from './SummaryGenerationService';
import { VectorOperations } from './VectorOperations';
import { buildT2SummarySource, orderSummaryChunksBottomUp } from './summary-source';
import { generateChunkEmbedding, chunkEmbeddingInput } from './chunk-embedding';
import { getProcessingOperationStore } from './ProcessingOperationStore';
import { getPreflightRates } from '@/lib/ai/pricing';

// Regeneration scope types
export type RegenerationScope = 'all' | 'project' | 'section';

// Regeneration request interfaces
export interface RegenerationRequest {
  scope: RegenerationScope;
  projectId?: string;
  sectionId?: string;
  preserveManualEdits?: boolean;
  overrideManualEdits?: boolean;
}

export interface RegenerationEstimate {
  scope: RegenerationScope;
  projectsAffected: number;
  sectionsAffected: number;
  chunksAffected: number;
  estimatedTokens: number;
  estimatedCost: number;
  breakdown: {
    embeddingCost: number;
    summarizationCost: number;
  };
  preservedSections: number;
  regeneratedSections: number;
}

export interface RegenerationProgress {
  operationId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: {
    sectionsProcessed: number;
    totalSections: number;
    chunksProcessed: number;
    tokensUsed: number;
    costAccumulated: number;
    percentComplete: number;
  };
  currentSection?: string;
  errors: RegenerationError[];
  startedAt: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number;
}

export interface RegenerationResult {
  operationId: string;
  success: boolean;
  summary: {
    projectsProcessed: number;
    sectionsPreserved: number;
    sectionsRegenerated: number;
    chunksCreated: number;
    chunksUpdated: number;
    chunksDeleted: number;
    totalTokensUsed: number;
    totalCost: number;
    processingTime: number;
  };
  costBreakdown: {
    embeddingCost: number;
    summarizationCost: number;
  };
  errors: RegenerationError[];
}

export interface RegenerationError {
  sectionId: string;
  sectionTitle: string;
  error: string;
  retryable: boolean;
  retryCount: number;
}

// Pre-flight estimate: combined embedding + summarization cost for `tokens`
// at the registry-resolved default models (D38 — rates come from AIModelPricing).
async function estimateCombinedSectionCost(tokens: number): Promise<{ embeddingCost: number; summarizationCost: number; totalCost: number }> {
  const rates = await getPreflightRates();
  const embeddingCost = (tokens / 1000) * rates.embeddingPer1kUsd;
  const summarizationCost = (tokens / 1000) * rates.summarizationInputPer1kUsd;
  return { embeddingCost, summarizationCost, totalCost: embeddingCost + summarizationCost };
}

/**
 * Main SelectiveSectionRegenerator class
 */
export class SelectiveSectionRegenerator {
  private contentGenerator: SmartContentGenerator;
  private changeDetector: ContentChangeDetector;
  private contentParser: HierarchicalContentParser;
  private summaryService: SummaryGenerationService;
  private vectorOps: VectorOperations;
  private operationStore = getProcessingOperationStore();

  // Progress tracking (projection; durable state is the operation row)
  private progressCallbacks = new Map<string, Set<(progress: RegenerationProgress) => void>>();
  private activeOperations = new Map<string, RegenerationProgress>();

  constructor() {
    this.contentGenerator = new SmartContentGenerator();
    this.changeDetector = new ContentChangeDetector();
    this.contentParser = HierarchicalContentParser.getInstance();
    this.summaryService = getSummaryGenerationService();
    this.vectorOps = new VectorOperations(prisma);
  }

  /**
   * Estimate regeneration cost for a given scope
   * Only counts affected sections, not entire project
   */
  async estimateRegenerationCost(request: RegenerationRequest): Promise<RegenerationEstimate> {
    const { scope, projectId, sectionId } = request;

    switch (scope) {
      case 'all':
        return await this.estimateAllProjects();

      case 'project':
        if (!projectId) {
          throw new Error('projectId required for project scope');
        }
        return await this.estimateProject(projectId, request.preserveManualEdits);

      case 'section':
        if (!projectId || !sectionId) {
          throw new Error('projectId and sectionId required for section scope');
        }
        return await this.estimateSection(projectId, sectionId, request.preserveManualEdits);

      default:
        throw new Error(`Invalid scope: ${scope}`);
    }
  }

  /**
   * Estimate cost for all projects
   */
  private async estimateAllProjects(): Promise<RegenerationEstimate> {
    const projects = await prisma.project.findMany({
      where: {
        visibility: 'PUBLIC',
        articleContent: {
          isNot: null
        }
      },
      select: { id: true }
    });

    let totalTokens = 0;
    let totalSections = 0;
    let totalChunks = 0;
    let totalPreserved = 0;
    let totalRegenerated = 0;

    for (const project of projects) {
      const estimate = await this.estimateProject(project.id, true);
      totalTokens += estimate.estimatedTokens;
      totalSections += estimate.sectionsAffected;
      totalChunks += estimate.chunksAffected;
      totalPreserved += estimate.preservedSections;
      totalRegenerated += estimate.regeneratedSections;
    }

    const { embeddingCost, summarizationCost, totalCost } = await estimateCombinedSectionCost(totalTokens);

    return {
      scope: 'all',
      projectsAffected: projects.length,
      sectionsAffected: totalSections,
      chunksAffected: totalChunks,
      estimatedTokens: totalTokens,
      estimatedCost: totalCost,
      breakdown: {
        embeddingCost,
        summarizationCost
      },
      preservedSections: totalPreserved,
      regeneratedSections: totalRegenerated
    };
  }

  /**
   * Estimate cost for a single project
   */
  private async estimateProject(
    projectId: string,
    preserveManualEdits: boolean = true
  ): Promise<RegenerationEstimate> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        articleContent: true
      }
    });

    if (!project || !project.articleContent) {
      throw new Error(`Project not found or has no content: ${projectId}`);
    }

    // Detect changes to identify affected sections
    const changeDetection = await this.changeDetector.detectChanges(
      projectId,
      project.articleContent.content
    );

    // Count affected sections and estimate tokens
    let estimatedTokens = 0;
    let chunksAffected = 0;
    let preservedSections = 0;
    let regeneratedSections = 0;

    for (const sectionChange of changeDetection.sectionChanges) {
      if (sectionChange.regenerationRequired) {
        // Check if section has manually edited chunks
        if (preserveManualEdits) {
          const hasManualEdits = await this.hasManualEdits(projectId, sectionChange.sectionId);
          if (hasManualEdits) {
            preservedSections++;
            continue;
          }
        }

        estimatedTokens += sectionChange.estimatedTokens;
        chunksAffected += sectionChange.affectedT3ChunkIds.length + 1; // +1 for T2
        regeneratedSections++;
      } else {
        preservedSections++;
      }
    }

    const { embeddingCost, summarizationCost, totalCost } = await estimateCombinedSectionCost(estimatedTokens);

    return {
      scope: 'project',
      projectsAffected: 1,
      sectionsAffected: regeneratedSections,
      chunksAffected,
      estimatedTokens,
      estimatedCost: totalCost,
      breakdown: {
        embeddingCost,
        summarizationCost
      },
      preservedSections,
      regeneratedSections
    };
  }

  /**
   * Estimate cost for a specific section
   */
  private async estimateSection(
    projectId: string,
    sectionId: string,
    preserveManualEdits: boolean = true
  ): Promise<RegenerationEstimate> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        articleContent: true
      }
    });

    if (!project || !project.articleContent) {
      throw new Error(`Project not found or has no content: ${projectId}`);
    }

    // Check if section has manually edited chunks
    if (preserveManualEdits) {
      const hasManualEdits = await this.hasManualEdits(projectId, sectionId);
      if (hasManualEdits) {
        return {
          scope: 'section',
          projectsAffected: 1,
          sectionsAffected: 0,
          chunksAffected: 0,
          estimatedTokens: 0,
          estimatedCost: 0,
          breakdown: {
            embeddingCost: 0,
            summarizationCost: 0
          },
          preservedSections: 1,
          regeneratedSections: 0
        };
      }
    }

    // Get section content and estimate tokens
    const enhancedIndex = await this.contentParser.indexProjectHierarchical(projectId);
    const section = enhancedIndex.hierarchicalSections.find(s => s.anchorId === sectionId);

    if (!section) {
      throw new Error(`Section not found: ${sectionId}`);
    }

    const estimatedTokens = this.estimateTokenCount(section.content);
    const chunksAffected = Math.ceil(estimatedTokens / 300) + 1; // T3 chunks + T2

    const { embeddingCost, summarizationCost, totalCost } = await estimateCombinedSectionCost(estimatedTokens);

    return {
      scope: 'section',
      projectsAffected: 1,
      sectionsAffected: 1,
      chunksAffected,
      estimatedTokens,
      estimatedCost: totalCost,
      breakdown: {
        embeddingCost,
        summarizationCost
      },
      preservedSections: 0,
      regeneratedSections: 1
    };
  }

  /**
   * Trigger regeneration with specified scope
   */
  async regenerate(request: RegenerationRequest): Promise<string> {
    // Generate operation ID
    const operationId = this.generateOperationId();

    // Check budget before starting
    await this.checkBudget(request);

    // Initialize progress tracking
    const progress: RegenerationProgress = {
      operationId,
      status: 'pending',
      progress: {
        sectionsProcessed: 0,
        totalSections: 0,
        chunksProcessed: 0,
        tokensUsed: 0,
        costAccumulated: 0,
        percentComplete: 0
      },
      errors: [],
      startedAt: new Date()
    };

    this.activeOperations.set(operationId, progress);
    await this.persistDurable(operationId, request, progress);

    // Start regeneration asynchronously
    this.executeRegeneration(operationId, request).catch(async error => {
      console.error(`Regeneration operation ${operationId} failed:`, error);
      progress.status = 'failed';
      progress.completedAt = progress.completedAt ?? new Date();
      progress.errors.push({
        sectionId: 'system',
        sectionTitle: 'System Error',
        error: error.message,
        retryable: false,
        retryCount: 0
      });
      await this.persistDurable(operationId, request, progress).catch(() => {});
      this.notifyProgress(operationId, progress);
    });

    return operationId;
  }

  /**
   * Execute regeneration operation
   */
  private async executeRegeneration(
    operationId: string,
    request: RegenerationRequest
  ): Promise<void> {
    const progress = this.activeOperations.get(operationId);
    if (!progress) {
      throw new Error(`Operation not found: ${operationId}`);
    }

    progress.status = 'in_progress';
    await this.persistDurable(operationId, request, progress);
    this.notifyProgress(operationId, progress);

    try {
      switch (request.scope) {
        case 'all':
          await this.regenerateAllProjects(operationId, request);
          break;

        case 'project':
          if (!request.projectId) {
            throw new Error('projectId required for project scope');
          }
          await this.regenerateProject(operationId, request.projectId, request);
          break;

        case 'section':
          if (!request.projectId || !request.sectionId) {
            throw new Error('projectId and sectionId required for section scope');
          }
          await this.regenerateProject(operationId, request.projectId, request, [request.sectionId]);
          break;
      }

      progress.status = 'completed';
      progress.completedAt = new Date();
      progress.progress.percentComplete = 100;
      // Durable terminal transition first, then notification (Req 9.2)
      await this.persistDurable(operationId, request, progress);
      this.notifyProgress(operationId, progress);

    } catch (error) {
      progress.status = 'failed';
      progress.completedAt = new Date();
      await this.persistDurable(operationId, request, progress).catch(() => {});
      this.notifyProgress(operationId, progress);
      throw error;
    }
  }

  /**
   * Regenerate all projects (each project is its own persistence unit)
   */
  private async regenerateAllProjects(
    operationId: string,
    request: RegenerationRequest
  ): Promise<void> {
    const projects = await prisma.project.findMany({
      where: {
        visibility: 'PUBLIC',
        articleContent: {
          isNot: null
        }
      },
      select: { id: true }
    });

    const progress = this.activeOperations.get(operationId)!;

    for (const project of projects) {
      try {
        await this.regenerateProject(operationId, project.id, request);
        progress.progress.percentComplete =
          ((projects.indexOf(project) + 1) / projects.length) * 100;
        this.notifyProgress(operationId, progress);
      } catch (error) {
        console.error(`Failed to regenerate project ${project.id}:`, error);
        progress.errors.push({
          sectionId: project.id,
          sectionTitle: `Project ${project.id}`,
          error: error instanceof Error ? error.message : String(error),
          retryable: true,
          retryCount: 0
        });
      }
    }
  }

  /**
   * Regenerate a single project's changed sections (or an explicit list) —
   * one unified pass so shared ancestors (and T1) regenerate exactly once.
   */
  private async regenerateProject(
    operationId: string,
    projectId: string,
    request: RegenerationRequest,
    explicitSectionIds?: string[]
  ): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        articleContent: true,
        tags: true
      }
    });

    if (!project || !project.articleContent) {
      throw new Error(`Project not found or has no content: ${projectId}`);
    }

    const progress = this.activeOperations.get(operationId)!;

    // Determine which sections need regeneration
    let sectionIds: string[];
    if (explicitSectionIds) {
      sectionIds = explicitSectionIds;
    } else {
      const changeDetection = await this.changeDetector.detectChanges(
        projectId,
        project.articleContent.content
      );
      sectionIds = changeDetection.sectionChanges
        .filter(sc => sc.regenerationRequired)
        .map(sc => sc.sectionId);
    }

    // Manual-edit preservation: drop protected sections from the change set
    if (request.preserveManualEdits && !request.overrideManualEdits) {
      const kept: string[] = [];
      for (const sectionId of sectionIds) {
        if (await this.hasManualEdits(projectId, sectionId)) {
          console.log(`Preserving manually edited section: ${sectionId}`);
        } else {
          kept.push(sectionId);
        }
      }
      sectionIds = kept;
    }

    if (sectionIds.length === 0) {
      console.log(`[SelectiveRegenerator] No sections need regeneration for ${project.slug}`);
      return;
    }

    progress.progress.totalSections += sectionIds.length;
    this.notifyProgress(operationId, progress);

    await this.regenerateSectionsWithAncestors(operationId, project, sectionIds, request);

    progress.progress.sectionsProcessed += sectionIds.length;
    this.notifyProgress(operationId, progress);
  }

  /**
   * Core regeneration pass (task 9.2): regenerate the changed sections'
   * subtrees AND invalidate + re-summarize + re-embed every affected
   * ancestor (parent T2 chain and T1), bottom-up, from cumulative sources.
   */
  private async regenerateSectionsWithAncestors(
    operationId: string,
    project: any,
    sectionIds: string[],
    request: RegenerationRequest
  ): Promise<void> {
    const progress = this.activeOperations.get(operationId)!;

    const entity = await prisma.contentEntity.findUnique({
      where: {
        entityType_slug: {
          entityType: 'PROJECT',
          slug: project.slug
        }
      }
    });

    if (!entity) {
      throw new Error(`Content entity not found for project: ${project.slug}`);
    }

    // 1. Fresh scaffold from current content — verbatim T3s + T2
    //    placeholders/auto-populated cumulative content. No AI calls.
    //    The parser TTL-caches per project; regeneration follows a content
    //    edit by definition, so the cache MUST be busted or the scaffold
    //    re-embeds the pre-edit text.
    this.contentParser.clearProjectCache(project.id);
    const scaffold = await this.contentGenerator.generateScaffoldOnly(project);
    const scaffoldChunks = scaffold.tiers;
    const scaffoldT2s = scaffoldChunks.filter(c => c.tier === 2);
    const scaffoldT3s = scaffoldChunks.filter(c => c.tier === 3);
    const t1 = scaffoldChunks.find(c => c.tier === 1);
    const t2ById = new Map(scaffoldT2s.map(c => [c.chunkId, c]));

    // Existing DB rows: content for unaffected T2s, manual-edit flags,
    // parent-id resolution, and deletion detection
    const dbChunks = await prisma.contextChunk.findMany({ where: { entityId: entity.id } });
    const dbByChunkId = new Map(dbChunks.map(c => [c.chunkId, c]));
    const dbIdToChunkId = new Map(dbChunks.map(c => [c.id, c.chunkId]));

    // 2. Affected sets — subtree (descendants) + ancestor chain per changed
    //    section, on scaffold linkage, falling back to DB linkage for
    //    sections that were removed from the content
    const subtreeIds = new Set<string>();
    const ancestorIds = new Set<string>();

    const childrenOf = (parentChunkId: string): string[] => {
      const fromScaffold = scaffoldT2s
        .filter(c => c.parentChunkId === parentChunkId)
        .map(c => c.chunkId);
      const parentDbId = dbByChunkId.get(parentChunkId)?.id;
      const fromDb = parentDbId
        ? dbChunks.filter(c => c.tier === 2 && c.parentChunkId === parentDbId).map(c => c.chunkId)
        : [];
      return [...new Set([...fromScaffold, ...fromDb])];
    };
    const parentOf = (chunkId: string): string | undefined => {
      const scaffoldParent = t2ById.get(chunkId)?.parentChunkId;
      if (scaffoldParent && t2ById.has(scaffoldParent)) return scaffoldParent;
      const dbParentId = dbByChunkId.get(chunkId)?.parentChunkId;
      const dbParentChunkId = dbParentId ? dbIdToChunkId.get(dbParentId) : undefined;
      return dbParentChunkId && (t2ById.has(dbParentChunkId) || dbByChunkId.get(dbParentChunkId)?.tier === 2)
        ? dbParentChunkId
        : undefined;
    };

    for (const sectionId of sectionIds) {
      // Subtree: the section and every descendant section
      const stack = [sectionId];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (subtreeIds.has(id)) continue;
        subtreeIds.add(id);
        stack.push(...childrenOf(id));
      }
      // Ancestors: parent T2 chain (T1 is always invalidated below)
      let parent = parentOf(sectionId);
      while (parent && !ancestorIds.has(parent)) {
        ancestorIds.add(parent);
        parent = parentOf(parent);
      }
    }

    const affectedT2Ids = new Set([...subtreeIds, ...ancestorIds].filter(id => t2ById.has(id)));

    console.log(`[SelectiveRegenerator] ${project.slug}: sections=[${sectionIds.join(', ')}] → subtree=${subtreeIds.size}, ancestors=[${[...ancestorIds].join(', ') || 'none'}] (+T1)`);

    // Manual-edit protection at chunk level
    const manuallyEditedIds = new Set(
      dbChunks.filter(c => c.manuallyEdited || c.modifiedBy === 'user').map(c => c.chunkId)
    );
    const isProtected = (chunkId: string) =>
      request.preserveManualEdits && !request.overrideManualEdits && manuallyEditedIds.has(chunkId);

    // 3. Unaffected T2s keep their existing (still valid) summaries so
    //    ancestor sources include correct sibling content
    for (const t2 of scaffoldT2s) {
      const existing = dbByChunkId.get(t2.chunkId);
      const inheritExisting = !affectedT2Ids.has(t2.chunkId) || isProtected(t2.chunkId);
      if (inheritExisting && existing && existing.tier === 2) {
        t2.content = existing.content;
        t2.tokenCount = existing.tokenCount;
        t2.metadata = (existing.metadata as any) || t2.metadata;
      }
    }
    if (t1) {
      const existingT1 = dbByChunkId.get(t1.chunkId);
      if (existingT1 && isProtected(t1.chunkId)) {
        t1.content = existingT1.content;
        t1.tokenCount = existingT1.tokenCount;
        t1.metadata = (existingT1.metadata as any) || t1.metadata;
      }
    }

    // 4. Bottom-up summary regeneration: affected T2 placeholders deepest
    //    first, then T1 (its source is the whole project's T3 content)
    const chunksNeedingSummaries = orderSummaryChunksBottomUp([
      ...scaffoldT2s.filter(
        c => affectedT2Ids.has(c.chunkId) && c.metadata.needsAIGeneration && !isProtected(c.chunkId)
      ),
      ...(t1 && !isProtected(t1.chunkId) ? [t1] : [])
    ]);

    for (const chunk of chunksNeedingSummaries) {
      let sourceContent: string;
      let sourceProvenance: Record<string, any> | undefined;

      if (chunk.tier === 1) {
        sourceContent = scaffoldT3s.map(c => c.content).join('\n\n');
      } else {
        const cumulative = buildT2SummarySource(chunk, scaffoldT2s, scaffoldT3s);
        sourceContent = cumulative.source;
        sourceProvenance = {
          ownT3Count: cumulative.ownT3Count,
          childChunkIds: cumulative.contributingChildIds,
        };
        if (sourceContent.length < 50) {
          chunk.content = cumulative.childTitles.length > 0
            ? `Covers: ${cumulative.childTitles.join(', ')}.`
            : 'No content available for summary';
          chunk.tokenCount = this.estimateTokenCount(chunk.content);
          chunk.metadata.needsAIGeneration = false;
          chunk.metadata.source = cumulative.childTitles.length > 0 ? 'child-overview' : 'empty';
          continue;
        }
      }

      if (chunk.tier === 1 && sourceContent.length < 50) {
        chunk.content = 'No content available for summary';
        chunk.metadata.needsAIGeneration = false;
        chunk.metadata.source = 'empty';
        continue;
      }

      const result = await this.summaryService.generateSummary({
        content: sourceContent,
        type: chunk.tier === 1 ? 'T1' : 'T2',
        projectId: project.id,
        sectionTitle: chunk.title,
        metadata: chunk.metadata
      });

      chunk.content = result.summary;
      chunk.tokenCount = this.estimateTokenCount(result.summary);
      chunk.metadata.aiGenerated = true;
      chunk.metadata.needsAIGeneration = false;
      chunk.metadata.placeholder = false;
      chunk.metadata.confidenceScore = result.confidenceScore;
      chunk.metadata.source = 'ai-generated';
      chunk.metadata.generationMode = 'ai';
      if (sourceProvenance) {
        chunk.metadata.summarySource = sourceProvenance;
      }

      progress.progress.costAccumulated += result.cost;
      progress.progress.tokensUsed += result.tokensUsed;
      this.notifyProgress(operationId, progress);
    }

    // 5. Chunks to write: subtree T3s, affected T2s, and T1 (always — a
    //    descendant change invalidates the whole ancestor chain)
    const affectedT3s = scaffoldT3s.filter(
      c => c.sectionGroup && subtreeIds.has(c.sectionGroup) && !isProtected(c.chunkId)
    );
    const affectedT2s = scaffoldT2s.filter(
      c => affectedT2Ids.has(c.chunkId) && !isProtected(c.chunkId)
    );
    const chunksToWrite: TierContent[] = [
      ...(t1 && !isProtected(t1.chunkId) ? [t1] : []),
      // Parents before children so new T2 rows resolve their parent FK
      ...orderSummaryChunksBottomUp(affectedT2s).reverse(),
      ...affectedT3s,
    ];

    // 6. Purge rows the new scaffold no longer produces within the affected
    //    subtree (removed sections/chunks)
    const keepIds = new Set([...affectedT2s, ...affectedT3s].map(c => c.chunkId));
    const deleted = await prisma.contextChunk.deleteMany({
      where: {
        entityId: entity.id,
        chunkId: { notIn: [...keepIds] },
        OR: [
          { tier: 3, sectionGroup: { in: [...subtreeIds] } },
          { tier: 2, chunkId: { in: [...subtreeIds] } },
        ],
      }
    });
    if (deleted.count > 0) {
      console.log(`[SelectiveRegenerator] Purged ${deleted.count} stale chunks in regenerated subtree`);
    }

    // 7. Re-embed and persist every affected chunk (ancestors included —
    //    Req 9.3: "invalidate and re-embed every affected ancestor summary")
    const t0DbId = dbChunks.find(c => c.tier === 0)?.id ?? null;
    const writtenIds = new Map<string, string>(); // chunkId -> DB uuid (this pass)

    const resolveDbId = (chunkId: string | undefined | null): string | null => {
      if (!chunkId) return null;
      return writtenIds.get(chunkId) ?? dbByChunkId.get(chunkId)?.id ?? null;
    };

    for (const chunk of chunksToWrite) {
      const { embedding, costUsd, tokensUsed, modelId } = await generateChunkEmbedding(
        chunkEmbeddingInput(chunk),
        { operationId }
      );

      const parentDbId = chunk.tier === 1
        ? t0DbId
        : resolveDbId(chunk.parentChunkId) ?? (chunk.tier === 2 && t1 ? resolveDbId(t1.chunkId) : null);
      const result = await this.vectorOps.upsertContextChunkWithVector({
        entityId: entity.id,
        tier: chunk.tier,
        chunkId: chunk.chunkId,
        title: chunk.title,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding,
        embeddingModel: modelId,
        metadata: chunk.metadata,
        parentChunkId: parentDbId ?? undefined,
        rootChunkId: t0DbId ?? undefined,
        sectionGroup: chunk.sectionGroup,
        derivationPath: chunk.derivationPath
      });
      writtenIds.set(chunk.chunkId, result.id);

      progress.progress.chunksProcessed++;
      progress.progress.costAccumulated += costUsd;
      progress.progress.tokensUsed += tokensUsed;
      this.notifyProgress(operationId, progress);
    }

    console.log(`✅ Regenerated ${sectionIds.length} section(s) + ${ancestorIds.size} ancestor(s) + T1 for ${project.slug}: ${chunksToWrite.length} chunks re-embedded`);
  }

  /**
   * Check if section has manually edited chunks
   */
  private async hasManualEdits(projectId: string, sectionId: string): Promise<boolean> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { slug: true }
    });

    if (!project) return false;

    const entity = await prisma.contentEntity.findUnique({
      where: {
        entityType_slug: {
          entityType: 'PROJECT',
          slug: project.slug
        }
      }
    });

    if (!entity) return false;

    // Use raw SQL to check for manually edited chunks
    const manuallyEditedChunks = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM context_chunks
      WHERE entity_id = ${entity.id}
        AND section_group = ${sectionId}
        AND (manually_edited = true OR modified_by = 'user')
      LIMIT 1
    `;

    return manuallyEditedChunks.length > 0;
  }

  /**
   * Check budget before regeneration
   */
  private async checkBudget(request: RegenerationRequest): Promise<void> {
    const estimate = await this.estimateRegenerationCost(request);

    // Check if SemanticBudget table exists and has data
    try {
      const budget = await prisma.$queryRaw<Array<{
        id: string;
        allocated_funds: number;
        remaining_funds: number;
        is_active: boolean;
      }>>`
        SELECT id, allocated_funds, remaining_funds, is_active
        FROM semantic_budgets
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!budget || budget.length === 0) {
        console.warn('No active semantic budget found. Proceeding without budget check.');
        return;
      }

      const remainingFunds = budget[0].remaining_funds;
      if (remainingFunds < estimate.estimatedCost) {
        throw new Error(
          `Insufficient budget. Required: $${estimate.estimatedCost.toFixed(4)}, ` +
          `Available: $${remainingFunds.toFixed(4)}`
        );
      }
    } catch (error) {
      // If table doesn't exist or query fails, log warning and proceed
      console.warn('Budget check failed, proceeding without validation:', error);
    }
  }

  /**
   * Get regeneration progress (in-memory projection)
   */
  getProgress(operationId: string): RegenerationProgress | null {
    return this.activeOperations.get(operationId) || null;
  }

  /**
   * Get progress, falling back to the durable operation row
   */
  async getProgressOrPersisted(operationId: string): Promise<RegenerationProgress | null> {
    const live = this.activeOperations.get(operationId);
    if (live) return live;
    const row = await this.operationStore.getOperation(operationId);
    if (!row) return null;
    return {
      operationId: row.id,
      status: row.status as RegenerationProgress['status'],
      progress: {
        sectionsProcessed: row.itemsProcessed,
        totalSections: row.totalItems,
        chunksProcessed: 0,
        tokensUsed: row.tokensUsed,
        costAccumulated: Number(row.costAccumulated),
        percentComplete: row.overallProgress,
      },
      errors: Array.isArray(row.errors) ? (row.errors as any[]) : [],
      startedAt: row.startedAt,
      completedAt: row.completedAt ?? undefined,
    };
  }

  /**
   * Subscribe to progress updates (multi-subscriber safe)
   */
  subscribeToProgress(
    operationId: string,
    callback: (progress: RegenerationProgress) => void
  ): void {
    let set = this.progressCallbacks.get(operationId);
    if (!set) {
      set = new Set();
      this.progressCallbacks.set(operationId, set);
    }
    set.add(callback);
  }

  /**
   * Unsubscribe from progress updates
   */
  unsubscribeFromProgress(
    operationId: string,
    callback?: (progress: RegenerationProgress) => void
  ): void {
    if (!callback) {
      this.progressCallbacks.delete(operationId);
      return;
    }
    const set = this.progressCallbacks.get(operationId);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this.progressCallbacks.delete(operationId);
    }
  }

  /**
   * Notify progress update (projection only — durable state is written by
   * the transition call sites)
   */
  private notifyProgress(operationId: string, progress: RegenerationProgress): void {
    const callbacks = this.progressCallbacks.get(operationId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(progress);
        } catch (error) {
          console.warn(`[SelectiveRegenerator] Subscriber callback failed for ${operationId}:`, error);
        }
      }
    }
  }

  /**
   * Persist regeneration state to the durable operation table (task 6.3 —
   * regenerations are semantic operations too; the queue projects them)
   */
  private async persistDurable(
    operationId: string,
    request: RegenerationRequest,
    progress: RegenerationProgress
  ): Promise<void> {
    try {
      await prisma.semanticProcessingOperation.upsert({
        where: { id: operationId },
        create: {
          id: operationId,
          scope: request.scope,
          projectId: request.projectId ?? null,
          sectionId: request.sectionId ?? null,
          type: 'regeneration',
          status: progress.status,
          overallProgress: progress.progress.percentComplete,
          totalItems: progress.progress.totalSections,
          itemsProcessed: progress.progress.sectionsProcessed,
          costAccumulated: progress.progress.costAccumulated,
          tokensUsed: progress.progress.tokensUsed,
          errors: JSON.parse(JSON.stringify(progress.errors)) as object,
          error: progress.errors.length > 0 ? progress.errors[progress.errors.length - 1].error : null,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt ?? null,
        },
        update: {
          status: progress.status,
          overallProgress: progress.progress.percentComplete,
          totalItems: progress.progress.totalSections,
          itemsProcessed: progress.progress.sectionsProcessed,
          costAccumulated: progress.progress.costAccumulated,
          tokensUsed: progress.progress.tokensUsed,
          errors: JSON.parse(JSON.stringify(progress.errors)) as object,
          error: progress.errors.length > 0 ? progress.errors[progress.errors.length - 1].error : null,
          lastUpdatedAt: new Date(),
          completedAt: progress.completedAt ?? null,
        },
      });
    } catch (error) {
      console.error(`[SelectiveRegenerator] Durable persist failed for ${operationId}:`, error);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `regen-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Estimate token count
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 0.75 words
    const words = text.split(/\s+/).length;
    return Math.ceil(words / 0.75);
  }

  /**
   * Calculate section cost
   */
  private async calculateSectionCost(tokens: number): Promise<number> {
    return (await estimateCombinedSectionCost(tokens)).totalCost;
  }
}

// Singleton (global — survives Next.js dev hot reloads). Routes previously
// constructed their own instances, so the SSE route could never see the
// start route's in-memory progress.
const globalForRegenerator = global as typeof globalThis & {
  selectiveRegeneratorInstance?: SelectiveSectionRegenerator;
};

export function getSelectiveSectionRegenerator(): SelectiveSectionRegenerator {
  if (!globalForRegenerator.selectiveRegeneratorInstance) {
    globalForRegenerator.selectiveRegeneratorInstance = new SelectiveSectionRegenerator();
  }
  return globalForRegenerator.selectiveRegeneratorInstance;
}

export default SelectiveSectionRegenerator;
