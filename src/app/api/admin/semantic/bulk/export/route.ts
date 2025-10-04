/**
 * Export Semantic Indexes API
 * 
 * POST: Export semantic indexes as downloadable ZIP
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
    const { projectIds } = body;

    const zipBuffer = await bulkOps.exportSemanticIndexes(projectIds);

    // Return as downloadable file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="semantic-indexes-${Date.now()}.zip"`
      }
    });
  } catch (error) {
    console.error('Error exporting semantic indexes:', error);
    return NextResponse.json(
      { error: 'Failed to export semantic indexes' },
      { status: 500 }
    );
  }
}
