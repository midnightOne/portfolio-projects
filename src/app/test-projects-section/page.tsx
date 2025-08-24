"use client";

import React, { useState, useEffect } from 'react';
import { ProjectsSection, ProjectsSectionPresets } from '@/components/projects/projects-section';
import type { ProjectWithRelations, Tag } from '@/lib/types/project';

export default function TestProjectsSectionPage() {
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch projects and tags
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch projects
        const projectsResponse = await fetch('/api/projects');
        const projectsData = await projectsResponse.json();
        
        // Fetch tags
        const tagsResponse = await fetch('/api/tags');
        const tagsData = await tagsResponse.json();
        
        setProjects(projectsData.data?.projects || []);
        setTags(tagsData.data?.tags || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleProjectClick = (slug: string) => {
    console.log('Project clicked:', slug);
    // In a real app, this would open a modal or navigate to project page
    alert(`Opening project: ${slug}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 space-y-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">ProjectsSection Component Test</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            This page demonstrates the different variants and configurations of the ProjectsSection component.
          </p>
        </div>

        {/* Homepage Variant */}
        <section className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold mb-2">Homepage Variant</h2>
            <p className="text-gray-600">
              Limited projects, minimal controls, perfect for homepage featured section.
            </p>
          </div>
          <ProjectsSection
            {...ProjectsSectionPresets.homepage}
            projects={projects}
            tags={tags}
            loading={loading}
            onProjectClick={handleProjectClick}
          />
        </section>

        {/* Full Page Variant */}
        <section className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold mb-2">Full Page Variant</h2>
            <p className="text-gray-600">
              All features enabled, perfect for dedicated projects page.
            </p>
          </div>
          <ProjectsSection
            {...ProjectsSectionPresets.fullPage}
            projects={projects}
            tags={tags}
            loading={loading}
            onProjectClick={handleProjectClick}
          />
        </section>

        {/* Featured Variant */}
        <section className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold mb-2">Featured Variant</h2>
            <p className="text-gray-600">
              Curated selection with custom styling, perfect for special sections.
            </p>
          </div>
          <ProjectsSection
            {...ProjectsSectionPresets.featured}
            projects={projects}
            tags={tags}
            loading={loading}
            onProjectClick={handleProjectClick}
          />
        </section>

        {/* Custom Configuration */}
        <section className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold mb-2">Custom Configuration</h2>
            <p className="text-gray-600">
              Timeline layout with colorful theme and custom settings.
            </p>
          </div>
          <ProjectsSection
            variant="full-page"
            config={{
              maxItems: 10,
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
              title: 'Custom Timeline View',
              description: 'Projects displayed in chronological order with custom styling',
              showViewCount: true
            }}
            projects={projects}
            tags={tags}
            loading={loading}
            onProjectClick={handleProjectClick}
          />
        </section>

        {/* List Layout */}
        <section className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold mb-2">List Layout</h2>
            <p className="text-gray-600">
              Detailed list view with full descriptions and metadata.
            </p>
          </div>
          <ProjectsSection
            variant="full-page"
            config={{
              layout: 'list',
              columns: 3,
              showSearch: true,
              showFilters: false,
              showSorting: true,
              showViewToggle: false,
              theme: 'minimal',
              spacing: 'normal',
              openMode: 'modal',
              sortBy: 'title',
              title: 'Detailed List View',
              showViewCount: true
            }}
            projects={projects}
            tags={tags}
            loading={loading}
            onProjectClick={handleProjectClick}
          />
        </section>

        {/* Dark Theme */}
        <section className="bg-slate-900 rounded-lg shadow-sm">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-2xl font-semibold mb-2 text-white">Dark Theme</h2>
            <p className="text-slate-300">
              Dark theme variant with high contrast design.
            </p>
          </div>
          <ProjectsSection
            variant="featured"
            config={{
              maxItems: 6,
              layout: 'grid',
              columns: 3,
              showSearch: false,
              showFilters: false,
              showSorting: false,
              showViewToggle: false,
              theme: 'dark',
              spacing: 'normal',
              openMode: 'modal',
              sortBy: 'date',
              title: 'Dark Theme Projects',
              showViewCount: false
            }}
            projects={projects}
            tags={tags}
            loading={loading}
            onProjectClick={handleProjectClick}
          />
        </section>

        {/* Loading State Demo */}
        <section className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-2xl font-semibold mb-2">Loading State</h2>
            <p className="text-gray-600">
              Demonstrates loading skeletons and empty states.
            </p>
          </div>
          <ProjectsSection
            {...ProjectsSectionPresets.fullPage}
            projects={[]}
            tags={[]}
            loading={true}
            onProjectClick={handleProjectClick}
          />
        </section>
      </div>
    </div>
  );
}