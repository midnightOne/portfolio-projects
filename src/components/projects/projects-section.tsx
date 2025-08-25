"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NavigationBar, type SortOption, type ViewMode, type TimelineGroupBy } from '@/components/layout/navigation-bar';
import { ProjectGrid } from './project-grid';
import { ProjectList } from './project-list';
import { ProjectTimeline } from './project-timeline';
import type { ProjectWithRelations, Tag } from '@/lib/types/project';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ProjectsSectionConfig {
  // Display options
  maxItems?: number; // undefined = show all
  layout: ViewMode;
  columns?: 2 | 3 | 4; // for grid layout
  
  // Features
  showSearch: boolean;
  showFilters: boolean;
  showSorting: boolean;
  showViewToggle: boolean; // grid/timeline/list toggle
  
  // Styling
  theme?: 'default' | 'dark' | 'minimal' | 'colorful';
  spacing: 'compact' | 'normal' | 'spacious';
  
  // Behavior
  openMode: 'modal' | 'page'; // how projects open
  filterTags?: string[]; // pre-filter to specific tags
  sortBy?: SortOption;
  timelineGroupBy?: TimelineGroupBy;
  
  // Content
  title?: string;
  description?: string;
  showViewCount?: boolean;
}

export interface ProjectsSectionProps {
  variant: 'homepage' | 'full-page' | 'featured';
  config: ProjectsSectionConfig;
  projects?: ProjectWithRelations[]; // For SSR or pre-loaded data
  tags?: Tag[]; // Available tags for filtering
  loading?: boolean;
  onProjectClick: (projectSlug: string) => void;
  className?: string;
}

// Remove these type definitions as they're now imported from navigation-bar

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function filterProjects(
  projects: ProjectWithRelations[],
  searchQuery: string,
  selectedTags: string[],
  maxItems?: number
): ProjectWithRelations[] {
  let filtered = projects;

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(project =>
      project.title.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      project.briefOverview?.toLowerCase().includes(query) ||
      project.tags.some(tag => tag.name.toLowerCase().includes(query))
    );
  }

  // Apply tag filter
  if (selectedTags.length > 0) {
    filtered = filtered.filter(project =>
      project.tags.some(tag => selectedTags.includes(tag.name))
    );
  }

  // Apply max items limit
  if (maxItems && maxItems > 0) {
    filtered = filtered.slice(0, maxItems);
  }

  return filtered;
}

function sortProjects(
  projects: ProjectWithRelations[],
  sortBy: SortOption
): ProjectWithRelations[] {
  const sorted = [...projects];

  switch (sortBy) {
    case 'relevance':
      // For relevance, we'll use the original order (assuming it's already relevance-sorted)
      return sorted;
    case 'date':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.workDate || a.createdAt);
        const dateB = new Date(b.workDate || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'popularity':
      return sorted.sort((a, b) => b.viewCount - a.viewCount);
    default:
      return sorted;
  }
}

