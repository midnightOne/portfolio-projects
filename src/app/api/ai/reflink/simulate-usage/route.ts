import { NextRequest, NextResponse } from 'next/server';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import { z } from 'zod';

const SimulateUsageSchema = z.object({
  reflinkId: z.string().min(1),
  usageType: z.enum(['llm_request', 'voice_generation', 'voice_processing']).default('llm_request'),
  tokens: z.number().int().min(1).max(100000).default(100),
  cost: z.number().positive().max(100).default(0.01), // Increased for testing
  modelUsed: z.string().optional().default('gpt-4o-mini'),
  endpoint: z.string().optional().default('/api/ai/chat'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reflinkId, usageType, tokens, cost, modelUsed, endpoint } = SimulateUsageSchema.parse(body);

    // Track the simulated usage
    await reflinkManager.trackUsage(reflinkId, {
      type: usageType,
      tokens,
      cost,
      modelUsed,
      endpoint,
      metadata: {
        simulated: true,
        timestamp: new Date().toISOString(),
      },
    });

    // Get updated budget status
    const budgetStatus = await reflinkManager.getRemainingBudget(reflinkId);

    return NextResponse.json({
      success: true,
      message: `Simulated ${usageType} usage: ${tokens} tokens, $${cost.toFixed(4)}`,
      budgetStatus,
      usage: {
        type: usageType,
        tokens,
        cost,
        modelUsed,
        endpoint,
      },
    });
  } catch (error) {
    console.error('Simulate usage error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to simulate usage' },
      { status: 500 }
    );
  }
}