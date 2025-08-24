/**
 * ProjectsSection Component Usage Examples
 * 
 * This file demonstrates how to use the ProjectsSection component
 * in different contexts with various configurations.
 */

import React from 'react';
import { ProjectsSection, ProjectsSectionPresets } from './projects-section';
import type { ProjectWithRelations, Tag } from '@/lib/types/project';

// Mock data for examples
const mockProjects: ProjectWithRelations[] = [
  // This would typically come from your API or database
];

const mockTags: Tag[] = [
  // This would typically come from your API or database
];

// ============================================================================
// EXAMPLE 1: Homepage Featured Projects
// ============================================================================

export function HomepageFeaturedProjects() {
  const handleProjectClick = (slug: string) => {
    // Handle project click - typically opens modal or navigates to project page
    console.log('Opening project:', slug);
  };

  return (
    <ProjectsSection
      {...ProjectsSectionPresets.homepage}
      projects={mockProjects}
      tags={mockTags}
      onProjectClick={handleProjectClick}
      className="bg-gray-50"
    />
  );
}

// ============================================================================
// EXAMPLE 2: Full Projects Page
// ============================================================================

export function FullProjectsPage() {
  const handleProjectClick = (slug: string) => {
    // Navigate to project detail page or open modal
    window.location.href = `/projects/${slug}`;
  };

  return (
    <ProjectsSection
      {...ProjectsSectionPresets.fullPage}
      projects={mockProjects}
      tags={mockTags}
      onProjectClick={handleProjectClick}
    />
  );
}

// ============================================================================
// EXAMPLE 3: Custom Configuration
// ============================================================================

export function CustomProjectsSection() {
  const handleProjectClick = (slug: string) => {
    console.log('Custom project click:', slug);
  };

  return (
    <ProjectsSection
      variant="full-page"
      config={{
        maxItems: 12,
        layout: 'timeline',
        columns: 3,
        showSearch: true,
        showFilters: true,
        showSorting: true,
        showViewToggle: true,
        theme: 'colorful',
        spacing: 'spacious',
        openMode: 'modal',
        sortBy: 'popularity',
        title: 'My Custom Projects',
        description: 'A curated collection of my best work',
        showViewCount: true,
        filterTags: ['React', 'TypeScript'] // Pre-filter to specific tags
      }}
      projects={mockProjects}
      tags={mockTags}
      onProjectClick={handleProjectClick}
      className="min-h-screen"
    />
  );
}

// ============================================================================
// EXAMPLE 4: Minimal Configuration (No Controls)
// ============================================================================

export function MinimalProjectsSection() {
  const handleProjectClick = (slug: string) => {
    console.log('Minimal project click:', slug);
  };

  return (
    <ProjectsSection
      variant="featured"
      config={{
        maxItems: 8,
        layout: 'grid',
        columns: 4,
        showSearch: false,
        showFilters: false,
        showSorting: false,
        showViewToggle: false,
        theme: 'minimal',
        spacing: 'compact',
        openMode: 'page',
        sortBy: 'date',
        showViewCount: false
      }}
      projects={mockProjects}
      onProjectClick={handleProjectClick}
    />
  );
}

// ============================================================================
// EXAMPLE 5: Loading State
// ============================================================================

export function LoadingProjectsSection() {
  const handleProjectClick = (slug: string) => {
    console.log('Loading project click:', slug);
  };

  return (
    <ProjectsSection
      {...ProjectsSectionPresets.fullPage}
      projects={[]} // Empty while loading
      tags={[]}
      loading={true} // Show loading skeletons
      onProjectClick={handleProjectClick}
    />
  );
}

// ============================================================================
// EXAMPLE 6: Server-Side Rendered with Client Enhancement
// ============================================================================

export function SSRProjectsSection({ 
  initialProjects, 
  initialTags 
}: { 
  initialProjects: ProjectWithRelations[];
  initialTags: Tag[];
}) {
  const handleProjectClick = (slug: string) => {
    // This could be enhanced with client-side modal
    // while still working with server-rendered content
    window.location.href = `/projects/${slug}`;
  };

  return (
    <ProjectsSection
      variant="full-page"
      config={{
        layout: 'grid',
        columns: 3,
        showSearch: true,
        showFilters: true,
        showSorting: true,
        showViewToggle: true,
        theme: 'default',
        spacing: 'normal',
        openMode: 'page', // Use page navigation for SSR
        sortBy: 'date',
        title: 'All Projects',
        showViewCount: true
      }}
      projects={initialProjects} // Pre-loaded from server
      tags={initialTags}
      onProjectClick={handleProjectClick}
    />
  );
}

// ============================================================================
// USAGE NOTES
// ============================================================================

/*
Key Features:

1. **Variant System**: 
   - 'homepage': Limited projects, minimal controls
   - 'full-page': All features enabled
   - 'featured': Curated selection with custom styling

2. **Layout Modes**:
   - 'grid': Card-based grid layout
   - 'list': Detailed list view
   - 'timeline': Chronological timeline view

3. **Configurable Features**:
   - Search functionality
   - Tag-based filtering
   - Sorting options (date, title, popularity)
   - View mode toggle
   - Custom theming and spacing

4. **Responsive Design**:
   - Automatically adapts to screen size
   - Configurable column counts for grid layout
   - Mobile-optimized controls

5. **Performance**:
   - Supports server-side rendering
   - Efficient filtering and sorting
   - Loading states and skeletons

6. **Accessibility**:
   - Keyboard navigation
   - Screen reader support
   - Focus management

7. **Customization**:
   - Theme variants (default, dark, minimal, colorful)
   - Spacing options (compact, normal, spacious)
   - Custom CSS classes
   - Preset configurations for common use cases

Usage in different contexts:
- Homepage: Use 'homepage' variant with limited features
- Dedicated projects page: Use 'full-page' variant with all features
- Portfolio sections: Use 'featured' variant with custom styling
- Admin interfaces: Use custom config with specific requirements
*/