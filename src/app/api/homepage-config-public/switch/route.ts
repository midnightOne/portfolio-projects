import { NextRequest, NextResponse } from 'next/server';
import type { HomepageConfig } from '@/components/homepage/section-renderer';

// Simple in-memory storage for testing (in production this would be in database)
let currentConfigIndex = 0;

const testConfigurations: HomepageConfig[] = [
  // Configuration 1: Default order
  {
    sections: [
      {
        id: 'hero-main',
        type: 'hero',
        enabled: true,
        order: 1,
        config: {
          title: 'Configuration 1',
          subtitle: 'Default Order',
          description: 'Hero → About → Projects → Contact',
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
          content: 'This is configuration 1 with the default section order.',
          skills: ['React', 'TypeScript', 'Next.js'],
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
            title: 'Featured Projects',
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
          description: 'Contact section in default position.',
          showContactForm: true,
          theme: 'default'
        }
      }
    ],
    globalTheme: 'default',
    layout: 'standard'
  },
  
  // Configuration 2: Reversed order
  {
    sections: [
      {
        id: 'contact-main',
        type: 'contact',
        enabled: true,
        order: 1,
        config: {
          title: 'Configuration 2 - Contact First!',
          description: 'This configuration puts contact at the top.',
          showContactForm: true,
          theme: 'default'
        }
      },
      {
        id: 'projects-main',
        type: 'projects',
        enabled: true,
        order: 2,
        config: {
          variant: 'homepage',
          config: {
            maxItems: 4,
            layout: 'grid',
            columns: 2,
            title: 'Projects (Config 2)',
            theme: 'default'
          }
        }
      },
      {
        id: 'about-main',
        type: 'about',
        enabled: true,
        order: 3,
        config: {
          content: 'Configuration 2: Sections are reordered - Contact → Projects → About → Hero',
          skills: ['Dynamic Config', 'API Integration', 'React'],
          showSkills: true,
          theme: 'default',
          layout: 'side-by-side'
        }
      },
      {
        id: 'hero-main',
        type: 'hero',
        enabled: true,
        order: 4,
        config: {
          title: 'Hero at the Bottom!',
          subtitle: 'Configuration 2',
          description: 'This hero section is now at the bottom of the page.',
          theme: 'default',
          showScrollIndicator: false,
          ctaText: 'Back to Top',
          ctaLink: '#contact-main'
        }
      }
    ],
    globalTheme: 'default',
    layout: 'standard'
  },
  
  // Configuration 3: Some sections disabled
  {
    sections: [
      {
        id: 'hero-main',
        type: 'hero',
        enabled: true,
        order: 1,
        config: {
          title: 'Configuration 3',
          subtitle: 'Minimal Layout',
          description: 'Only Hero and Projects sections are enabled.',
          theme: 'default',
          showScrollIndicator: true,
          ctaText: 'View Projects',
          ctaLink: '#projects'
        }
      },
      {
        id: 'about-main',
        type: 'about',
        enabled: false, // Disabled
        order: 2,
        config: {
          content: 'This section is disabled.',
          skills: [],
          showSkills: false,
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
            maxItems: 8,
            layout: 'grid',
            columns: 4,
            title: 'All Projects (Config 3)',
            theme: 'default'
          }
        }
      },
      {
        id: 'contact-main',
        type: 'contact',
        enabled: false, // Disabled
        order: 4,
        config: {
          title: 'Contact (Disabled)',
          description: 'This section is disabled.',
          showContactForm: false,
          theme: 'default'
        }
      }
    ],
    globalTheme: 'default',
    layout: 'standard'
  }
];

// GET: Return current configuration
export async function GET() {
  try {
    const config = testConfigurations[currentConfigIndex];
    
    return NextResponse.json({
      success: true,
      data: { 
        config,
        currentIndex: currentConfigIndex,
        totalConfigs: testConfigurations.length
      }
    });
  } catch (error) {
    console.error('Error getting configuration:', error);
    return NextResponse.json(
      { error: 'Failed to get configuration' },
      { status: 500 }
    );
  }
}

// POST: Switch to next configuration
export async function POST() {
  try {
    currentConfigIndex = (currentConfigIndex + 1) % testConfigurations.length;
    const config = testConfigurations[currentConfigIndex];
    
    return NextResponse.json({
      success: true,
      data: { 
        config,
        currentIndex: currentConfigIndex,
        totalConfigs: testConfigurations.length,
        message: `Switched to configuration ${currentConfigIndex + 1}`
      }
    });
  } catch (error) {
    console.error('Error switching configuration:', error);
    return NextResponse.json(
      { error: 'Failed to switch configuration' },
      { status: 500 }
    );
  }
}