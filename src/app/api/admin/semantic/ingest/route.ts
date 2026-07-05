/**
 * API Route: Initial Content Ingestion
 * POST /api/admin/semantic/ingest
 * 
 * Triggers initial semantic content ingestion for new projects using the
 * integrated SmartContentGenerator and ContentIngestionService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway } from '@/lib/ai/gateway';
import { getSession } from '@/lib/auth-utils';
import { ContentIngestionService } from '@/lib/content/ContentIngestionService';
import { prisma } from '@/lib/prisma';

async function handlePOST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Find the project
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { slug: projectId },
          { id: projectId }
        ]
      },
      include: {
        articleContent: true,
        tags: true,
        aiIndex: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404 }
      );
    }

    // Check if project already has semantic content
    const existingEntity = await prisma.contentEntity.findFirst({
      where: {
        entityType: 'PROJECT',
        OR: [
          { slug: project.slug },
          { id: project.id }
        ]
      }
    });

    if (existingEntity) {
      const chunkCount = await prisma.contextChunk.count({
        where: { entityId: existingEntity.id }
      });

      return NextResponse.json({
        message: 'Project already has semantic content',
        projectId: project.slug,
        entityId: existingEntity.id,
        existingChunks: chunkCount,
        suggestion: 'Use regeneration API to update existing content'
      });
    }

    // Perform initial ingestion using the integrated system
    console.log(`Starting initial ingestion for project: ${project.slug}`);
    
    const ingestionService = new ContentIngestionService();
    const result = await ingestionService.ingestProject(project);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Initial content ingestion completed successfully',
        projectId: project.slug,
        result: {
          entityId: result.entityId,
          tiersCreated: result.tiersCreated,
          totalChunks: result.totalChunks,
          embeddingsGenerated: result.embeddingsGenerated,
          costEstimate: result.costEstimate,
          processingTime: result.processingTime
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Content ingestion failed',
        error: result.error,
        projectId: project.slug
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Content ingestion API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get projects that need initial ingestion
    const projects = await prisma.project.findMany({
      where: {
        status: 'PUBLISHED'
      },
      select: {
        id: true,
        slug: true,
        title: true,
        updatedAt: true
      }
    });

    // Check which projects have semantic content
    const projectsWithStatus = await Promise.all(
      projects.map(async (project) => {
        const entity = await prisma.contentEntity.findFirst({
          where: {
            entityType: 'PROJECT',
            OR: [
              { slug: project.slug },
              { id: project.id }
            ]
          }
        });

        const chunkCount = entity ? await prisma.contextChunk.count({
          where: { entityId: entity.id }
        }) : 0;

        return {
          projectId: project.slug,
          title: project.title,
          hasSemanticContent: !!entity,
          chunkCount,
          lastUpdated: project.updatedAt,
          needsIngestion: !entity
        };
      })
    );

    const needsIngestion = projectsWithStatus.filter(p => p.needsIngestion);
    const hasContent = projectsWithStatus.filter(p => p.hasSemanticContent);

    return NextResponse.json({
      summary: {
        totalProjects: projects.length,
        withSemanticContent: hasContent.length,
        needsIngestion: needsIngestion.length
      },
      projects: projectsWithStatus
    });

  } catch (error) {
    console.error('Content ingestion status API error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
// Cost-incurring semantic operation start: gateway-wrapped (D33), admin-tier via route auth.
export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
