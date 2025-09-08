/**
 * Debug Test Monitoring API
 * 
 * Test endpoint to trigger debug events for monitoring system testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType = 'all' } = body;

    const results: any[] = [];

    // Enable debug events
    debugEventEmitter.enable();

    if (testType === 'context' || testType === 'all') {
      // Test context events
      debugEventEmitter.emitContextRequest(
        'Test query for monitoring system',
        ['projects', 'profile'],
        'test-session-monitoring'
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      debugEventEmitter.emitContextLoaded(
        JSON.stringify({
          query: 'Test query for monitoring system',
          results: [
            { type: 'project', title: 'Test Project', relevance: 0.9 }
          ]
        }),
        250,
        85
      );

      results.push({ type: 'context', status: 'triggered' });
    }

    if (testType === 'tools' || testType === 'all') {
      // Test tool call events
      const tools = [
        { name: 'scrollToSection', args: { sectionId: 'projects', smooth: true } },
        { name: 'highlightText', args: { selector: '.project-card', text: 'React', color: 'yellow' } },
        { name: 'openProjectModal', args: { projectId: 'test-project' } }
      ];

      for (const tool of tools) {
        debugEventEmitter.emitToolCallStart(tool.name, tool.args, 'test-session-monitoring');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        debugEventEmitter.emitToolCallComplete(
          tool.name,
          { success: true, data: { executed: true } },
          Math.floor(Math.random() * 200) + 50,
          true
        );

        results.push({ type: 'tool', name: tool.name, status: 'triggered' });
      }
    }

    if (testType === 'voice' || testType === 'all') {
      // Test voice session events
      debugEventEmitter.emitVoiceSessionStart('openai', 'test-session-monitoring');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      debugEventEmitter.emitVoiceSessionEnd('openai', 'test-session-monitoring', 5000);

      results.push({ type: 'voice', status: 'triggered' });
    }

    return NextResponse.json({
      success: true,
      message: 'Debug events triggered successfully',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error triggering debug events:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Debug monitoring test endpoint',
    availableTests: ['context', 'tools', 'voice', 'all'],
    usage: 'POST with { "testType": "all" } to trigger debug events'
  });
}