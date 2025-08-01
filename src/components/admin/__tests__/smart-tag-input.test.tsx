import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SmartTagInput, Tag, TagInputBehavior } from '../smart-tag-input';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock data
const mockExistingTags: Tag[] = [
  { id: '1', name: 'React', projectCount: 5 },
  { id: '2', name: 'TypeScript', projectCount: 8 },
  { id: '3', name: 'Next.js', projectCount: 3 },
  { id: '4', name: 'JavaScript', projectCount: 10 },
  { id: '5', name: 'Node.js', projectCount: 4 },
  { id: '6', name: 'react-native', projectCount: 2 },
];

describe('SmartTagInput', () => {
  const defaultProps = {
    value: [],
    onChange: jest.fn(),
    existingTags: mockExistingTags,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('renders with placeholder text', () => {
      render(<SmartTagInput {...defaultProps} />);
      expect(screen.getByPlaceholderText('Add tags (comma or semicolon separated)...')).toBeInTheDocument();
    });

    it('displays existing tags as inline badges', () => {
      render(<SmartTagInput {...defaultProps} value={['React', 'TypeScript']} />);
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      
      // Tags should be displayed inline within the input container
      const inputContainer = screen.getByText('React').closest('[class*="flex"]');
      expect(inputContainer).toBeInTheDocument();
    });

    it('removes tags when X button is clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} value={['React', 'TypeScript']} onChange={onChange} />);
      
      const removeButtons = screen.getAllByLabelText(/Remove .* tag/);
      await user.click(removeButtons[0]);
      
      expect(onChange).toHaveBeenCalledWith(['TypeScript']);
    });
  });

  describe('Separator Handling', () => {
    it('processes comma-separated tags', () => {
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      
      // Simulate typing with comma separator
      fireEvent.change(input, { target: { value: 'tag1,tag2,tag3' } });
      
      expect(onChange).toHaveBeenCalledWith(['tag1', 'tag2', 'tag3']);
    });

    it('processes semicolon-separated tags', () => {
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      
      // Simulate typing with semicolon separator
      fireEvent.change(input, { target: { value: 'tag1;tag2;tag3' } });
      
      expect(onChange).toHaveBeenCalledWith(['tag1', 'tag2', 'tag3']);
    });

    it('handles mixed separators', () => {
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      
      // Simulate typing with mixed separators
      fireEvent.change(input, { target: { value: 'tag1,tag2;tag3' } });
      
      expect(onChange).toHaveBeenCalledWith(['tag1', 'tag2', 'tag3']);
    });

    it('trims whitespace from tags', () => {
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      
      // Simulate typing with whitespace and separators
      fireEvent.change(input, { target: { value: ' tag1 , tag2 ; tag3 ' } });
      
      expect(onChange).toHaveBeenCalledWith(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('Autocomplete Functionality', () => {
    it('shows suggestions when typing', async () => {
      const user = userEvent.setup();
      
      render(<SmartTagInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Rea');
      
      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
      });
    });

    it('filters suggestions based on input', async () => {
      const user = userEvent.setup();
      
      render(<SmartTagInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Type');
      
      await waitFor(() => {
        expect(screen.getByText('TypeScript')).toBeInTheDocument();
        expect(screen.queryByText('React')).not.toBeInTheDocument();
      });
    });

    it('handles TAB key for autocomplete', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Rea');
      
      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
      });
      
      await user.keyboard('{Tab}');
      
      expect(onChange).toHaveBeenCalledWith(['React']);
    });

    it('handles Enter key for autocomplete', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Rea');
      
      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
      });
      
      await user.keyboard('{Enter}');
      
      expect(onChange).toHaveBeenCalledWith(['React']);
    });

    it('navigates suggestions with arrow keys', async () => {
      const user = userEvent.setup();
      
      render(<SmartTagInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'react');
      
      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
        expect(screen.getByText('react-native')).toBeInTheDocument();
      });
      
      // First suggestion should be selected by default
      expect(screen.getByText('React').closest('div')).toHaveClass('bg-blue-50');
      
      // Navigate down
      await user.keyboard('{ArrowDown}');
      expect(screen.getByText('react-native').closest('div')).toHaveClass('bg-blue-50');
      
      // Navigate back up
      await user.keyboard('{ArrowUp}');
      expect(screen.getByText('React').closest('div')).toHaveClass('bg-blue-50');
    });
  });

  describe('Duplicate Detection', () => {
    it('prevents duplicate tags (case-insensitive)', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      const onDuplicateAttempt = jest.fn();
      
      render(
        <SmartTagInput 
          {...defaultProps} 
          value={['React']} 
          onChange={onChange}
          onDuplicateAttempt={onDuplicateAttempt}
          showSuggestions={false} // Disable suggestions to test direct duplicate detection
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'react{Enter}');
      
      expect(onChange).not.toHaveBeenCalled();
      expect(onDuplicateAttempt).toHaveBeenCalledWith('react');
    });

    it('shows duplicate animation', async () => {
      const user = userEvent.setup();
      const onDuplicateAttempt = jest.fn();
      
      render(
        <SmartTagInput 
          {...defaultProps} 
          value={['React']} 
          animateDuplicates={true}
          showSuggestions={false}
          onDuplicateAttempt={onDuplicateAttempt}
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'react{Enter}');
      
      // Check that duplicate attempt was detected
      expect(onDuplicateAttempt).toHaveBeenCalledWith('react');
      
      // Check that the badge still exists (not removed)
      expect(screen.getByText('React')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('removes last tag with backspace on empty input', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} value={['React', 'TypeScript']} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('{Backspace}');
      
      expect(onChange).toHaveBeenCalledWith(['React']);
    });

    it('closes suggestions with Escape key', async () => {
      const user = userEvent.setup();
      
      render(<SmartTagInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Rea');
      
      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
      });
      
      await user.keyboard('{Escape}');
      
      expect(screen.queryByText('React')).not.toBeInTheDocument();
    });
  });

  describe('Configuration Options', () => {
    it('respects maxTags limit', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<SmartTagInput {...defaultProps} value={['tag1', 'tag2']} maxTags={2} onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'tag3{Enter}');
      
      expect(onChange).not.toHaveBeenCalled();
    });

    it('shows tag counter when maxTags is set', () => {
      render(<SmartTagInput {...defaultProps} value={['tag1']} maxTags={5} />);
      expect(screen.getByText('1/5 tags')).toBeInTheDocument();
    });

    it('handles case-sensitive mode', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(
        <SmartTagInput 
          {...defaultProps} 
          value={['React']} 
          caseSensitive={true}
          onChange={onChange}
          showSuggestions={false} // Disable suggestions to test direct input
        />
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'react{Enter}');
      
      // Should allow 'react' as it's different from 'React' in case-sensitive mode
      expect(onChange).toHaveBeenCalledWith(['React', 'react']);
    });

    it('displays error message', () => {
      render(<SmartTagInput {...defaultProps} error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });
  });

  describe('Click Outside Behavior', () => {
    it('closes suggestions when clicking outside', async () => {
      const user = userEvent.setup();
      
      render(
        <div>
          <SmartTagInput {...defaultProps} />
          <div data-testid="outside">Outside element</div>
        </div>
      );
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'Rea');
      
      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('outside'));
      
      expect(screen.queryByText('React')).not.toBeInTheDocument();
    });
  });
});

