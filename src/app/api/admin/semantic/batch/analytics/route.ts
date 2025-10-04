/**
 * Batch Operation Analytics API
 * 
 * GET /api/admin/semantic/batch/analytics
 * Get analytics for batch operations (cost savings, processing time, success rate)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBatchEmbeddingService } from '@/lib/content/BatchEmbeddingService';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;
    const projectId = searchParams.get('projectId') || undefined;

    // Get analytics
    const batchService = getBatchEmbeddingService();
    const analytics = await batchService.getBatchAnalytics({
      startDate,
      endDate,
      projectId
    });

    return NextResponse.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Batch analytics error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get batch analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
