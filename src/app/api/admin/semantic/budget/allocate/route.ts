/**
 * Semantic Budget Allocation API
 * 
 * POST: Allocate additional funds to the budget
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount } = body;

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid amount. Must be a positive number.'
        },
        { status: 400 }
      );
    }

    const budget = await semanticBudgetManager.allocateFunds({
      amount,
      description: 'Manual allocation via admin interface'
    });

    return NextResponse.json({
      success: true,
      budget
    });
  } catch (error) {
    console.error('Error allocating funds:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate funds'
      },
      { status: 500 }
    );
  }
}
