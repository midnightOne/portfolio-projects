/**
 * SSR-Compatible Component Variants - UI System
 * 
 * SSR-compatible versions of enhanced components that work with server-side rendering.
 * These components render with server data and progressively enhance with client features.
 */

"use client";

import React from 'react';
import { useEffect, useState } from 'react';
import type { ProjectWithRelations } from '@/lib/types/project';
import type { Tag } from '@/lib/types/project';
import type { AIControlProps } from '@/lib/ui/types';

// Import original components for SSR fallback
import { ProjectModal } from '../../projects/project-modal';
import { ProjectGrid } from '../../projects/project-grid';
import { NavigationBar } from '../../layout/navigation-bar';

// Import enhanced components for client-side enhancement
import { EnhancedProjectModal } from '../../projects/enhanced-project-modal';
import { EnhancedProjectGrid } from '../../projects/enhanced-project-grid';
import { EnhancedNavigationBar } from '../../layout/enhanced-navigation-bar';

interface SSRCompatibleComponent {
  initialData?: any;
  enableClientFeatures?: boolean;
  aiEnabled?: boolean;
}

// SSR-Compatible Project Modal
interface SSRProjectModalProps extends AIControlProps, SSRCompatibleComponent {
  project: ProjectWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
  aiId?: string;
}

