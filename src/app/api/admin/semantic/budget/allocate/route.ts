/**
 * Budget Allocation API
 * 
 * POST: Allocate additional funds to the semantic budget
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, description } = body;

    // Validation
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Amount must be a positive number'
        },
        { status: 400 }
      );
    }

    if (amount > 10000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Amount cannot exceed $10,000 per allocation'
        },
        { status: 400 }
      );
    }

    const budget = await semanticBudgetManager.allocateFunds({
      amount,
      description
    });

    return NextResponse.json({
      success: true,
      budget,
      message: `Successfully allocated $${amount.toFixed(2)} to semantic budget`
    });
  } catch (error) {
    console.error('Error allocating budget:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate budget'
      },
      { status: 500 }
    );
  }
}
