/**
 * Cleanup Orphaned Chunks API
 * 
 * GET: Preview orphaned chunks
 * POST: Execute cleanup
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BulkOperationsService } from '@/lib/content/BulkOperationsService';

const bulkOps = new BulkOperationsService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preview = await bulkOps.previewOrphanedChunks();

    return NextResponse.json(preview);
  } catch (error) {
    console.error('Error previewing orphaned chunks:', error);
    return NextResponse.json(
      { error: 'Failed to preview orphaned chunks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await bulkOps.cleanupOrphanedChunks();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error cleaning up orphaned chunks:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup orphaned chunks' },
      { status: 500 }
    );
  }
}
