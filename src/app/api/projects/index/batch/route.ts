/**
 * Batch Project Indexing API - POST /api/projects/index/batch
 * Indexes multiple projects for AI context management
 * Used by the Client-Side AI Assistant system for bulk operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { projectIndexer } from '@/lib/services/project-indexer';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

interface BatchIndexRequest {
  projectIds?: string[];
  projectSlugs?: string[];
  forceReindex?: boolean;
  includeContent?: boolean;
  includeSections?: boolean;
  includeMedia?: boolean;
}

async function batchIndexHandler(request: NextRequest) {
  try {
    const body: BatchIndexRequest = await request.json();
    const {
      projectIds = [],
      projectSlugs = [],
      forceReindex = false,
      includeContent = false,
      includeSections = true,
      includeMedia = true
    } = body;

    // Validate request
    if (projectIds.length === 0 && projectSlugs.length === 0) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Either projectIds or projectSlugs must be provided',
          null,
          request.url
        ),
        { status: 400 }
      );
    }

    // Limit batch size to prevent overload
    const maxBatchSize = 20;
    const totalRequested = projectIds.length + projectSlugs.length;
    if (totalRequested > maxBatchSize) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          `Batch size too large. Maximum ${maxBatchSize} projects allowed per request.`,
          { requested: totalRequested, maximum: maxBatchSize },
          request.url
        ),
        { status: 400 }
      );
    }

    // Resolve project IDs from slugs
    let allProjectIds = [...projectIds];
    
    if (projectSlugs.length > 0) {
      const projectsFromSlugs = await prisma.project.findMany({
        where: {
          slug: { in: projectSlugs },
          status: 'PUBLISHED',
          visibility: 'PUBLIC'
        },
        select: { id: true, slug: true }
      });

      const foundSlugs = projectsFromSlugs.map(p => p.slug);
      const missingSlugs = projectSlugs.filter(slug => !foundSlugs.includes(slug));
      
      if (missingSlugs.length > 0) {
        console.warn(`Projects not found for slugs: ${missingSlugs.join(', ')}`);
      }

      allProjectIds.push(...projectsFromSlugs.map(p => p.id));
    }

    // Remove duplicates
    allProjectIds = Array.from(new Set(allProjectIds));

    if (allProjectIds.length === 0) {
      return NextResponse.json(
        createApiError(
          'NOT_FOUND',
          'No valid projects found for indexing',
          null,
          request.url
        ),
        { status: 404 }
      );
    }

    // Clear cache if force reindex is requested
    if (forceReindex) {
      allProjectIds.forEach(id => projectIndexer.clearProjectCache(id));
    }

    // Index projects in parallel (with concurrency limit)
    const concurrencyLimit = 5;
    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < allProjectIds.length; i += concurrencyLimit) {
      const batch = allProjectIds.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (projectId) => {
        try {
          const startTime = Date.now();
          
          // Index the project
          const projectIndex = await projectIndexer.indexProject(projectId);
          const projectSummary = await projectIndexer.getProjectSummary(projectId);
          
          const indexingTime = Date.now() - startTime;

          // Build result object
          const result: any = {
            projectId,
            success: true,
            indexingTime,
            lastUpdated: projectIndex.lastUpdated,
            contentHash: projectIndex.contentHash,
            summary: projectIndex.summary,
            keywords: projectIndex.keywords,
            topics: projectIndex.topics,
            technologies: projectIndex.technologies,
            metadata: {
              sectionsCount: projectIndex.sections.length,
              mediaItemsCount: projectIndex.mediaContext.length
            }
          };

          // Include detailed summary if available
          if (projectSummary) {
            result.detailedSummary = {
              briefSummary: projectSummary.briefSummary,
              keyTechnologies: projectSummary.keyTechnologies,
              mainTopics: projectSummary.mainTopics,
              contentStructure: projectSummary.contentStructure,
              mediaOverview: projectSummary.mediaOverview
            };
          }

          // Include sections if requested
          if (includeSections) {
            result.sections = projectIndex.sections.map(section => ({
              id: section.id,
              title: section.title,
              summary: section.summary,
              keywords: section.keywords,
              importance: section.importance,
              nodeType: section.nodeType,
              depth: section.depth,
              ...(includeContent && {
                content: section.content,
                markdownContent: section.markdownContent
              })
            }));
          }

          // Include media context if requested
          if (includeMedia) {
            result.mediaContext = projectIndex.mediaContext.map(media => ({
              id: media.id,
              type: media.type,
              title: media.title,
              description: media.description,
              context: media.context,
              relevanceScore: media.relevanceScore,
              ...(media.url && { url: media.url }),
              ...(media.altText && { altText: media.altText })
            }));
          }

          return result;

        } catch (error) {
          console.error(`Error indexing project ${projectId}:`, error);
          return {
            projectId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            indexingTime: 0
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Separate successful results from errors
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });
    }

    // Calculate statistics
    const totalIndexingTime = results.reduce((sum, r) => sum + r.indexingTime, 0);
    const avgIndexingTime = results.length > 0 ? totalIndexingTime / results.length : 0;

    const responseData = {
      results,
      errors,
      statistics: {
        totalProjects: allProjectIds.length,
        successfulIndexes: results.length,
        failedIndexes: errors.length,
        totalIndexingTime,
        averageIndexingTime: Math.round(avgIndexingTime),
        cacheStatus: forceReindex ? 'refreshed' : 'cached'
      }
    };

    // Return partial success if some projects failed
    const status = errors.length > 0 && results.length === 0 ? 500 : 200;
    
    const response = NextResponse.json(createApiSuccess(responseData), { status });
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const POST = withPerformanceTracking(batchIndexHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}