/**
 * Admin Cache Management API - DELETE /api/admin/cache
 * Provides cache clearing functionality for performance optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { addCorsHeaders } from '@/lib/utils/api-utils';

// Import cache instances from API routes
// Note: In a production app, you'd want a more centralized cache management system
let projectsCache: Map<string, any> | null = null;
let projectDetailCache: Map<string, any> | null = null;

// Function to get cache references (would be better implemented with a cache manager)
function getCacheReferences() {
  try {
    // This is a simplified approach - in production you'd use Redis or a proper cache manager
    const projectsModule = require('@/app/api/projects/route');
    const projectDetailModule = require('@/app/api/projects/[slug]/route');
    
    // Access cache instances if they exist
    projectsCache = (projectsModule as any).projectsCache || null;
    projectDetailCache = (projectDetailModule as any).projectDetailCache || null;
  } catch (error) {
    console.warn('Could not access cache references:', error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    getCacheReferences();

    let clearedCaches = [];
    let totalCleared = 0;

    // Clear specific cache type or all caches
    if (!type || type === 'projects') {
      if (projectsCache) {
        const size = projectsCache.size;
        projectsCache.clear();
        clearedCaches.push(`projects (${size} entries)`);
        totalCleared += size;
      }
    }

    if (!type || type === 'projectDetails') {
      if (projectDetailCache) {
        const size = projectDetailCache.size;
        projectDetailCache.clear();
        clearedCaches.push(`project details (${size} entries)`);
        totalCleared += size;
      }
    }

    // Clear all caches if no specific type requested
    if (!type) {
      // Add any other cache clearing logic here
      clearedCaches.push('all application caches');
    }

    const response = NextResponse.json(createApiSuccess({
      message: 'Cache cleared successfully',
      clearedCaches,
      totalEntriesCleared: totalCleared,
      timestamp: new Date().toISOString(),
    }));
    
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Cache clear error:', error);
    
    const response = NextResponse.json(
      createApiError(
        'CACHE_CLEAR_ERROR',
        'Failed to clear cache',
        error instanceof Error ? error.message : 'Unknown error',
        request.url
      ),
      { status: 500 }
    );
    
    return addCorsHeaders(response);
  }
}

export async function GET(request: NextRequest) {
  try {
    getCacheReferences();

    const cacheStats = {
      projects: {
        size: projectsCache?.size || 0,
        available: !!projectsCache,
      },
      projectDetails: {
        size: projectDetailCache?.size || 0,
        available: !!projectDetailCache,
      },
      timestamp: new Date().toISOString(),
    };

    const response = NextResponse.json(createApiSuccess(cacheStats));
    return addCorsHeaders(response);

  } catch (error) {
    console.error('Cache stats error:', error);
    
    const response = NextResponse.json(
      createApiError(
        'CACHE_STATS_ERROR',
        'Failed to retrieve cache statistics',
        error instanceof Error ? error.message : 'Unknown error',
        request.url
      ),
      { status: 500 }
    );
    
    return addCorsHeaders(response);
  }
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response);
}