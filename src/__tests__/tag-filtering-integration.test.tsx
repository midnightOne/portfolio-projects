/**
 * Integration test for tag filtering with animations
 * Tests the complete flow from tag selection to project filtering
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavigationBar } from '@/components/layout/navigation-bar';
import { ProjectGrid } from '@/components/projects/project-grid';
import type { Tag, ProjectWithRelations } from '@/lib/types/project';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
}));

const mockTags: Tag[] = [
  { id: '1', name: 'React', color: '#61DAFB', createdAt: new Date() },
  { id: '2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() },
  { id: '3', name: 'XR', color: '#FF6B6B', createdAt: new Date() },
];

const mockProjects: ProjectWithRelations[] = [
  {
    id: '1',
    title: 'React Project',
    slug: 'react-project',
    description: 'A React-based project',
    briefOverview: 'React project overview',
    workDate: new Date(),
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    viewCount: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [mockTags[0]], // React tag
    mediaItems: [],
    interactiveExamples: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: [],
  },
  {
    id: '2',
    title: 'XR Experience',
    slug: 'xr-experience',
    description: 'An XR project',
    briefOverview: 'XR project overview',
    workDate: new Date(),
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    viewCount: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [mockTags[2]], // XR tag
    mediaItems: [],
    interactiveExamples: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: [],
  },
];

describe('Tag Filtering Integration', () => {
  it('filters projects when tags are selected', async () => {
    const mockOnTagSelect = jest.fn();
    const mockOnProjectClick = jest.fn();

    // Render navigation bar with all projects initially
    const { rerender } = render(
      <div>
        <NavigationBar
          tags={mockTags}
          selectedTags={[]}
          onTagSelect={mockOnTagSelect}
          searchQuery=""
          onSearchChange={jest.fn()}
          sortBy="relevance"
          onSortChange={jest.fn()}
          viewMode="grid"
          onViewModeChange={jest.fn()}
          canSearch={true}
          canFilter={true}
          searchResultsCount={2}
        />
        <ProjectGrid
          projects={mockProjects}
          loading={false}
          onProjectClick={mockOnProjectClick}
        />
      </div>
    );

    // Initially, both projects should be visible
    expect(screen.getByText('React Project')).toBeInTheDocument();
    expect(screen.getByText('XR Experience')).toBeInTheDocument();

    // Click on React tag (get the first one which should be the clickable badge)
    const reactTags = screen.getAllByText('React');
    const reactTag = reactTags.find(el => el.closest('[role="button"], button, .cursor-pointer')) || reactTags[0];
    fireEvent.click(reactTag);

    // Verify the callback was called
    expect(mockOnTagSelect).toHaveBeenCalledWith(['React']);

    // Simulate the filtering by re-rendering with filtered projects
    rerender(
      <div>
        <NavigationBar
          tags={mockTags}
          selectedTags={['React']}
          onTagSelect={mockOnTagSelect}
          searchQuery=""
          onSearchChange={jest.fn()}
          sortBy="relevance"
          onSortChange={jest.fn()}
          viewMode="grid"
          onViewModeChange={jest.fn()}
          canSearch={true}
          canFilter={true}
          searchResultsCount={1}
        />
        <ProjectGrid
          projects={[mockProjects[0]]} // Only React project
          loading={false}
          onProjectClick={mockOnProjectClick}
        />
      </div>
    );

    // Now only React project should be visible
    expect(screen.getByText('React Project')).toBeInTheDocument();
    expect(screen.queryByText('XR Experience')).not.toBeInTheDocument();

    // Check that the tag is shown as selected
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('Filtered by:')).toBeInTheDocument();
  });

  it('shows multiple tag selection correctly', async () => {
    const mockOnTagSelect = jest.fn();
    const mockOnProjectClick = jest.fn();

    render(
      <div>
        <NavigationBar
          tags={mockTags}
          selectedTags={['React', 'XR']}
          onTagSelect={mockOnTagSelect}
          searchQuery=""
          onSearchChange={jest.fn()}
          sortBy="relevance"
          onSortChange={jest.fn()}
          viewMode="grid"
          onViewModeChange={jest.fn()}
          canSearch={true}
          canFilter={true}
          searchResultsCount={2}
        />
        <ProjectGrid
          projects={mockProjects}
          loading={false}
          onProjectClick={mockOnProjectClick}
        />
      </div>
    );

    // Both projects should be visible (OR logic for multiple tags)
    expect(screen.getByText('React Project')).toBeInTheDocument();
    expect(screen.getByText('XR Experience')).toBeInTheDocument();

    // Should show both selected tags
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks).toHaveLength(2);

    // Should show filtered by section
    expect(screen.getByText('Filtered by:')).toBeInTheDocument();
    
    // Should show both tag names in the summary
    const reactSummaryTags = screen.getAllByText('React');
    const xrSummaryTags = screen.getAllByText('XR');
    
    // Each tag appears in the filter badges and in the summary
    expect(reactSummaryTags.length).toBeGreaterThan(1);
    expect(xrSummaryTags.length).toBeGreaterThan(1);
  });

  it('clears filters correctly', async () => {
    const mockOnTagSelect = jest.fn();
    const mockOnSearchChange = jest.fn();
    const mockOnProjectClick = jest.fn();

    render(
      <div>
        <NavigationBar
          tags={mockTags}
          selectedTags={['React']}
          onTagSelect={mockOnTagSelect}
          searchQuery=""
          onSearchChange={mockOnSearchChange}
          sortBy="relevance"
          onSortChange={jest.fn()}
          viewMode="grid"
          onViewModeChange={jest.fn()}
          canSearch={true}
          canFilter={true}
          searchResultsCount={1}
        />
        <ProjectGrid
          projects={[mockProjects[0]]}
          loading={false}
          onProjectClick={mockOnProjectClick}
        />
      </div>
    );

    // Clear button should be visible
    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeInTheDocument();

    // Click clear button
    fireEvent.click(clearButton);

    // Verify callbacks were called
    expect(mockOnTagSelect).toHaveBeenCalledWith([]);
    expect(mockOnSearchChange).toHaveBeenCalledWith('');
  });

  it('shows empty state when no projects match filters', () => {
    const mockOnProjectClick = jest.fn();

    render(
      <div>
        <NavigationBar
          tags={mockTags}
          selectedTags={['TypeScript']}
          onTagSelect={jest.fn()}
          searchQuery=""
          onSearchChange={jest.fn()}
          sortBy="relevance"
          onSortChange={jest.fn()}
          viewMode="grid"
          onViewModeChange={jest.fn()}
          canSearch={true}
          canFilter={true}
          searchResultsCount={0}
        />
        <ProjectGrid
          projects={[]} // No projects match
          loading={false}
          onProjectClick={mockOnProjectClick}
        />
      </div>
    );

    // Should show empty state
    expect(screen.getByText('No projects found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search terms or filters to find what you\'re looking for.')).toBeInTheDocument();

    // Should still show the filter is active
    expect(screen.getByText('Filtered by:')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('handles loading states correctly', () => {
    const mockOnProjectClick = jest.fn();

    render(
      <div>
        <NavigationBar
          tags={mockTags}
          selectedTags={[]}
          onTagSelect={jest.fn()}
          searchQuery=""
          onSearchChange={jest.fn()}
          sortBy="relevance"
          onSortChange={jest.fn()}
          viewMode="grid"
          onViewModeChange={jest.fn()}
          canSearch={false}
          canFilter={false}
          tagsLoading={true}
          loadingMessage="Loading projects and filters..."
        />
        <ProjectGrid
          projects={[]}
          loading={true}
          onProjectClick={mockOnProjectClick}
        />
      </div>
    );

    // Should show loading message
    expect(screen.getByText('Loading projects and filters...')).toBeInTheDocument();

    // Should show tag loading skeletons
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);

    // Tags should be disabled
    const searchInput = screen.getByPlaceholderText('Loading projects...');
    expect(searchInput).toBeDisabled();
  });
});