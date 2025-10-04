/**
 * API Route: Trigger Regeneration
 * POST /api/admin/semantic/regenerate
 * 
 * Triggers semantic content regeneration with specified scope.
 * Supports: all projects, single project, or specific section.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SelectiveSectionRegenerator } from '@/lib/content/SelectiveSectionRegenerator';
import { ContentIngestionService } from '@/lib/content/ContentIngestionService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      scope, 
      projectId, 
      sectionId, 
      preserveManualEdits = true,
      overrideManualEdits = false
    } = body;

    if (!scope || !['all', 'project', 'section'].includes(scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Must be: all, project, or section' },
        { status: 400 }
      );
    }

    if (scope === 'project' && !projectId) {
      return NextResponse.json(
        { error: 'projectId required for project scope' },
        { status: 400 }
      );
    }

    if (scope === 'section' && (!projectId || !sectionId)) {
      return NextResponse.json(
        { error: 'projectId and sectionId required for section scope' },
        { status: 400 }
      );
    }

    // Check if this is a new project that needs initial ingestion
    if (scope === 'project' && projectId) {
      const existingEntity = await prisma.contentEntity.findFirst({
        where: {
          entityType: 'PROJECT',
          OR: [
            { slug: projectId },
            { id: projectId }
          ]
        }
      });

      if (!existingEntity) {
        // This is a new project - use ContentIngestionService for initial setup
        console.log(`New project detected: ${projectId}. Using ContentIngestionService for initial ingestion.`);
        
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

        const ingestionService = new ContentIngestionService();
        const result = await ingestionService.ingestProject(project);
        
        return NextResponse.json({
          operationId: `ingestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: 'Initial content ingestion completed',
          result: {
            success: result.success,
            tiersCreated: result.tiersCreated,
            totalChunks: result.totalChunks,
            embeddingsGenerated: result.embeddingsGenerated,
            costEstimate: result.costEstimate,
            processingTime: result.processingTime
          }
        });
      }
    }

    // Existing project - use SelectiveSectionRegenerator
    const regenerator = new SelectiveSectionRegenerator();
    
    // Start regeneration (async)
    const operationId = await regenerator.regenerate({
      scope,
      projectId,
      sectionId,
      preserveManualEdits,
      overrideManualEdits
    });

    return NextResponse.json({
      operationId,
      status: 'started',
      message: 'Regeneration started successfully'
    });

  } catch (error) {
    console.error('Error starting regeneration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start regeneration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
