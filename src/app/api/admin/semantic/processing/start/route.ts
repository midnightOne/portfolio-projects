/**
 * API Route: Start Stage-Based Processing
 * POST /api/admin/semantic/processing/start
 * 
 * Starts stage-based content processing with granular control over stages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway } from '@/lib/ai/gateway';
import { getSession } from '@/lib/auth-utils';
import { ProcessingRequest, StageConfig } from '@/lib/content/StageBasedProcessingService';
import { getProcessingService } from '@/lib/content/StageBasedProcessingServiceSingleton';

async function handlePOST(request: NextRequest) {
  try {
    // Check authentication — this route triggers OpenAI spend (chunk summaries/embeddings)
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      scope, 
      projectId, 
      sectionId, 
      stages,
      preserveManualEdits = true
    } = body;

    // Validate request
    if (!scope || !['all', 'project', 'section'].includes(scope)) {
      return NextResponse.json(
        { error: 'Invalid scope. Must be: all, project, or section' },
        { status: 400 }
      );
    }

    if (scope === 'project' && !projectId) {
      return NextResponse.json(
        { error: 'projectId required for project scope' },
        { status: 400 }
      );
    }

    if (scope === 'section' && (!projectId || !sectionId)) {
      return NextResponse.json(
        { error: 'projectId and sectionId required for section scope' },
        { status: 400 }
      );
    }

    if (!stages || !Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json(
        { error: 'At least one stage must be specified' },
        { status: 400 }
      );
    }

    // Validate stages
    const validStages = ['chunking', 'summaries', 'embeddings', 'validation'];
    for (const stage of stages) {
      if (!validStages.includes(stage.stage)) {
        return NextResponse.json(
          { error: `Invalid stage: ${stage.stage}. Valid stages: ${validStages.join(', ')}` },
          { status: 400 }
        );
      }
      if (!['immediate', 'batch'].includes(stage.mode)) {
        return NextResponse.json(
          { error: `Invalid mode: ${stage.mode}. Valid modes: immediate, batch` },
          { status: 400 }
        );
      }
    }

    // Generate operation ID
    const operationId = `stage-proc-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create processing request
    const processingRequest: ProcessingRequest = {
      operationId,
      scope,
      projectId,
      sectionId,
      stages: stages as StageConfig[],
      preserveManualEdits
    };

    // Start processing — the service creates the durable operation row
    // (semantic_processing_operations) that the queue/history projects from
    const processingService = getProcessingService();
    await processingService.startProcessing(processingRequest);

    return NextResponse.json({
      operationId,
      status: 'started',
      message: 'Stage-based processing started successfully',
      stages: stages.map((s: any) => s.stage)
    });

  } catch (error) {
    console.error('Error starting stage-based processing:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start processing',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
// Cost-incurring semantic operation start: gateway-wrapped (D33), admin-tier via route auth.
export const POST = withAIGateway({ feature: 'semantic', publicAllowed: false }, handlePOST);
