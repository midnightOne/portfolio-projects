import { NextRequest, NextResponse } from 'next/server';
import type { HomepageConfig } from '@/components/homepage/section-renderer';

// Public endpoint for testing homepage configuration changes
export async function GET() {
  try {
    // Get current configuration from the switcher
    const switcherResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/homepage-config-public/switch`);
    
    if (switcherResponse.ok) {
      const switcherData = await switcherResponse.json();
      return NextResponse.json({
        success: true,
        data: { config: switcherData.data.config }
      });
    }
    
    // Fallback to default test configuration
    const testConfig: HomepageConfig = {
      sections: [
        {
          id: 'contact-main',
          type: 'contact',
          enabled: true,
          order: 1, // Moved contact to first
          config: {
            title: 'Contact Me First!',
            description: 'This section has been moved to the top to demonstrate dynamic configuration.',
            showContactForm: true,
            theme: 'default',
            socialLinks: []
          }
        },
        {
          id: 'hero-main',
          type: 'hero',
          enabled: true,
          order: 2, // Hero moved to second
          config: {
            title: 'Dynamic Configuration Test',
            subtitle: 'Configuration Loaded from API',
            description: 'This homepage is now loading its configuration dynamically from the API!',
            theme: 'default',
            showScrollIndicator: true,
            ctaText: 'See Projects Below',
            ctaLink: '#projects'
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
              maxItems: 4, // Changed from 6 to 4
              layout: 'grid',
              columns: 2, // Changed from 3 to 2
              showSearch: false,
              showFilters: false,
              showSorting: false,
              showViewToggle: false,
              theme: 'default',
              spacing: 'normal',
              openMode: 'modal',
              sortBy: 'date',
              title: 'My Projects (Dynamic Config)',
              showViewCount: false
            }
          }
        },
        {
          id: 'about-main',
          type: 'about',
          enabled: true,
          order: 4, // About moved to last
          config: {
            content: 'This about section has been moved to the bottom through dynamic configuration. The homepage now loads its layout from the API!',
            skills: ['Dynamic Configuration', 'React', 'TypeScript', 'Next.js', 'API Integration'],
            showSkills: true,
            theme: 'default',
            layout: 'side-by-side'
          }
        }
      ],
      globalTheme: 'default',
      layout: 'standard'
    };

    return NextResponse.json({
      success: true,
      data: { config: testConfig }
    });

  } catch (error) {
    console.error('Error in public homepage config endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homepage configuration' },
      { status: 500 }
    );
  }
}