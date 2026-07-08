/**
 * EnhancedProjectEditor tests.
 *
 * The editor no longer renders its own save bar — it LIFTS its save controls
 * (save/back handlers, dirty flag, visibility) to the parent via
 * `onSaveControlsChange`, and the admin page layout renders them. The
 * harness captures the latest controls and drives save/back through them.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { EnhancedProjectEditor } from '../enhanced-project-editor';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}));

// Mock heavy child components
jest.mock('../ai-quick-actions', () => ({
  AIQuickActions: ({ projectContext }: any) => (
    <div data-testid="ai-quick-actions">
      <div data-testid="project-title">{projectContext?.title}</div>
    </div>
  )
}));

jest.mock('../ai-prompt-interface', () => ({
  AIPromptInterface: ({ projectContext }: any) => (
    <div data-testid="ai-prompt-interface">
      <div data-testid="project-title">{projectContext?.title}</div>
    </div>
  )
}));

jest.mock('../text-selection-manager', () => ({
  TextSelectionManager: ({ children }: any) => (
    <div data-testid="text-selection-manager">{children}</div>
  ),
  TextareaAdapter: jest.fn().mockImplementation(() => ({
    getSelection: () => null,
    applyChange: jest.fn(),
    getFullContent: () => '',
    setFullContent: jest.fn(),
    focus: jest.fn()
  })),
  TiptapAdapter: jest.fn().mockImplementation(() => ({
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

jest.mock('../clickable-media-upload', () => ({
  ClickableMediaUpload: () => <div data-testid="clickable-media-upload" />
}));

// Tiptap needs a real browser; stub it with a plain textarea
jest.mock('../../tiptap/tiptap-editor-with-ai', () => ({
  TiptapEditorWithAI: ({ placeholder }: any) => (
    <textarea data-testid="tiptap-editor" placeholder={placeholder} />
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

/** Captures the save controls the editor lifts to its parent. */
let latestControls: any = null;
const onSaveControlsChange = jest.fn((controls) => {
  latestControls = controls;
});

