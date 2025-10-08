import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IndexMaintenanceService } from '@/lib/database/IndexMaintenanceService';
import { prisma } from '@/lib/database/connection';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const indexMaintenance = IndexMaintenanceService.getInstance(prisma);
    
    console.log('🔧 Force HNSW index rebuild initiated by admin...');
    const startTime = Date.now();
    
    // Force reindex regardless of thresholds
    const results = await indexMaintenance.forceMaintenance('reindex');
    const reindexResult = results[0]; // forceMaintenance returns array
    
    const duration = Date.now() - startTime;
    
    if (reindexResult.success) {
      console.log(`✅ Force HNSW reindex completed in ${duration}ms`);
      
      return NextResponse.json({
        success: true,
        message: 'HNSW vector index rebuilt successfully',
        details: {
          action: reindexResult.action,
          duration: reindexResult.duration,
          stats: reindexResult.stats,
          totalTime: duration
        }
      });
    } else {
      console.error('❌ Force HNSW reindex failed:', reindexResult.message);
      
      return NextResponse.json({
        success: false,
        error: reindexResult.message,
        details: {
          action: reindexResult.action,
          duration: reindexResult.duration
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Force reindex API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const indexMaintenance = IndexMaintenanceService.getInstance(prisma);
    
    // Get current index status and recommendations
    const stats = await indexMaintenance.getIndexStats();
    const recommendations = await indexMaintenance.getMaintenanceRecommendations();
    const indexVerification = await indexMaintenance.verifyIndexes();
    
    return NextResponse.json({
      success: true,
      stats,
      recommendations,
      indexVerification,
      canForceReindex: indexVerification.vectorIndexExists
    });
    
  } catch (error) {
    console.error('Get reindex status API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get index status'
    }, { status: 500 });
  }
}