export function SSRProjectModal({
  project,
  isOpen,
  onClose,
  loading = false,
  enableClientFeatures = true,
  aiEnabled = false,
  ...aiProps
}: SSRProjectModalProps) {
  const [isClient, setIsClient] = useState(false);
  const [clientFeaturesEnabled, setClientFeaturesEnabled] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Enable client features after hydration
    if (enableClientFeatures) {
      const timer = setTimeout(() => {
        setClientFeaturesEnabled(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [enableClientFeatures]);

  // Server-side render: Use original component
  if (!isClient) {
    return (
      <ProjectModal
        project={project}
        isOpen={isOpen}
        onClose={onClose}
        loading={loading}
      />
    );
  }

  // Client-side render: Use enhanced component if features are enabled
  if (clientFeaturesEnabled && (enableClientFeatures || aiEnabled)) {
    return (
      <EnhancedProjectModal
        project={project}
        isOpen={isOpen}
        onClose={onClose}
        loading={loading}
        aiControlEnabled={aiEnabled}
        animated={enableClientFeatures}
        {...aiProps}
      />
    );
  }

  // Fallback: Use original component during hydration
  return (
    <ProjectModal
      project={project}
      isOpen={isOpen}
      onClose={onClose}
      loading={loading}
    />
  );
}

// SSR-Compatible Project Grid
interface SSRProjectGridProps extends AIControlProps, SSRCompatibleComponent {
  projects: ProjectWithRelations[];
  loading: boolean;
  onProjectClick: (projectSlug: string) => void;
  showViewCount?: boolean;
  className?: string;
  searchQuery?: string;
  aiId?: string;
}

export function SSRProjectGrid({
  projects,
  loading,
  onProjectClick,
  showViewCount = true,
  className,
  searchQuery = '',
  enableClientFeatures = true,
  aiEnabled = false,
  ...aiProps
}: SSRProjectGridProps) {
  const [isClient, setIsClient] = useState(false);
  const [clientFeaturesEnabled, setClientFeaturesEnabled] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    if (enableClientFeatures) {
      const timer = setTimeout(() => {
        setClientFeaturesEnabled(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [enableClientFeatures]);

  // Server-side render: Use original component
  if (!isClient) {
    return (
      <ProjectGrid
        projects={projects}
        loading={loading}
        onProjectClick={onProjectClick}
        showViewCount={showViewCount}
        className={className}
        searchQuery={searchQuery}
      />
    );
  }

  // Client-side render: Use enhanced component if features are enabled
  if (clientFeaturesEnabled && (enableClientFeatures || aiEnabled)) {
    return (
      <EnhancedProjectGrid
        projects={projects}
        loading={loading}
        onProjectClick={onProjectClick}
        showViewCount={showViewCount}
        className={className}
        searchQuery={searchQuery}
        aiControlEnabled={aiEnabled}
        animated={enableClientFeatures}
        {...aiProps}
      />
    );
  }

  // Fallback: Use original component during hydration
  return (
    <ProjectGrid
      projects={projects}
      loading={loading}
      onProjectClick={onProjectClick}
      showViewCount={showViewCount}
      className={className}
      searchQuery={searchQuery}
    />
  );
}

// SSR-Compatible Navigation Bar
interface SSRNavigationBarProps extends AIControlProps, SSRCompatibleComponent {
  tags: Tag[];
  selectedTags: string[];
  onTagSelect: (tags: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'relevance' | 'date' | 'title' | 'popularity';
  onSortChange: (sort: 'relevance' | 'date' | 'title' | 'popularity') => void;
  viewMode: 'grid' | 'list' | 'timeline';
  onViewModeChange: (mode: 'grid' | 'list' | 'timeline') => void;
  timelineGroupBy?: 'year' | 'month';
  onTimelineGroupByChange?: (groupBy: 'year' | 'month') => void;
  isLoading?: boolean;
  canSearch?: boolean;
  canFilter?: boolean;
  tagsLoading?: boolean;
  loadingMessage?: string;
  aiId?: string;
  isSearching?: boolean;
  searchResultsCount?: number;
  variant?: 'page' | 'section';
}

export function SSRNavigationBar({
  tags,
  selectedTags,
  onTagSelect,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  timelineGroupBy = 'year',
  onTimelineGroupByChange,
  isLoading = false,
  canSearch = true,
  canFilter = true,
  tagsLoading = false,
  loadingMessage,
  isSearching = false,
  searchResultsCount,
  variant = 'page',
  enableClientFeatures = true,
  aiEnabled = false,
  ...aiProps
}: SSRNavigationBarProps) {
  const [isClient, setIsClient] = useState(false);
  const [clientFeaturesEnabled, setClientFeaturesEnabled] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    if (enableClientFeatures) {
      const timer = setTimeout(() => {
        setClientFeaturesEnabled(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [enableClientFeatures]);

  // Server-side render: Use original component
  if (!isClient) {
    return (
      <NavigationBar
        tags={tags}
        selectedTags={selectedTags}
        onTagSelect={onTagSelect}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        timelineGroupBy={timelineGroupBy}
        onTimelineGroupByChange={onTimelineGroupByChange}
        isLoading={isLoading}
        canSearch={canSearch}
        canFilter={canFilter}
        tagsLoading={tagsLoading}
        loadingMessage={loadingMessage}
        isSearching={isSearching}
        searchResultsCount={searchResultsCount}
        variant={variant}
      />
    );
  }

  // Client-side render: Use enhanced component if features are enabled
  if (clientFeaturesEnabled && (enableClientFeatures || aiEnabled)) {
    return (
      <EnhancedNavigationBar
        tags={tags}
        selectedTags={selectedTags}
        onTagSelect={onTagSelect}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        timelineGroupBy={timelineGroupBy}
        onTimelineGroupByChange={onTimelineGroupByChange}
        isLoading={isLoading}
        canSearch={canSearch}
        canFilter={canFilter}
        tagsLoading={tagsLoading}
        loadingMessage={loadingMessage}
        isSearching={isSearching}
        searchResultsCount={searchResultsCount}
        variant={variant}
        aiControlEnabled={aiEnabled}
        animated={enableClientFeatures}
        {...aiProps}
      />
    );
  }

  // Fallback: Use original component during hydration
  return (
    <NavigationBar
      tags={tags}
      selectedTags={selectedTags}
      onTagSelect={onTagSelect}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      sortBy={sortBy}
      onSortChange={onSortChange}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      timelineGroupBy={timelineGroupBy}
      onTimelineGroupByChange={onTimelineGroupByChange}
      isLoading={isLoading}
      canSearch={canSearch}
      canFilter={canFilter}
      tagsLoading={tagsLoading}
      loadingMessage={loadingMessage}
      isSearching={isSearching}
      searchResultsCount={searchResultsCount}
      variant={variant}
    />
  );
}

// Progressive Enhancement Hook
export function useProgressiveEnhancement(enableClientFeatures: boolean = true) {
  const [isClient, setIsClient] = useState(false);
  const [clientFeaturesEnabled, setClientFeaturesEnabled] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    if (enableClientFeatures) {
      const timer = setTimeout(() => {
        setClientFeaturesEnabled(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [enableClientFeatures]);

  return {
    isClient,
    clientFeaturesEnabled,
    shouldUseEnhanced: clientFeaturesEnabled && enableClientFeatures,
  };
}

export type {
  SSRProjectModalProps,
  SSRProjectGridProps,
  SSRNavigationBarProps,
  SSRCompatibleComponent,
};