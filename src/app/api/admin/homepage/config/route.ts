import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { HomepageConfig, SectionConfig } from '@/components/homepage/section-renderer';

// Validation schemas
const SectionConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['hero', 'about', 'projects', 'contact', 'custom']),
  enabled: z.boolean(),
  order: z.number(),
  config: z.record(z.any()),
  className: z.string().optional()
});

const HomepageConfigSchema = z.object({
  sections: z.array(SectionConfigSchema),
  globalTheme: z.string().default('default'),
  layout: z.enum(['standard', 'single-page', 'multi-page']).default('standard')
});

// GET /api/admin/homepage/config - Get current homepage configuration
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the current homepage configuration
    const homepageConfig = await prisma.homepageConfig.findFirst({
      include: {
        sectionConfigs: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!homepageConfig) {
      // Return default configuration if none exists
      const defaultConfig: HomepageConfig = {
        sections: [
          {
            id: 'hero-main',
            type: 'hero',
            enabled: true,
            order: 1,
            config: {
              title: 'John Doe',
              subtitle: 'Full Stack Developer',
              description: 'Building digital experiences that make a difference.',
              theme: 'default',
              showScrollIndicator: true,
              ctaText: 'View My Work',
              ctaLink: '#projects'
            }
          },
          {
            id: 'about-main',
            type: 'about',
            enabled: true,
            order: 2,
            config: {
              content: 'I\'m a passionate developer with expertise in modern web technologies. I love creating solutions that are both functional and beautiful.',
              skills: ['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'Next.js'],
              showSkills: true,
              theme: 'default',
              layout: 'side-by-side'
            }
          },
          {
            id: 'projects-main',
            type: 'projects',
            enabled: true,
            order: 3,
            config: {
              variant: 'homepage',
              config: {
                maxItems: 6,
                layout: 'grid',
                columns: 3,
                showSearch: false,
                showFilters: false,
                showSorting: false,
                showViewToggle: false,
                theme: 'default',
                spacing: 'normal',
                openMode: 'modal',
                sortBy: 'date',
                title: 'Featured Projects',
                showViewCount: false
              }
            }
          },
          {
            id: 'contact-main',
            type: 'contact',
            enabled: true,
            order: 4,
            config: {
              title: 'Get In Touch',
              description: 'I\'m always interested in new opportunities and collaborations.',
              showContactForm: true,
              theme: 'default',
              socialLinks: []
            }
          }
        ],
        globalTheme: 'default',
        layout: 'standard'
      };

      return NextResponse.json({
        success: true,
        data: { config: defaultConfig }
      });
    }

    // Convert database format to component format
    const config: HomepageConfig = {
      sections: homepageConfig.sectionConfigs.map(section => ({
        id: section.sectionId,
        type: section.type as any,
        enabled: section.enabled,
        order: section.order,
        config: section.config as Record<string, any>,
        className: section.className || undefined
      })),
      globalTheme: homepageConfig.globalTheme,
      layout: homepageConfig.layout as any
    };

    return NextResponse.json({
      success: true,
      data: { config }
    });

  } catch (error) {
    console.error('Error fetching homepage config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homepage configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/homepage/config - Update homepage configuration
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate the request body
    const validationResult = HomepageConfigSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid configuration data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const { sections, globalTheme, layout } = validationResult.data;

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Find or create homepage config
      let homepageConfig = await tx.homepageConfig.findFirst();
      
      if (!homepageConfig) {
        homepageConfig = await tx.homepageConfig.create({
          data: {
            sections: sections,
            globalTheme,
            layout
          }
        });
      } else {
        homepageConfig = await tx.homepageConfig.update({
          where: { id: homepageConfig.id },
          data: {
            sections: sections,
            globalTheme,
            layout,
            updatedAt: new Date()
          }
        });
      }

      // Delete existing section configs
      await tx.sectionConfig.deleteMany({
        where: { homepageConfigId: homepageConfig.id }
      });

      // Create new section configs
      await tx.sectionConfig.createMany({
        data: sections.map(section => ({
          homepageConfigId: homepageConfig.id,
          sectionId: section.id,
          type: section.type,
          enabled: section.enabled,
          order: section.order,
          config: section.config,
          className: section.className
        }))
      });

      return homepageConfig;
    });

    return NextResponse.json({
      success: true,
      data: { 
        config: {
          sections,
          globalTheme,
          layout
        }
      }
    });

  } catch (error) {
    console.error('Error updating homepage config:', error);
    return NextResponse.json(
      { error: 'Failed to update homepage configuration' },
      { status: 500 }
    );
  }
}