import { NextRequest, NextResponse } from 'next/server';
import { reflinkManager } from '@/lib/services/ai/reflink-manager';
import { z } from 'zod';

const ValidateReflinkSchema = z.object({
  code: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = ValidateReflinkSchema.parse(body);

    // Validate reflink with budget checking
    const validation = await reflinkManager.validateReflinkWithBudget(code);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Reflink validation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to validate reflink' },
      { status: 500 }
    );
  }
}