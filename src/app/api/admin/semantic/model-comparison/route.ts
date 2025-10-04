/**
 * Model Cost Comparison API
 * 
 * Compares costs between different embedding models
 */

import { NextRequest, NextResponse } from 'next/server';
import { costEstimationService } from '@/lib/content/CostEstimationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { estimatedTokens, currentModel } = body;

    if (!estimatedTokens || estimatedTokens <= 0) {
      return NextResponse.json(
        { error: 'estimatedTokens must be a positive number' },
        { status: 400 }
      );
    }

    const comparison = await costEstimationService.compareEmbeddingModels({
      estimatedTokens,
      currentModel
    });

    return NextResponse.json({ models: comparison });
  } catch (error) {
    console.error('Model comparison error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compare models' },
      { status: 500 }
    );
  }
}
