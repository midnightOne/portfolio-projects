/**
 * Semantic Budget Thresholds API
 * 
 * PUT: Update warning and critical thresholds
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { warningThreshold, criticalThreshold } = body;

    if (
      typeof warningThreshold !== 'number' ||
      typeof criticalThreshold !== 'number' ||
      warningThreshold < 0 ||
      warningThreshold > 1 ||
      criticalThreshold < 0 ||
      criticalThreshold > 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid thresholds. Must be numbers between 0 and 1.'
        },
        { status: 400 }
      );
    }

    if (warningThreshold >= criticalThreshold) {
      return NextResponse.json(
        {
          success: false,
          error: 'Warning threshold must be less than critical threshold.'
        },
        { status: 400 }
      );
    }

    const budget = await semanticBudgetManager.updateThresholds(
      warningThreshold,
      criticalThreshold
    );

    return NextResponse.json({
      success: true,
      budget
    });
  } catch (error) {
    console.error('Error updating thresholds:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update thresholds'
      },
      { status: 500 }
    );
  }
}
