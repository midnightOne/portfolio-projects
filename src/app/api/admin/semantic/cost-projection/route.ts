/**
 * Cost Projection API
 * 
 * Projects future costs based on historical data
 */

import { NextRequest, NextResponse } from 'next/server';
import { costEstimationService } from '@/lib/content/CostEstimationService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lookbackDays = parseInt(searchParams.get('lookbackDays') || '30');
    const confidenceThreshold = parseFloat(searchParams.get('confidenceThreshold') || '0.7');

    if (lookbackDays <= 0 || lookbackDays > 365) {
      return NextResponse.json(
        { error: 'lookbackDays must be between 1 and 365' },
        { status: 400 }
      );
    }

    const projection = await costEstimationService.projectCosts({
      lookbackDays,
      confidenceThreshold
    });

    return NextResponse.json(projection);
  } catch (error) {
    console.error('Cost projection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to project costs' },
      { status: 500 }
    );
  }
}
