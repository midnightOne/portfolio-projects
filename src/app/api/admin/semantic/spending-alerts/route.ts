/**
 * Spending Alerts API
 * 
 * Detects unusual spending patterns and generates alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { costEstimationService } from '@/lib/content/CostEstimationService';

export async function GET(request: NextRequest) {
  try {
    const alerts = await costEstimationService.detectSpendingAlerts();

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Spending alerts error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to detect spending alerts' },
      { status: 500 }
    );
  }
}
