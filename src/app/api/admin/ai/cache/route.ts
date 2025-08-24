import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AIStatusCache } from '@/lib/ai/status-cache';

/**
 * Get AI cache status and statistics
 * Useful for monitoring and debugging cache performance
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }
      }, { status: 401 });
    }

    const cache = AIStatusCache.getInstance();
    
    const stats = cache.getStats();
    const config = cache.getConfig();
    const size = cache.getCacheSize();
    const entries = cache.getCacheEntries();
    
    return NextResponse.json({
      success: true,
      data: {
        statistics: stats,
        configuration: config,
        size,
        entries: entries.map(entry => ({
          provider: entry.provider,
          configured: entry.status.configured,
          connected: entry.status.connected,
          modelCount: entry.status.models.length,
          cached: entry.cached,
          expires: entry.expires,
          timeUntilExpiration: entry.timeUntilExpiration,
          isExpired: entry.isExpired,
          error: entry.status.error
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching AI cache status:', error);
    return NextResponse.json({
      success: false,
      error: { 
        message: 'Failed to fetch AI cache status',
        code: 'CACHE_STATUS_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

/**
 * Clear AI cache
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }
      }, { status: 401 });
    }

    const cache = AIStatusCache.getInstance();
    cache.clear();
    
    return NextResponse.json({
      success: true,
      message: 'AI cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing AI cache:', error);
    return NextResponse.json({
      success: false,
      error: { 
        message: 'Failed to clear AI cache',
        code: 'CACHE_CLEAR_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}