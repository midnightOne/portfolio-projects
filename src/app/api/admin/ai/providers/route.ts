import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AIServiceManager } from '@/lib/ai/service-manager';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' }
      }, { status: 401 });
    }

    const aiService = new AIServiceManager();
    
    // Initialize model configurations
    await aiService.initializeModelConfigurations();
    
    // Get provider statuses
    const providers = await aiService.getAvailableProviders();
    
    return NextResponse.json({
      success: true,
      data: providers
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