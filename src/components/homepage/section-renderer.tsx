"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { HeroSection, type HeroSectionProps } from './hero-section';
import { AboutSection, type AboutSectionProps } from './about-section';
import { ContactSection, type ContactSectionProps } from './contact-section';
import { ProjectsSection, type ProjectsSectionProps } from '@/components/projects/projects-section';
import { cn } from '@/lib/utils';
import type { ProjectWithRelations, Tag } from '@/lib/types/project';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type SectionType = 'hero' | 'about' | 'projects' | 'contact' | 'custom';

export interface SectionConfig {
  id: string;
  type: SectionType;
  enabled: boolean;
  order: number;
  config: Record<string, any>; // Section-specific configuration
  className?: string;
}

export interface HomepageConfig {
  sections: SectionConfig[];
  globalTheme?: string;
  layout?: 'standard' | 'single-page' | 'multi-page';
}

export interface SectionRendererProps {
  section: SectionConfig;
  isEditing?: boolean;
  onConfigChange?: (config: Record<string, any>) => void;
  
  // Data props for sections that need external data
  projects?: ProjectWithRelations[];
  tags?: Tag[];
  onProjectClick?: (projectSlug: string) => void;
  
  // Additional props
  className?: string;
}

export interface CustomSectionProps {
  id: string;
  content: string;
  title?: string;
  theme?: string;
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateSectionConfig(type: SectionType, config: Record<string, any>): boolean {
  switch (type) {
    case 'hero':
      return typeof config.title === 'string' && typeof config.subtitle === 'string';
    case 'about':
      return typeof config.content === 'string';
    case 'projects':
      return typeof config.variant === 'string' && typeof config.config === 'object';
    case 'contact':
      return true; // Contact section has all optional props
    case 'custom':
      return typeof config.content === 'string';
    default:
      return false;
  }
}

function getDefaultSectionConfig(type: SectionType): Record<string, any> {
  switch (type) {
    case 'hero':
      return {
        title: 'Your Name',
        subtitle: 'Your Title',
        description: 'A brief introduction about yourself.',
        theme: 'default',
        showScrollIndicator: true,
        ctaText: 'View My Work',
        ctaLink: '#projects'
      };
    
    case 'about':
      return {
        content: 'Tell your story here. Share your background, experience, and what drives you.',
        skills: [],
        showSkills: true,
        theme: 'default',
        layout: 'side-by-side'
      };
    
    case 'projects':
      return {
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
      };
    
    case 'contact':
      return {
        title: 'Get In Touch',
        description: "I'm always interested in new opportunities and collaborations.",
        showContactForm: true,
        theme: 'default',
        socialLinks: []
      };
    
    case 'custom':
      return {
        title: 'Custom Section',
        content: 'Add your custom content here.',
        theme: 'default'
      };
    
    default:
      return {};
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function CustomSection({ id, content, title, theme = 'default', className }: CustomSectionProps) {
  const getThemeClasses = (theme: string): string => {
    const themeClasses = {
      default: 'bg-background text-foreground',
      dark: 'bg-slate-900 text-slate-100',
      minimal: 'bg-gray-50 text-gray-900',
      colorful: 'bg-gradient-to-br from-indigo-50 to-purple-50 text-gray-900'
    };

    return themeClasses[theme as keyof typeof themeClasses] || themeClasses.default;
  };

  return (
    <section
      id={id}
      className={cn(
        'py-16 px-6',
        getThemeClasses(theme),
        className
      )}
    >
      <div className="container mx-auto max-w-4xl">
        {title && (
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
            <div className="w-24 h-1 bg-primary mx-auto rounded-full" />
          </div>
        )}
        
        <div className="prose prose-lg max-w-none">
          {content.split('\n\n').map((paragraph, index) => (
            <p key={index} className="mb-4 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function EditingOverlay({ 
  sectionType, 
  onConfigChange 
}: { 
  sectionType: SectionType;
  onConfigChange?: (config: Record<string, any>) => void;
}) {
  if (!onConfigChange) return null;

  return (
    <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg flex items-center justify-center z-10">
      <div className="bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
        <p className="text-sm font-medium">
          Editing {sectionType} section
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SectionRenderer({
  section,
  isEditing = false,
  onConfigChange,
  projects = [],
  tags = [],
  onProjectClick,
  className
}: SectionRendererProps) {
  // Validate section configuration
  const isValidConfig = validateSectionConfig(section.type, section.config);
  
  if (!section.enabled) {
    return null;
  }

  if (!isValidConfig) {
    console.warn(`Invalid configuration for section ${section.id} of type ${section.type}`);
    // Use default config as fallback
    const defaultConfig = getDefaultSectionConfig(section.type);
    section.config = { ...defaultConfig, ...section.config };
  }

  const sectionProps = {
    ...section.config,
    className: cn(section.className, className)
  };

  const renderSection = () => {
    switch (section.type) {
      case 'hero':
        return <HeroSection {...(sectionProps as HeroSectionProps)} />;
      
      case 'about':
        return <AboutSection {...(sectionProps as AboutSectionProps)} />;
      
      case 'projects':
        if (!onProjectClick) {
          console.warn('ProjectsSection requires onProjectClick prop');
          return null;
        }
        return (
          <ProjectsSection
            {...(sectionProps as Omit<ProjectsSectionProps, 'onProjectClick' | 'projects' | 'tags'>)}
            projects={projects}
            tags={tags}
            onProjectClick={onProjectClick}
          />
        );
      
      case 'contact':
        return <ContactSection {...(sectionProps as ContactSectionProps)} />;
      
      case 'custom':
        return (
          <CustomSection
            id={section.id}
            {...(sectionProps as Omit<CustomSectionProps, 'id'>)}
          />
        );
      
      default:
        console.warn(`Unknown section type: ${section.type}`);
        return (
          <div className="py-16 px-6 text-center">
            <p className="text-muted-foreground">
              Unknown section type: {section.type}
            </p>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: section.order * 0.1 }}
      className="relative"
      data-section-id={section.id}
      data-section-type={section.type}
    >
      {renderSection()}
      
      {isEditing && (
        <EditingOverlay 
          sectionType={section.type}
          onConfigChange={onConfigChange}
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createSectionConfig(
  type: SectionType,
  order: number,
  customConfig: Record<string, any> = {},
  id?: string
): SectionConfig {
  const defaultConfig = getDefaultSectionConfig(type);
  
  return {
    id: id || `${type}-${order}`,
    type,
    enabled: true,
    order,
    config: { ...defaultConfig, ...customConfig }
  };
}

export function sortSectionsByOrder(sections: SectionConfig[]): SectionConfig[] {
  return [...sections].sort((a, b) => a.order - b.order);
}

export function getEnabledSections(sections: SectionConfig[]): SectionConfig[] {
  return sections.filter(section => section.enabled);
}

export function validateHomepageConfig(config: HomepageConfig): boolean {
  if (!config.sections || !Array.isArray(config.sections)) {
    return false;
  }

  return config.sections.every(section => 
    typeof section.id === 'string' &&
    typeof section.type === 'string' &&
    typeof section.enabled === 'boolean' &&
    typeof section.order === 'number' &&
    typeof section.config === 'object'
  );
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const HomepagePresets = {
  standard: {
    sections: [
      createSectionConfig('hero', 1, {
        title: 'John Doe',
        subtitle: 'Full Stack Developer',
        description: 'Building digital experiences that make a difference.',
        ctaText: 'View My Work',
        ctaLink: '#projects'
      }, 'hero-standard'),
      createSectionConfig('about', 2, {
        content: 'I\'m a passionate developer with expertise in modern web technologies. I love creating solutions that are both functional and beautiful.',
        skills: ['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL'],
        showSkills: true
      }, 'about-standard'),
      createSectionConfig('projects', 3, {
        variant: 'homepage',
        config: {
          maxItems: 6,
          title: 'Featured Projects',
          layout: 'grid',
          columns: 3
        }
      }, 'projects-standard'),
      createSectionConfig('contact', 4, {
        title: 'Get In Touch',
        description: 'I\'m always interested in new opportunities and collaborations.',
        showContactForm: true
      }, 'contact-standard')
    ],
    globalTheme: 'default',
    layout: 'standard'
  } as HomepageConfig,

  minimal: {
    sections: [
      createSectionConfig('hero', 1, {
        title: 'Jane Smith',
        subtitle: 'Designer & Developer',
        theme: 'minimal',
        showScrollIndicator: false
      }, 'hero-minimal'),
      createSectionConfig('projects', 2, {
        variant: 'homepage',
        config: {
          maxItems: 4,
          title: 'Selected Work',
          layout: 'grid',
          columns: 2,
          theme: 'minimal'
        }
      }, 'projects-minimal'),
      createSectionConfig('contact', 3, {
        title: 'Contact',
        showContactForm: false,
        theme: 'minimal'
      }, 'contact-minimal')
    ],
    globalTheme: 'minimal',
    layout: 'standard'
  } as HomepageConfig,

  showcase: {
    sections: [
      createSectionConfig('hero', 1, {
        title: 'Creative Portfolio',
        subtitle: 'Digital Artist & Developer',
        theme: 'colorful'
      }, 'hero-showcase'),
      createSectionConfig('about', 2, {
        content: 'I create digital experiences that blend art and technology.',
        layout: 'image-first',
        theme: 'colorful'
      }, 'about-showcase'),
      createSectionConfig('projects', 3, {
        variant: 'featured',
        config: {
          maxItems: 8,
          title: 'Featured Work',
          layout: 'grid',
          columns: 4,
          theme: 'colorful'
        }
      }, 'projects-showcase'),
      createSectionConfig('contact', 4, {
        theme: 'colorful'
      }, 'contact-showcase')
    ],
    globalTheme: 'colorful',
    layout: 'standard'
  } as HomepageConfig
} as const;