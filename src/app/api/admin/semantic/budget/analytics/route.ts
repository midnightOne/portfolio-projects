/**
 * Budget Analytics API
 * 
 * GET: Get budget analytics with trends and projections
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (days < 1 || days > 365) {
      return NextResponse.json(
        {
          success: false,
          error: 'Days parameter must be between 1 and 365'
        },
        { status: 400 }
      );
    }

    const analytics = await semanticBudgetManager.getBudgetAnalytics(days);

    return NextResponse.json({
      success: true,
      analytics,
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching budget analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch budget analytics'
      },
      { status: 500 }
    );
  }
}
