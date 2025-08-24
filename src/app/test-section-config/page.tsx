"use client";

import React, { useState } from 'react';
import { SectionConfigEditor } from '@/components/admin/section-config-editor';
import type { SectionConfig } from '@/components/homepage/section-renderer';

const testSections: SectionConfig[] = [
  {
    id: 'hero-test',
    type: 'hero',
    enabled: true,
    order: 1,
    config: {
      title: 'John Doe',
      subtitle: 'Full Stack Developer',
      description: 'Building amazing web experiences with modern technologies.',
      ctaText: 'View My Work',
      ctaLink: '#projects',
      theme: 'default',
      showScrollIndicator: true
    }
  },
  {
    id: 'about-test',
    type: 'about',
    enabled: true,
    order: 2,
    config: {
      title: 'About Me',
      content: 'I am a passionate developer with 5+ years of experience in building web applications.',
      skills: ['React', 'TypeScript:Frontend', 'Node.js:Backend', 'AWS:Cloud'],
      showSkills: true,
      profileImage: 'https://via.placeholder.com/300x300',
      showProfileImage: true,
      layout: 'side-by-side',
      theme: 'default'
    }
  },
  {
    id: 'projects-test',
    type: 'projects',
    enabled: true,
    order: 3,
    config: {
      title: 'Featured Projects',
      config: {
        variant: 'homepage',
        maxItems: 6,
        layout: 'grid',
        columns: '3',
        showSearch: false,
        showFilters: false,
        showSorting: false,
        showViewToggle: false,
        openMode: 'modal',
        theme: 'default'
      }
    }
  },
  {
    id: 'contact-test',
    type: 'contact',
    enabled: true,
    order: 4,
    config: {
      title: 'Get In Touch',
      description: 'I\'m always interested in new opportunities and collaborations.',
      email: 'john@example.com',
      showContactForm: true,
      socialLinks: ['GitHub:https://github.com/johndoe', 'LinkedIn:https://linkedin.com/in/johndoe'],
      showSocialLinks: true,
      layout: 'form-and-info',
      theme: 'default'
    }
  }
];

export default function TestSectionConfigPage() {
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [sections, setSections] = useState(testSections);

  const handleConfigChange = (config: Record<string, any>) => {
    setSections(prev => prev.map((section, index) => 
      index === selectedSectionIndex 
        ? { ...section, config }
        : section
    ));
  };

  const selectedSection = sections[selectedSectionIndex];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">Section Config Editor Test</h1>
          <p className="text-muted-foreground">
            Test the enhanced section-specific admin controls for different section types.
          </p>
        </div>

        {/* Section Selector */}
        <div className="flex gap-2 flex-wrap">
          {sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => setSelectedSectionIndex(index)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedSectionIndex === index
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {section.type.charAt(0).toUpperCase() + section.type.slice(1)} Section
            </button>
          ))}
        </div>

        {/* Section Config Editor */}
        <div className="bg-card rounded-lg border p-6">
          <SectionConfigEditor
            section={selectedSection}
            onConfigChange={handleConfigChange}
          />
        </div>

        {/* Current Config Display */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h3 className="font-medium mb-2">Current Configuration (JSON)</h3>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(selectedSection.config, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}