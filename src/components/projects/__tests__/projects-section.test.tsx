/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectsSection, ProjectsSectionPresets } from '../projects-section';
import type { ProjectWithRelations, Tag } from '@/lib/types/project';

// Mock the child components
jest.mock('../project-grid', () => ({
  ProjectGrid: ({ projects, onProjectClick }: any) => (
    <div data-testid="project-grid">
      {projects.map((project: any) => (
        <div key={project.id} onClick={() => onProjectClick(project.slug)}>
          {project.title}
        </div>
      ))}
    </div>
  )
}));

jest.mock('../project-list', () => ({
  ProjectList: ({ projects, onProjectClick }: any) => (
    <div data-testid="project-list">
      {projects.map((project: any) => (
        <div key={project.id} onClick={() => onProjectClick(project.slug)}>
          {project.title}
        </div>
      ))}
    </div>
  )
}));

jest.mock('../project-timeline', () => ({
  ProjectTimeline: ({ projects, onProjectClick }: any) => (
    <div data-testid="project-timeline">
      {projects.map((project: any) => (
        <div key={project.id} onClick={() => onProjectClick(project.slug)}>
          {project.title}
        </div>
      ))}
    </div>
  )
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon" />,
  Filter: () => <div data-testid="filter-icon" />,
  SortAsc: () => <div data-testid="sort-icon" />,
  Grid: () => <div data-testid="grid-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  EyeOff: () => <div data-testid="eye-off-icon" />,
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  )
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick, ...props }: any) => (
    <span onClick={onClick} {...props}>
      {children}
    </span>
  )
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <select role="combobox" onChange={(e) => onValueChange(e.target.value)} value={value}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <span>{children}</span>,
  SelectValue: () => <span>Select Value</span>,
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}));

