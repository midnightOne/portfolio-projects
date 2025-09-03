import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '7d';
    const provider = searchParams.get('provider') || 'all';
    const format = searchParams.get('format') || 'csv';

    // Generate mock CSV data for export
    const csvData = [
      'Date,Provider,Sessions,Minutes,Cost,Average Latency,Error Rate',
      '2025-01-01,openai,25,120.5,0.6025,185,0.02',
      '2025-01-01,elevenlabs,18,95.2,0.6664,275,0.03',
      '2025-01-02,openai,32,145.8,0.729,192,0.015',
      '2025-01-02,elevenlabs,22,108.4,0.7588,268,0.025',
      '2025-01-03,openai,28,132.1,0.6605,178,0.018',
      '2025-01-03,elevenlabs,19,98.7,0.6909,282,0.032'
    ].join('\n');

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="voice-analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });

  } catch (error) {
    console.error('Voice analytics export API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}