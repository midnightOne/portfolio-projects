/**
 * API Route: T3 Generation Diagnostics
 * GET /api/admin/semantic/diagnostics/t3 - Get T3 generation status
 * POST /api/admin/semantic/diagnostics/t3 - Run T3 diagnostic tests
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { getDiagnosticTestSuite } from '@/lib/content/DiagnosticTestSuite';
import { getSemanticLogger } from '@/lib/content/SemanticLogger';
import { prisma } from '@/lib/database/connection';

const logger = getSemanticLogger();

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Get current T3 chunk statistics
    const t3Stats = await getT3ChunkStatistics(projectId ?? undefined);
    
    // Get recent T3-related logs
    const recentT3Logs = logger.getRecentLogs(20, 'info', 'T3Generation');

    // Check for recent T3 generation attempts
    const recentAttempts = recentT3Logs.filter(log => 
      log.operation === 'generate' && 
      log.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    return NextResponse.json({
      t3Statistics: t3Stats,
      recentActivity: {
        generationAttempts: recentAttempts.length,
        lastGeneration: recentAttempts.length > 0 ? recentAttempts[recentAttempts.length - 1].timestamp : null,
        recentLogs: recentT3Logs.slice(-5).map(log => ({
          timestamp: log.timestamp,
          message: log.message,
          context: log.context
        }))
      },
      systemStatus: {
        t3GenerationWorking: recentAttempts.some(attempt => 
          attempt.context.chunksGenerated > 0
        ),
        lastSuccessfulGeneration: recentAttempts.find(attempt => 
          attempt.context.chunksGenerated > 0
        )?.timestamp || null
      }
    });

  } catch (error) {
    logger.error('T3DiagnosticAPI', 'GET', 'Failed to get T3 diagnostic status', {
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { 
        error: 'Failed to get T3 diagnostic status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectId, verbose = true, includeAnalysis = true } = body;

    logger.info('T3DiagnosticAPI', 'POST', 'Starting T3 diagnostic', {
      projectId,
      verbose,
      includeAnalysis
    });

    const diagnosticSuite = getDiagnosticTestSuite();

    // Run T3-focused diagnostic
    const t3Diagnosis = await diagnosticSuite.diagnoseT3Issues(projectId);

    // Get detailed analysis if requested
    let detailedAnalysis = null;
    if (includeAnalysis) {
      detailedAnalysis = await performDetailedT3Analysis(projectId);
    }

    // Get current T3 statistics
    const currentStats = await getT3ChunkStatistics(projectId);

    const result = {
      diagnosis: t3Diagnosis,
      currentStatistics: currentStats,
      detailedAnalysis,
      recommendations: generateT3Recommendations(t3Diagnosis, detailedAnalysis),
      timestamp: new Date().toISOString()
    };

    logger.info('T3DiagnosticAPI', 'POST', 'T3 diagnostic completed', {
      projectId,
      t3Working: t3Diagnosis.t3Working,
      sectionsAnalyzed: t3Diagnosis.sectionsAnalyzed,
      chunksGenerated: t3Diagnosis.chunksGenerated,
      persistenceIssues: t3Diagnosis.persistenceIssues.length
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('T3DiagnosticAPI', 'POST', 'T3 diagnostic failed', {
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { 
        error: 'T3 diagnostic failed',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Get T3 chunk statistics
 */
