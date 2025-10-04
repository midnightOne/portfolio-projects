/**
 * Budget Export API
 * 
 * GET: Export spending data as CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters (same as operations endpoint)
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

    const csvContent = await semanticBudgetManager.exportSpendingDataCSV(filter);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `semantic-budget-export-${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error('Error exporting budget data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export budget data'
      },
      { status: 500 }
    );
  }
}
