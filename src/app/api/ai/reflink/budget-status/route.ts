import { NextRequest, NextResponse } from 'next/server';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reflinkId = searchParams.get('reflinkId');

    if (!reflinkId) {
      return NextResponse.json(
        { error: 'Reflink ID is required' },
        { status: 400 }
      );
    }

    const budgetStatus = await reflinkManager.getRemainingBudget(reflinkId);

    return NextResponse.json(budgetStatus);
  } catch (error) {
    console.error('Budget status error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get budget status' },
      { status: 500 }
    );
  }
}