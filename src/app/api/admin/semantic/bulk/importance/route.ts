/**
 * Bulk Importance Update API
 * 
 * POST: Update importance scores for multiple chunks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BulkOperationsService } from '@/lib/content/BulkOperationsService';

const bulkOps = new BulkOperationsService();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chunkIds, importance } = body;

    if (!chunkIds || !Array.isArray(chunkIds) || chunkIds.length === 0) {
      return NextResponse.json({ error: 'Invalid chunk IDs' }, { status: 400 });
    }

    if (typeof importance !== 'number' || importance < 0 || importance > 1) {
      return NextResponse.json({ error: 'Importance must be between 0 and 1' }, { status: 400 });
    }

    const count = await bulkOps.bulkUpdateImportance({
      chunkIds,
      importance,
      importanceSource: 'manual'
    });

    return NextResponse.json({ 
      success: true,
      chunksUpdated: count 
    });
  } catch (error) {
    console.error('Error updating importance scores:', error);
    return NextResponse.json(
      { error: 'Failed to update importance scores' },
      { status: 500 }
    );
  }
}
