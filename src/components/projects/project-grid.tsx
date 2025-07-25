"use client";

import React from 'react';
import { ProjectCard } from './project-card';
import { ProjectGridSkeleton } from './project-grid-skeleton';
import type { ProjectWithRelations } from '@/lib/types/project';

interface ProjectGridProps {
  projects: ProjectWithRelations[];
  loading: boolean;
  onProjectClick: (projectId: string) => void;
  showViewCount?: boolean;
  className?: string;
}

export function ProjectGrid({ 
  projects, 
  loading, 
  onProjectClick, 
  showViewCount = true,
  className 
}: ProjectGridProps) {
  if (loading) {
    return <ProjectGridSkeleton />;
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">No projects found</h3>
        <p className="text-muted-foreground max-w-md">
          Try adjusting your search terms or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className || ''}`}>
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={() => onProjectClick(project.id)}
          showViewCount={showViewCount}
        />
      ))}
    </div>
  );
}