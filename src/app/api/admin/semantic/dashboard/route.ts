/**
 * Semantic Dashboard API
 * 
 * Provides comprehensive metrics for semantic content management:
 * - Vector index health metrics
 * - Project semantic status
 * - Budget status
 * - Cost analytics
 * - Batch job status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

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

    // Fetch vector index health metrics
    const totalChunks = await prisma.contextChunk.count();
    const chunksWithEmbeddings = await prisma.contextChunk.count({
      where: {
        embeddingGeneratedAt: { not: null }
      }
    });

    // Get total projects with semantic indexes
    const totalProjects = await prisma.project.count();
    const projectsWithChunks = await prisma.contextChunk.groupBy({
      by: ['projectIndexId'],
      _count: true
    });

    // Calculate average query time (mock for now - would need actual query logs)
    const averageQueryTime = 45; // ms

    // Get index size estimate
    const indexSizeBytes = totalChunks * 1536 * 4; // Approximate: chunks * dimensions * 4 bytes per float
    const indexSizeMB = (indexSizeBytes / (1024 * 1024)).toFixed(2);

    // Fetch project semantic status
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    const projectStatus = await Promise.all(
      projects.map(async (project) => {
        // Get chunks for this project
        const chunks = await prisma.contextChunk.findMany({
          where: { projectIndexId: project.id },
          select: {
            tier: true,
            embeddingGeneratedAt: true,
            updatedAt: true
          }
        });

        const chunkCount = chunks.length;
        const tierDistribution = chunks.reduce((acc, chunk) => {
          acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        const hasEmbeddings = chunks.some(c => c.embeddingGeneratedAt !== null);
        const allHaveEmbeddings = chunks.length > 0 && chunks.every(c => c.embeddingGeneratedAt !== null);
        
        // Determine health status
        let healthStatus: 'healthy' | 'outdated' | 'incomplete' | 'error';
        if (chunkCount === 0) {
          healthStatus = 'incomplete';
        } else if (!hasEmbeddings) {
          healthStatus = 'error';
        } else if (!allHaveEmbeddings) {
          healthStatus = 'incomplete';
        } else {
          // Check if outdated (more than 7 days old)
          const oldestChunk = chunks.reduce((oldest, chunk) => 
            chunk.updatedAt < oldest ? chunk.updatedAt : oldest, 
            chunks[0]?.updatedAt || new Date()
          );
          const daysSinceUpdate = (Date.now() - oldestChunk.getTime()) / (1000 * 60 * 60 * 24);
          healthStatus = daysSinceUpdate > 7 ? 'outdated' : 'healthy';
        }

        // Get total cost for this project
        const operations = await prisma.semanticOperation.findMany({
          where: { 
            projectId: project.id,
            success: true
          },
          select: { cost: true }
        });
        const totalCost = operations.reduce((sum, op) => sum + Number(op.cost), 0);

        // Get last regeneration time
        const lastRegeneration = await prisma.semanticOperation.findFirst({
          where: {
            projectId: project.id,
            operationType: 'regeneration',
            success: true
          },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true }
        });

        return {
          projectId: project.id,
          title: project.title,
          chunkCount,
          tierDistribution,
          lastRegenerated: lastRegeneration?.completedAt || project.updatedAt,
          totalCost,
          healthStatus
        };
      })
    );

    // Get budget status
    const budgetStatus = await semanticBudgetManager.getActiveBudget();

    // Get cost analytics
    const costBreakdown = await semanticBudgetManager.getCostBreakdown();

    // Get batch job status (placeholder - would integrate with actual batch service)
    const batchJobs = await prisma.semanticOperation.findMany({
      where: {
        operationType: 'embedding',
        metadata: {
          path: ['batchMode'],
          equals: true
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        projectId: true,
        startedAt: true,
        completedAt: true,
        success: true,
        chunksProcessed: true,
        cost: true,
        metadata: true
      }
    });

    const batchJobStatus = batchJobs.map(job => ({
      id: job.id,
      projectId: job.projectId,
      status: job.completedAt 
        ? (job.success ? 'completed' : 'failed')
        : 'in_progress',
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      chunksProcessed: job.chunksProcessed,
      cost: Number(job.cost),
      estimatedSavings: Number(job.cost) * 0.5, // 50% savings with batch mode
      progress: job.metadata && typeof job.metadata === 'object' && 'progress' in job.metadata
        ? (job.metadata as any).progress
        : 100
    }));

    // Construct dashboard metrics
    const dashboardMetrics = {
      vectorIndexHealth: {
        totalProjects,
        indexedProjects: projectsWithChunks.length,
        totalChunks,
        totalEmbeddings: chunksWithEmbeddings,
        averageQueryTime,
        indexSize: `${indexSizeMB} MB`
      },
      budgetStatus: {
        allocated: budgetStatus.allocatedFunds,
        remaining: budgetStatus.remainingFunds,
        percentUsed: budgetStatus.percentUsed * 100,
        warningLevel: budgetStatus.warningLevel
      },
      projectStatus,
      costAnalytics: {
        totalSpent: budgetStatus.totalSpent,
        breakdown: costBreakdown
      },
      batchJobStatus
    };

    return NextResponse.json(dashboardMetrics);
  } catch (error) {
    console.error('Error fetching semantic dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