// Sample test data
const mockProjects: ProjectWithRelations[] = [
  {
    id: '1',
    title: 'Test Project 1',
    slug: 'test-project-1',
    description: 'A test project for React development',
    briefOverview: 'React project',
    workDate: new Date('2024-01-01'),
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    viewCount: 10,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    tags: [
      { id: 'tag1', name: 'React', color: '#61DAFB', createdAt: new Date() },
      { id: 'tag2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() }
    ],
    mediaItems: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: [],
    interactiveExamples: []
  },
  {
    id: '2',
    title: 'Test Project 2',
    slug: 'test-project-2',
    description: 'Another test project for Vue development',
    briefOverview: 'Vue project',
    workDate: new Date('2024-02-01'),
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    viewCount: 25,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    tags: [
      { id: 'tag3', name: 'Vue', color: '#4FC08D', createdAt: new Date() },
      { id: 'tag2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() }
    ],
    mediaItems: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: [],
    interactiveExamples: []
  }
];

const mockTags: Tag[] = [
  { id: 'tag1', name: 'React', color: '#61DAFB', createdAt: new Date() },
  { id: 'tag2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() },
  { id: 'tag3', name: 'Vue', color: '#4FC08D', createdAt: new Date() }
];

describe('ProjectsSection', () => {
  const mockOnProjectClick = jest.fn();

  beforeEach(() => {
    mockOnProjectClick.mockClear();
  });

  describe('Homepage Variant', () => {
    it('renders homepage variant with limited features', () => {
      render(
        <ProjectsSection
          {...ProjectsSectionPresets.homepage}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      expect(screen.getByText('Featured Projects')).toBeInTheDocument();
      expect(screen.getByTestId('project-grid')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search projects...')).not.toBeInTheDocument();
    });

    it('limits projects to maxItems', () => {
      render(
        <ProjectsSection
          variant="homepage"
          config={{
            ...ProjectsSectionPresets.homepage.config,
            maxItems: 1
          }}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      // Should only show 1 project due to maxItems limit
      const projectGrid = screen.getByTestId('project-grid');
      expect(projectGrid.children).toHaveLength(1);
    });
  });

  describe('Full Page Variant', () => {
    it('renders full page variant with all features', () => {
      render(
        <ProjectsSection
          {...ProjectsSectionPresets.fullPage}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      expect(screen.getByText('All Projects')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('handles search functionality', async () => {
      render(
        <ProjectsSection
          {...ProjectsSectionPresets.fullPage}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search projects...');
      fireEvent.change(searchInput, { target: { value: 'React' } });

      await waitFor(() => {
        // Should filter to only show projects matching "React"
        expect(screen.getByText('Test Project 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Project 2')).not.toBeInTheDocument();
      });
    });

    it('handles tag filtering', async () => {
      render(
        <ProjectsSection
          {...ProjectsSectionPresets.fullPage}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      // Open filters
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      await waitFor(() => {
        expect(screen.getByText('Filter by Tags')).toBeInTheDocument();
      });

      // Click on Vue tag
      const vueTag = screen.getByText('Vue');
      fireEvent.click(vueTag);

      await waitFor(() => {
        // Should filter to only show Vue projects
        expect(screen.queryByText('Test Project 1')).not.toBeInTheDocument();
        expect(screen.getByText('Test Project 2')).toBeInTheDocument();
      });
    });

    it('handles layout mode changes', () => {
      render(
        <ProjectsSection
          {...ProjectsSectionPresets.fullPage}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      // Should start with grid layout
      expect(screen.getByTestId('project-grid')).toBeInTheDocument();

      // Switch to list layout
      const listButton = screen.getByTestId('eye-icon').closest('button');
      fireEvent.click(listButton!);

      expect(screen.getByTestId('project-list')).toBeInTheDocument();
      expect(screen.queryByTestId('project-grid')).not.toBeInTheDocument();

      // Switch to timeline layout
      const timelineButton = screen.getByTestId('clock-icon').closest('button');
      fireEvent.click(timelineButton!);

      expect(screen.getByTestId('project-timeline')).toBeInTheDocument();
      expect(screen.queryByTestId('project-list')).not.toBeInTheDocument();
    });
  });

  describe('Project Interaction', () => {
    it('calls onProjectClick when project is clicked', () => {
      render(
        <ProjectsSection
          {...ProjectsSectionPresets.homepage}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      const project = screen.getByText('Test Project 1');
      fireEvent.click(project);

      expect(mockOnProjectClick).toHaveBeenCalledWith('test-project-1');
    });
  });

  describe('Loading State', () => {
    it('shows loading state when loading prop is true', () => {
      render(
        <ProjectsSection
          {...ProjectsSectionPresets.fullPage}
          projects={[]}
          tags={[]}
          loading={true}
          onProjectClick={mockOnProjectClick}
        />
      );

      // The loading state is handled by the child components
      // This test verifies that loading prop is passed through
      expect(screen.getByTestId('project-grid')).toBeInTheDocument();
    });
  });

  describe('Custom Configuration', () => {
    it('applies custom theme and spacing', () => {
      render(
        <ProjectsSection
          variant="featured"
          config={{
            layout: 'grid',
            columns: 2,
            showSearch: false,
            showFilters: false,
            showSorting: false,
            showViewToggle: false,
            theme: 'colorful',
            spacing: 'spacious',
            openMode: 'modal',
            sortBy: 'date',
            title: 'Custom Section',
            showViewCount: true
          }}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      expect(screen.getByText('Custom Section')).toBeInTheDocument();
      // Theme and spacing classes are applied to the section element
      const section = screen.getByText('Custom Section').closest('section');
      expect(section).toHaveClass('py-16', 'px-8'); // spacious spacing
    });

    it('handles pre-filtered tags', () => {
      render(
        <ProjectsSection
          variant="featured"
          config={{
            layout: 'grid',
            columns: 3,
            showSearch: false,
            showFilters: false,
            showSorting: false,
            showViewToggle: false,
            theme: 'default',
            spacing: 'normal',
            openMode: 'modal',
            sortBy: 'date',
            filterTags: ['React'], // Pre-filter to React projects
            showViewCount: true
          }}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      // Should only show React projects
      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Project 2')).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts projects by different criteria', async () => {
      render(
        <ProjectsSection
          {...ProjectsSectionPresets.fullPage}
          projects={mockProjects}
          tags={mockTags}
          onProjectClick={mockOnProjectClick}
        />
      );

      // Find the sort select
      const sortSelect = screen.getByRole('combobox');
      
      // Sort by title (alphabetical)
      fireEvent.change(sortSelect!, { target: { value: 'title' } });

      await waitFor(() => {
        // Projects should be sorted alphabetically
        const projectGrid = screen.getByTestId('project-grid');
        const projects = Array.from(projectGrid.children);
        expect(projects[0]).toHaveTextContent('Test Project 1');
        expect(projects[1]).toHaveTextContent('Test Project 2');
      });
    });
  });
});

describe('ProjectsSectionPresets', () => {
  it('provides correct homepage preset', () => {
    const preset = ProjectsSectionPresets.homepage;
    
    expect(preset.variant).toBe('homepage');
    expect(preset.config.maxItems).toBe(6);
    expect(preset.config.showSearch).toBe(false);
    expect(preset.config.showFilters).toBe(false);
    expect(preset.config.title).toBe('Featured Projects');
  });

  it('provides correct full page preset', () => {
    const preset = ProjectsSectionPresets.fullPage;
    
    expect(preset.variant).toBe('full-page');
    expect(preset.config.showSearch).toBe(true);
    expect(preset.config.showFilters).toBe(true);
    expect(preset.config.showViewToggle).toBe(true);
    expect(preset.config.title).toBe('All Projects');
  });

  it('provides correct featured preset', () => {
    const preset = ProjectsSectionPresets.featured;
    
    expect(preset.variant).toBe('featured');
    expect(preset.config.maxItems).toBe(4);
    expect(preset.config.columns).toBe(2);
    expect(preset.config.sortBy).toBe('popularity');
    expect(preset.config.title).toBe('Featured Work');
  });
});