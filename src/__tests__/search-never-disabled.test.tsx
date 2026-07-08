/**
 * Tests to verify search input is never disabled during search operations
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavigationBar } from '@/components/layout/navigation-bar';
import type { Tag } from '@/lib/types/project';

// Mock framer-motion: Proxy passthrough — ANY motion.<tag> renders the plain
// element (per-tag partial mocks broke on tags like motion.h3 in empty states).
jest.mock("framer-motion", () => {
  const React = require("react");
  const motion = new Proxy({}, {
    get: (_t, tag) => ({ children, ...props }: any) => React.createElement(String(tag), props, children),
  });
  return {
    motion,
    AnimatePresence: ({ children }: any) => children,
    useReducedMotion: () => false,
  };
});

const mockTags: Tag[] = [
  { id: '1', name: 'React', color: '#61dafb', createdAt: new Date() },
];

describe('Search Input Never Disabled', () => {
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

  it('search input is never disabled even when isLoading is true', () => {
    render(<NavigationBar {...mockProps} isLoading={true} />);

    const searchInput = screen.getByPlaceholderText(/projects/);
    expect(searchInput).not.toBeDisabled();
  });

  it('search input is never disabled even when canSearch is false', () => {
    render(<NavigationBar {...mockProps} canSearch={false} />);

    const searchInput = screen.getByPlaceholderText(/projects/);
    expect(searchInput).not.toBeDisabled();
  });

  it('search input is never disabled when isSearching is true', () => {
    render(<NavigationBar {...mockProps} isSearching={true} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    expect(searchInput).not.toBeDisabled();
  });

  it('search input is never disabled with all loading states active', () => {
    render(
      <NavigationBar 
        {...mockProps} 
        isLoading={true}
        canSearch={false}
        isSearching={true}
        tagsLoading={true}
      />
    );

    const searchInput = screen.getByPlaceholderText(/projects/);
    expect(searchInput).not.toBeDisabled();
  });

  it('user can always type in search input regardless of loading states', () => {
    const { rerender } = render(<NavigationBar {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    
    // User can type initially
    searchInput.focus();
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput).toHaveValue('test');
    expect(searchInput).not.toBeDisabled();

    // Re-render with loading states
    rerender(
      <NavigationBar 
        {...mockProps} 
        searchQuery="test"
        isLoading={true}
        isSearching={true}
        canSearch={false}
      />
    );

    // User can still type
    expect(searchInput).not.toBeDisabled();
    searchInput.focus();
    fireEvent.change(searchInput, { target: { value: 'test more' } });
    expect(searchInput).toHaveValue('test more');
  });

  it('internal state updates even when canSearch is false', () => {
    render(<NavigationBar {...mockProps} canSearch={false} />);

    const searchInput = screen.getByPlaceholderText(/projects/);
    
    // User can still type (internal state updates)
    searchInput.focus();
    fireEvent.change(searchInput, { target: { value: 'typing anyway' } });
    expect(searchInput).toHaveValue('typing anyway');
    
    // But onSearchChange should not be called when canSearch is false
    expect(mockProps.onSearchChange).not.toHaveBeenCalled();
  });

  it('onSearchChange is called when canSearch is true', () => {
    render(<NavigationBar {...mockProps} canSearch={true} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    
    searchInput.focus();
    fireEvent.change(searchInput, { target: { value: 'search term' } });
    expect(searchInput).toHaveValue('search term');
    expect(mockProps.onSearchChange).toHaveBeenCalledWith('search term');
  });

  it('placeholder text reflects canSearch state but input remains enabled', () => {
    const { rerender } = render(<NavigationBar {...mockProps} canSearch={true} />);

    let searchInput = screen.getByPlaceholderText('Search projects...');
    expect(searchInput).not.toBeDisabled();

    // Change canSearch to false
    rerender(<NavigationBar {...mockProps} canSearch={false} />);

    searchInput = screen.getByPlaceholderText('Loading projects...');
    expect(searchInput).not.toBeDisabled(); // Still not disabled!
  });

  it('typing still works when canSearch is false; clear button requires canSearch', () => {
    const { rerender } = render(<NavigationBar {...mockProps} canSearch={false} />);

    const searchInput = screen.getByPlaceholderText(/projects/);

    // Typing is never blocked…
    searchInput.focus();
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput).toHaveValue('test');

    // …but the clear affordance is deliberately hidden while canSearch=false
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

    // With canSearch back on, the clear button appears and works
    rerender(<NavigationBar {...mockProps} canSearch={true} />);
    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('maintains focus during all state changes', () => {
    const { rerender } = render(<NavigationBar {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    searchInput.focus();
    
    expect(document.activeElement).toBe(searchInput);

    // Re-render with various loading states
    rerender(
      <NavigationBar 
        {...mockProps} 
        isLoading={true}
        isSearching={true}
        canSearch={false}
        tagsLoading={true}
      />
    );

    // Focus should be maintained and input should still work
    expect(document.activeElement).toBe(searchInput);
    expect(searchInput).not.toBeDisabled();
    
    searchInput.focus();
    fireEvent.change(searchInput, { target: { value: 'still typing' } });
    expect(searchInput).toHaveValue('still typing');
  });
});