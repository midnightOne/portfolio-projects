/**
 * Cost Breakdown API
 * 
 * GET: Get cost breakdown by operation type
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function GET(request: NextRequest) {
  try {
    const breakdown = await semanticBudgetManager.getCostBreakdown();

    return NextResponse.json({
      success: true,
      breakdown
    });
  } catch (error) {
    console.error('Error fetching cost breakdown:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cost breakdown'
      },
      { status: 500 }
    );
  }
}
