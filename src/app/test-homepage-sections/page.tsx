/**
 * Test page for homepage section components
 * This page demonstrates all the homepage section components with sample data
 */

"use client";

import React from 'react';
import { 
  HeroSection, 
  AboutSection, 
  ContactSection, 
  SectionRenderer,
  HomepagePresets,
  type SectionConfig
} from '@/components/homepage';
import { ProjectsSection } from '@/components/projects/projects-section';

// Sample data for testing
const sampleProjects = [
  {
    id: '1',
    title: 'Sample Project 1',
    slug: 'sample-project-1',
    description: 'A sample project for testing',
    briefOverview: 'This is a brief overview of the project',
    workDate: new Date('2024-01-15'),
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    viewCount: 150,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    tags: [
      { id: '1', name: 'React', color: '#61DAFB', createdAt: new Date() },
      { id: '2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() }
    ],
    mediaItems: [],
    interactiveExamples: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: []
  },
  {
    id: '2',
    title: 'Sample Project 2',
    slug: 'sample-project-2',
    description: 'Another sample project for testing',
    briefOverview: 'This is another brief overview',
    workDate: new Date('2024-02-01'),
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    viewCount: 89,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-02-01'),
    tags: [
      { id: '3', name: 'Next.js', color: '#000000', createdAt: new Date() },
      { id: '4', name: 'Tailwind', color: '#06B6D4', createdAt: new Date() }
    ],
    mediaItems: [],
    interactiveExamples: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: []
  }
];

const sampleTags = [
  { id: '1', name: 'React', color: '#61DAFB', createdAt: new Date() },
  { id: '2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() },
  { id: '3', name: 'Next.js', color: '#000000', createdAt: new Date() },
  { id: '4', name: 'Tailwind', color: '#06B6D4', createdAt: new Date() }
];

const sampleSocialLinks = [
  {
    platform: 'GitHub',
    url: 'https://github.com/username',
    icon: 'github',
    label: 'GitHub',
    color: '#333'
  },
  {
    platform: 'LinkedIn',
    url: 'https://linkedin.com/in/username',
    icon: 'linkedin',
    label: 'LinkedIn',
    color: '#0077B5'
  },
  {
    platform: 'Twitter',
    url: 'https://twitter.com/username',
    icon: 'twitter',
    label: 'Twitter',
    color: '#1DA1F2'
  }
];

export default function TestHomepageSectionsPage() {
  const handleProjectClick = (projectSlug: string) => {
    console.log('Project clicked:', projectSlug);
    // In a real app, this would navigate to the project detail page
  };

  return (
    <div className="min-h-screen">
      <h1 className="text-4xl font-bold text-center py-8 bg-muted">
        Homepage Sections Test Page
      </h1>

      {/* Individual Component Tests */}
      <div className="space-y-16">
        {/* Hero Section Test */}
        <div>
          <div className="bg-slate-100 py-4 px-6">
            <h2 className="text-2xl font-semibold">Hero Section</h2>
            <p className="text-muted-foreground">Testing the hero section component</p>
          </div>
          <HeroSection
            title="John Doe"
            subtitle="Full Stack Developer"
            description="Building digital experiences that make a difference. Passionate about creating solutions that are both functional and beautiful."
            ctaText="View My Work"
            ctaLink="#projects"
            theme="default"
            showScrollIndicator={true}
          />
        </div>

        {/* About Section Test */}
        <div>
          <div className="bg-slate-100 py-4 px-6">
            <h2 className="text-2xl font-semibold">About Section</h2>
            <p className="text-muted-foreground">Testing the about section component</p>
          </div>
          <AboutSection
            content="I'm a passionate full-stack developer with over 5 years of experience building web applications. I specialize in React, TypeScript, and Node.js, and I love creating solutions that solve real-world problems.

            When I'm not coding, you can find me exploring new technologies, contributing to open-source projects, or sharing knowledge with the developer community."
            skills={[
              'React:Frontend',
              'TypeScript:Frontend', 
              'Next.js:Frontend',
              'Node.js:Backend',
              'PostgreSQL:Database',
              'Python:Backend',
              'AWS:Cloud',
              'Docker:DevOps'
            ]}
            showSkills={true}
            theme="default"
            layout="side-by-side"
          />
        </div>

        {/* Projects Section Test */}
        <div>
          <div className="bg-slate-100 py-4 px-6">
            <h2 className="text-2xl font-semibold">Projects Section</h2>
            <p className="text-muted-foreground">Testing the projects section component</p>
          </div>
          <ProjectsSection
            variant="homepage"
            config={{
              maxItems: 6,
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
              description: 'A selection of my recent work',
              showViewCount: false
            }}
            projects={sampleProjects}
            tags={sampleTags}
            onProjectClick={handleProjectClick}
          />
        </div>

        {/* Contact Section Test */}
        <div>
          <div className="bg-slate-100 py-4 px-6">
            <h2 className="text-2xl font-semibold">Contact Section</h2>
            <p className="text-muted-foreground">Testing the contact section component</p>
          </div>
          <ContactSection
            email="john.doe@example.com"
            socialLinks={sampleSocialLinks}
            showContactForm={true}
            theme="default"
            title="Get In Touch"
            description="I'm always interested in new opportunities and collaborations. Feel free to reach out!"
          />
        </div>

        {/* Section Renderer Test */}
        <div>
          <div className="bg-slate-100 py-4 px-6">
            <h2 className="text-2xl font-semibold">Section Renderer</h2>
            <p className="text-muted-foreground">Testing the section renderer with preset configuration</p>
          </div>
          
          {HomepagePresets.standard.sections.map((section: SectionConfig) => (
            <SectionRenderer
              key={section.id}
              section={section}
              projects={sampleProjects}
              tags={sampleTags}
              onProjectClick={handleProjectClick}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-900 text-white py-8 px-6 text-center mt-16">
        <p>End of Homepage Sections Test Page</p>
      </div>
    </div>
  );
}