/**
 * F-I-D Context API Route
 * 
 * Provides Frame/Index/Details context for client-side AI tools.
 * This allows the ContextFrameManager to work in browser environments
 * by fetching context from the server instead of accessing the database directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { contextFrameManager } from '../../../../../lib/ai/ContextFrameManager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      route = 'home',
      projectId,
      userIntent,
      lastActions = [],
      contextType = 'complete' // 'frame', 'index', 'details', or 'complete'
    } = body;

    const config = {
      route,
      projectId,
      userIntent,
      lastActions
    };

    let result;

    switch (contextType) {
      case 'frame':
        result = {
          frame: await contextFrameManager.getFrameContext(),
          type: 'frame'
        };
        break;

      case 'index':
        result = {
          index: await contextFrameManager.getIndexContext(config),
          type: 'index'
        };
        break;

      case 'details':
        const remainingBudget = 1000; // Default budget for details
        result = {
          details: await contextFrameManager.getDetailsContext(config, { remainingBudget }),
          type: 'details'
        };
        break;

      case 'complete':
      default:
        result = await contextFrameManager.getCompleteContext(config);
        result.type = 'complete';
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('F-I-D Context API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route') || 'home';
    const projectId = searchParams.get('projectId') || undefined;
    const userIntent = searchParams.get('userIntent') || undefined;
    const contextType = searchParams.get('type') || 'complete';

    const config = {
      route,
      projectId,
      userIntent,
      lastActions: []
    };

    let result;

    switch (contextType) {
      case 'frame':
        result = {
          frame: await contextFrameManager.getFrameContext(),
          type: 'frame'
        };
        break;

      case 'index':
        result = {
          index: await contextFrameManager.getIndexContext(config),
          type: 'index'
        };
        break;

      case 'details':
        const remainingBudget = 1000;
        result = {
          details: await contextFrameManager.getDetailsContext(config, { remainingBudget }),
          type: 'details'
        };
        break;

      case 'complete':
      default:
        result = await contextFrameManager.getCompleteContext(config);
        result.type = 'complete';
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('F-I-D Context API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}