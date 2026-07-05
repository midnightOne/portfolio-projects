/**
 * Bulk Regeneration API
 * 
 * POST /estimate: Estimate cost for bulk regeneration
 * POST /execute: Execute bulk regeneration
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway } from '@/lib/ai/gateway';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BulkOperationsService } from '@/lib/content/BulkOperationsService';

const bulkOps = new BulkOperationsService();

async function handlePOST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, projectIds, useBatchMode, preserveManualEdits, regenerateEmbeddings } = body;

    if (action === 'estimate') {
      const estimate = await bulkOps.estimateBulkRegeneration({
        projectIds,
        useBatchMode: useBatchMode ?? false,
        preserveManualEdits: preserveManualEdits ?? true,
        regenerateEmbeddings: regenerateEmbeddings ?? false
      });

      return NextResponse.json(estimate);
    }

    if (action === 'execute') {
      // Execute bulk regeneration
      const result = await bulkOps.bulkRegenerateEmbeddings(
        projectIds || [],
        useBatchMode ?? false
      );

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in bulk regeneration:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk regeneration' },
      { status: 500 }
    );
  }
}

// Cost-incurring semantic operation start: gateway-wrapped (D33), admin-tier via route auth.
export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
