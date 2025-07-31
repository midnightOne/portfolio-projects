import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AIService } from '@/lib/services/ai/ai-service';
import { AIServiceFactory } from '@/lib/services/ai/providers';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await AIService.getSettings();
    
    // Don't send API keys to client, just indicate if they're configured
    const safeSettings = {
      ...settings,
      anthropicApiKey: settings.anthropicApiKey ? '***configured***' : null,
      openaiApiKey: settings.openaiApiKey ? '***configured***' : null,
    };

    return NextResponse.json(safeSettings);
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await request.json();
    
    // Validate API keys if provided
    if (updates.anthropicApiKey && updates.anthropicApiKey !== '***configured***') {
      try {
        const provider = AIServiceFactory.createProvider('anthropic', updates.anthropicApiKey);
        const isValid = await provider.validateApiKey(updates.anthropicApiKey);
        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid Anthropic API key' },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to validate Anthropic API key' },
          { status: 400 }
        );
      }
    }

    if (updates.openaiApiKey && updates.openaiApiKey !== '***configured***') {
      try {
        const provider = AIServiceFactory.createProvider('openai', updates.openaiApiKey);
        const isValid = await provider.validateApiKey(updates.openaiApiKey);
        if (!isValid) {
          return NextResponse.json(
            { error: 'Invalid OpenAI API key' },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to validate OpenAI API key' },
          { status: 400 }
        );
      }
    }

    // Don't update API keys if they're the placeholder value
    if (updates.anthropicApiKey === '***configured***') {
      delete updates.anthropicApiKey;
    }
    if (updates.openaiApiKey === '***configured***') {
      delete updates.openaiApiKey;
    }

    const settings = await AIService.updateSettings(updates);
    
    // Return safe settings
    const safeSettings = {
      ...settings,
      anthropicApiKey: settings.anthropicApiKey ? '***configured***' : null,
      openaiApiKey: settings.openaiApiKey ? '***configured***' : null,
    };

    return NextResponse.json(safeSettings);
  } catch (error) {
    console.error('Error updating AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to update AI settings' },
      { status: 500 }
    );
  }
}