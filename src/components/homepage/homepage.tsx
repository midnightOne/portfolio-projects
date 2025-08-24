"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { SectionRenderer, type HomepageConfig, type SectionConfig, sortSectionsByOrder, getEnabledSections } from './section-renderer';
import { ProjectModal } from '@/components/projects/project-modal';
import { ScrollToTop } from '@/components/layout/scroll-to-top';
import { useProjects } from '@/hooks/use-projects';
import { cn } from '@/lib/utils';
import type { ProjectWithRelations } from '@/lib/types/project';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface HomepageProps {
  config?: HomepageConfig;
  className?: string;
}

// ============================================================================
// DEFAULT HOMEPAGE CONFIGURATION
// ============================================================================

const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
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

// ============================================================================
// SMOOTH SCROLLING UTILITY
// ============================================================================

function smoothScrollToSection(sectionId: string) {
  const element = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (element) {
    element.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  } else {
    // Fallback: try to find by ID
    const fallbackElement = document.getElementById(sectionId.replace('#', ''));
    if (fallbackElement) {
      fallbackElement.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Homepage({ config = DEFAULT_HOMEPAGE_CONFIG, className }: HomepageProps) {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<ProjectWithRelations | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);

  // Get projects data for the projects section
  const { projects, tags, loading: projectsLoading } = useProjects();

  // Sort and filter enabled sections
  const enabledSections = getEnabledSections(config.sections);
  const sortedSections = sortSectionsByOrder(enabledSections);

  // ============================================================================
  // PROJECT MODAL HANDLERS
  // ============================================================================

  const fetchProjectDetails = async (projectSlug: string): Promise<ProjectWithRelations | null> => {
    try {
      setProjectLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Project with slug "${projectSlug}" not found`);
          return null;
        }
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data?.project || null;
    } catch (error) {
      console.error('Error fetching project details:', error);
      return null;
    } finally {
      setProjectLoading(false);
    }
  };

  const handleProjectClick = async (projectSlug: string) => {
    setProjectLoading(true);
    setProjectModalOpen(true);
    
    const projectDetails = await fetchProjectDetails(projectSlug);
    if (projectDetails) {
      setSelectedProject(projectDetails);
    } else {
      // Project not found, close modal
      setProjectModalOpen(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedProject(null);
    setProjectModalOpen(false);
    setProjectLoading(false);
  };

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handleNavigationClick = (link: string) => {
    if (link.startsWith('#')) {
      // Internal section link - smooth scroll
      const sectionId = link.substring(1);
      
      // Special handling for common section names
      if (sectionId === 'projects') {
        // Find the projects section
        const projectsSection = sortedSections.find(s => s.type === 'projects');
        if (projectsSection) {
          smoothScrollToSection(projectsSection.id);
        }
      } else if (sectionId === 'about') {
        // Find the about section
        const aboutSection = sortedSections.find(s => s.type === 'about');
        if (aboutSection) {
          smoothScrollToSection(aboutSection.id);
        }
      } else if (sectionId === 'contact') {
        // Find the contact section
        const contactSection = sortedSections.find(s => s.type === 'contact');
        if (contactSection) {
          smoothScrollToSection(contactSection.id);
        }
      } else {
        // Try to scroll to the exact section ID
        smoothScrollToSection(sectionId);
      }
    } else if (link === '/projects') {
      // Navigate to dedicated projects page
      router.push('/projects');
    } else {
      // External link or other page
      if (link.startsWith('http')) {
        window.open(link, '_blank', 'noopener,noreferrer');
      } else {
        router.push(link);
      }
    }
  };

  // ============================================================================
  // SECTION CONFIGURATION HANDLER
  // ============================================================================

  const handleSectionConfigChange = (sectionId: string, newConfig: Record<string, any>) => {
    // This would be used in admin mode to update section configurations
    console.log(`Section ${sectionId} config changed:`, newConfig);
    // In a real implementation, this would update the configuration in the database
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={cn('min-h-screen', className)}>
      {/* Homepage Sections */}
      <div className="relative">
        {sortedSections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            projects={projects}
            tags={tags}
            onProjectClick={handleProjectClick}
            onConfigChange={(newConfig) => handleSectionConfigChange(section.id, newConfig)}
            className="scroll-mt-16" // Add scroll margin for fixed navigation
          />
        ))}
      </div>

      {/* Project Modal */}
      <ProjectModal
        project={selectedProject}
        isOpen={projectModalOpen}
        onClose={handleCloseModal}
        loading={projectLoading}
      />

      {/* Scroll to Top Button */}
      <ScrollToTop variant="floating" showAfter={200} />

      {/* Navigation Enhancement Script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Enhance navigation links for smooth scrolling
            document.addEventListener('DOMContentLoaded', function() {
              const links = document.querySelectorAll('a[href^="#"]');
              links.forEach(link => {
                link.addEventListener('click', function(e) {
                  const href = this.getAttribute('href');
                  if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const targetId = href.substring(1);
                    const target = document.querySelector('[data-section-id="' + targetId + '"]') || 
                                   document.getElementById(targetId);
                    if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }
                });
              });
            });
          `
        }}
      />
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createHomepageConfig(
  sections: Partial<SectionConfig>[],
  globalTheme: string = 'default',
  layout: 'standard' | 'single-page' | 'multi-page' = 'standard'
): HomepageConfig {
  const completeSections: SectionConfig[] = sections.map((section, index) => ({
    id: section.id || `section-${index}`,
    type: section.type || 'custom',
    enabled: section.enabled ?? true,
    order: section.order ?? index + 1,
    config: section.config || {},
    className: section.className
  }));

  return {
    sections: completeSections,
    globalTheme,
    layout
  };
}

export function getHomepageSection(config: HomepageConfig, sectionType: string): SectionConfig | null {
  return config.sections.find(section => section.type === sectionType) || null;
}

export function updateHomepageSection(
  config: HomepageConfig, 
  sectionId: string, 
  updates: Partial<SectionConfig>
): HomepageConfig {
  return {
    ...config,
    sections: config.sections.map(section =>
      section.id === sectionId ? { ...section, ...updates } : section
    )
  };
}