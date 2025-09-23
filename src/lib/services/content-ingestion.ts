/**
 * Content Ingestion Pipeline for Hierarchical Content Storage
 * 
 * This service handles the ingestion of existing portfolio content into the
 * new hierarchical T0-T4 tier system for semantic search and AI context.
 */

import { PrismaClient } from '@prisma/client';
import { ProjectIndexer } from './project-indexer';
import { ContextManager } from './ai/context-manager';
import VectorOperations from '../content/VectorOperations';

const prisma = new PrismaClient();

export interface TierContent {
  tier: number;
  chunkId: string;
  title?: string;
  content: string;
  tokenCount: number;
  metadata: Record<string, any>;
}

export interface ContentIngestionResult {
  entityId: string;
  entityType: string;
  slug: string;
  tiersCreated: number[];
  totalChunks: number;
  success: boolean;
  error?: string;
}

export class ContentIngestionPipeline {
  private projectIndexer: ProjectIndexer;
  private contextManager: ContextManager;
  private vectorOps: VectorOperations;

  constructor() {
    this.projectIndexer = ProjectIndexer.getInstance();
    this.contextManager = new ContextManager();
    this.vectorOps = new VectorOperations(prisma);
  }

  /**
   * Ingest all existing portfolio content into hierarchical storage
   */
  async ingestAllContent(): Promise<ContentIngestionResult[]> {
    const results: ContentIngestionResult[] = [];

    try {
      // Ingest all projects
      const projects = await prisma.project.findMany({
        where: { status: 'PUBLISHED' },
        include: {
          articleContent: true,
          tags: true,
          aiIndex: true
        }
      });

      for (const project of projects) {
        const result = await this.ingestProject(project);
        results.push(result);
      }

      // Ingest static content (bio, resume, etc.)
      const staticContentResults = await this.ingestStaticContent();
      results.push(...staticContentResults);

      return results;
    } catch (error) {
      console.error('Content ingestion failed:', error);
      throw error;
    }
  }

  /**
   * Ingest a single project into hierarchical storage
   */
  async ingestProject(project: any): Promise<ContentIngestionResult> {
    try {
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

      // Generate tier content
      const tierContents = await this.generateProjectTiers(project);

      // Store tier content as context chunks using VectorOperations
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
          embedding: undefined, // No embeddings in this version
          metadata: tierContent.metadata
        });
        
        // Get the full chunk data for return
        const chunk = await prisma.contextChunk.findUnique({
          where: { id: chunkResult.id }
        });
        if (chunk) chunks.push(chunk);
      }

      // Create content version record
      const contentHash = this.generateContentHash(project);
      await this.createContentVersion(entity.id, contentHash, 'Initial ingestion');

      return {
        entityId: entity.id,
        entityType: 'PROJECT',
        slug: project.slug,
        tiersCreated: tierContents.map(t => t.tier),
        totalChunks: chunks.length,
        success: true
      };

    } catch (error) {
      console.error(`Failed to ingest project ${project.slug}:`, error);
      return {
        entityId: '',
        entityType: 'PROJECT',
        slug: project.slug,
        tiersCreated: [],
        totalChunks: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate T0-T4 tier content for a project
   */
  private async generateProjectTiers(project: any): Promise<TierContent[]> {
    const tiers: TierContent[] = [];

    // Get project index for structured content
    const projectIndex = await this.projectIndexer.indexProject(project.id);

    // T0: Metadata only (title, tags, technologies)
    tiers.push({
      tier: 0,
      chunkId: 'metadata',
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
        importance: 1.0
      }
    });

    // T1: Brief summary (description + brief overview)
    const briefContent = [project.description, project.briefOverview].filter(Boolean).join('\n\n');
    if (briefContent) {
      tiers.push({
        tier: 1,
        chunkId: 'summary',
        title: 'Project Summary',
        content: briefContent,
        tokenCount: this.estimateTokenCount(briefContent),
        metadata: {
          type: 'summary',
          importance: 0.9
        }
      });
    }

    // T2: Key sections (high importance sections from ProjectIndexer)
    if (projectIndex?.sections) {
      const keySections = projectIndex.sections
        .filter(section => section.importance > 0.7)
        .slice(0, 3); // Top 3 most important sections

      keySections.forEach((section, index) => {
        tiers.push({
          tier: 2,
          chunkId: `key-section-${index}`,
          title: section.title,
          content: section.summary || section.content,
          tokenCount: this.estimateTokenCount(section.summary || section.content),
          metadata: {
            type: 'key-section',
            importance: section.importance,
            keywords: section.keywords
          }
        });
      });
    }

    // T3: All sections (complete content breakdown)
    if (projectIndex?.sections) {
      projectIndex.sections.forEach((section, index) => {
        tiers.push({
          tier: 3,
          chunkId: `section-${index}`,
          title: section.title,
          content: section.content,
          tokenCount: this.estimateTokenCount(section.content),
          metadata: {
            type: 'section',
            importance: section.importance,
            keywords: section.keywords,
            nodeType: section.nodeType
          }
        });
      });
    }

    // T4: Full content (complete article content)
    if (project.articleContent?.content) {
      tiers.push({
        tier: 4,
        chunkId: 'full-content',
        title: 'Complete Article Content',
        content: project.articleContent.content,
        tokenCount: this.estimateTokenCount(project.articleContent.content),
        metadata: {
          type: 'full-content',
          contentType: project.articleContent.contentType
        }
      });
    }

    return tiers;
  }

  /**
   * Ingest static content (bio, resume, etc.)
   */
  private async ingestStaticContent(): Promise<ContentIngestionResult[]> {
    const results: ContentIngestionResult[] = [];

    // This would be expanded to handle bio, resume, and other static content
    // For now, we'll create placeholder entities that can be populated later

    const staticEntities = [
      { type: 'BIO', slug: 'bio', title: 'Professional Bio' },
      { type: 'RESUME', slug: 'resume', title: 'Resume & Experience' },
      { type: 'SKILLS', slug: 'skills', title: 'Technical Skills' }
    ];

    for (const entityData of staticEntities) {
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

        results.push({
          entityId: entity.id,
          entityType: entityData.type,
          slug: entityData.slug,
          tiersCreated: [0], // Just metadata tier for now
          totalChunks: 1,
          success: true
        });

      } catch (error) {
        results.push({
          entityId: '',
          entityType: entityData.type,
          slug: entityData.slug,
          tiersCreated: [],
          totalChunks: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Create a content version record for tracking changes
   */
  private async createContentVersion(entityId: string, contentHash: string, changesSummary: string): Promise<void> {
    // Get the next version number
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
   * Update content for a specific entity
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

      return await this.ingestProject(project);
    }

    throw new Error(`Entity type ${entityType} not supported for updates yet`);
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
}

export default ContentIngestionPipeline;