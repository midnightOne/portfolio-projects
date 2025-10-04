/**
 * Change Detection API Endpoint
 * 
 * Provides API access to content change detection functionality.
 * Used by admin interface and project save workflows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ContentChangeDetector from '@/lib/content/ContentChangeDetector';
import ChangeDetectionIntegration from '@/lib/content/ChangeDetectionIntegration';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

/**
 * POST /api/admin/semantic/detect-changes
 * Detect changes in project content
 */
export async function POST(request: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectId, content, previousHash, triggerMode = 'manual' } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const integration = ChangeDetectionIntegration.getInstance();

    let detection;
    
    if (triggerMode === 'save-hook') {
      // Called from project save workflow
      const hookResult = await integration.onProjectSave({
        projectId,
        newContent: content,
        userId: (user as any).id,
        saveMode: body.saveMode || 'publish',
        skipChangeDetection: body.skipChangeDetection
      });

      return NextResponse.json({
        success: true,
        shouldProceed: hookResult.shouldProceed,
        userPromptRequired: hookResult.userPromptRequired,
        detection: hookResult.detection,
        estimatedCost: hookResult.estimatedCost,
        recommendedAction: hookResult.recommendedAction
      });
    } else {
      // Manual trigger
      if (content) {
        const detector = new ContentChangeDetector();
        detection = await detector.detectChanges(projectId, content, previousHash);
      } else {
        detection = await integration.triggerChangeDetection(projectId);
      }
    }

    return NextResponse.json({
      success: true,
      detection: {
        projectId: detection.projectId,
        changeScope: detection.changeScope,
        sectionChanges: detection.sectionChanges,
        affectedSections: detection.affectedSections,
        affectedChunks: detection.affectedChunks,
        recommendedAction: detection.recommendedAction,
        estimatedCost: detection.estimatedCost,
        estimatedTokens: detection.estimatedTokens,
        metrics: detection.metrics,
        detectedAt: detection.detectedAt
      }
    });

  } catch (error) {
    console.error('Change detection API error:', error);
    return NextResponse.json(
      { 
        error: 'Change detection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/semantic/detect-changes?projectId=xxx
 * Get change detection status for a project
 */
export async function GET(request: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const integration = ChangeDetectionIntegration.getInstance();
    const status = await integration.getChangeDetectionStatus(projectId);

    return NextResponse.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Change detection status API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get change detection status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}