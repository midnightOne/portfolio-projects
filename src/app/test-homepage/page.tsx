"use client";

import React from 'react';
import { Homepage } from '@/components/homepage/homepage';
import { MainNavigation } from '@/components/layout/main-navigation';

// Test configuration with all sections enabled
const testConfig = {
  sections: [
    {
      id: 'hero-test',
      type: 'hero' as const,
      enabled: true,
      order: 1,
      config: {
        title: 'Test Portfolio',
        subtitle: 'Testing Homepage Layout',
        description: 'This is a test of the homepage component with navigation.',
        theme: 'default',
        showScrollIndicator: true,
        ctaText: 'View Projects',
        ctaLink: '#projects'
      }
    },
    {
      id: 'about-test',
      type: 'about' as const,
      enabled: true,
      order: 2,
      config: {
        content: 'This is a test about section to verify the layout and navigation functionality.',
        skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
        showSkills: true,
        theme: 'default',
        layout: 'side-by-side'
      }
    },
    {
      id: 'projects-test',
      type: 'projects' as const,
      enabled: true,
      order: 3,
      config: {
        variant: 'homepage',
        config: {
          maxItems: 4,
          layout: 'grid',
          columns: 2,
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
      id: 'contact-test',
      type: 'contact' as const,
      enabled: true,
      order: 4,
      config: {
        title: 'Get In Touch',
        description: 'Test contact section for homepage navigation.',
        showContactForm: true,
        theme: 'default',
        socialLinks: [
          {
            platform: 'GitHub',
            url: 'https://github.com/test',
            icon: 'github',
            label: 'GitHub'
          },
          {
            platform: 'LinkedIn',
            url: 'https://linkedin.com/in/test',
            icon: 'linkedin',
            label: 'LinkedIn'
          }
        ]
      }
    }
  ],
  globalTheme: 'default',
  layout: 'standard' as const
};

export default function TestHomepage() {
  return (
    <div className="min-h-screen">
      <MainNavigation 
        logoText="Test Portfolio"
        variant="floating"
        position="fixed"
      />
      <Homepage config={testConfig} />
      
      {/* Test Navigation Links */}
      <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-4 shadow-lg z-50">
        <h3 className="font-semibold mb-2">Test Navigation</h3>
        <div className="space-y-2 text-sm">
          <button 
            onClick={() => {
              const element = document.getElementById('hero');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="block w-full text-left px-2 py-1 hover:bg-accent rounded"
          >
            → Hero Section
          </button>
          <button 
            onClick={() => {
              const element = document.getElementById('about');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="block w-full text-left px-2 py-1 hover:bg-accent rounded"
          >
            → About Section
          </button>
          <button 
            onClick={() => {
              const element = document.getElementById('projects');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="block w-full text-left px-2 py-1 hover:bg-accent rounded"
          >
            → Projects Section
          </button>
          <button 
            onClick={() => {
              const element = document.getElementById('contact');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="block w-full text-left px-2 py-1 hover:bg-accent rounded"
          >
            → Contact Section
          </button>
        </div>
      </div>
    </div>
  );
}