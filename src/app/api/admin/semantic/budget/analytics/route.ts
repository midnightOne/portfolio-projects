/**
 * Semantic Budget Analytics API
 * 
 * GET: Get budget analytics with trends and projections
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (isNaN(days) || days < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid days parameter. Must be a positive integer.'
        },
        { status: 400 }
      );
    }

    const analytics = await semanticBudgetManager.getBudgetAnalytics(days);

    return NextResponse.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics'
      },
      { status: 500 }
    );
  }
}
