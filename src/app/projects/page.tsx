"use client";

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProjectsLayout } from '@/components/layout/projects-layout';
import { ProjectGrid } from '@/components/projects/project-grid';
import { ProjectModal } from '@/components/projects/project-modal';
import { useProjects } from '@/hooks/use-projects';
import type { ViewMode } from '@/components/layout/navigation-bar';
import type { ProjectWithRelations } from '@/lib/types/project';

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
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
  const [selectedProject, setSelectedProject] = React.useState<ProjectWithRelations | null>(null);
  const [projectModalOpen, setProjectModalOpen] = React.useState(false);
  const [projectLoading, setProjectLoading] = React.useState(false);

  // Handle URL-based project opening
  React.useEffect(() => {
    const projectSlug = searchParams.get('project');
    if (projectSlug && !projectModalOpen) {
      handleProjectClick(projectSlug, false);
    } else if (!projectSlug && projectModalOpen) {
      handleCloseModal(false);
    }
  }, [searchParams.get('project')]);

  const fetchProjectDetails = async (projectSlug: string): Promise<ProjectWithRelations | null> => {
    try {
            setProjectLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.error('Project not found:', projectSlug);
          return null;
        }
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data?.project;
    } catch (error) {
      console.error('Error fetching project details:', error);
      return null;
    } finally {
      setProjectLoading(false);
    }
  };

  const handleProjectClick = async (projectId: string, updateUrl: boolean = true) => {
    // Try to find project in current list first (for basic info)
    const existingProject = projects.find(p => p.id === projectId || p.slug === projectId);
    
    if (existingProject) {
      setSelectedProject(existingProject);
      setProjectModalOpen(true);
      
      if (updateUrl) {
        // Update URL to reflect selected project
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.set('project', existingProject.slug);
        router.push(`/projects?${newSearchParams.toString()}`, { scroll: false });
      }
      
      // Fetch full project details (this will also track analytics via the API)
      const fullProject = await fetchProjectDetails(existingProject.slug);
      if (fullProject) {
        setSelectedProject(fullProject);
      }
    } else {
      // If project not in current list, fetch it directly
      setProjectModalOpen(true);
      const fullProject = await fetchProjectDetails(projectId);
      if (fullProject) {
        setSelectedProject(fullProject);
        
        if (updateUrl) {
          const newSearchParams = new URLSearchParams(searchParams.toString());
          newSearchParams.set('project', fullProject.slug);
          router.push(`/projects?${newSearchParams.toString()}`, { scroll: false });
        }
      } else {
        // Project not found, close modal
        setProjectModalOpen(false);
        if (updateUrl) {
          const newSearchParams = new URLSearchParams(searchParams.toString());
          newSearchParams.delete('project');
          router.push(`/projects?${newSearchParams.toString()}`, { scroll: false });
        }
      }
    }
  };

  const handleCloseModal = (updateUrl: boolean = true) => {
    setProjectModalOpen(false);
    setSelectedProject(null);
    setProjectLoading(false);
    
    if (updateUrl) {
      // Remove project from URL
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete('project');
      const newUrl = newSearchParams.toString() 
        ? `/projects?${newSearchParams.toString()}`
        : '/projects';
      router.push(newUrl, { scroll: false });
    }
  };

  // Handle browser back/forward
  React.useEffect(() => {
    const handlePopState = () => {
      const projectSlug = new URLSearchParams(window.location.search).get('project');
      if (projectSlug && !projectModalOpen) {
        handleProjectClick(projectSlug, false);
      } else if (!projectSlug && projectModalOpen) {
        handleCloseModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [projectModalOpen]);

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
    <>
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

      {/* Project Detail Modal */}
      <ProjectModal
        project={selectedProject}
        isOpen={projectModalOpen}
        onClose={() => handleCloseModal()}
        loading={projectLoading}
      />
    </>
  );
}