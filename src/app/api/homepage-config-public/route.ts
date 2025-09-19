import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { HomepageConfig } from '@/components/homepage/section-renderer';

// GET /api/homepage-config-public - Get homepage configuration (public endpoint)
export async function GET() {
  try {
    // Get the current homepage configuration
    let homepageConfig;
    try {
      homepageConfig = await prisma.homepageConfig.findFirst({
        include: {
          sectionConfigs: {
            orderBy: { order: 'asc' }
          }
        }
      });
    } catch (dbError) {
      console.error('Database error fetching homepage config:', dbError);
      // Fall through to return default config
      homepageConfig = null;
    }

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
              config: {
                title: 'Featured Projects',
                description: 'A showcase of my recent work and projects',
                variant: 'homepage',
                maxItems: 6,
                layout: 'grid',
                columns: '3',
                showSearch: false,
                showFilters: false,
                showSorting: false,
                showViewToggle: false,
                showViewCount: false,
                openMode: 'modal',
                spacing: 'normal',
                theme: 'default'
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
    
    // Return default configuration on error
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
            config: {
              title: 'Featured Projects',
              description: 'A showcase of my recent work and projects',
              variant: 'homepage',
              maxItems: 6,
              layout: 'grid',
              columns: '3',
              showSearch: false,
              showFilters: false,
              showSorting: false,
              showViewToggle: false,
              showViewCount: false,
              openMode: 'modal',
              spacing: 'normal',
              theme: 'default'
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
}