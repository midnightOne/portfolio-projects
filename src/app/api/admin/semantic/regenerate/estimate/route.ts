/**
 * API Route: Estimate Regeneration Cost
 * POST /api/admin/semantic/regenerate/estimate
 * 
 * Estimates the cost of regeneration for a given scope.
 * Only counts affected sections, not entire project.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSelectiveSectionRegenerator } from '@/lib/content/SelectiveSectionRegenerator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scope, projectId, sectionId } = body;

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

    const regenerator = getSelectiveSectionRegenerator();
    const estimate = await regenerator.estimateRegenerationCost({
      scope,
      projectId,
      sectionId,
      preserveManualEdits: true
    });

    return NextResponse.json(estimate);

  } catch (error) {
    console.error('Error estimating regeneration cost:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to estimate regeneration cost',
        details: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
