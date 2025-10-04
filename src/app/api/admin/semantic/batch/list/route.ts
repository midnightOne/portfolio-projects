/**
 * List Active Batch Jobs API
 * 
 * GET /api/admin/semantic/batch/list
 * List all active batch embedding jobs
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

    // Get active batch jobs
    const batchService = getBatchEmbeddingService();
    const jobs = await batchService.listActiveBatchJobs();

    return NextResponse.json({
      success: true,
      jobs
    });
  } catch (error) {
    console.error('List batch jobs error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to list batch jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