function getThemeClasses(theme: string = 'default', spacing: string = 'normal'): string {
  const themeClasses = {
    default: 'bg-background text-foreground',
    dark: 'bg-slate-900 text-slate-100',
    minimal: 'bg-white text-gray-900',
    colorful: 'bg-gradient-to-br from-blue-50 to-purple-50 text-gray-900'
  };

  const spacingClasses = {
    compact: 'py-8 px-4',
    normal: 'py-12 px-6',
    spacious: 'py-16 px-8'
  };

  return cn(
    themeClasses[theme as keyof typeof themeClasses] || themeClasses.default,
    spacingClasses[spacing as keyof typeof spacingClasses] || spacingClasses.normal
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProjectsSection({
  variant,
  config,
  projects = [],
  tags = [],
  loading = false,
  onProjectClick,
  className
}: ProjectsSectionProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(config.filterTags || []);
  const [sortBy, setSortBy] = useState<SortOption>(config.sortBy || 'relevance');
  const [viewMode, setViewMode] = useState<ViewMode>(config.layout);
  const [timelineGroupBy, setTimelineGroupBy] = useState<TimelineGroupBy>(config.timelineGroupBy || 'year');

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredAndSortedProjects = useMemo(() => {
    const filtered = filterProjects(projects, searchQuery, selectedTags, config.maxItems);
    return sortProjects(filtered, sortBy);
  }, [projects, searchQuery, selectedTags, sortBy, config.maxItems]);

  const availableTags = useMemo(() => {
    // Get unique tags from projects if not provided
    if (tags.length > 0) return tags;
    
    const tagMap = new Map<string, Tag>();
    projects.forEach(project => {
      project.tags.forEach(tag => {
        tagMap.set(tag.id, tag);
      });
    });
    
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, tags]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleTagSelect = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleTimelineGroupByChange = (groupBy: TimelineGroupBy) => {
    setTimelineGroupBy(groupBy);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderHeader = () => {
    if (!config.title && !config.description) return null;

    return (
      <div className="mb-8 text-center">
        {config.title && (
          <h2 className="text-3xl font-bold mb-4">{config.title}</h2>
        )}
        {config.description && (
          <p className="text-muted-foreground max-w-2xl mx-auto">{config.description}</p>
        )}
      </div>
    );
  };

  const renderNavigationBar = () => {
    const hasAnyControls = config.showSearch || config.showFilters || config.showSorting || config.showViewToggle;
    
    if (!hasAnyControls) return null;

    return (
      <NavigationBar
        tags={availableTags}
        selectedTags={selectedTags}
        onTagSelect={handleTagSelect}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        timelineGroupBy={timelineGroupBy}
        onTimelineGroupByChange={handleTimelineGroupByChange}
        isLoading={loading}
        canSearch={config.showSearch}
        canFilter={config.showFilters}
        tagsLoading={loading}
        searchResultsCount={filteredAndSortedProjects.length}
        variant="section"
      />
    );
  };

  const renderProjects = () => {
    const commonProps = {
      projects: filteredAndSortedProjects,
      loading,
      onProjectClick,
      showViewCount: config.showViewCount ?? true,
      searchQuery,
      className: getGridClasses()
    };

    switch (viewMode) {
      case 'grid':
        return <ProjectGrid {...commonProps} />;
      case 'list':
        return <ProjectList {...commonProps} />;
      case 'timeline':
        return <ProjectTimeline {...commonProps} groupBy={timelineGroupBy} />;
      default:
        return <ProjectGrid {...commonProps} />;
    }
  };

  const getGridClasses = () => {
    if (viewMode !== 'grid') return '';
    
    const columnClasses = {
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    };

    return columnClasses[config.columns || 3];
  };

  const renderStats = () => {
    if (variant === 'homepage' && !config.showSearch) return null;

    const totalProjects = projects.length;
    const filteredCount = filteredAndSortedProjects.length;
    const hasFilters = searchQuery || selectedTags.length > 0;

    if (!hasFilters && variant === 'homepage') return null;

    return (
      <div className="mb-4 text-sm text-muted-foreground">
        {hasFilters ? (
          <span>
            Showing {filteredCount} of {totalProjects} projects
          </span>
        ) : (
          <span>
            {totalProjects} project{totalProjects !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <section className={cn(getThemeClasses(config.theme, config.spacing), className)}>
      <div className="container mx-auto max-w-7xl">
        {renderHeader()}
        {renderNavigationBar()}
        {renderStats()}
        {renderProjects()}
      </div>
    </section>
  );
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const ProjectsSectionPresets = {
  homepage: {
    variant: 'homepage' as const,
    config: {
      maxItems: 6,
      layout: 'grid' as ViewMode,
      columns: 3 as const,
      showSearch: false,
      showFilters: false,
      showSorting: false,
      showViewToggle: false,
      theme: 'default',
      spacing: 'normal' as const,
      openMode: 'modal' as const,
      sortBy: 'relevance' as SortOption,
      timelineGroupBy: 'year' as TimelineGroupBy,
      title: 'Featured Projects',
      showViewCount: false
    }
  },
  
  fullPage: {
    variant: 'full-page' as const,
    config: {
      layout: 'grid' as ViewMode,
      columns: 3 as const,
      showSearch: true,
      showFilters: true,
      showSorting: true,
      showViewToggle: true,
      theme: 'default',
      spacing: 'normal' as const,
      openMode: 'modal' as const,
      sortBy: 'relevance' as SortOption,
      timelineGroupBy: 'year' as TimelineGroupBy,
      title: 'All Projects',
      showViewCount: true
    }
  },
  
  featured: {
    variant: 'featured' as const,
    config: {
      maxItems: 4,
      layout: 'grid' as ViewMode,
      columns: 2 as const,
      showSearch: false,
      showFilters: false,
      showSorting: false,
      showViewToggle: false,
      theme: 'default',
      spacing: 'compact' as const,
      openMode: 'modal' as const,
      sortBy: 'popularity' as SortOption,
      timelineGroupBy: 'year' as TimelineGroupBy,
      title: 'Featured Work',
      showViewCount: false
    }
  }
} as const;