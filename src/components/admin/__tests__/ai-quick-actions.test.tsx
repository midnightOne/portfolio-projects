import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIQuickActions, TextSelection, ProjectContext } from '../ai-quick-actions';

// Mock the UnifiedModelSelector component
jest.mock('../unified-model-selector', () => ({
  UnifiedModelSelector: ({ value, onValueChange, placeholder }: any) => (
    <select
      data-testid="model-selector"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      <option value="gpt-4o">GPT-4o</option>
      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
    </select>
  )
}));

// Mock fetch
global.fetch = jest.fn();

const mockProjectContext: ProjectContext = {
  title: 'Test Project',
  description: 'A test project',
  existingTags: ['react', 'typescript'],
  fullContent: 'This is test content for the project.'
};

const mockSelectedText: TextSelection = {
  text: 'test content',
  start: 8,
  end: 20
};

const mockOnApplyChanges = jest.fn();

describe('AIQuickActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('renders all quick action buttons', () => {
    render(
      <AIQuickActions
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    expect(screen.getByText('Make Professional')).toBeInTheDocument();
    expect(screen.getByText('Make Casual')).toBeInTheDocument();
    expect(screen.getByText('Expand')).toBeInTheDocument();
    expect(screen.getByText('Summarize')).toBeInTheDocument();
    expect(screen.getByText('Improve')).toBeInTheDocument();
    expect(screen.getByText('Suggest Tags')).toBeInTheDocument();
  });

  it('shows model selector', () => {
    render(
      <AIQuickActions
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    expect(screen.getByTestId('model-selector')).toBeInTheDocument();
  });

  it('displays selected text when provided', () => {
    render(
      <AIQuickActions
        selectedText={mockSelectedText}
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    expect(screen.getByText('Selected Text:')).toBeInTheDocument();
    expect(screen.getByText('"test content"')).toBeInTheDocument();
    expect(screen.getByText('12 characters selected')).toBeInTheDocument();
  });

  it('disables text-based actions when no text is selected', () => {
    render(
      <AIQuickActions
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    const professionalButton = screen.getByText('Make Professional').closest('button');
    const casualButton = screen.getByText('Make Casual').closest('button');
    const expandButton = screen.getByText('Expand').closest('button');
    const summarizeButton = screen.getByText('Summarize').closest('button');
    const improveButton = screen.getByText('Improve').closest('button');
    const suggestTagsButton = screen.getByText('Suggest Tags').closest('button');

    expect(professionalButton).toBeDisabled();
    expect(casualButton).toBeDisabled();
    expect(expandButton).toBeDisabled();
    expect(summarizeButton).toBeDisabled();
    expect(improveButton).toBeDisabled();
    expect(suggestTagsButton).toBeDisabled(); // Disabled because no model selected
  });

  it('enables text-based actions when text is selected and model is chosen', () => {
    render(
      <AIQuickActions
        selectedText={mockSelectedText}
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    // Select a model first
    const modelSelector = screen.getByTestId('model-selector');
    fireEvent.change(modelSelector, { target: { value: 'gpt-4o' } });

    const professionalButton = screen.getByText('Make Professional').closest('button');
    const casualButton = screen.getByText('Make Casual').closest('button');
    const expandButton = screen.getByText('Expand').closest('button');
    const summarizeButton = screen.getByText('Summarize').closest('button');
    const improveButton = screen.getByText('Improve').closest('button');

    expect(professionalButton).not.toBeDisabled();
    expect(casualButton).not.toBeDisabled();
    expect(expandButton).not.toBeDisabled();
    expect(summarizeButton).not.toBeDisabled();
    expect(improveButton).not.toBeDisabled();
  });

  it('disables text-based actions when no text is selected', () => {
    render(
      <AIQuickActions
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    // Select a model first
    const modelSelector = screen.getByTestId('model-selector');
    fireEvent.change(modelSelector, { target: { value: 'gpt-4o' } });

    // Text-based actions should be disabled when no text is selected
    const professionalButton = screen.getByText('Make Professional').closest('button');
    const casualButton = screen.getByText('Make Casual').closest('button');
    const expandButton = screen.getByText('Expand').closest('button');
    const summarizeButton = screen.getByText('Summarize').closest('button');
    const improveButton = screen.getByText('Improve').closest('button');

    expect(professionalButton).toBeDisabled();
    expect(casualButton).toBeDisabled();
    expect(expandButton).toBeDisabled();
    expect(summarizeButton).toBeDisabled();
    expect(improveButton).toBeDisabled();
  });

  it('disables actions when no model is selected', () => {
    render(
      <AIQuickActions
        selectedText={mockSelectedText}
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    // All actions should be disabled when no model is selected
    const professionalButton = screen.getByText('Make Professional').closest('button');
    const casualButton = screen.getByText('Make Casual').closest('button');
    const suggestTagsButton = screen.getByText('Suggest Tags').closest('button');

    expect(professionalButton).toBeDisabled();
    expect(casualButton).toBeDisabled();
    expect(suggestTagsButton).toBeDisabled();
  });

  it('makes API call for content editing action', async () => {
    const mockResponse = {
      success: true,
      changes: {
        partialUpdate: {
          start: 8,
          end: 20,
          newText: 'professional content',
          reasoning: 'Made text more professional'
        }
      },
      reasoning: 'Improved professionalism',
      confidence: 0.9,
      warnings: [],
      model: 'gpt-4o',
      tokensUsed: 50,
      cost: 0.001
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(
      <AIQuickActions
        selectedText={mockSelectedText}
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    // Select a model
    const modelSelector = screen.getByTestId('model-selector');
    fireEvent.change(modelSelector, { target: { value: 'gpt-4o' } });

    // Click the professional action
    const professionalButton = screen.getByText('Make Professional').closest('button');
    fireEvent.click(professionalButton!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/ai/edit-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          operation: 'make_professional',
          content: 'test content',
          selectedText: {
            text: 'test content',
            start: 8,
            end: 20
          },
          context: {
            projectTitle: 'Test Project',
            projectDescription: 'A test project',
            existingTags: ['react', 'typescript'],
            fullContent: 'This is test content for the project.'
          }
        })
      });
    });
  });

  it('makes API call for tag suggestion action', async () => {
    const mockResponse = {
      success: true,
      changes: {
        suggestedTags: {
          add: ['javascript'],
          remove: [],
          reasoning: 'Based on project content'
        }
      },
      reasoning: 'Analyzed project content',
      confidence: 0.9,
      warnings: [],
      model: 'gpt-4o',
      tokensUsed: 30,
      cost: 0.0005
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(
      <AIQuickActions
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    // Select a model
    const modelSelector = screen.getByTestId('model-selector');
    fireEvent.change(modelSelector, { target: { value: 'gpt-4o' } });

    // Click the suggest tags action
    const suggestTagsButton = screen.getByText('Suggest Tags').closest('button');
    fireEvent.click(suggestTagsButton!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/ai/suggest-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          projectTitle: 'Test Project',
          projectDescription: 'A test project',
          articleContent: 'This is test content for the project.',
          existingTags: ['react', 'typescript'],
          maxSuggestions: 5
        })
      });
    });
  });

  it('displays preview after successful API call', async () => {
    const mockResponse = {
      success: true,
      changes: {
        fullContent: 'This is improved professional content for the project.'
      },
      reasoning: 'Made the content more professional',
      confidence: 0.9,
      warnings: [],
      model: 'gpt-4o',
      tokensUsed: 50,
      cost: 0.001
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(
      <AIQuickActions
        selectedText={mockSelectedText}
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    // Select a model
    const modelSelector = screen.getByTestId('model-selector');
    fireEvent.change(modelSelector, { target: { value: 'gpt-4o' } });

    // Click the professional action
    const professionalButton = screen.getByText('Make Professional').closest('button');
    fireEvent.click(professionalButton!);

    await waitFor(() => {
      expect(screen.getByText('AI Results Preview')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Made the content more professional')).toBeInTheDocument();
      expect(screen.getByText('Apply Changes')).toBeInTheDocument();
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });
  });

  it('calls onApplyChanges when Apply Changes is clicked', async () => {
    const mockResponse = {
      success: true,
      changes: {
        fullContent: 'This is improved professional content for the project.'
      },
      reasoning: 'Made the content more professional',
      confidence: 0.9,
      warnings: [],
      model: 'gpt-4o',
      tokensUsed: 50,
      cost: 0.001
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    render(
      <AIQuickActions
        selectedText={mockSelectedText}
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    // Select a model
    const modelSelector = screen.getByTestId('model-selector');
    fireEvent.change(modelSelector, { target: { value: 'gpt-4o' } });

    // Click the professional action
    const professionalButton = screen.getByText('Make Professional').closest('button');
    fireEvent.click(professionalButton!);

    // Wait for preview to appear
    await waitFor(() => {
      expect(screen.getByText('Apply Changes')).toBeInTheDocument();
    });

    // Click Apply Changes
    const applyButton = screen.getByText('Apply Changes');
    fireEvent.click(applyButton);

    expect(mockOnApplyChanges).toHaveBeenCalledWith(mockResponse);
  });

  it('handles API errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <AIQuickActions
        selectedText={mockSelectedText}
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    // Select a model
    const modelSelector = screen.getByTestId('model-selector');
    fireEvent.change(modelSelector, { target: { value: 'gpt-4o' } });

    // Click the professional action
    const professionalButton = screen.getByText('Make Professional').closest('button');
    fireEvent.click(professionalButton!);

    await waitFor(() => {
      expect(screen.getByText('AI Results Preview')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Action failed: Network error')).toBeInTheDocument();
    });
  });

  it('shows selection required notice when no text is selected', () => {
    render(
      <AIQuickActions
        projectContext={mockProjectContext}
        onApplyChanges={mockOnApplyChanges}
      />
    );

    expect(screen.getByText('Select text in the editor to enable text-specific actions')).toBeInTheDocument();
  });
});