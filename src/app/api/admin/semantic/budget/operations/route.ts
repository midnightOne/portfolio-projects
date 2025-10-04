/**
 * Semantic Budget Operations API
 * 
 * GET: Get spending history with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const filter: any = {};

    // Project filter
    const projectId = searchParams.get('projectId');
    if (projectId) {
      filter.projectId = projectId;
    }

    // Operation type filter
    const operationType = searchParams.get('operationType');
    if (operationType) {
      filter.operationType = operationType;
    }

    // Success filter
    const success = searchParams.get('success');
    if (success !== null) {
      filter.success = success === 'true';
    }

    // Date range filter
    const startDate = searchParams.get('startDate');
    if (startDate) {
      filter.startDate = new Date(startDate);
    }

    const endDate = searchParams.get('endDate');
    if (endDate) {
      filter.endDate = new Date(endDate);
    }

    const operations = await semanticBudgetManager.getSpendingHistory(filter);

    return NextResponse.json({
      success: true,
      operations
    });
  } catch (error) {
    console.error('Error fetching operations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch operations'
      },
      { status: 500 }
    );
  }
}
