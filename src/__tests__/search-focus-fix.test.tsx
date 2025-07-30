/**
 * Tests for search input focus fix and clear search functionality
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
];

describe('Search Focus Fix and Clear Button', () => {
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

  it('renders search input with proper structure', () => {
    render(<NavigationBar {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveClass('pl-10', 'pr-10'); // Left padding for search icon, right padding for clear button
  });

  it('shows clear search button when there is search text', () => {
    render(<NavigationBar {...mockProps} searchQuery="test search" />);

    const clearButton = screen.getByLabelText('Clear search');
    expect(clearButton).toBeInTheDocument();
  });

  it('does not show clear search button when search is empty', () => {
    render(<NavigationBar {...mockProps} searchQuery="" />);

    const clearButton = screen.queryByLabelText('Clear search');
    expect(clearButton).not.toBeInTheDocument();
  });

  it('calls onSearchChange with empty string when clear button is clicked', async () => {
    render(<NavigationBar {...mockProps} searchQuery="test search" />);

    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('');
    });
  });

  it('shows loading spinner when searching', () => {
    render(<NavigationBar {...mockProps} searchQuery="test" isSearching={true} />);

    // Should show loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows both clear button and loading spinner when appropriate', () => {
    render(<NavigationBar {...mockProps} searchQuery="test" isSearching={true} />);

    // Should show both clear button and loading spinner
    const clearButton = screen.getByLabelText('Clear search');
    const spinner = document.querySelector('.animate-spin');
    
    expect(clearButton).toBeInTheDocument();
    expect(spinner).toBeInTheDocument();
  });

  it('maintains search input functionality', async () => {
    render(<NavigationBar {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    
    fireEvent.change(searchInput, { target: { value: 'new search' } });

    await waitFor(() => {
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('new search');
    });
  });

  it('disables clear button when canSearch is false', () => {
    render(<NavigationBar {...mockProps} searchQuery="test" canSearch={false} />);

    // Clear button should not be shown when canSearch is false
    const clearButton = screen.queryByLabelText('Clear search');
    expect(clearButton).not.toBeInTheDocument();
  });

  it('shows proper search input state when disabled', () => {
    render(<NavigationBar {...mockProps} isLoading={true} canSearch={false} />);

    const searchInput = screen.getByPlaceholderText('Loading projects...');
    expect(searchInput).toBeDisabled();
  });

  it('clear search button only clears search, not tags', async () => {
    render(
      <NavigationBar 
        {...mockProps} 
        searchQuery="test search" 
        selectedTags={['React']} 
      />
    );

    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    await waitFor(() => {
      // Should only clear search, not call onTagSelect
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('');
      expect(mockProps.onTagSelect).not.toHaveBeenCalled();
    });
  });

  it('clear all button clears both search and tags', async () => {
    render(
      <NavigationBar 
        {...mockProps} 
        searchQuery="test search" 
        selectedTags={['React']} 
      />
    );

    const clearAllButton = screen.getByText('Clear');
    fireEvent.click(clearAllButton);

    await waitFor(() => {
      // Should clear both search and tags
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('');
      expect(mockProps.onTagSelect).toHaveBeenCalledWith([]);
    });
  });

  it('shows clear all button when there are selected tags or search query', () => {
    const { rerender } = render(<NavigationBar {...mockProps} />);

    // No clear button when nothing is selected
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();

    // Show clear button when search query exists
    rerender(<NavigationBar {...mockProps} searchQuery="test" />);
    expect(screen.getByText('Clear')).toBeInTheDocument();

    // Show clear button when tags are selected
    rerender(<NavigationBar {...mockProps} searchQuery="" selectedTags={['React']} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();

    // Show clear button when both exist
    rerender(<NavigationBar {...mockProps} searchQuery="test" selectedTags={['React']} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<NavigationBar {...mockProps} searchQuery="test" />);

    const clearButton = screen.getByLabelText('Clear search');
    expect(clearButton).toHaveAttribute('type', 'button');
    expect(clearButton).toHaveAttribute('aria-label', 'Clear search');
  });
});