/**
 * Batch Embedding Job Submission API
 * 
 * POST /api/admin/semantic/batch/submit
 * Submit a batch embedding job for non-time-sensitive operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBatchEmbeddingService } from '@/lib/content/BatchEmbeddingService';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { requests, config } = body;

    // Validate input
    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json(
        { error: 'Invalid requests array' },
        { status: 400 }
      );
    }

    if (!config || !config.model) {
      return NextResponse.json(
        { error: 'Invalid config' },
        { status: 400 }
      );
    }

    // Submit batch job
    const batchService = getBatchEmbeddingService();
    const result = await batchService.submitBatchJob(requests, config);

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      status: result.status,
      message: `Batch job submitted successfully. Processing will complete within 24 hours.`
    });
  } catch (error) {
    console.error('Batch submission error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to submit batch job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
