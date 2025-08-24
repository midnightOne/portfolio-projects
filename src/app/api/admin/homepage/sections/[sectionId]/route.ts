import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for section config update
const SectionConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  order: z.number().optional(),
  config: z.record(z.any()).optional(),
  className: z.string().optional()
});

// GET /api/admin/homepage/sections/[sectionId] - Get specific section configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sectionId } = await params;

    // Get the homepage config and specific section
    const homepageConfig = await prisma.homepageConfig.findFirst({
      include: {
        sectionConfigs: {
          where: { sectionId },
          take: 1
        }
      }
    });

    if (!homepageConfig || homepageConfig.sectionConfigs.length === 0) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    const sectionConfig = homepageConfig.sectionConfigs[0];

    return NextResponse.json({
      success: true,
      data: {
        section: {
          id: sectionConfig.sectionId,
          type: sectionConfig.type,
          enabled: sectionConfig.enabled,
          order: sectionConfig.order,
          config: sectionConfig.config,
          className: sectionConfig.className
        }
      }
    });

  } catch (error) {
    console.error('Error fetching section config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch section configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/homepage/sections/[sectionId] - Update specific section configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sectionId } = await params;
    const body = await request.json();
    
    // Validate the request body
    const validationResult = SectionConfigUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid section configuration data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Find the homepage config and section
    const homepageConfig = await prisma.homepageConfig.findFirst({
      include: {
        sectionConfigs: {
          where: { sectionId }
        }
      }
    });

    if (!homepageConfig || homepageConfig.sectionConfigs.length === 0) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    const sectionConfig = homepageConfig.sectionConfigs[0];

    // Update the section config
    const updatedSection = await prisma.sectionConfig.update({
      where: { id: sectionConfig.id },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        section: {
          id: updatedSection.sectionId,
          type: updatedSection.type,
          enabled: updatedSection.enabled,
          order: updatedSection.order,
          config: updatedSection.config,
          className: updatedSection.className
        }
      }
    });

  } catch (error) {
    console.error('Error updating section config:', error);
    return NextResponse.json(
      { error: 'Failed to update section configuration' },
      { status: 500 }
    );
  }
}