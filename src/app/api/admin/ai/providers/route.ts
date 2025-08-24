import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AIServiceManager } from '@/lib/ai/service-manager';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const aiService = new AIServiceManager();
    
    // Initialize model configurations
    await aiService.initializeModelConfigurations();
    
    // Get provider statuses (with caching unless refresh is requested)
    const providers = await aiService.getAvailableProviders(forceRefresh);
    
    // Include cache statistics in response for debugging
    const cacheStats = aiService.getCacheStats();
    
    return NextResponse.json({
      success: true,
      data: providers,
      meta: {
        cached: !forceRefresh,
        cacheStats: process.env.NODE_ENV === 'development' ? cacheStats : undefined
      }
    });
  } catch (error) {
    console.error('Error fetching AI providers:', error);
    return NextResponse.json({
      success: false,
      error: { 
        message: 'Failed to fetch AI providers',
        code: 'FETCH_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}