/**
 * API Route: Trigger Regeneration
 * POST /api/admin/semantic/regenerate
 * 
 * Triggers semantic content regeneration with specified scope.
 * Supports: all projects, single project, or specific section.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SelectiveSectionRegenerator } from '@/lib/content/SelectiveSectionRegenerator';

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
