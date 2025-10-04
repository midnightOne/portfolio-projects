/**
 * Spending History API
 * 
 * GET: Get spending history with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const filter: any = {};

    const projectId = searchParams.get('projectId');
    if (projectId) {
      filter.projectId = projectId;
    }

    const operationType = searchParams.get('operationType');
    if (operationType) {
      filter.operationType = operationType;
    }

    const startDate = searchParams.get('startDate');
    if (startDate) {
      filter.startDate = new Date(startDate);
    }

    const endDate = searchParams.get('endDate');
    if (endDate) {
      filter.endDate = new Date(endDate);
    }

    const success = searchParams.get('success');
    if (success !== null) {
      filter.success = success === 'true';
    }

    const operations = await semanticBudgetManager.getSpendingHistory(filter);

    return NextResponse.json({
      success: true,
      operations,
      count: operations.length
    });
  } catch (error) {
    console.error('Error fetching spending history:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch spending history'
      },
      { status: 500 }
    );
  }
}
