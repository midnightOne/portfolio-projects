/**
 * Tests for view mode functionality (grid vs timeline)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavigationBar } from '@/components/layout/navigation-bar';
import type { Tag } from '@/lib/types/project';

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
  { id: '3', name: 'Vue', color: '#4fc08d', createdAt: new Date() },
];

describe('View Mode Functionality', () => {
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

  it('renders grid and timeline view toggle buttons', () => {
    render(<NavigationBar {...mockProps} />);

    const gridButton = screen.getByRole('button', { name: /grid/i });
    const timelineButton = screen.getByRole('button', { name: /list/i });

    expect(gridButton).toBeInTheDocument();
    expect(timelineButton).toBeInTheDocument();
  });

  it('shows grid button as active when grid view is selected', () => {
    render(<NavigationBar {...mockProps} viewMode="grid" />);

    const gridButton = screen.getByRole('button', { name: /grid/i });
    const timelineButton = screen.getByRole('button', { name: /list/i });

    // Grid button should have 'default' variant (active)
    expect(gridButton).toHaveClass('bg-primary'); // or whatever active class
    expect(timelineButton).not.toHaveClass('bg-primary');
  });

  it('shows timeline button as active when timeline view is selected', () => {
    render(<NavigationBar {...mockProps} viewMode="timeline" />);

    const gridButton = screen.getByRole('button', { name: /grid/i });
    const timelineButton = screen.getByRole('button', { name: /list/i });

    // Timeline button should have 'default' variant (active)
    expect(timelineButton).toHaveClass('bg-primary');
    expect(gridButton).not.toHaveClass('bg-primary');
  });

  it('calls onViewModeChange when grid button is clicked', async () => {
    render(<NavigationBar {...mockProps} viewMode="timeline" />);

    const gridButton = screen.getByRole('button', { name: /grid/i });
    fireEvent.click(gridButton);

    await waitFor(() => {
      expect(mockProps.onViewModeChange).toHaveBeenCalledWith('grid');
    });
  });

  it('calls onViewModeChange when timeline button is clicked', async () => {
    render(<NavigationBar {...mockProps} viewMode="grid" />);

    const timelineButton = screen.getByRole('button', { name: /list/i });
    fireEvent.click(timelineButton);

    await waitFor(() => {
      expect(mockProps.onViewModeChange).toHaveBeenCalledWith('timeline');
    });
  });

  it('shows timeline grouping controls only when timeline view is active', () => {
    const { rerender } = render(<NavigationBar {...mockProps} viewMode="grid" />);

    // Should not show timeline grouping controls in grid view
    expect(screen.queryByText('Year')).not.toBeInTheDocument();
    expect(screen.queryByText('Month')).not.toBeInTheDocument();

    // Switch to timeline view
    rerender(<NavigationBar {...mockProps} viewMode="timeline" />);

    // Should show timeline grouping controls in timeline view
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
  });

  it('shows year button as active when year grouping is selected', () => {
    render(
      <NavigationBar 
        {...mockProps} 
        viewMode="timeline" 
        timelineGroupBy="year" 
      />
    );

    const yearButton = screen.getByText('Year');
    const monthButton = screen.getByText('Month');

    expect(yearButton).toHaveClass('bg-primary');
    expect(monthButton).not.toHaveClass('bg-primary');
  });

  it('shows month button as active when month grouping is selected', () => {
    render(
      <NavigationBar 
        {...mockProps} 
        viewMode="timeline" 
        timelineGroupBy="month" 
      />
    );

    const yearButton = screen.getByText('Year');
    const monthButton = screen.getByText('Month');

    expect(monthButton).toHaveClass('bg-primary');
    expect(yearButton).not.toHaveClass('bg-primary');
  });

  it('calls onTimelineGroupByChange when year button is clicked', async () => {
    render(
      <NavigationBar 
        {...mockProps} 
        viewMode="timeline" 
        timelineGroupBy="month" 
      />
    );

    const yearButton = screen.getByText('Year');
    fireEvent.click(yearButton);

    await waitFor(() => {
      expect(mockProps.onTimelineGroupByChange).toHaveBeenCalledWith('year');
    });
  });

  it('calls onTimelineGroupByChange when month button is clicked', async () => {
    render(
      <NavigationBar 
        {...mockProps} 
        viewMode="timeline" 
        timelineGroupBy="year" 
      />
    );

    const monthButton = screen.getByText('Month');
    fireEvent.click(monthButton);

    await waitFor(() => {
      expect(mockProps.onTimelineGroupByChange).toHaveBeenCalledWith('month');
    });
  });

  it('disables view mode buttons when loading', () => {
    render(<NavigationBar {...mockProps} isLoading={true} />);

    const gridButton = screen.getByRole('button', { name: /grid/i });
    const timelineButton = screen.getByRole('button', { name: /list/i });

    expect(gridButton).toBeDisabled();
    expect(timelineButton).toBeDisabled();
  });

  it('disables view mode buttons when canSearch is false', () => {
    render(<NavigationBar {...mockProps} canSearch={false} />);

    const gridButton = screen.getByRole('button', { name: /grid/i });
    const timelineButton = screen.getByRole('button', { name: /list/i });

    expect(gridButton).toBeDisabled();
    expect(timelineButton).toBeDisabled();
  });

  it('disables timeline grouping buttons when loading', () => {
    render(
      <NavigationBar 
        {...mockProps} 
        viewMode="timeline" 
        isLoading={true} 
      />
    );

    const yearButton = screen.getByText('Year');
    const monthButton = screen.getByText('Month');

    expect(yearButton).toBeDisabled();
    expect(monthButton).toBeDisabled();
  });

  it('disables timeline grouping buttons when canSearch is false', () => {
    render(
      <NavigationBar 
        {...mockProps} 
        viewMode="timeline" 
        canSearch={false} 
      />
    );

    const yearButton = screen.getByText('Year');
    const monthButton = screen.getByText('Month');

    expect(yearButton).toBeDisabled();
    expect(monthButton).toBeDisabled();
  });

  it('does not show timeline grouping controls when onTimelineGroupByChange is not provided', () => {
    render(
      <NavigationBar 
        {...mockProps} 
        viewMode="timeline" 
        onTimelineGroupByChange={undefined}
      />
    );

    expect(screen.queryByText('Year')).not.toBeInTheDocument();
    expect(screen.queryByText('Month')).not.toBeInTheDocument();
  });

  it('maintains other functionality when switching view modes', async () => {
    render(<NavigationBar {...mockProps} />);

    // Test that search still works
    const searchInput = screen.getByPlaceholderText('Search projects...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(mockProps.onSearchChange).toHaveBeenCalledWith('test');

    // Switch view mode
    const timelineButton = screen.getByRole('button', { name: /list/i });
    fireEvent.click(timelineButton);

    expect(mockProps.onViewModeChange).toHaveBeenCalledWith('timeline');

    // Search should still work after view mode change
    fireEvent.change(searchInput, { target: { value: 'test2' } });
    expect(mockProps.onSearchChange).toHaveBeenCalledWith('test2');
  });
});