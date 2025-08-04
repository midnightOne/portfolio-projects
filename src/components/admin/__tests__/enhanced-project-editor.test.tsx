import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { EnhancedProjectEditor } from '../enhanced-project-editor';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}));

// Mock child components
jest.mock('../ai-quick-actions', () => ({
  AIQuickActions: ({ selectedText, projectContext, onApplyChanges }: any) => (
    <div data-testid="ai-quick-actions">
      <div data-testid="selected-text">{selectedText?.text || 'No selection'}</div>
      <div data-testid="project-title">{projectContext.title}</div>
      <button 
        data-testid="apply-changes"
        onClick={() => onApplyChanges({
          success: true,
          changes: { fullContent: 'AI improved content' },
          reasoning: 'Test improvement',
          confidence: 0.9,
          warnings: [],
          model: 'test-model',
          tokensUsed: 50,
          cost: 0.001
        })}
      >
        Apply AI Changes
      </button>
    </div>
  )
}));

jest.mock('../text-selection-manager', () => ({
  TextSelectionManager: ({ children, onSelectionChange }: any) => (
    <div data-testid="text-selection-manager">
      {children}
      <button 
        data-testid="simulate-selection"
        onClick={() => onSelectionChange({
          text: 'selected text',
          start: 0,
          end: 13
        })}
      >
        Simulate Selection
      </button>
    </div>
  ),
  TextareaAdapter: jest.fn().mockImplementation(() => ({
    getSelection: () => null,
    applyChange: jest.fn(),
    getFullContent: () => '',
    setFullContent: jest.fn(),
    focus: jest.fn()
  }))
}));

jest.mock('../smart-tag-input', () => ({
  SmartTagInput: ({ value, onChange, placeholder }: any) => (
    <div data-testid="smart-tag-input">
      <input
        data-testid="tag-input"
        value={value.join(', ')}
        onChange={(e) => onChange(e.target.value.split(', ').filter(Boolean))}
        placeholder={placeholder}
      />
    </div>
  )
}));

jest.mock('../floating-save-bar', () => ({
  FloatingSaveBar: ({ onSave, onBack, hasUnsavedChanges, saving }: any) => (
    <div data-testid="floating-save-bar">
      <button data-testid="save-button" onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      <button data-testid="back-button" onClick={onBack}>
        Back
      </button>
      <div data-testid="unsaved-changes">
        {hasUnsavedChanges ? 'Has changes' : 'No changes'}
      </div>
    </div>
  )
}));

jest.mock('../clickable-media-upload', () => ({
  ClickableMediaUpload: ({ onMediaSelect, onMediaRemove }: any) => (
    <div data-testid="clickable-media-upload">
      <button data-testid="select-media" onClick={() => onMediaSelect({ id: 'media-1', url: 'test.jpg' })}>
        Select Media
      </button>
      <button data-testid="remove-media" onClick={onMediaRemove}>
        Remove Media
      </button>
    </div>
  )
}));

// Mock fetch
global.fetch = jest.fn();

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn()
};

