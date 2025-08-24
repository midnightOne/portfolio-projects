"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, SortAsc, Grid, Clock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
  layout: 'grid' | 'timeline' | 'list';
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
  sortBy?: 'date' | 'title' | 'popularity';
  
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

type SortOption = 'date' | 'title' | 'popularity';
type LayoutMode = 'grid' | 'timeline' | 'list';

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
  const [sortBy, setSortBy] = useState<SortOption>(config.sortBy || 'date');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(config.layout);
  const [showFilters, setShowFilters] = useState(false);

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

  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value as SortOption);
  };

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
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

  const renderControls = () => {
    const hasAnyControls = config.showSearch || config.showFilters || config.showSorting || config.showViewToggle;
    
    if (!hasAnyControls) return null;

    return (
      <div className="mb-8 space-y-4">
        {/* Top row: Search and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          {config.showSearch && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {/* View Toggle and Sort */}
          <div className="flex items-center gap-2">
            {config.showViewToggle && (
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={layoutMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleLayoutChange('grid')}
                  className="h-8 w-8 p-0"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={layoutMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleLayoutChange('list')}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant={layoutMode === 'timeline' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleLayoutChange('timeline')}
                  className="h-8 w-8 p-0"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
            )}

            {config.showSorting && (
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-40">
                  <SortAsc className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Latest First</SelectItem>
                  <SelectItem value="title">Alphabetical</SelectItem>
                  <SelectItem value="popularity">Most Popular</SelectItem>
                </SelectContent>
              </Select>
            )}

            {config.showFilters && (
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {selectedTags.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedTags.length}
                  </Badge>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {config.showFilters && showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border rounded-lg p-4 bg-muted/50"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Filter by Tags</h3>
                {selectedTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Clear All
                  </Button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                    className="cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleTagToggle(tag.name)}
                    style={
                      tag.color && selectedTags.includes(tag.name)
                        ? {
                          backgroundColor: tag.color,
                          borderColor: tag.color,
                          color: 'white'
                        }
                        : tag.color && !selectedTags.includes(tag.name)
                        ? {
                          borderColor: tag.color,
                          color: tag.color
                        }
                        : undefined
                    }
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filters Display */}
        {selectedTags.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Active filters:</span>
            <div className="flex flex-wrap gap-1">
              {selectedTags.map((tagName) => (
                <Badge
                  key={tagName}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => handleTagToggle(tagName)}
                >
                  {tagName}
                  <button className="ml-1 hover:text-destructive">×</button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
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

    switch (layoutMode) {
      case 'grid':
        return <ProjectGrid {...commonProps} />;
      case 'list':
        return <ProjectList {...commonProps} />;
      case 'timeline':
        return <ProjectTimeline {...commonProps} groupBy="year" />;
      default:
        return <ProjectGrid {...commonProps} />;
    }
  };

  const getGridClasses = () => {
    if (layoutMode !== 'grid') return '';
    
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
        {renderControls()}
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
      layout: 'grid' as const,
      columns: 3 as const,
      showSearch: false,
      showFilters: false,
      showSorting: false,
      showViewToggle: false,
      theme: 'default',
      spacing: 'normal' as const,
      openMode: 'modal' as const,
      sortBy: 'date' as const,
      title: 'Featured Projects',
      showViewCount: false
    }
  },
  
  fullPage: {
    variant: 'full-page' as const,
    config: {
      layout: 'grid' as const,
      columns: 3 as const,
      showSearch: true,
      showFilters: true,
      showSorting: true,
      showViewToggle: true,
      theme: 'default',
      spacing: 'normal' as const,
      openMode: 'modal' as const,
      sortBy: 'date' as const,
      title: 'All Projects',
      showViewCount: true
    }
  },
  
  featured: {
    variant: 'featured' as const,
    config: {
      maxItems: 4,
      layout: 'grid' as const,
      columns: 2 as const,
      showSearch: false,
      showFilters: false,
      showSorting: false,
      showViewToggle: false,
      theme: 'default',
      spacing: 'compact' as const,
      openMode: 'modal' as const,
      sortBy: 'popularity' as const,
      title: 'Featured Work',
      showViewCount: false
    }
  }
} as const;