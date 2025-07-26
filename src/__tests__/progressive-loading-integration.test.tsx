import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NavigationBar } from '../components/layout/navigation-bar';
import { ProjectGrid } from '../components/projects/project-grid';

// Mock the project modal
jest.mock('../components/projects/project-modal', () => ({
  ProjectModal: ({ isOpen, project, loading }: any) => (
    <div data-testid="project-modal">
      {isOpen && (
        <div>
          {loading ? 'Loading project...' : project?.title || 'No project'}
        </div>
      )}
    </div>
  ),
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

// Mock the project modal
jest.mock('../components/projects/project-modal', () => ({
  ProjectModal: ({ isOpen, project, loading }: any) => (
    <div data-testid="project-modal">
      {isOpen && (
        <div>
          {loading ? 'Loading project...' : project?.title || 'No project'}
        </div>
      )}
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Progressive Loading Integration', () => {
  const mockTags = [
    { id: '1', name: 'React', color: '#61dafb' },
    { id: '2', name: 'TypeScript', color: '#3178c6' },
  ];

  const mockProjects = [
    { 
      id: '1', 
      title: 'Test Project', 
      slug: 'test-project',
      tags: [{ id: '1', name: 'React' }],
      briefOverview: 'A test project',
      _count: { mediaItems: 1, downloadableFiles: 0 },
      viewCount: 10,
      workDate: new Date('2023-01-01'),
      externalLinks: [],
      downloadableFiles: [],
      mediaItems: [],
      thumbnailImage: null,
    },
  ];

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should show navigation bar with progressive loading states', () => {
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
      isLoading: false,
      canSearch: false, // Projects not loaded yet
      canFilter: false, // Tags not loaded yet
      tagsLoading: true,
      loadingMessage: 'Loading projects and filters...',
    };

    render(<NavigationBar {...mockProps} />);

    // Search should be disabled
    const searchInput = screen.getByPlaceholderText(/Loading/);
    expect(searchInput).toBeDisabled();

    // Should show loading message
    expect(screen.getByText('Loading projects and filters...')).toBeInTheDocument();
  });

  it('should enable search when projects are loaded', () => {
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
      isLoading: false,
      canSearch: true, // Projects loaded
      canFilter: false, // Tags still loading
      tagsLoading: true,
      loadingMessage: 'Loading filters...',
    };

    render(<NavigationBar {...mockProps} />);

    // Search should be enabled
    const searchInput = screen.getByPlaceholderText(/Search projects/);
    expect(searchInput).not.toBeDisabled();

    // Should show loading message for filters
    expect(screen.getByText('Loading filters...')).toBeInTheDocument();
  });

  it('should enable filtering when tags are loaded', () => {
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
      isLoading: false,
      canSearch: true,
      canFilter: true, // Tags loaded
      tagsLoading: false,
    };

    render(<NavigationBar {...mockProps} />);

    // Both search and filter should be enabled
    const searchInput = screen.getByPlaceholderText(/Search projects/);
    expect(searchInput).not.toBeDisabled();

    // Tags should be clickable
    const reactTag = screen.getByText('React');
    expect(reactTag).not.toHaveClass('cursor-not-allowed');
  });

  it('should show project grid with loading state', () => {
    render(
      <ProjectGrid
        projects={[]}
        loading={true}
        onProjectClick={jest.fn()}
      />
    );

    // Should show skeleton loading state
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });

  it('should show projects when loaded', () => {
    render(
      <ProjectGrid
        projects={mockProjects}
        loading={false}
        onProjectClick={jest.fn()}
      />
    );

    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('should show empty state when no projects', () => {
    render(
      <ProjectGrid
        projects={[]}
        loading={false}
        onProjectClick={jest.fn()}
      />
    );

    expect(screen.getByText('No projects found')).toBeInTheDocument();
  });

  it('should handle clear filters in navigation', () => {
    const onTagSelect = jest.fn();
    const onSearchChange = jest.fn();

    const mockProps = {
      tags: mockTags,
      selectedTags: ['React'],
      onTagSelect,
      searchQuery: 'test',
      onSearchChange,
      sortBy: 'relevance' as const,
      onSortChange: jest.fn(),
      viewMode: 'grid' as const,
      onViewModeChange: jest.fn(),
      isLoading: false,
      canSearch: true,
      canFilter: true,
      tagsLoading: false,
    };

    render(<NavigationBar {...mockProps} />);

    // Should show clear button when filters are active
    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeInTheDocument();

    // Click clear button
    fireEvent.click(clearButton);

    // Should call both clear functions
    expect(onTagSelect).toHaveBeenCalledWith([]);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});