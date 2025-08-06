# Enhanced Project Editor

The `EnhancedProjectEditor` component integrates AI Quick Actions and Text Selection Manager with the existing project editing interface. It provides a unified editing experience with AI-powered content assistance across all text fields.

## Features

- **Integrated AI Assistant**: AI Quick Actions panel with unified model selection
- **Text Selection Management**: Precise text selection and replacement across all fields
- **Multi-Field Support**: Works with title, brief overview, description, and article content
- **Change Preview**: Shows AI-generated changes before applying them
- **Undo/Redo Support**: Built-in change tracking and reversal
- **Real-time Sync**: Automatic content synchronization between fields and AI context

## Architecture

The component combines several key technologies:

```
EnhancedProjectEditor
├── TextSelectionManager (per field)
│   ├── TextareaAdapter (title, description, etc.)
│   └── Selection monitoring and change application
├── AIQuickActions
│   ├── Quick action buttons
│   ├── Model selection
│   └── Change preview system
└── Project Form Management
    ├── Form state management
    ├── Save/load functionality
    └── Change tracking
```

## Usage

### Basic Usage

```tsx
import { EnhancedProjectEditor } from '@/components/admin/enhanced-project-editor';

// For creating new projects
function CreateProject() {
  return <EnhancedProjectEditor mode="create" />;
}

// For editing existing projects
function EditProject({ projectId }: { projectId: string }) {
  return <EnhancedProjectEditor mode="edit" projectId={projectId} />;
}
```

### Integration with Routing

```tsx
// In your page component
export default function ProjectEditorPage({ params }: { params: { id?: string } }) {
  const mode = params.id ? 'edit' : 'create';
  
  return (
    <EnhancedProjectEditor 
      mode={mode} 
      projectId={params.id} 
    />
  );
}
```

## Text Field Integration

Each text field is wrapped with a `TextSelectionManager` that provides:

### Selection Detection
- Automatic text selection monitoring
- Field-specific selection context
- Real-time selection updates

### Change Application
- Precise character-position-based replacements
- Full content replacement support
- Cursor position management
- Change event propagation

### AI Context
- Field-aware AI prompting
- Cross-field content awareness
- Contextual suggestions

## AI Integration

### Quick Actions
The component provides these AI-powered actions:

- **Make Professional**: Rewrite text in professional tone
- **Make Casual**: Rewrite text in friendly tone
- **Expand**: Add detail and context to selected text
- **Summarize**: Condense text while preserving key information
- **Improve**: Enhance clarity, grammar, and flow
- **Suggest Tags**: Analyze content for relevant tags

### Model Selection
- Unified model dropdown across all actions
- Support for OpenAI and Anthropic models
- Model availability based on API key configuration

### Change Preview
Before applying changes, users see:
- AI reasoning and confidence level
- Token usage and cost information
- Preview of content changes
- Tag suggestions with explanations
- Warnings and validation messages

## Form Management

### State Management
```tsx
interface ProjectFormData {
  title: string;
  description: string;
  briefOverview: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  visibility: 'PUBLIC' | 'PRIVATE';
  workDate: string;
  articleContent: string;
}
```

### Change Tracking
- Automatic detection of unsaved changes
- Visual indicators for modified content
- Save state management
- Last save time tracking

### Validation
- Required field validation
- Character limit enforcement
- Format validation for dates
- Tag uniqueness validation

## Layout and UI

### Responsive Design
- 65% editor area, 35% AI assistant
- Collapsible sidebar for metadata
- Scrollable content areas
- Mobile-responsive breakpoints

### Visual Feedback
- Loading states for all async operations
- Error messages with actionable guidance
- Success confirmations
- Progress indicators

### Accessibility
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- ARIA labels and descriptions

## API Integration

### Endpoints Used
- `GET /api/admin/projects/{id}` - Load project data
- `POST /api/admin/projects` - Create new project
- `PUT /api/admin/projects/{id}` - Update existing project
- `GET /api/tags` - Load existing tags for autocomplete
- `POST /api/admin/ai/edit-content` - AI content editing
- `POST /api/admin/ai/suggest-tags` - AI tag suggestions

### Error Handling
- Network error recovery
- API error message display
- Validation error highlighting
- Graceful degradation

## Performance Optimizations

### Efficient Rendering
- Memoized adapter creation
- Selective re-rendering
- Debounced change detection
- Lazy loading of non-critical features

### Memory Management
- Proper cleanup of event listeners
- Adapter instance reuse
- Efficient state updates
- Garbage collection friendly

## Extension Points

### Custom AI Actions
Add new quick actions by extending the AI Quick Actions component:

```tsx
const customActions: AIQuickAction[] = [
  {
    id: 'custom-action',
    label: 'Custom Action',
    description: 'Custom AI operation',
    operation: 'custom',
    icon: CustomIcon,
    requiresSelection: true,
    color: 'blue'
  }
];
```

### Additional Text Fields
Add new text fields with AI support:

```tsx
const newFieldAdapter = useMemo(() => {
  if (newFieldRef.current) {
    return new TextareaAdapter(newFieldRef.current, (content) => {
      setFormData(prev => ({ ...prev, newField: content }));
    });
  }
  return null;
}, [newFieldRef.current]);
```

### Rich Text Editor Support
Future integration with Tiptap or Novel:

```tsx
// Will be supported through adapter pattern
const tiptapAdapter = new TiptapAdapter(tiptapEditor, onContentChange);
const novelAdapter = new NovelAdapter(novelEditor, onContentChange);
```

## Testing

The component includes comprehensive tests for:
- Text selection across different fields
- AI action integration
- Form state management
- Save/load functionality
- Error handling scenarios
- Accessibility compliance

## Migration Guide

### From Existing Project Editor
1. Replace `ProjectEditor` imports with `EnhancedProjectEditor`
2. Update routing to use new mode-based API
3. Remove old AI assistant panel references
4. Update any custom integrations

### Breaking Changes
- Props interface has changed to use `mode` instead of separate create/edit components
- AI assistant is now integrated rather than a separate sidebar
- Text selection API has been unified across all fields

## Dependencies

- `@/components/ui/*` - shadcn/ui components
- `@/components/admin/ai-quick-actions` - AI functionality
- `@/components/admin/text-selection-manager` - Text selection
- `@/components/admin/smart-tag-input` - Tag management
- `@/components/admin/floating-save-bar` - Save functionality
- `lucide-react` - Icons
- React hooks for state management