import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  TextSelectionManager, 
  TextareaAdapter, 
  TiptapAdapter,

  createEditorAdapter,
  applyTextChangeWithPosition,
  findTextPosition,
  detectTextSelection,
  TextSelection,
  TextChange
} from '../text-selection-manager';

// Mock React.Children for testing
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  Children: {
    map: (children: any, fn: any) => {
      if (Array.isArray(children)) {
        return children.map(fn);
      }
      return fn(children, 0);
    }
  },
  isValidElement: () => true,
  cloneElement: (element: any, props: any) => ({ ...element, props: { ...element.props, ...props } })
}));

describe('TextareaAdapter', () => {
  let textarea: HTMLTextAreaElement;
  let adapter: TextareaAdapter;
  let onContentChange: jest.Mock;

  beforeEach(() => {
    textarea = document.createElement('textarea');
    textarea.value = 'Hello world, this is a test';
    document.body.appendChild(textarea);
    
    onContentChange = jest.fn();
    adapter = new TextareaAdapter(textarea, onContentChange);
  });

  afterEach(() => {
    document.body.removeChild(textarea);
  });

  it('gets selection correctly', () => {
    // Set selection
    textarea.setSelectionRange(6, 11); // "world"
    
    const selection = adapter.getSelection();
    
    expect(selection).toEqual({
      text: 'world',
      start: 6,
      end: 11
    });
  });

  it('returns null when no text is selected', () => {
    // Set cursor position (no selection)
    textarea.setSelectionRange(5, 5);
    
    const selection = adapter.getSelection();
    
    expect(selection).toBeNull();
  });

  it('applies text changes correctly', () => {
    const change: TextChange = {
      start: 6,
      end: 11,
      newText: 'universe',
      reasoning: 'Test replacement'
    };
    
    adapter.applyChange(change);
    
    expect(textarea.value).toBe('Hello universe, this is a test');
    expect(onContentChange).toHaveBeenCalledWith('Hello universe, this is a test');
    
    // Check cursor position
    expect(textarea.selectionStart).toBe(14); // 6 + 8 (length of "universe")
    expect(textarea.selectionEnd).toBe(14);
  });

  it('gets full content', () => {
    expect(adapter.getFullContent()).toBe('Hello world, this is a test');
  });

  it('sets full content', () => {
    adapter.setFullContent('New content');
    
    expect(textarea.value).toBe('New content');
    expect(onContentChange).toHaveBeenCalledWith('New content');
  });

  it('focuses the textarea', () => {
    const focusSpy = jest.spyOn(textarea, 'focus');
    
    adapter.focus();
    
    expect(focusSpy).toHaveBeenCalled();
  });
});

describe('TiptapAdapter', () => {
  let mockEditor: any;
  let adapter: TiptapAdapter;

  beforeEach(() => {
    mockEditor = {
      commands: {
        focus: jest.fn()
      }
    };
    adapter = new TiptapAdapter(mockEditor);
  });

  it('logs warning for unimplemented methods', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    expect(adapter.getSelection()).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('TiptapAdapter.getSelection() not yet implemented');

    adapter.applyChange({ start: 0, end: 5, newText: 'test' });
    expect(consoleSpy).toHaveBeenCalledWith('TiptapAdapter.applyChange() not yet implemented');

    expect(adapter.getFullContent()).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith('TiptapAdapter.getFullContent() not yet implemented');

    adapter.setFullContent('test');
    expect(consoleSpy).toHaveBeenCalledWith('TiptapAdapter.setFullContent() not yet implemented');

    consoleSpy.mockRestore();
  });

  it('focuses the editor', () => {
    adapter.focus();
    expect(mockEditor.commands.focus).toHaveBeenCalled();
  });
});

// NovelAdapter tests removed as Novel has been replaced with Tiptap

describe('createEditorAdapter', () => {
  it('creates textarea adapter', () => {
    const textarea = document.createElement('textarea');
    const adapter = createEditorAdapter('textarea', textarea);
    
    expect(adapter).toBeInstanceOf(TextareaAdapter);
  });

  it('creates tiptap adapter', () => {
    const mockEditor = {};
    const adapter = createEditorAdapter('tiptap', mockEditor);
    
    expect(adapter).toBeInstanceOf(TiptapAdapter);
  });

  // Novel adapter test removed as Novel has been replaced with Tiptap

  it('throws error for unsupported editor type', () => {
    expect(() => {
      createEditorAdapter('unsupported' as any, {});
    }).toThrow('Unsupported editor type: unsupported');
  });
});

