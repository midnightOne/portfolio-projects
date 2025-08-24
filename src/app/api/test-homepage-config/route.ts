import { NextRequest, NextResponse } from 'next/server';
import type { HomepageConfig } from '@/components/homepage/section-renderer';

// Test endpoint without authentication
export async function GET() {
  try {
    // Return default configuration for testing
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
            content: 'I\'m a passionate developer with expertise in modern web technologies.',
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

  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test configuration' },
      { status: 500 }
    );
  }
}