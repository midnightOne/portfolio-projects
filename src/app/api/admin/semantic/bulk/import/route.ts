/**
 * Import Semantic Indexes API
 * 
 * POST: Import semantic indexes from ZIP file
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const overwriteExisting = formData.get('overwriteExisting') === 'true';
    const validateOnly = formData.get('validateOnly') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await bulkOps.importSemanticIndexes(buffer, {
      overwriteExisting,
      validateOnly
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing semantic indexes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import semantic indexes' },
      { status: 500 }
    );
  }
}