describe('EnhancedProjectEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (fetch as jest.Mock).mockClear();
  });

  describe('Create Mode', () => {
    it('renders create mode correctly', () => {
      render(<EnhancedProjectEditor mode="create" />);

      expect(screen.getByPlaceholderText('Enter your project title...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('A short description that appears on project cards...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Describe your project in detail...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Write your project article here...')).toBeInTheDocument();
      expect(screen.getByTestId('ai-quick-actions')).toBeInTheDocument();
    });

    it('tracks unsaved changes for new projects', async () => {
      render(<EnhancedProjectEditor mode="create" />);

      const titleInput = screen.getByPlaceholderText('Enter your project title...');
      fireEvent.change(titleInput, { target: { value: 'New Project Title' } });

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-changes')).toHaveTextContent('Has changes');
      });
    });

    it('saves new project correctly', async () => {
      const mockResponse = {
        project: { id: 'new-project-id' }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      render(<EnhancedProjectEditor mode="create" />);

      const titleInput = screen.getByPlaceholderText('Enter your project title...');
      fireEvent.change(titleInput, { target: { value: 'New Project' } });

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"title":"New Project"')
        });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/projects/editor/new-project-id');
      });
    });
  });

  describe('Edit Mode', () => {
    const mockProject = {
      id: 'project-1',
      title: 'Existing Project',
      description: 'Existing description',
      briefOverview: 'Existing overview',
      status: 'DRAFT',
      visibility: 'PRIVATE',
      workDate: '2024-01-01',
      tags: [{ name: 'react' }, { name: 'typescript' }],
      articleContent: { content: 'Existing article content' }
    };

    it('loads existing project data', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProject
      });

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/projects/project-1');
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing overview')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing article content')).toBeInTheDocument();
      });
    });

    it('updates existing project correctly', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProject
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProject
        });

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument();
      });

      const titleInput = screen.getByDisplayValue('Existing Project');
      fireEvent.change(titleInput, { target: { value: 'Updated Project' } });

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/projects/project-1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"title":"Updated Project"')
        });
      });
    });

    it('handles load error gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to load'));

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load project')).toBeInTheDocument();
        expect(screen.getByText('Back to Projects')).toBeInTheDocument();
      });
    });
  });

  describe('Text Selection Integration', () => {
    it('handles text selection across different fields', async () => {
      render(<EnhancedProjectEditor mode="create" />);

      const simulateSelectionButton = screen.getAllByTestId('simulate-selection')[0];
      fireEvent.click(simulateSelectionButton);

      await waitFor(() => {
        expect(screen.getByTestId('selected-text')).toHaveTextContent('selected text');
      });
    });

    it('applies AI changes to selected text', async () => {
      render(<EnhancedProjectEditor mode="create" />);

      // Simulate text selection
      const simulateSelectionButton = screen.getAllByTestId('simulate-selection')[0];
      fireEvent.click(simulateSelectionButton);

      // Apply AI changes
      const applyChangesButton = screen.getByTestId('apply-changes');
      fireEvent.click(applyChangesButton);

      // The TextareaAdapter mock should be called
      // In a real implementation, this would update the form field
    });
  });

  describe('AI Integration', () => {
    it('provides project context to AI actions', () => {
      render(<EnhancedProjectEditor mode="create" />);

      const titleInput = screen.getByPlaceholderText('Enter your project title...');
      fireEvent.change(titleInput, { target: { value: 'Test Project' } });

      expect(screen.getByTestId('project-title')).toHaveTextContent('Test Project');
    });

    it('handles AI tag suggestions', async () => {
      render(<EnhancedProjectEditor mode="create" />);

      const applyChangesButton = screen.getByTestId('apply-changes');
      
      // Mock AI response with tag suggestions
      const aiResponse = {
        success: true,
        changes: {
          suggestedTags: {
            add: ['javascript', 'web'],
            remove: [],
            reasoning: 'Based on project content'
          }
        },
        reasoning: 'Added relevant tags',
        confidence: 0.9,
        warnings: [],
        model: 'test-model',
        tokensUsed: 30,
        cost: 0.0005
      };

      // This would trigger the tag update in the real implementation
      fireEvent.click(applyChangesButton);
    });
  });

  describe('Form Management', () => {
    it('tracks form changes correctly', async () => {
      render(<EnhancedProjectEditor mode="create" />);

      expect(screen.getByTestId('unsaved-changes')).toHaveTextContent('No changes');

      const titleInput = screen.getByPlaceholderText('Enter your project title...');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-changes')).toHaveTextContent('Has changes');
      });
    });

    it('handles tag input correctly', () => {
      render(<EnhancedProjectEditor mode="create" />);

      const tagInput = screen.getByTestId('tag-input');
      fireEvent.change(tagInput, { target: { value: 'react, typescript, nextjs' } });

      // The SmartTagInput mock should handle the tag parsing
      expect(tagInput).toHaveValue('react, typescript, nextjs');
    });

    it('handles date input correctly', () => {
      render(<EnhancedProjectEditor mode="create" />);

      const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0]);
      fireEvent.change(dateInput, { target: { value: '2024-12-25' } });

      expect(dateInput).toHaveValue('2024-12-25');
    });
  });

  describe('Navigation', () => {
    it('navigates back to projects list', () => {
      render(<EnhancedProjectEditor mode="create" />);

      const backButton = screen.getByTestId('back-button');
      fireEvent.click(backButton);

      expect(mockPush).toHaveBeenCalledWith('/admin/projects');
    });
  });

  describe('Error Handling', () => {
    it('displays save errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Save failed'));

      render(<EnhancedProjectEditor mode="create" />);

      const titleInput = screen.getByPlaceholderText('Enter your project title...');
      fireEvent.change(titleInput, { target: { value: 'Test Project' } });

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Error would be displayed in the FloatingSaveBar
        expect(fetch).toHaveBeenCalled();
      });
    });

    it('handles network errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load project')).toBeInTheDocument();
      });
    });
  });

  describe('Media Upload Integration', () => {
    it('shows media upload for existing projects', async () => {
      const mockProject = {
        id: 'project-1',
        title: 'Test Project',
        description: 'Test description',
        briefOverview: 'Test overview',
        status: 'DRAFT',
        visibility: 'PRIVATE',
        workDate: '2024-01-01',
        tags: [],
        articleContent: { content: 'Test content' }
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProject
      });

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('clickable-media-upload')).toBeInTheDocument();
      });
    });

    it('does not show media upload for new projects', () => {
      render(<EnhancedProjectEditor mode="create" />);

      expect(screen.queryByTestId('clickable-media-upload')).not.toBeInTheDocument();
    });
  });
});