/**
 * Guardrail Violation API Route
 * 
 * Handles reporting of guardrail violations from client-side voice agents.
 * Stores violation data for admin review and safety monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

interface GuardrailViolationRequest {
  provider: 'openai' | 'elevenlabs';
  sessionId: string;
  violation: {
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    timestamp: string;
    context?: any;
  };
  context: {
    recentTranscript: Array<{
      id: string;
      type: string;
      content: string;
      timestamp: string;
      provider: string;
    }>;
    recentToolCalls: Array<{
      id: string;
      name: string;
      arguments: any;
      timestamp: string;
    }>;
  };
}

interface GuardrailViolationResponse {
  success: boolean;
  violationId?: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GuardrailViolationRequest = await request.json();
    
    // Validate required fields
    if (!body.provider || !body.sessionId || !body.violation) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required fields: provider, sessionId, violation' 
        },
        { status: 400 }
      );
    }

    // Get client information
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for') || 
                    headersList.get('x-real-ip') || 
                    'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Generate violation ID
    const violationId = `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare violation entry
    const violationEntry = {
      id: violationId,
      provider: body.provider,
      sessionId: body.sessionId,
      violationType: body.violation.type,
      message: body.violation.message,
      severity: body.violation.severity,
      timestamp: new Date(body.violation.timestamp),
      violationContext: body.violation.context,
      conversationContext: body.context,
      clientIP,
      userAgent,
      createdAt: new Date()
    };

    // Log the violation for immediate attention
    console.error('GUARDRAIL VIOLATION REPORTED:', {
      violationId,
      provider: body.provider,
      sessionId: body.sessionId,
      type: body.violation.type,
      severity: body.violation.severity,
      message: body.violation.message,
      clientIP,
      timestamp: body.violation.timestamp
    });

    // Log context for debugging
    console.log('Violation context:', {
      recentTranscriptCount: body.context.recentTranscript.length,
      recentToolCallCount: body.context.recentToolCalls.length,
      lastTranscriptItem: body.context.recentTranscript[body.context.recentTranscript.length - 1]?.content?.substring(0, 100),
      lastToolCall: body.context.recentToolCalls[body.context.recentToolCalls.length - 1]?.name
    });

    // TODO: Store in database
    // For now, we'll log to console and store in memory/file
    // In production, this should use Prisma or another database client
    
    // TODO: Implement database storage
    // Example with Prisma:
    /*
    const guardrailViolation = await prisma.guardrailViolation.create({
      data: {
        id: violationId,
        provider: body.provider,
        sessionId: body.sessionId,
        violationType: body.violation.type,
        message: body.violation.message,
        severity: body.violation.severity,
        timestamp: new Date(body.violation.timestamp),
        violationContext: body.violation.context ? JSON.stringify(body.violation.context) : null,
        conversationContext: JSON.stringify(body.context),
        clientIP,
        userAgent
      }
    });
    */

    // TODO: Send alerts for critical violations
    if (body.violation.severity === 'critical' || body.violation.severity === 'error') {
      console.error(`CRITICAL GUARDRAIL VIOLATION: ${body.violation.message}`);
      
      // TODO: Implement alerting system (email, Slack, etc.)
      // await sendCriticalViolationAlert(violationEntry);
    }

    // TODO: Update session safety status if needed
    // TODO: Consider temporary suspension of AI features for repeated violations

    const response: GuardrailViolationResponse = {
      success: true,
      violationId,
      message: 'Guardrail violation reported successfully'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error reporting guardrail violation:', error);
    
    const response: GuardrailViolationResponse = {
      success: false,
      message: 'Failed to report guardrail violation'
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// GET endpoint for retrieving guardrail violations (admin only)
export async function GET(request: NextRequest) {
  try {
    // TODO: Implement authentication check for admin access
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const provider = searchParams.get('provider');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // TODO: Implement database query to retrieve violations
    // Example with Prisma:
    /*
    const violations = await prisma.guardrailViolation.findMany({
      where: {
        ...(sessionId && { sessionId }),
        ...(provider && { provider }),
        ...(severity && { severity })
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
    */

    // For now, return empty array
    const violations: any[] = [];

    return NextResponse.json({
      success: true,
      violations,
      total: violations.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error retrieving guardrail violations:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve violations' },
      { status: 500 }
    );
  }
}