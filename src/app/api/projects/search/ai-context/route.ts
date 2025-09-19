/**
 * AI Context Search API - GET /api/projects/search/ai-context
 * Searches indexed project content for AI context building
 * Used by the Client-Side AI Assistant system
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/connection';
import { projectIndexer } from '@/lib/services/project-indexer';
import { createApiError, createApiSuccess } from '@/lib/types/api';
import { handleApiError, addCorsHeaders } from '@/lib/utils/api-utils';
import { withPerformanceTracking } from '@/lib/utils/performance';

async function aiContextSearchHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Query parameters
  const query = searchParams.get('query');
  const projectIds = searchParams.get('projectIds')?.split(',').filter(Boolean) || [];
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const includeContent = searchParams.get('includeContent') === 'true';
  const includeMarkdown = searchParams.get('includeMarkdown') === 'true';
  const minRelevance = parseFloat(searchParams.get('minRelevance') || '0.1');

  try {
    // Validate query
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Query must be at least 2 characters long',
          null,
          request.url
        ),
        { status: 400 }
      );
    }

    // Get all public projects if no specific projects requested
    let targetProjectIds = projectIds;
    
    if (targetProjectIds.length === 0) {
      const publicProjects = await prisma.project.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC'
        },
        select: { id: true },
        take: 100 // Limit to prevent excessive processing
      });
      
      targetProjectIds = publicProjects.map(p => p.id);
    } else {
      // Validate that requested projects are public
      const validProjects = await prisma.project.findMany({
        where: {
          id: { in: targetProjectIds },
          status: 'PUBLISHED',
          visibility: 'PUBLIC'
        },
        select: { id: true }
      });
      
      targetProjectIds = validProjects.map(p => p.id);
    }

    if (targetProjectIds.length === 0) {
      return NextResponse.json(
        createApiSuccess({
          results: [],
          query: query.trim(),
          totalResults: 0,
          searchTime: 0,
          projectsSearched: 0
        })
      );
    }

    const startTime = Date.now();

    // Search relevant content using the indexer
    const relevantSections = await projectIndexer.searchRelevantContent(
      targetProjectIds,
      query.trim(),
      limit
    );

    // Filter by minimum relevance if specified
    const filteredSections = relevantSections.filter(section => {
      // Calculate a simple relevance score based on query match
      const queryTerms = query.toLowerCase().split(/\s+/);
      const content = (section.title + ' ' + section.content + ' ' + section.keywords.join(' ')).toLowerCase();
      
      let relevanceScore = 0;
      queryTerms.forEach(term => {
        if (section.title.toLowerCase().includes(term)) relevanceScore += 0.5;
        if (section.keywords.some(keyword => keyword.includes(term))) relevanceScore += 0.3;
        const termCount = (content.match(new RegExp(term, 'g')) || []).length;
        relevanceScore += Math.min(termCount * 0.1, 0.4);
      });
      
      return relevanceScore >= minRelevance;
    });

    // Get project information for the results
    const projectsInResults = Array.from(new Set(filteredSections.map(s => 
      // We need to get project ID from the section somehow
      // For now, we'll fetch it from the database
      targetProjectIds.find(id => id) // This is a placeholder - we need to track projectId in sections
    ))).filter(Boolean);

    const projectsInfo = await prisma.project.findMany({
      where: { id: { in: targetProjectIds } },
      select: {
        id: true,
        title: true,
        slug: true,
        briefOverview: true,
        tags: { select: { name: true } }
      }
    });

    const projectsMap = new Map(projectsInfo.map(p => [p.id, p]));

    // Build response
    const results = filteredSections.map(section => {
      // Find the project this section belongs to
      // This is a limitation of the current implementation - we need to track projectId in sections
      const projectInfo = projectsInfo[0]; // Placeholder - need to fix this
      
      return {
        sectionId: section.id,
        title: section.title,
        summary: section.summary,
        keywords: section.keywords,
        importance: section.importance,
        nodeType: section.nodeType,
        depth: section.depth,
        project: projectInfo ? {
          id: projectInfo.id,
          title: projectInfo.title,
          slug: projectInfo.slug,
          briefOverview: projectInfo.briefOverview,
          tags: projectInfo.tags.map(t => t.name)
        } : null,
        ...(includeContent && { content: section.content }),
        ...(includeMarkdown && { markdownContent: section.markdownContent })
      };
    });

    const searchTime = Date.now() - startTime;

    const responseData = {
      results,
      query: query.trim(),
      totalResults: results.length,
      searchTime,
      projectsSearched: targetProjectIds.length,
      parameters: {
        limit,
        minRelevance,
        includeContent,
        includeMarkdown
      }
    };

    const response = NextResponse.json(createApiSuccess(responseData));
    return addCorsHeaders(response);

  } catch (error) {
    return handleApiError(error, request);
  }
}

export const GET = withPerformanceTracking(aiContextSearchHandler);

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}