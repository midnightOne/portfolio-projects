import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEnvironmentVariable } from '@/types/voice-config';

// GET /api/admin/ai/elevenlabs/agents - List ElevenLabs conversational AI agents
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Get API key from environment
    const apiKey = getEnvironmentVariable('ELEVENLABS_API_KEY');
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'ElevenLabs API key not configured',
            details: 'ELEVENLABS_API_KEY environment variable is not set'
          } 
        },
        { status: 400 }
      );
    }

    // Fetch agents from ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Failed to fetch ElevenLabs agents',
            details: errorData.detail?.message || `HTTP ${response.status}: ${response.statusText}`
          } 
        },
        { status: response.status }
      );
    }

    const agentsData = await response.json();
    
    // Transform agent data for frontend
    const agents = (agentsData.agents || []).map((agent: any) => ({
      id: agent.agent_id,
      name: agent.name || agent.agent_id,
      description: agent.prompt || 'No description available',
      voiceId: agent.voice_id,
      language: agent.language || 'en',
      createdAt: agent.created_at,
      updatedAt: agent.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: agents
    });

  } catch (error) {
    console.error('Failed to fetch ElevenLabs agents:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to fetch ElevenLabs agents',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}