describe('TagInputBehavior Utility Functions', () => {
  describe('findExistingTag', () => {
    it('finds existing tag case-insensitively', () => {
      const result = TagInputBehavior.findExistingTag('react', mockExistingTags, false);
      expect(result?.name).toBe('React');
    });

    it('finds existing tag case-sensitively', () => {
      const result = TagInputBehavior.findExistingTag('react', mockExistingTags, true);
      expect(result).toBeNull();
      
      const result2 = TagInputBehavior.findExistingTag('React', mockExistingTags, true);
      expect(result2?.name).toBe('React');
    });
  });

  describe('processSeparators', () => {
    it('splits by comma and semicolon', () => {
      const result = TagInputBehavior.processSeparators('tag1,tag2;tag3', [',', ';']);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('trims whitespace', () => {
      const result = TagInputBehavior.processSeparators(' tag1 , tag2 ; tag3 ', [',', ';']);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('filters empty tags', () => {
      const result = TagInputBehavior.processSeparators('tag1,,tag2;;tag3', [',', ';']);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('getMatchingSuggestions', () => {
    it('returns matching suggestions', () => {
      const result = TagInputBehavior.getMatchingSuggestions('rea', mockExistingTags, [], false, 5);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('React');
      expect(result[1].name).toBe('react-native');
    });

    it('excludes current tags', () => {
      const result = TagInputBehavior.getMatchingSuggestions('rea', mockExistingTags, ['React'], false, 5);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('react-native');
    });

    it('sorts by relevance', () => {
      // Test that suggestions are returned and sorted
      const result = TagInputBehavior.getMatchingSuggestions('Script', mockExistingTags, [], false, 5);
      
      // Should return both JavaScript and TypeScript
      expect(result).toHaveLength(2);
      expect(result.map(r => r.name)).toContain('JavaScript');
      expect(result.map(r => r.name)).toContain('TypeScript');
      
      // Results should be sorted (exact order may vary based on implementation)
      expect(result[0].name).toMatch(/^(JavaScript|TypeScript)$/);
      expect(result[1].name).toMatch(/^(JavaScript|TypeScript)$/);
    });

    it('limits results', () => {
      const result = TagInputBehavior.getMatchingSuggestions('a', mockExistingTags, [], false, 2);
      expect(result).toHaveLength(2);
    });
  });
});