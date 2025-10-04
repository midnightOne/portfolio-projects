/**
 * Cost Estimation API
 * 
 * Provides cost estimation for regeneration operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { costEstimationService } from '@/lib/content/CostEstimationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, scope, sectionIds, embeddingModel, summarizationModel } = body;

    if (!scope || !['all', 'project', 'section'].includes(scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Must be "all", "project", or "section"' },
        { status: 400 }
      );
    }

    if (scope === 'project' && !projectId) {
      return NextResponse.json(
        { error: 'projectId is required for project scope' },
        { status: 400 }
      );
    }

    if (scope === 'section' && (!projectId || !sectionIds || sectionIds.length === 0)) {
      return NextResponse.json(
        { error: 'projectId and sectionIds are required for section scope' },
        { status: 400 }
      );
    }

    const estimate = await costEstimationService.estimateRegenerationCost({
      projectId,
      scope,
      sectionIds,
      embeddingModel,
      summarizationModel
    });

    return NextResponse.json(estimate);
  } catch (error) {
    console.error('Cost estimation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to estimate cost' },
      { status: 500 }
    );
  }
}
