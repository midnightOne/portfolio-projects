/**
 * Tests for final search input focus fix using internal state
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
];

describe('Final Search Focus Fix', () => {
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

  it('maintains focus during typing with internal state management', async () => {
    const { rerender } = render(<NavigationBar {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    
    // Focus the input
    searchInput.focus();
    expect(document.activeElement).toBe(searchInput);

    // Type in the input
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Verify onSearchChange was called
    await waitFor(() => {
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('test');
    });

    // Simulate parent component re-render with new search state
    rerender(<NavigationBar {...mockProps} searchQuery="test" isSearching={true} />);

    // Input should still be focused and have the correct value
    expect(document.activeElement).toBe(searchInput);
    expect(searchInput).toHaveValue('test');

    // Continue typing
    fireEvent.change(searchInput, { target: { value: 'test more' } });

    await waitFor(() => {
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('test more');
    });

    // Focus should still be maintained
    expect(document.activeElement).toBe(searchInput);
    expect(searchInput).toHaveValue('test more');
  });

  it('syncs internal state with external prop when not focused', async () => {
    const { rerender } = render(<NavigationBar {...mockProps} searchQuery="" />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    expect(searchInput).toHaveValue('');

    // Update external prop when input is not focused
    rerender(<NavigationBar {...mockProps} searchQuery="external update" />);

    // Internal state should sync with external prop
    await waitFor(() => {
      expect(searchInput).toHaveValue('external update');
    });
  });

  it('does not sync external prop when input is focused', async () => {
    const { rerender } = render(<NavigationBar {...mockProps} searchQuery="" />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    
    // Focus the input and type
    searchInput.focus();
    fireEvent.change(searchInput, { target: { value: 'user typing' } });

    expect(searchInput).toHaveValue('user typing');
    expect(document.activeElement).toBe(searchInput);

    // Try to update external prop while input is focused
    rerender(<NavigationBar {...mockProps} searchQuery="external update" />);

    // Internal state should NOT sync because input is focused
    expect(searchInput).toHaveValue('user typing');
    expect(document.activeElement).toBe(searchInput);
  });

  it('clears search and maintains focus when clear button is clicked', async () => {
    render(<NavigationBar {...mockProps} searchQuery="test search" />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    const clearButton = screen.getByLabelText('Clear search');

    // Input should have the search value
    expect(searchInput).toHaveValue('test search');

    // Click clear button
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('');
      expect(searchInput).toHaveValue('');
    });

    // Focus should be restored to the input after clearing
    await waitFor(() => {
      expect(document.activeElement).toBe(searchInput);
    });
  });

  it('shows clear button based on internal search value', () => {
    const { rerender } = render(<NavigationBar {...mockProps} />);

    // No clear button when empty
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

    // Type in search input
    const searchInput = screen.getByPlaceholderText('Search projects...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Clear button should appear based on internal value
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();

    // Clear the input
    fireEvent.change(searchInput, { target: { value: '' } });

    // Clear button should disappear
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('handles rapid typing without losing focus', async () => {
    render(<NavigationBar {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    searchInput.focus();

    // Simulate rapid typing
    const typingSequence = ['t', 'te', 'tes', 'test', 'test ', 'test s', 'test se', 'test sea', 'test sear', 'test search'];
    
    for (const value of typingSequence) {
      fireEvent.change(searchInput, { target: { value } });
      
      // Verify focus is maintained and value is correct
      expect(document.activeElement).toBe(searchInput);
      expect(searchInput).toHaveValue(value);
      
      // Verify onSearchChange was called
      await waitFor(() => {
        expect(mockProps.onSearchChange).toHaveBeenCalledWith(value);
      });
    }

    // Final verification
    expect(document.activeElement).toBe(searchInput);
    expect(searchInput).toHaveValue('test search');
  });

  it('maintains correct loading spinner visibility based on internal state', () => {
    const { rerender } = render(<NavigationBar {...mockProps} isSearching={true} />);

    // Should show loading spinner when searching with no text
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();

    // Type in search
    const searchInput = screen.getByPlaceholderText('Search projects...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Re-render with searching state
    rerender(<NavigationBar {...mockProps} searchQuery="test" isSearching={true} />);

    // Should show both clear button and smaller loading spinner
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('clears both internal and external state when clear all is clicked', async () => {
    render(<NavigationBar {...mockProps} searchQuery="test" selectedTags={['React']} />);

    const searchInput = screen.getByPlaceholderText('Search projects...');
    const clearAllButton = screen.getByText('Clear');

    expect(searchInput).toHaveValue('test');

    fireEvent.click(clearAllButton);

    await waitFor(() => {
      expect(mockProps.onSearchChange).toHaveBeenCalledWith('');
      expect(mockProps.onTagSelect).toHaveBeenCalledWith([]);
      expect(searchInput).toHaveValue('');
    });
  });

  it('handles disabled state correctly', () => {
    render(<NavigationBar {...mockProps} canSearch={false} isLoading={true} />);

    const searchInput = screen.getByPlaceholderText('Loading projects...');
    
    expect(searchInput).toBeDisabled();
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });
});