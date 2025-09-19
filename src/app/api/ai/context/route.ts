/**
 * AI Context API Route
 * 
 * Provides dynamic context loading for voice agents based on queries and access control.
 * Filters context based on reflink permissions and access levels.
 */

import { NextRequest, NextResponse } from 'next/server';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';

interface ContextRequest {
  query: string;
  contextType?: 'projects' | 'profile' | 'skills' | 'experience';
  reflinkId?: string;
  accessLevel?: 'basic' | 'limited' | 'premium';
}

interface ContextResponse {
  context: any;
  sources: string[];
  accessLevel: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContextRequest = await request.json();
    const { query, contextType, reflinkId, accessLevel = 'basic' } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Emit debug event for context request
    const sessionId = (body as any).sessionId || `context-${Date.now()}`;
    const sources = (body as any).sources || ['projects', 'profile'];
    debugEventEmitter.emitContextRequest(query, sources, sessionId);

    // TODO: Implement actual context loading from ContextProviderService
    // TODO: Apply access control based on reflink permissions
    // TODO: Filter context based on access level

    // Mock context response for now
    const mockContext = {
      query,
      contextType: contextType || 'general',
      results: [
        {
          type: 'project',
          title: 'Sample Project',
          description: 'This is a sample project description that matches your query.',
          relevance: 0.85,
          tags: ['react', 'typescript', 'nextjs']
        },
        {
          type: 'skill',
          name: 'React Development',
          description: 'Extensive experience with React and modern frontend development.',
          relevance: 0.92,
          yearsExperience: 5
        }
      ],
      totalResults: 2,
      processingTime: '45ms'
    };

    const response: ContextResponse = {
      context: mockContext,
      sources: ['projects', 'profile', 'skills'],
      accessLevel: accessLevel,
      timestamp: new Date().toISOString()
    };

    // TODO: Log context request for analytics
    console.log(`Context loaded for query: "${query}" (${contextType || 'general'})`);

    // Emit debug event for context loaded
    const contextString = JSON.stringify(mockContext);
    const tokenCount = Math.ceil(contextString.length / 4); // Rough token estimate
    debugEventEmitter.emitContextLoaded(contextString, tokenCount, 45);

    return NextResponse.json({
      success: true,
      data: {
        context: contextString, // Always return as string
        tokenCount,
        processingTime: 45,
        fromCache: false,
        sources: response.sources,
        accessLevel: response.accessLevel,
        timestamp: response.timestamp
      }
    });

  } catch (error) {
    console.error('Error loading context:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const contextType = searchParams.get('contextType') as 'projects' | 'profile' | 'skills' | 'experience' | null;

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Handle GET request similar to POST
    const mockContext = {
      query,
      contextType: contextType || 'general',
      results: [
        {
          type: 'project',
          title: 'Sample Project',
          description: 'This is a sample project description that matches your query.',
          relevance: 0.85,
          tags: ['react', 'typescript', 'nextjs']
        }
      ],
      totalResults: 1,
      processingTime: '32ms'
    };

    const contextString = JSON.stringify(mockContext);
    const tokenCount = Math.ceil(contextString.length / 4);

    return NextResponse.json({
      success: true,
      data: {
        context: contextString, // Always return as string
        tokenCount,
        processingTime: 32,
        fromCache: false,
        sources: ['projects', 'profile'],
        accessLevel: 'basic',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error loading context:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}