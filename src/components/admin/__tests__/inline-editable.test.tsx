import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEditable } from '../inline-editable';
import { TextSelection } from '@/lib/types/project';
import { describe, it, beforeEach } from '@jest/globals';

describe('InlineEditable', () => {
  const defaultProps = {
    value: 'Test value',
    onChange: jest.fn(),
    placeholder: 'Enter text...'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('renders in display mode by default', () => {
      render(<InlineEditable {...defaultProps} />);
      
      expect(screen.getByText('Test value')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('switches to edit mode when clicked', async () => {
      const user = userEvent.setup();
      render(<InlineEditable {...defaultProps} />);
      
      await user.click(screen.getByText('Test value'));
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test value')).toBeInTheDocument();
    });

    it('calls onChange when value is modified and blurred', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      render(<InlineEditable {...defaultProps} onChange={onChange} />);
      
      await user.click(screen.getByText('Test value'));
      const input = screen.getByRole('textbox');
      
      await user.clear(input);
      await user.type(input, 'New value');
      await user.tab(); // Blur the input
      
      expect(onChange).toHaveBeenCalledWith('New value');
    });

    it('reverts to original value on Escape', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      render(<InlineEditable {...defaultProps} onChange={onChange} />);
      
      await user.click(screen.getByText('Test value'));
      const input = screen.getByRole('textbox');
      
      await user.clear(input);
      await user.type(input, 'New value');
      await user.keyboard('{Escape}');
      
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText('Test value')).toBeInTheDocument();
    });
  });

  describe('Multiline mode', () => {
    it('renders textarea in multiline mode', async () => {
      const user = userEvent.setup();
      render(<InlineEditable {...defaultProps} multiline />);
      
      await user.click(screen.getByText('Test value'));
      
      expect(screen.getByRole('textbox')).toBeInstanceOf(HTMLTextAreaElement);
    });

    it('does not submit on Enter in multiline mode', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      render(<InlineEditable {...defaultProps} onChange={onChange} multiline />);
      
      await user.click(screen.getByText('Test value'));
      const textarea = screen.getByRole('textbox');
      
      await user.type(textarea, '{Enter}New line');
      
      expect(onChange).not.toHaveBeenCalled();
      expect(textarea).toHaveValue('Test value\nNew line');
    });
  });

  describe('Validation', () => {
    it('shows required field error when empty and required', async () => {
      const user = userEvent.setup();
      render(<InlineEditable value="" onChange={jest.fn()} required placeholder="Enter text..." />);
      
      // Click on the container div since empty value shows placeholder
      const container = screen.getByText('Enter text...').parentElement;
      await user.click(container!);
      await user.tab(); // Blur without entering text
      
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('shows character count when maxLength is set', async () => {
      const user = userEvent.setup();
      render(<InlineEditable {...defaultProps} maxLength={20} showCharacterCount />);
      
      await user.click(screen.getByText('Test value'));
      
      expect(screen.getByText('10/20 characters')).toBeInTheDocument();
    });

    it('prevents input beyond maxLength', async () => {
      const user = userEvent.setup();
      render(<InlineEditable value="12345" onChange={jest.fn()} maxLength={5} />);
      
      await user.click(screen.getByText('12345'));
      const input = screen.getByRole('textbox');
      
      await user.type(input, '67890');
      
      expect(input).toHaveValue('12345'); // Should not exceed maxLength
    });

    it('validates with custom validator', async () => {
      const user = userEvent.setup();
      const customValidator = (value: string) => 
        value.includes('@') ? null : 'Must contain @';
      
      render(
        <InlineEditable 
          value="test" 
          onChange={jest.fn()} 
          customValidator={customValidator}
        />
      );
      
      await user.click(screen.getByText('test'));
      await user.tab(); // Blur to trigger validation
      
      expect(screen.getByText('Must contain @')).toBeInTheDocument();
    });
  });

  describe('Text selection for AI integration', () => {
    it('calls onTextSelection when text is selected', async () => {
      const user = userEvent.setup();
      const onTextSelection = jest.fn();
      
      render(
        <InlineEditable 
          {...defaultProps} 
          onTextSelection={onTextSelection}
          fieldName="title"
        />
      );
      
      await user.click(screen.getByText('Test value'));
      const input = screen.getByRole('textbox') as HTMLInputElement;
      
      // Simulate text selection
      input.setSelectionRange(0, 4);
      fireEvent.mouseUp(input);
      
      expect(onTextSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          start: 0,
          end: 4,
          text: 'Test',
          field: 'title'
        })
      );
    });

    it('clears selection when no text is selected', async () => {
      const user = userEvent.setup();
      const onTextSelection = jest.fn();
      
      render(
        <InlineEditable 
          {...defaultProps} 
          onTextSelection={onTextSelection}
        />
      );
      
      await user.click(screen.getByText('Test value'));
      const input = screen.getByRole('textbox') as HTMLInputElement;
      
      // Simulate clicking without selection
      input.setSelectionRange(2, 2);
      fireEvent.mouseUp(input);
      
      expect(onTextSelection).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Auto-save functionality', () => {
    it('triggers auto-save after delay when enabled', async () => {
      const user = userEvent.setup();
      const onAutoSave = jest.fn();
      
      render(
        <InlineEditable 
          {...defaultProps} 
          autoSave 
          autoSaveDelay={100}
          onAutoSave={onAutoSave}
        />
      );
      
      await user.click(screen.getByText('Test value'));
      const input = screen.getByRole('textbox');
      
      await user.type(input, ' modified');
      
      await waitFor(() => {
        expect(onAutoSave).toHaveBeenCalledWith('Test value modified');
      }, { timeout: 200 });
    });

    it('shows auto-saving indicator when dirty', async () => {
      const user = userEvent.setup();
      
      render(
        <InlineEditable 
          {...defaultProps} 
          autoSave 
          onAutoSave={jest.fn()}
        />
      );
      
      await user.click(screen.getByText('Test value'));
      const input = screen.getByRole('textbox');
      
      await user.type(input, ' modified');
      
      expect(screen.getByText('Auto-saving...')).toBeInTheDocument();
    });
  });

  describe('Display modes', () => {
    it('renders in inline display mode', () => {
      render(<InlineEditable {...defaultProps} displayMode="inline" />);
      
      const container = screen.getByText('Test value').parentElement;
      expect(container).toHaveClass('inline-flex');
    });

    it('shows edit indicator on hover', () => {
      render(<InlineEditable {...defaultProps} />);
      
      const container = screen.getByText('Test value').parentElement;
      expect(container).toHaveClass('group');
    });
  });

  describe('Error handling', () => {
    it('displays external error prop', () => {
      render(<InlineEditable {...defaultProps} error="External error" />);
      
      expect(screen.getByText('External error')).toBeInTheDocument();
    });

    it('prioritizes validation error over external error', async () => {
      const user = userEvent.setup();
      
      render(
        <InlineEditable 
          value="" 
          onChange={jest.fn()} 
          required 
          error="External error"
          placeholder="Enter text..."
        />
      );
      
      // Click on the container div since empty value shows placeholder
      const container = screen.getByText('Enter text...').parentElement;
      await user.click(container!);
      await user.tab();
      
      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.queryByText('External error')).not.toBeInTheDocument();
    });
  });
});