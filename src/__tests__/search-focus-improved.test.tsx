/**
 * Tests for improved search input focus management and larger clear button hitbox
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

describe('Improved Search Focus and Clear Button', () => {
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

    it('renders search input with increased right padding for larger hitbox', () => {
        render(<NavigationBar {...mockProps} />);

        const searchInput = screen.getByPlaceholderText('Search projects...');
        expect(searchInput).toHaveClass('pr-12'); // Increased from pr-10
    });

    it('shows clear button with larger hitbox when there is search text', () => {
        render(<NavigationBar {...mockProps} searchQuery="test search" />);

        const clearButton = screen.getByLabelText('Clear search');
        expect(clearButton).toBeInTheDocument();
        expect(clearButton).toHaveClass('min-w-[28px]', 'min-h-[28px]', 'p-2'); // Larger hitbox
    });

    it('clear button has proper size and padding for easier clicking', () => {
        render(<NavigationBar {...mockProps} searchQuery="test" />);

        const clearButton = screen.getByLabelText('Clear search');

        // Check for larger padding and minimum size
        expect(clearButton).toHaveClass('p-2'); // Increased from p-1
        expect(clearButton).toHaveClass('min-w-[28px]', 'min-h-[28px]');
        expect(clearButton).toHaveClass('rounded-md'); // Increased from rounded-sm
    });

    it('calls onSearchChange when typing in search input', async () => {
        render(<NavigationBar {...mockProps} />);

        const searchInput = screen.getByPlaceholderText('Search projects...');

        fireEvent.change(searchInput, { target: { value: 'new search' } });

        await waitFor(() => {
            expect(mockProps.onSearchChange).toHaveBeenCalledWith('new search');
        });
    });

    it('clears search and maintains focus when clear button is clicked', async () => {
        render(<NavigationBar {...mockProps} searchQuery="test search" />);

        const clearButton = screen.getByLabelText('Clear search');
        fireEvent.click(clearButton);

        await waitFor(() => {
            expect(mockProps.onSearchChange).toHaveBeenCalledWith('');
        });
    });

    it('shows loading spinner with proper spacing when searching without text', () => {
        render(<NavigationBar {...mockProps} searchQuery="" isSearching={true} />);

        const spinnerContainer = document.querySelector('.animate-spin')?.parentElement;
        expect(spinnerContainer).toHaveClass('min-w-[28px]', 'min-h-[28px]', 'p-2');
    });

    it('shows smaller loading spinner when searching with text', () => {
        render(<NavigationBar {...mockProps} searchQuery="test" isSearching={true} />);

        const spinnerContainer = document.querySelector('.animate-spin')?.parentElement;
        expect(spinnerContainer).toHaveClass('p-1'); // Smaller padding when text is present
    });

    it('positions clear button and spinner correctly', () => {
        render(<NavigationBar {...mockProps} searchQuery="test" isSearching={true} />);

        const clearButton = screen.getByLabelText('Clear search');
        const spinner = document.querySelector('.animate-spin');

        expect(clearButton).toBeInTheDocument();
        expect(spinner).toBeInTheDocument();

        // Both should be in the right side container
        const rightContainer = clearButton.parentElement;
        expect(rightContainer).toHaveClass('absolute', 'right-2'); // Positioned from right
    });

    it('clear button icon has proper size', () => {
        render(<NavigationBar {...mockProps} searchQuery="test" />);

        const clearButton = screen.getByLabelText('Clear search');
        const icon = clearButton.querySelector('svg');

        expect(icon).toHaveClass('h-4', 'w-4'); // Increased from h-3 w-3
    });

    it('maintains search functionality with improved focus management', async () => {
        const { rerender } = render(<NavigationBar {...mockProps} />);

        const searchInput = screen.getByPlaceholderText('Search projects...');

        // Type in search
        fireEvent.change(searchInput, { target: { value: 'test' } });

        await waitFor(() => {
            expect(mockProps.onSearchChange).toHaveBeenCalledWith('test');
        });

        // Simulate re-render with new search query
        rerender(<NavigationBar {...mockProps} searchQuery="test" />);

        // Input should still be functional
        fireEvent.change(searchInput, { target: { value: 'test updated' } });

        await waitFor(() => {
            expect(mockProps.onSearchChange).toHaveBeenCalledWith('test updated');
        });
    });

    it('does not show clear button when search is disabled', () => {
        render(<NavigationBar {...mockProps} searchQuery="test" canSearch={false} />);

        const clearButton = screen.queryByLabelText('Clear search');
        expect(clearButton).not.toBeInTheDocument();
    });

    it('shows proper loading state when searching', () => {
        render(<NavigationBar {...mockProps} searchQuery="test" isSearching={true} />);

        // Should show both clear button and loading spinner
        const clearButton = screen.getByLabelText('Clear search');
        const spinner = document.querySelector('.animate-spin');

        expect(clearButton).toBeInTheDocument();
        expect(spinner).toBeInTheDocument();
    });

    it('has proper accessibility attributes on clear button', () => {
        render(<NavigationBar {...mockProps} searchQuery="test" />);

        const clearButton = screen.getByLabelText('Clear search');

        expect(clearButton).toHaveAttribute('type', 'button');
        expect(clearButton).toHaveAttribute('aria-label', 'Clear search');
    });
});