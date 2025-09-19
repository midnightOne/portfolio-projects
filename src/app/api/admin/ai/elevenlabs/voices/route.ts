import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEnvironmentVariable } from '@/types/voice-config';

// GET /api/admin/ai/elevenlabs/voices - List ElevenLabs voices
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

    // Fetch voices from ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
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
            message: 'Failed to fetch ElevenLabs voices',
            details: errorData.detail?.message || `HTTP ${response.status}: ${response.statusText}`
          } 
        },
        { status: response.status }
      );
    }

    const voicesData = await response.json();
    
    // Transform voice data for frontend
    const voices = (voicesData.voices || []).map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name,
      description: voice.description || 'No description available',
      category: voice.category || 'Unknown',
      labels: voice.labels || {},
      previewUrl: voice.preview_url,
      availableForTiers: voice.available_for_tiers || [],
      settings: voice.settings,
      sharing: voice.sharing,
      highQualityBaseModelIds: voice.high_quality_base_model_ids || []
    }));

    // Sort voices by name for better UX
    voices.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      data: voices
    });

  } catch (error) {
    console.error('Failed to fetch ElevenLabs voices:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to fetch ElevenLabs voices',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}