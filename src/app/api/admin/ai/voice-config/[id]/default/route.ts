import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/admin/ai/voice-config/[id]/default - Set configuration as default
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if configuration exists
    const existingConfig = await prisma.voiceProviderConfig.findUnique({
      where: { id }
    });

    if (!existingConfig) {
      return NextResponse.json(
        { success: false, error: { message: 'Configuration not found' } },
        { status: 404 }
      );
    }

    // If already default, no need to change
    if (existingConfig.isDefault) {
      return NextResponse.json({
        success: true,
        data: { message: 'Configuration is already set as default' }
      });
    }

    // Use transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // Unset current default for this provider
      await tx.voiceProviderConfig.updateMany({
        where: { 
          provider: existingConfig.provider,
          isDefault: true 
        },
        data: { isDefault: false }
      });

      // Set new default
      await tx.voiceProviderConfig.update({
        where: { id },
        data: { isDefault: true }
      });
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Default configuration updated successfully' }
    });

  } catch (error) {
    console.error('Failed to set default voice configuration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to set default voice configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}