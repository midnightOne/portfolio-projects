/**
 * Integration tests for sorting and view mode functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavigationBar } from '@/components/layout/navigation-bar';
import { ProjectGrid } from '@/components/projects/project-grid';
import { ProjectTimeline } from '@/components/projects/project-timeline';
import type { Tag, ProjectWithRelations } from '@/lib/types/project';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
}));

const mockTags: Tag[] = [
  { id: '1', name: 'React', color: '#61dafb', createdAt: new Date() },
  { id: '2', name: 'TypeScript', color: '#3178c6', createdAt: new Date() },
];

const mockProjects: ProjectWithRelations[] = [
  {
    id: '1',
    title: 'React Project',
    slug: 'react-project',
    description: 'A React project',
    briefOverview: 'React overview',
    workDate: new Date('2023-06-15'),
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    viewCount: 150,
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2023-06-01'),
    tags: [mockTags[0]],
    thumbnailImage: null,
    mediaItems: [],
    interactiveExamples: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: [],
    _count: { mediaItems: 0, downloadableFiles: 0, externalLinks: 0, analytics: 150 },
  },
  {
    id: '2',
    title: 'TypeScript Project',
    slug: 'typescript-project',
    description: 'A TypeScript project',
    briefOverview: 'TypeScript overview',
    workDate: new Date('2022-12-10'),
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    viewCount: 89,
    createdAt: new Date('2022-12-01'),
    updatedAt: new Date('2022-12-01'),
    tags: [mockTags[1]],
    thumbnailImage: null,
    mediaItems: [],
    interactiveExamples: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: [],
    _count: { mediaItems: 0, downloadableFiles: 0, externalLinks: 0, analytics: 89 },
  },
];

describe('Sorting and View Mode Integration', () => {
  describe('NavigationBar Sorting', () => {
    const mockProps = {
      tags: mockTags,
      selectedTags: [],
      onTagSelect: jest.fn(),
      searchQuery: '',
      onSearchChange: jest.fn(),
      sortBy: 'relevance' as const,
      onSortChange: jest.fn(),
      viewMode: 'grid' as const,
      onViewModeChange: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('displays all sort options in dropdown', async () => {
      render(<NavigationBar {...mockProps} />);

      const sortButton = screen.getByText(/Sort: Relevance/);
      fireEvent.click(sortButton);

      await waitFor(() => {
        expect(screen.getByText('Relevance')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Popularity')).toBeInTheDocument();
      });
    });

    it('calls onSortChange when sort option is selected', async () => {
      render(<NavigationBar {...mockProps} />);

      const sortButton = screen.getByText(/Sort: Relevance/);
      fireEvent.click(sortButton);

      await waitFor(() => {
        const dateOption = screen.getByText('Date');
        fireEvent.click(dateOption);
      });

      expect(mockProps.onSortChange).toHaveBeenCalledWith('date');
    });

    it('shows current sort option in button text', () => {
      render(<NavigationBar {...mockProps} sortBy="popularity" />);

      expect(screen.getByText(/Sort: Popularity/)).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    const mockProps = {
      tags: mockTags,
      selectedTags: [],
      onTagSelect: jest.fn(),
      searchQuery: '',
      onSearchChange: jest.fn(),
      sortBy: 'relevance' as const,
      onSortChange: jest.fn(),
      viewMode: 'grid' as const,
      onViewModeChange: jest.fn(),
      timelineGroupBy: 'year' as const,
      onTimelineGroupByChange: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('switches between grid and timeline views', async () => {
      const { rerender } = render(<NavigationBar {...mockProps} />);

      // Initially in grid view
      expect(screen.queryByText('Year')).not.toBeInTheDocument();

      // Switch to timeline view
      const timelineButton = screen.getByRole('button', { name: /list/i });
      fireEvent.click(timelineButton);

      expect(mockProps.onViewModeChange).toHaveBeenCalledWith('timeline');

      // Re-render with timeline view
      rerender(<NavigationBar {...mockProps} viewMode="timeline" />);

      // Should show timeline grouping options
      expect(screen.getByText('Year')).toBeInTheDocument();
      expect(screen.getByText('Month')).toBeInTheDocument();
    });

    it('changes timeline grouping', async () => {
      render(<NavigationBar {...mockProps} viewMode="timeline" />);

      const monthButton = screen.getByText('Month');
      fireEvent.click(monthButton);

      expect(mockProps.onTimelineGroupByChange).toHaveBeenCalledWith('month');
    });
  });

  describe('Project Display Components', () => {
    const mockOnProjectClick = jest.fn();

    beforeEach(() => {
      mockOnProjectClick.mockClear();
    });

    it('renders projects in grid view', () => {
      render(
        <ProjectGrid
          projects={mockProjects}
          loading={false}
          onProjectClick={mockOnProjectClick}
        />
      );

      expect(screen.getByText('React Project')).toBeInTheDocument();
      expect(screen.getByText('TypeScript Project')).toBeInTheDocument();
    });

    it('renders projects in timeline view', () => {
      render(
        <ProjectTimeline
          projects={mockProjects}
          loading={false}
          onProjectClick={mockOnProjectClick}
          groupBy="year"
        />
      );

      // Should show year groupings
      expect(screen.getByText('2023')).toBeInTheDocument();
      expect(screen.getByText('2022')).toBeInTheDocument();

      // Should show projects
      expect(screen.getByText('React Project')).toBeInTheDocument();
      expect(screen.getByText('TypeScript Project')).toBeInTheDocument();
    });

    it('groups projects by month in timeline view', () => {
      render(
        <ProjectTimeline
          projects={mockProjects}
          loading={false}
          onProjectClick={mockOnProjectClick}
          groupBy="month"
        />
      );

      // Should show month groupings
      expect(screen.getByText('June 2023')).toBeInTheDocument();
      expect(screen.getByText('December 2022')).toBeInTheDocument();
    });

    it('handles project clicks in both views', async () => {
      const { rerender } = render(
        <ProjectGrid
          projects={mockProjects}
          loading={false}
          onProjectClick={mockOnProjectClick}
        />
      );

      // Click project in grid view
      const gridProject = screen.getByText('React Project');
      fireEvent.click(gridProject);

      await waitFor(() => {
        expect(mockOnProjectClick).toHaveBeenCalledWith('react-project');
      });

      mockOnProjectClick.mockClear();

      // Switch to timeline view
      rerender(
        <ProjectTimeline
          projects={mockProjects}
          loading={false}
          onProjectClick={mockOnProjectClick}
          groupBy="year"
        />
      );

      // Click project in timeline view
      const timelineProject = screen.getByText('React Project').closest('.group');
      fireEvent.click(timelineProject!);

      await waitFor(() => {
        expect(mockOnProjectClick).toHaveBeenCalledWith('react-project');
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state in grid view', () => {
      render(
        <ProjectGrid
          projects={[]}
          loading={true}
          onProjectClick={jest.fn()}
        />
      );

      // Should show skeleton loading
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('shows loading state in timeline view', () => {
      render(
        <ProjectTimeline
          projects={[]}
          loading={true}
          onProjectClick={jest.fn()}
        />
      );

      // Should show skeleton loading
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty state in grid view', () => {
      render(
        <ProjectGrid
          projects={[]}
          loading={false}
          onProjectClick={jest.fn()}
        />
      );

      expect(screen.getByText('No projects found')).toBeInTheDocument();
    });

    it('shows empty state in timeline view', () => {
      render(
        <ProjectTimeline
          projects={[]}
          loading={false}
          onProjectClick={jest.fn()}
        />
      );

      expect(screen.getByText('No projects found')).toBeInTheDocument();
    });
  });
});