describe('TextSelectionManager', () => {
  let textarea: HTMLTextAreaElement;
  let adapter: TextareaAdapter;
  let onSelectionChange: jest.Mock;
  let onContentChange: jest.Mock;

  beforeEach(() => {
    textarea = document.createElement('textarea');
    textarea.value = 'Hello world';
    document.body.appendChild(textarea);
    
    onSelectionChange = jest.fn();
    onContentChange = jest.fn();
    adapter = new TextareaAdapter(textarea);
  });

  afterEach(() => {
    document.body.removeChild(textarea);
    jest.clearAllTimers();
  });

  it('renders children with manager methods', () => {
    const TestChild = ({ textSelectionManager }: any) => (
      <div data-testid="test-child">
        {textSelectionManager ? 'Manager connected' : 'No manager'}
      </div>
    );

    render(
      <TextSelectionManager
        adapter={adapter}
        onSelectionChange={onSelectionChange}
        onContentChange={onContentChange}
      >
        <TestChild />
      </TextSelectionManager>
    );

    expect(screen.getByTestId('test-child')).toHaveTextContent('Manager connected');
  });

  it('monitors selection changes', async () => {
    jest.useFakeTimers();
    
    render(
      <TextSelectionManager
        adapter={adapter}
        onSelectionChange={onSelectionChange}
        onContentChange={onContentChange}
      >
        <div>Test content</div>
      </TextSelectionManager>
    );

    // Simulate selection change
    textarea.setSelectionRange(0, 5);
    
    // Fast-forward timers to trigger selection check
    jest.advanceTimersByTime(100);
    
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith({
        text: 'Hello',
        start: 0,
        end: 5
      });
    });

    jest.useRealTimers();
  });
});

describe('Utility Functions', () => {
  describe('applyTextChangeWithPosition', () => {
    it('applies text change correctly', () => {
      const originalText = 'Hello world';
      const change: TextChange = {
        start: 6,
        end: 11,
        newText: 'universe'
      };
      
      const result = applyTextChangeWithPosition(originalText, change);
      
      expect(result).toBe('Hello universe');
    });

    it('throws error for invalid positions', () => {
      const originalText = 'Hello world';
      
      expect(() => {
        applyTextChangeWithPosition(originalText, {
          start: -1,
          end: 5,
          newText: 'test'
        });
      }).toThrow('Invalid text change positions');

      expect(() => {
        applyTextChangeWithPosition(originalText, {
          start: 5,
          end: 20,
          newText: 'test'
        });
      }).toThrow('Invalid text change positions');

      expect(() => {
        applyTextChangeWithPosition(originalText, {
          start: 10,
          end: 5,
          newText: 'test'
        });
      }).toThrow('Invalid text change positions');
    });
  });

  describe('findTextPosition', () => {
    it('finds text position correctly', () => {
      const content = 'Hello world, hello universe';
      
      const position = findTextPosition(content, 'world');
      
      expect(position).toEqual({
        start: 6,
        end: 11
      });
    });

    it('finds text position with start offset', () => {
      const content = 'Hello world, hello universe';
      
      const position = findTextPosition(content, 'hello', 10);
      
      expect(position).toEqual({
        start: 13,
        end: 18
      });
    });

    it('returns null when text not found', () => {
      const content = 'Hello world';
      
      const position = findTextPosition(content, 'universe');
      
      expect(position).toBeNull();
    });
  });

  describe('detectTextSelection', () => {
    let element: HTMLDivElement;

    beforeEach(() => {
      element = document.createElement('div');
      element.textContent = 'Hello world';
      document.body.appendChild(element);
    });

    afterEach(() => {
      document.body.removeChild(element);
    });

    it('returns null when no selection', () => {
      // Mock window.getSelection to return null
      Object.defineProperty(window, 'getSelection', {
        value: () => null,
        writable: true
      });

      const selection = detectTextSelection(element);
      
      expect(selection).toBeNull();
    });

    it('returns null when no ranges', () => {
      // Mock window.getSelection to return selection with no ranges
      Object.defineProperty(window, 'getSelection', {
        value: () => ({
          rangeCount: 0
        }),
        writable: true
      });

      const selection = detectTextSelection(element);
      
      expect(selection).toBeNull();
    });

    it('returns selection when text is selected', () => {
      // Mock window.getSelection
      const mockRange = {
        commonAncestorContainer: element
      };
      
      Object.defineProperty(window, 'getSelection', {
        value: () => ({
          rangeCount: 1,
          getRangeAt: () => mockRange,
          toString: () => 'Hello'
        }),
        writable: true
      });

      const selection = detectTextSelection(element);
      
      expect(selection).toEqual({
        text: 'Hello',
        start: 0,
        end: 5
      });
    });

    it('returns null when selection is outside element', () => {
      const otherElement = document.createElement('div');
      
      const mockRange = {
        commonAncestorContainer: otherElement
      };
      
      Object.defineProperty(window, 'getSelection', {
        value: () => ({
          rangeCount: 1,
          getRangeAt: () => mockRange,
          toString: () => 'Hello'
        }),
        writable: true
      });

      const selection = detectTextSelection(element);
      
      expect(selection).toBeNull();
    });
  });
});