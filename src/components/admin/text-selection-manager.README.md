# Text Selection Manager

The `TextSelectionManager` component provides a unified interface for handling text selection and content changes across different editor types. It supports current textarea implementations and provides extension points for future rich text editors like Tiptap and Novel.

## Features

- **Editor Abstraction**: Unified interface for different editor types
- **Selection Detection**: Automatic text selection monitoring
- **Precise Text Replacement**: Character-position-based text changes
- **Future-Ready**: Extension points for Tiptap and Novel editors
- **Change Tracking**: Content change notifications
- **Focus Management**: Editor focus control

## Architecture

The system uses an adapter pattern to support different editor types:

```
TextSelectionManager
├── EditorAdapter (interface)
├── TextareaAdapter (current implementation)
├── TiptapAdapter (future implementation)
└── NovelAdapter (future implementation)
```

## Usage

### Basic Usage with Textarea

```tsx
import { TextSelectionManager, TextareaAdapter, TextSelection, TextChange } from './text-selection-manager';

function MyEditor() {
  const [content, setContent] = useState('');
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adapter = useMemo(() => {
    if (textareaRef.current) {
      return new TextareaAdapter(textareaRef.current, setContent);
    }
    return null;
  }, [textareaRef.current]);

  const handleApplyChange = (change: TextChange) => {
    if (adapter) {
      adapter.applyChange(change);
    }
  };

  if (!adapter) return null;

  return (
    <TextSelectionManager
      adapter={adapter}
      onSelectionChange={setSelection}
      onContentChange={setContent}
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <AIQuickActions
        selectedText={selection}
        onApplyChange={handleApplyChange}
      />
    </TextSelectionManager>
  );
}
```

### Using the Adapter Factory

```tsx
import { createEditorAdapter } from './text-selection-manager';

function MyEditor() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const adapter = useMemo(() => {
    if (textareaRef.current) {
      return createEditorAdapter('textarea', textareaRef.current, setContent);
    }
    return null;
  }, [textareaRef.current]);

  // ... rest of component
}
```

## Editor Adapters

### TextareaAdapter (Current)

Handles plain text editing in HTML textarea elements:

```tsx
const adapter = new TextareaAdapter(textareaElement, onContentChange);

// Get current selection
const selection = adapter.getSelection();

// Apply text change
adapter.applyChange({
  start: 10,
  end: 20,
  newText: 'replacement text',
  reasoning: 'AI improvement'
});

// Set full content
adapter.setFullContent('New content');
```

### TiptapAdapter (Future)

Will handle rich text editing with Tiptap editor:

```tsx
// Future implementation
const adapter = new TiptapAdapter(tiptapEditor, onContentChange);
```

### NovelAdapter (Future)

Will handle JSON-based content with Novel editor:

```tsx
// Future implementation
const adapter = new NovelAdapter(novelEditor, onContentChange);
```

## Interfaces

### TextSelection

```tsx
interface TextSelection {
  text: string;    // Selected text content
  start: number;   // Start position in content
  end: number;     // End position in content
}
```

### TextChange

```tsx
interface TextChange {
  start: number;      // Start position for replacement
  end: number;        // End position for replacement
  newText: string;    // New text to insert
  reasoning?: string; // Optional explanation of change
}
```

### EditorAdapter

```tsx
interface EditorAdapter {
  getSelection(): TextSelection | null;
  applyChange(change: TextChange): void;
  getFullContent(): string;
  setFullContent(content: string): void;
  focus(): void;
}
```

## Utility Functions

### applyTextChangeWithPosition

Applies text changes with validation:

```tsx
const newContent = applyTextChangeWithPosition(originalText, {
  start: 10,
  end: 20,
  newText: 'replacement'
});
```

### findTextPosition

Finds text position in content:

```tsx
const position = findTextPosition(content, 'search text');
// Returns: { start: number, end: number } | null
```

### detectTextSelection

Detects text selection in any HTML element:

```tsx
const selection = detectTextSelection(element);
```

## Selection Monitoring

The manager automatically monitors text selection changes:

- Polls selection every 100ms
- Compares with previous selection to avoid unnecessary updates
- Notifies parent components of selection changes
- Handles selection clearing after content changes

## Change Application

Text changes are applied with precise positioning:

1. Validates change positions
2. Applies text replacement
3. Updates cursor position
4. Triggers change events
5. Notifies content change callbacks
6. Clears selection state

## Future Extensions

### Tiptap Integration

The TiptapAdapter will support:
- Rich text selection detection
- HTML content manipulation
- Block-based content changes
- Formatting preservation

### Novel Integration

The NovelAdapter will support:
- JSON content structure
- Block-based editing
- Structured content changes
- Rich media handling

## Error Handling

- Validates text change positions
- Handles missing editor elements
- Provides fallback for unsupported operations
- Logs warnings for unimplemented features

## Performance Considerations

- Selection monitoring uses efficient polling
- Change detection compares only necessary properties
- Adapters cache editor references
- Content changes trigger minimal re-renders

## Testing

The component includes comprehensive tests for:
- Selection detection and monitoring
- Text change application
- Adapter functionality
- Error handling
- Edge cases and validation