async function getT3ChunkStatistics(projectId?: string): Promise<{
  totalT3Chunks: number;
  t3ChunksByProject: Array<{ projectSlug: string; count: number }>;
  averageT3ChunksPerProject: number;
  recentT3Chunks: number; // Last 24 hours
  tierDistribution: Record<number, number>;
}> {
  try {
    // Get total T3 chunks
    const totalT3Chunks = await prisma.contextChunk.count({
      where: { tier: 3 }
    });

    // Get T3 chunks by project
    const t3ChunksByProjectRaw = await prisma.contextChunk.groupBy({
      by: ['entityId'],
      where: { tier: 3 },
      _count: { id: true }
    });

    // Get entity slugs separately
    const entityIds = t3ChunksByProjectRaw.map(item => item.entityId);
    const entities = await prisma.contentEntity.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, slug: true }
    });

    const t3ChunksByProject = t3ChunksByProjectRaw.map(item => ({
      ...item,
      entity: entities.find(e => e.id === item.entityId)
    }));

    // Get recent T3 chunks (last 24 hours)
    const recentT3Chunks = await prisma.contextChunk.count({
      where: {
        tier: 3,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    // Get tier distribution
    const tierDistribution = await prisma.contextChunk.groupBy({
      by: ['tier'],
      _count: { id: true }
    });

    const tierDistributionMap = tierDistribution.reduce((acc, item) => {
      acc[item.tier] = item._count.id;
      return acc;
    }, {} as Record<number, number>);

    // Calculate average T3 chunks per project
    const totalProjects = await prisma.contentEntity.count({
      where: { entityType: 'PROJECT' }
    });
    const averageT3ChunksPerProject = totalProjects > 0 ? totalT3Chunks / totalProjects : 0;

    return {
      totalT3Chunks,
      t3ChunksByProject: t3ChunksByProject.map(item => ({
        projectSlug: item.entity?.slug || 'unknown',
        count: item._count.id
      })),
      averageT3ChunksPerProject,
      recentT3Chunks,
      tierDistribution: tierDistributionMap
    };

  } catch (error) {
    logger.error('T3DiagnosticAPI', 'getT3ChunkStatistics', 'Failed to get T3 statistics', {
      projectId,
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : undefined);

    return {
      totalT3Chunks: 0,
      t3ChunksByProject: [],
      averageT3ChunksPerProject: 0,
      recentT3Chunks: 0,
      tierDistribution: {}
    };
  }
}

/**
 * Perform detailed T3 analysis
 */
async function performDetailedT3Analysis(projectId?: string): Promise<{
  sectionAnalysis: {
    totalSections: number;
    contentSections: number;
    shortSections: number;
    emptySections: number;
  };
  chunkAnalysis: {
    validT3Chunks: number;
    invalidT3Chunks: number;
    averageChunkSize: number;
    sectionBoundedChunks: number;
  };
  persistenceAnalysis: {
    chunksWithValidEntities: number;
    orphanedChunks: number;
    foreignKeyIssues: number;
  };
  performanceAnalysis: {
    averageGenerationTime: number;
    slowGenerations: number;
    failedGenerations: number;
  };
}> {
  try {
    // Analyze sections (this would require project indexer integration)
    const sectionAnalysis = {
      totalSections: 0,
      contentSections: 0,
      shortSections: 0,
      emptySections: 0
    };

    // Analyze T3 chunks
    const t3Chunks = await prisma.contextChunk.findMany({
      where: { 
        tier: 3,
        ...(projectId && {
          entity: {
            slug: {
              contains: projectId
            }
          }
        })
      },
      include: {
        entity: true
      }
    });

    const validT3Chunks = t3Chunks.filter(chunk => 
      chunk.content && chunk.content.length > 10 && chunk.chunkId
    ).length;

    const sectionBoundedChunks = t3Chunks.filter(chunk => 
      (chunk.metadata as any)?.sectionBounded === true
    ).length;

    const averageChunkSize = t3Chunks.length > 0 
      ? t3Chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / t3Chunks.length 
      : 0;

    const chunkAnalysis = {
      validT3Chunks,
      invalidT3Chunks: t3Chunks.length - validT3Chunks,
      averageChunkSize,
      sectionBoundedChunks
    };

    // Analyze persistence
    const chunksWithValidEntities = t3Chunks.filter(chunk => chunk.entity).length;
    const orphanedChunks = t3Chunks.length - chunksWithValidEntities;

    const persistenceAnalysis = {
      chunksWithValidEntities,
      orphanedChunks,
      foreignKeyIssues: orphanedChunks // Simplified - orphaned chunks indicate FK issues
    };

    // Analyze performance (simplified - would need actual timing data)
    const performanceAnalysis = {
      averageGenerationTime: 0, // Would need to track this
      slowGenerations: 0,
      failedGenerations: 0
    };

    return {
      sectionAnalysis,
      chunkAnalysis,
      persistenceAnalysis,
      performanceAnalysis
    };

  } catch (error) {
    logger.error('T3DiagnosticAPI', 'performDetailedT3Analysis', 'Failed to perform detailed analysis', {
      projectId,
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : undefined);

    return {
      sectionAnalysis: { totalSections: 0, contentSections: 0, shortSections: 0, emptySections: 0 },
      chunkAnalysis: { validT3Chunks: 0, invalidT3Chunks: 0, averageChunkSize: 0, sectionBoundedChunks: 0 },
      persistenceAnalysis: { chunksWithValidEntities: 0, orphanedChunks: 0, foreignKeyIssues: 0 },
      performanceAnalysis: { averageGenerationTime: 0, slowGenerations: 0, failedGenerations: 0 }
    };
  }
}

/**
 * Generate T3-specific recommendations
 */
function generateT3Recommendations(
  diagnosis: any,
  analysis: any
): string[] {
  const recommendations: string[] = [];

  // T3 generation issues
  if (!diagnosis.t3Working) {
    recommendations.push('T3 generation is not working - check SmartContentGenerator implementation');
    recommendations.push('Verify section filtering logic in generateT3HeadingBoundedChunks method');
  }

  if (diagnosis.sectionsAnalyzed === 0) {
    recommendations.push('No sections found for analysis - check project indexer functionality');
    recommendations.push('Ensure projects have content sections with sufficient text');
  }

  if (diagnosis.chunksGenerated === 0 && diagnosis.sectionsAnalyzed > 0) {
    recommendations.push('Sections found but no T3 chunks generated - check section filtering criteria');
    recommendations.push('Review minimum content length requirements for T3 generation');
  }

  // Persistence issues
  if (diagnosis.persistenceIssues.length > 0) {
    recommendations.push('T3 chunks are not persisting properly - check VectorOperations implementation');
    recommendations.push('Verify database foreign key constraints and entity relationships');
    recommendations.push('Check for premature chunk cleanup operations');
  }

  // Analysis-based recommendations
  if (analysis) {
    if (analysis.chunkAnalysis.invalidT3Chunks > 0) {
      recommendations.push('Invalid T3 chunks detected - review chunk validation logic');
      recommendations.push('Ensure T3 chunks maintain section boundaries');
    }

    if (analysis.persistenceAnalysis.orphanedChunks > 0) {
      recommendations.push('Orphaned chunks found - clean up invalid entity references');
      recommendations.push('Implement proper foreign key constraint handling');
    }

    if (analysis.chunkAnalysis.sectionBoundedChunks < analysis.chunkAnalysis.validT3Chunks) {
      recommendations.push('Some T3 chunks are not section-bounded - fix heading boundary compliance');
    }
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push('T3 generation appears to be working correctly');
    recommendations.push('Consider running performance benchmarks to optimize generation speed');
  }

  return recommendations;
}