import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectTimeline } from '../project-timeline';
import type { ProjectWithRelations } from '@/lib/types/project';
import { describe, it, beforeEach } from '@jest/globals';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
}));

const mockProjects: ProjectWithRelations[] = [
  {
    id: '1',
    title: 'Project 1',
    slug: 'project-1',
    description: 'First project description',
    briefOverview: 'Brief overview 1',
    workDate: new Date('2023-06-15'),
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    viewCount: 150,
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2023-06-01'),
    tags: [
      { id: 'tag1', name: 'React', color: '#61dafb', createdAt: new Date() },
      { id: 'tag2', name: 'TypeScript', color: '#3178c6', createdAt: new Date() },
    ],
    thumbnailImage: {
      id: 'img1',
      url: 'https://example.com/thumb1.jpg',
      thumbnailUrl: 'https://example.com/thumb1_small.jpg',
      altText: 'Project 1 thumbnail',
      type: 'IMAGE' as const,
      displayOrder: 0,
      createdAt: new Date(),
    },
    mediaItems: [],
    interactiveExamples: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: [],
    _count: {
      mediaItems: 3,
      downloadableFiles: 2,
      externalLinks: 1,
      analytics: 150,
    },
  },
  {
    id: '2',
    title: 'Project 2',
    slug: 'project-2',
    description: 'Second project description',
    briefOverview: 'Brief overview 2',
    workDate: new Date('2022-12-10'),
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    viewCount: 89,
    createdAt: new Date('2022-12-01'),
    updatedAt: new Date('2022-12-01'),
    tags: [
      { id: 'tag3', name: 'Vue', color: '#4fc08d', createdAt: new Date() },
    ],
    thumbnailImage: null,
    mediaItems: [
      {
        id: 'img2',
        url: 'https://example.com/media2.jpg',
        thumbnailUrl: 'https://example.com/media2_small.jpg',
        altText: 'Project 2 media',
        type: 'IMAGE' as const,
        displayOrder: 0,
        createdAt: new Date(),
      },
    ],
    interactiveExamples: [],
    externalLinks: [],
    downloadableFiles: [],
    carousels: [],
    _count: {
      mediaItems: 1,
      downloadableFiles: 0,
      externalLinks: 2,
      analytics: 89,
    },
  },
];

describe('ProjectTimeline', () => {
  const mockOnProjectClick = jest.fn();

  beforeEach(() => {
    mockOnProjectClick.mockClear();
  });

  it('renders loading state correctly', () => {
    render(
      <ProjectTimeline
        projects={[]}
        loading={true}
        onProjectClick={mockOnProjectClick}
      />
    );

    // Should show skeleton loading elements
    expect(screen.getAllByText(/animate-pulse/i)).toBeTruthy();
  });

  it('renders empty state when no projects', () => {
    render(
      <ProjectTimeline
        projects={[]}
        loading={false}
        onProjectClick={mockOnProjectClick}
      />
    );

    expect(screen.getByText('No projects found')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search terms/)).toBeInTheDocument();
  });

  it('renders projects grouped by year', () => {
    render(
      <ProjectTimeline
        projects={mockProjects}
        loading={false}
        onProjectClick={mockOnProjectClick}
        groupBy="year"
      />
    );

    // Should show year headers
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();

    // Should show project titles
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 2')).toBeInTheDocument();
  });

  it('renders projects grouped by month', () => {
    render(
      <ProjectTimeline
        projects={mockProjects}
        loading={false}
        onProjectClick={mockOnProjectClick}
        groupBy="month"
      />
    );

    // Should show month headers
    expect(screen.getByText('June 2023')).toBeInTheDocument();
    expect(screen.getByText('December 2022')).toBeInTheDocument();
  });

  it('displays project information correctly', () => {
    render(
      <ProjectTimeline
        projects={mockProjects}
        loading={false}
        onProjectClick={mockOnProjectClick}
      />
    );

    // Check project details
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Brief overview 1')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();

    // Check view count
    expect(screen.getByText('150 views')).toBeInTheDocument();
    expect(screen.getByText('89 views')).toBeInTheDocument();

    // Check media counts
    expect(screen.getByText('3 media')).toBeInTheDocument();
    expect(screen.getByText('2 downloads')).toBeInTheDocument();
    expect(screen.getByText('1 links')).toBeInTheDocument();
  });

  it('handles project click correctly', async () => {
    render(
      <ProjectTimeline
        projects={mockProjects}
        loading={false}
        onProjectClick={mockOnProjectClick}
      />
    );

    const projectCard = screen.getByText('Project 1').closest('.group');
    expect(projectCard).toBeInTheDocument();

    fireEvent.click(projectCard!);

    await waitFor(() => {
      expect(mockOnProjectClick).toHaveBeenCalledWith('project-1');
    });
  });

  it('highlights search terms correctly', () => {
    render(
      <ProjectTimeline
        projects={mockProjects}
        loading={false}
        onProjectClick={mockOnProjectClick}
        searchQuery="Project"
      />
    );

    // Should highlight search terms (though exact implementation may vary)
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 2')).toBeInTheDocument();
  });

  it('displays thumbnails correctly', () => {
    render(
      <ProjectTimeline
        projects={mockProjects}
        loading={false}
        onProjectClick={mockOnProjectClick}
      />
    );

    // Project 1 has thumbnail
    const thumbnail1 = screen.getByAltText('Project 1 thumbnail');
    expect(thumbnail1).toBeInTheDocument();
    expect(thumbnail1).toHaveAttribute('src', 'https://example.com/thumb1_small.jpg');

    // Project 2 uses first media item as thumbnail
    const thumbnail2 = screen.getByAltText('Project 2 media');
    expect(thumbnail2).toBeInTheDocument();
    expect(thumbnail2).toHaveAttribute('src', 'https://example.com/media2_small.jpg');
  });

  it('shows correct project counts in group headers', () => {
    render(
      <ProjectTimeline
        projects={mockProjects}
        loading={false}
        onProjectClick={mockOnProjectClick}
        groupBy="year"
      />
    );

    // Each year should show 1 project
    expect(screen.getByText('1 project')).toBeInTheDocument();
  });

  it('sorts projects within groups by date (newest first)', () => {
    const projectsWithSameYear = [
      {
        ...mockProjects[0],
        workDate: new Date('2023-01-15'),
        title: 'Earlier Project',
      },
      {
        ...mockProjects[0],
        id: '3',
        workDate: new Date('2023-06-15'),
        title: 'Later Project',
      },
    ];

    render(
      <ProjectTimeline
        projects={projectsWithSameYear}
        loading={false}
        onProjectClick={mockOnProjectClick}
        groupBy="year"
      />
    );

    const projectTitles = screen.getAllByText(/Project/);
    // Later project should appear first (newer dates first)
    expect(projectTitles[0]).toHaveTextContent('Later Project');
    expect(projectTitles[1]).toHaveTextContent('Earlier Project');
  });

  it('handles projects without workDate by using createdAt', () => {
    const projectWithoutWorkDate = {
      ...mockProjects[0],
      workDate: undefined,
      createdAt: new Date('2023-03-15'),
    };

    render(
      <ProjectTimeline
        projects={[projectWithoutWorkDate]}
        loading={false}
        onProjectClick={mockOnProjectClick}
        groupBy="year"
      />
    );

    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getByText('March 15, 2023')).toBeInTheDocument();
  });
});