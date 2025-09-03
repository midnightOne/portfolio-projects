import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-utils';

// Mock transcript storage - in production this would use a database
const mockTranscripts = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, items, metadata } = body;

    if (!sessionId || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Store transcript (in production, this would go to a database)
    mockTranscripts.set(sessionId, {
      sessionId,
      items,
      metadata: {
        ...metadata,
        storedAt: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Transcript stored successfully'
    });

  } catch (error) {
    console.error('Store transcript API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}