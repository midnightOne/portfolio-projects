/**
 * Project Indexing API - GET /api/projects/[slug]/index
 * Provides AI-optimized project indexes and summaries for context management
 * Used by the Client-Side AI Assistant system
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { projectIndexer } from '@/lib/services/project-indexer';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

interface RouteParams {
  params: {
    slug: string;
  };
}

async function indexHandler(request: NextRequest, { params }: RouteParams) {
  const { slug } = params;
  const { searchParams } = new URL(request.url);

  // Query parameters
  const includeContent = searchParams.get('includeContent') === 'true';
  const includeSections = searchParams.get('includeSections') === 'true';
  const includeMedia = searchParams.get('includeMedia') === 'true';
  const forceReindex = searchParams.get('forceReindex') === 'true';

  try {
    // Find project by slug
    const project = await prisma.project.findUnique({
      where: {
        slug,
        status: 'PUBLISHED',
        visibility: 'PUBLIC'
      },
      select: {
        id: true,
        title: true,
        slug: true,
        updatedAt: true
      }
    });

    if (!project) {
      return NextResponse.json(
        createApiError(
          'NOT_FOUND',
          'Project not found or not publicly accessible',
          null,
          request.url
        ),
        { status: 404 }
      );
    }

    // Clear cache if force reindex is requested
    if (forceReindex) {
      projectIndexer.clearProjectCache(project.id);
    }

    // Get project index
    const projectIndex = await projectIndexer.indexProject(project.id);

    // Get project summary
    const projectSummary = await projectIndexer.getProjectSummary(project.id);

    // Build response based on requested data
    const responseData: any = {
      projectId: project.id,
      slug: project.slug,
      title: project.title,
      lastUpdated: projectIndex.lastUpdated,
      contentHash: projectIndex.contentHash,
      summary: projectIndex.summary,
      keywords: projectIndex.keywords,
      topics: projectIndex.topics,
      technologies: projectIndex.technologies
    };

    // Include detailed summary if available
    if (projectSummary) {
      responseData.detailedSummary = {
        briefSummary: projectSummary.briefSummary,
        keyTechnologies: projectSummary.keyTechnologies,
        mainTopics: projectSummary.mainTopics,
        contentStructure: projectSummary.contentStructure,
        mediaOverview: projectSummary.mediaOverview
      };
    }

    // Include sections if requested
    if (includeSections) {
      responseData.sections = projectIndex.sections.map(section => ({
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
      responseData.mediaContext = projectIndex.mediaContext.map(media => ({
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

    // Add metadata
    responseData.metadata = {
      sectionsCount: projectIndex.sections.length,
      mediaItemsCount: projectIndex.mediaContext.length,
      indexingTime: projectIndex.lastUpdated,
      cacheStatus: forceReindex ? 'refreshed' : 'cached'
    };

    const response = NextResponse.json(createApiSuccess(responseData));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const GET = withPerformanceTracking(indexHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}