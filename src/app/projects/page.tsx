"use client";

import React from 'react';
import { ProjectsLayout } from '@/components/layout/projects-layout';
import { ProjectGrid } from '@/components/projects/project-grid';
import { useProjects } from '@/hooks/use-projects';
import type { ViewMode } from '@/components/layout/navigation-bar';

export default function ProjectsPage() {
  const {
    projects,
    tags,
    loading,
    error,
    searchQuery,
    selectedTags,
    sortBy,
    setSearchQuery,
    setSelectedTags,
    setSortBy,
  } = useProjects();

  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');

  const handleProjectClick = (projectId: string) => {
    // TODO: Implement project modal/detail view
    // For now, just log the project ID
    console.log('Opening project:', projectId);
    
    // In the future, this will:
    // 1. Update URL to /projects/[slug]
    // 2. Open project modal
    // 3. Track analytics
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Projects</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProjectsLayout
      tags={tags}
      selectedTags={selectedTags}
      onTagSelect={setSelectedTags}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      sortBy={sortBy}
      onSortChange={setSortBy}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      isLoading={loading}
    >
      {viewMode === 'grid' ? (
        <ProjectGrid
          projects={projects}
          loading={loading}
          onProjectClick={handleProjectClick}
          showViewCount={true}
        />
      ) : (
        // TODO: Implement timeline view in future iteration
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold mb-2">Timeline View</h3>
          <p className="text-muted-foreground">Timeline view will be implemented in a future iteration.</p>
          <button 
            onClick={() => setViewMode('grid')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Switch to Grid View
          </button>
        </div>
      )}
    </ProjectsLayout>
  );
}