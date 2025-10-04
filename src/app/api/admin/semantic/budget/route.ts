/**
 * Semantic Budget API
 * 
 * GET: Get current budget status
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function GET(request: NextRequest) {
  try {
    const budget = await semanticBudgetManager.getActiveBudget();

    return NextResponse.json({
      success: true,
      budget
    });
  } catch (error) {
    console.error('Error fetching budget status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch budget status'
      },
      { status: 500 }
    );
  }
}
