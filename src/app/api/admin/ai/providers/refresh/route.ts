import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AIServiceManager } from '@/lib/ai/service-manager';

/**
 * Force refresh AI provider status
 * This endpoint bypasses all caching and performs fresh connection tests
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }
      }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { provider } = body; // Optional: refresh specific provider

    const aiService = new AIServiceManager();
    
    // Initialize model configurations
    await aiService.initializeModelConfigurations();
    
    // Force refresh provider status (bypasses cache)
    const providers = await aiService.refreshProviderStatus(provider);
    
    // Get cache statistics
    const cacheStats = aiService.getCacheStats();
    
    return NextResponse.json({
      success: true,
      data: providers,
      meta: {
        refreshed: true,
        refreshedProvider: provider || 'all',
        timestamp: new Date().toISOString(),
        cacheStats: process.env.NODE_ENV === 'development' ? cacheStats : undefined
      }
    });
  } catch (error) {
    console.error('Error refreshing AI providers:', error);
    return NextResponse.json({
      success: false,
      error: { 
        message: 'Failed to refresh AI providers',
        code: 'REFRESH_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}