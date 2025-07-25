"use client";

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProjectsLayout } from '@/components/layout/projects-layout';
import { ProjectGrid } from '@/components/projects/project-grid';
import { ProjectModal } from '@/components/projects/project-modal';
import { useProjects } from '@/hooks/use-projects';
import type { ViewMode } from '@/components/layout/navigation-bar';
import type { ProjectWithRelations } from '@/lib/types/project';

function ProjectsPageContent() {
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

  const handleProjectClick = async (projectSlug: string, updateUrl: boolean = true) => {
    setProjectLoading(true);
    setProjectModalOpen(true);
    
    if (updateUrl) {
      // Update URL without causing a full navigation
      const url = new URL(window.location.href);
      url.searchParams.set('project', projectSlug);
      window.history.pushState({}, '', url.toString());
    }
    
    const projectDetails = await fetchProjectDetails(projectSlug);
    if (projectDetails) {
      setSelectedProject(projectDetails);
    } else {
      // Project not found, close modal and remove from URL
      setProjectModalOpen(false);
      if (updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.delete('project');
        window.history.pushState({}, '', url.toString());
      }
    }
  };

  const handleCloseModal = (updateUrl: boolean = true) => {
    setSelectedProject(null);
    setProjectModalOpen(false);
    setProjectLoading(false);
    
    if (updateUrl) {
      // Remove project from URL without causing a full navigation
      const url = new URL(window.location.href);
      url.searchParams.delete('project');
      window.history.pushState({}, '', url.toString());
    }
  };

  // Handle browser back/forward
  React.useEffect(() => {
    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const projectSlug = currentParams.get('project');
      
      if (projectSlug && !projectModalOpen) {
        handleProjectClick(projectSlug, false);
      } else if (!projectSlug && projectModalOpen) {
        handleCloseModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handleCloseModal, handleProjectClick]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Projects</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectsLayout
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      selectedTags={selectedTags}
      onTagSelect={setSelectedTags}
      tags={tags}
      sortBy={sortBy}
      onSortChange={setSortBy}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
    >
      <ProjectGrid
        projects={projects}
        loading={loading}
        onProjectClick={(projectId) => handleProjectClick(projectId)}
      />
      
      <ProjectModal
        project={selectedProject}
        isOpen={projectModalOpen}
        onClose={() => handleCloseModal()}
        loading={projectLoading}
      />
    </ProjectsLayout>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    }>
      <ProjectsPageContent />
    </Suspense>
  );
}