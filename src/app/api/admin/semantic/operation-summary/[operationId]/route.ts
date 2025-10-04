/**
 * Operation Summary Report API
 * 
 * Generates comprehensive summary report for an operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { costEstimationService } from '@/lib/content/CostEstimationService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> }
) {
  try {
    const { operationId } = await params;

    if (!operationId) {
      return NextResponse.json(
        { error: 'operationId is required' },
        { status: 400 }
      );
    }

    const summary = await costEstimationService.generateOperationSummary(operationId);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Operation summary error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate operation summary' },
      { status: 500 }
    );
  }
}