describe('EnhancedProjectEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestControls = null;
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (fetch as jest.Mock).mockReset();
    // The editor fetches existing tags on mount (smart tag suggestions) —
    // default every unmatched call to an empty-ok response.
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: [] })
    });
  });

  describe('Create Mode', () => {
    it('renders the create-mode form fields', () => {
      render(<EnhancedProjectEditor mode="create" onSaveControlsChange={onSaveControlsChange} />);

      expect(screen.getByPlaceholderText('Enter your project title...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('A short description that appears on project cards...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Describe your project in detail...')).toBeInTheDocument();
      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument();
    });

    it('tracks unsaved changes through the lifted save controls', async () => {
      render(<EnhancedProjectEditor mode="create" onSaveControlsChange={onSaveControlsChange} />);

      expect(latestControls.hasUnsavedChanges).toBe(false);

      fireEvent.change(screen.getByPlaceholderText('Enter your project title...'), {
        target: { value: 'New Project Title' }
      });

      await waitFor(() => {
        expect(latestControls.hasUnsavedChanges).toBe(true);
      });
    });

    it('saves a new project and navigates to its editor', async () => {
      (fetch as jest.Mock).mockImplementation(async (url: string, init?: RequestInit) => {
        if (String(url) === '/api/admin/projects' && init?.method === 'POST') {
          return { ok: true, json: async () => ({ project: { id: 'new-project-id' } }) };
        }
        return { ok: true, json: async () => ({ tags: [] }) };
      });

      render(<EnhancedProjectEditor mode="create" onSaveControlsChange={onSaveControlsChange} />);

      fireEvent.change(screen.getByPlaceholderText('Enter your project title...'), {
        target: { value: 'New Project' }
      });

      await act(async () => {
        await latestControls.onSave();
      });

      expect(fetch).toHaveBeenCalledWith('/api/admin/projects', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"title":"New Project"')
      }));

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
      visibility: 'PRIVATE',
      workDate: '2024-01-01',
      tags: [{ name: 'react' }, { name: 'typescript' }],
      articleContent: { content: 'Existing article content' }
    };

    function mockEditFetch(saveResponse?: () => Promise<unknown> | unknown) {
      (fetch as jest.Mock).mockImplementation(async (url: string, init?: RequestInit) => {
        if (String(url) === '/api/admin/projects/project-1' && init?.method === 'PUT') {
          return { ok: true, json: async () => (saveResponse ? await saveResponse() : mockProject) };
        }
        if (String(url) === '/api/admin/projects/project-1') {
          return { ok: true, json: async () => mockProject };
        }
        return { ok: true, json: async () => ({ tags: [] }) };
      });
    }

    it('loads existing project data', async () => {
      mockEditFetch();

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" onSaveControlsChange={onSaveControlsChange} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/admin/projects/project-1');
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing overview')).toBeInTheDocument();
      });
    });

    it('updates an existing project via PUT', async () => {
      mockEditFetch();

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" onSaveControlsChange={onSaveControlsChange} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue('Existing Project'), {
        target: { value: 'Updated Project' }
      });

      await act(async () => {
        await latestControls.onSave();
      });

      expect(fetch).toHaveBeenCalledWith('/api/admin/projects/project-1', expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"title":"Updated Project"')
      }));
    });

    it('handles load error gracefully', async () => {
      (fetch as jest.Mock).mockImplementation(async (url: string) => {
        if (String(url) === '/api/admin/projects/project-1') {
          throw new Error('Failed to load');
        }
        return { ok: true, json: async () => ({ tags: [] }) };
      });

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" onSaveControlsChange={onSaveControlsChange} />);

      await waitFor(() => {
        expect(screen.getByText('Back to Projects')).toBeInTheDocument();
      });
    });
  });

  describe('Form Management', () => {
    it('handles tag input correctly', () => {
      render(<EnhancedProjectEditor mode="create" onSaveControlsChange={onSaveControlsChange} />);

      const tagInput = screen.getByTestId('tag-input');
      fireEvent.change(tagInput, { target: { value: 'react, typescript, nextjs' } });

      expect(tagInput).toHaveValue('react, typescript, nextjs');
    });

    it('handles date input correctly', () => {
      render(<EnhancedProjectEditor mode="create" onSaveControlsChange={onSaveControlsChange} />);

      const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0]);
      fireEvent.change(dateInput, { target: { value: '2024-12-25' } });

      expect(dateInput).toHaveValue('2024-12-25');
    });
  });

  describe('Navigation', () => {
    it('navigates back to projects list via the lifted controls', () => {
      render(<EnhancedProjectEditor mode="create" onSaveControlsChange={onSaveControlsChange} />);

      act(() => {
        latestControls.onBack();
      });

      expect(mockPush).toHaveBeenCalledWith('/admin/projects');
    });
  });

  describe('Media Upload Integration', () => {
    it('shows media upload for existing projects', async () => {
      (fetch as jest.Mock).mockImplementation(async (url: string) => {
        if (String(url) === '/api/admin/projects/project-1') {
          return {
            ok: true,
            json: async () => ({
              id: 'project-1',
              title: 'Test Project',
              description: 'Test description',
              briefOverview: 'Test overview',
              visibility: 'PRIVATE',
              workDate: '2024-01-01',
              tags: [],
              articleContent: { content: 'Test content' }
            })
          };
        }
        return { ok: true, json: async () => ({ tags: [] }) };
      });

      render(<EnhancedProjectEditor mode="edit" projectId="project-1" onSaveControlsChange={onSaveControlsChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('clickable-media-upload')).toBeInTheDocument();
      });
    });

    it('does not show media upload for new projects', () => {
      render(<EnhancedProjectEditor mode="create" onSaveControlsChange={onSaveControlsChange} />);

      expect(screen.queryByTestId('clickable-media-upload')).not.toBeInTheDocument();
    });
  });
});
