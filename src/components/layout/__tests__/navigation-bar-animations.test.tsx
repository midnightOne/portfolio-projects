/**
 * Tests for enhanced tag filtering animations in NavigationBar
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NavigationBar } from '../navigation-bar';
import type { Tag } from '@/lib/types/project';
import { describe, it, beforeEach } from '@jest/globals';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div data-testid={props['data-testid']} {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
}));

const mockTags: Tag[] = [
  { id: '1', name: 'React', color: '#61DAFB', createdAt: new Date() },
  { id: '2', name: 'TypeScript', color: '#3178C6', createdAt: new Date() },
  { id: '3', name: 'Next.js', color: '#000000', createdAt: new Date() },
  { id: '4', name: 'XR', color: '#FF6B6B', createdAt: new Date() },
];

const defaultProps = {
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
  canFilter: true,
  tagsLoading: false,
};

describe('NavigationBar Tag Filtering Animations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tag filter badges with proper styling', () => {
    render(<NavigationBar {...defaultProps} />);
    
    // Check that all tags are rendered
    mockTags.forEach(tag => {
      expect(screen.getByText(tag.name)).toBeInTheDocument();
    });
    
    // Check filter label is present
    expect(screen.getByText('Filter:')).toBeInTheDocument();
  });

  it('handles tag selection with visual feedback', async () => {
    const onTagSelect = jest.fn();
    render(<NavigationBar {...defaultProps} onTagSelect={onTagSelect} />);
    
    // Click on React tag
    const reactTag = screen.getByText('React');
    fireEvent.click(reactTag);
    
    // Verify callback was called
    expect(onTagSelect).toHaveBeenCalledWith(['React']);
  });

  it('shows selected tags with different styling', () => {
    render(<NavigationBar {...defaultProps} selectedTags={['React', 'TypeScript']} />);
    
    // Selected tags should have checkmarks (✓)
    expect(screen.getAllByText('✓')).toHaveLength(2);
  });

  it('displays multiple selected tags correctly', () => {
    render(<NavigationBar {...defaultProps} selectedTags={['React', 'XR']} />);
    
    // Check that selected tags are shown in the summary
    expect(screen.getByText('Filtered by:')).toBeInTheDocument();
    
    // Both selected tags should appear in the summary
    const summaryTags = screen.getAllByText('React');
    const summaryXR = screen.getAllByText('XR');
    
    // Should appear both in the filter badges and in the summary
    expect(summaryTags.length).toBeGreaterThan(1);
    expect(summaryXR.length).toBeGreaterThan(1);
  });

  it('shows clear button when tags are selected', () => {
    render(<NavigationBar {...defaultProps} selectedTags={['React']} />);
    
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('handles clear filters functionality', () => {
    const onTagSelect = jest.fn();
    const onSearchChange = jest.fn();
    
    render(
      <NavigationBar 
        {...defaultProps} 
        selectedTags={['React']} 
        searchQuery="test"
        onTagSelect={onTagSelect}
        onSearchChange={onSearchChange}
      />
    );
    
    // Click clear button
    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);
    
    // Verify both callbacks were called to clear state
    expect(onTagSelect).toHaveBeenCalledWith([]);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('disables tag filtering when canFilter is false', () => {
    render(<NavigationBar {...defaultProps} canFilter={false} />);
    
    // Tags should be disabled (have opacity-50 class)
    const reactTag = screen.getByText('React').closest('.opacity-50');
    expect(reactTag).toBeInTheDocument();
  });

  it('shows loading skeletons when tags are loading', () => {
    render(<NavigationBar {...defaultProps} tagsLoading={true} />);
    
    // Should show skeleton loaders instead of actual tags
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    
    // Should not show actual tag names
    expect(screen.queryByText('React')).not.toBeInTheDocument();
  });

  it('shows "Show More" button when there are many tags', () => {
    const manyTags = Array.from({ length: 12 }, (_, i) => ({
      id: `tag-${i}`,
      name: `Tag ${i}`,
      color: '#000000',
      createdAt: new Date(),
    }));
    
    render(<NavigationBar {...defaultProps} tags={manyTags} />);
    
    // Should show "Show More" button for tags beyond the first 8
    expect(screen.getByText('+4 More')).toBeInTheDocument();
  });

  it('expands to show all tags when "Show More" is clicked', () => {
    const manyTags = Array.from({ length: 12 }, (_, i) => ({
      id: `tag-${i}`,
      name: `Tag ${i}`,
      color: '#000000',
      createdAt: new Date(),
    }));
    
    render(<NavigationBar {...defaultProps} tags={manyTags} />);
    
    // Click "Show More"
    const showMoreButton = screen.getByText('+4 More');
    fireEvent.click(showMoreButton);
    
    // Should now show "Show Less"
    expect(screen.getByText('Show Less')).toBeInTheDocument();
    
    // All tags should be visible
    manyTags.forEach(tag => {
      expect(screen.getByText(tag.name)).toBeInTheDocument();
    });
  });

  it('shows search results count when searching', () => {
    render(
      <NavigationBar 
        {...defaultProps} 
        searchQuery="react"
        searchResultsCount={5}
      />
    );
    
    expect(screen.getByText('5 results for "react"')).toBeInTheDocument();
  });

  it('shows searching indicator when search is in progress', () => {
    render(
      <NavigationBar 
        {...defaultProps} 
        searchQuery="react"
        isSearching={true}
      />
    );
    
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('applies custom colors to selected tags', () => {
    render(<NavigationBar {...defaultProps} selectedTags={['React']} />);
    
    // Find all React text elements and look for the one with custom styling
    const reactElements = screen.getAllByText('React');
    const styledReactBadge = reactElements.find(el => 
      el.closest('[style*="background-color"]')
    );
    
    expect(styledReactBadge).toBeDefined();
    const badge = styledReactBadge?.closest('[style*="background-color"]');
    // The color gets converted from hex to RGB, so check for the RGB equivalent
    expect(badge).toHaveAttribute('style', expect.stringContaining('rgb(97, 218, 251)'));
  });
});