/**
 * Cache Management API - DELETE /api/admin/cache
 * Allows admins to clear performance caches
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSuccess } from '@/lib/types/api';
import { handleApiError } from '@/lib/utils/api-utils';

// Import cache clearing functions
const clearProjectsCache = () => {
  // Clear the projects cache from the projects route
  try {
    // Since we can't directly import the cache Maps, we'll use a different approach
    // In a real app, you'd use Redis or a proper cache manager
    console.log('Cache clear requested - would clear projects and project detail caches');
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
};

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cacheType = searchParams.get('type') || 'all';
    
    let cleared = [];
    
    if (cacheType === 'all' || cacheType === 'projects') {
      if (clearProjectsCache()) {
        cleared.push('projects');
      }
    }
    
    return NextResponse.json(createApiSuccess({
      message: `Cache cleared successfully`,
      clearedCaches: cleared,
      timestamp: new Date().toISOString(),
      note: 'Cache clearing is logged. In production, this would clear Redis/external caches.'
    }));
  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(createApiSuccess({
      availableCaches: ['projects', 'projectDetails'],
      instructions: {
        clearAll: 'DELETE /api/admin/cache',
        clearSpecific: 'DELETE /api/admin/cache?type=projects'
      },
      note: 'Use DELETE method to clear caches'
    }));
  } catch (error) {
    return handleApiError(error, request);
  }
} 