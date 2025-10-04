/**
 * Batch Job Status API
 * 
 * GET /api/admin/semantic/batch/[batchId]/status
 * Check the status of a batch embedding job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBatchEmbeddingService } from '@/lib/content/BatchEmbeddingService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { batchId } = await params;

    // Get batch status
    const batchService = getBatchEmbeddingService();
    const status = await batchService.checkBatchStatus(batchId);

    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Batch status check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check batch status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
