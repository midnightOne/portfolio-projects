# AI Quick Actions Component

The `AIQuickActions` component provides a user-friendly interface for common AI-powered content editing tasks. It integrates with the existing AI service architecture to offer quick actions like making text professional, casual, expanding content, summarizing, and suggesting tags.

## Features

- **Quick Action Buttons**: Pre-defined actions for common editing tasks
- **Text Selection Support**: Actions that work on selected text portions
- **Model Selection**: Integration with UnifiedModelSelector for AI model choice
- **Preview System**: Shows AI results before applying changes
- **Error Handling**: Graceful error handling with user-friendly messages
- **Cost Tracking**: Displays token usage and cost information

## Usage

```tsx
import { AIQuickActions, TextSelection, ProjectContext } from '@/components/admin/ai-quick-actions';

function MyEditor() {
  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  
  const projectContext: ProjectContext = {
    title: "My Project",
    description: "Project description",
    existingTags: ["react", "typescript"],
    fullContent: "Full project content..."
  };

  const handleApplyChanges = (result: AIQuickActionResult) => {
    // Apply the AI-generated changes to your content
    if (result.changes.fullContent) {
      // Update full content
    }
    if (result.changes.partialUpdate) {
      // Apply partial text replacement
    }
    if (result.changes.suggestedTags) {
      // Update project tags
    }
  };

  return (
    <AIQuickActions
      selectedText={selectedText}
      projectContext={projectContext}
      onApplyChanges={handleApplyChanges}
    />
  );
}
```

## Props

### `selectedText?: TextSelection`
Optional text selection object containing:
- `text: string` - The selected text
- `start: number` - Start position in the content
- `end: number` - End position in the content

### `projectContext: ProjectContext`
Project context information:
- `title: string` - Project title
- `description: string` - Project description
- `existingTags: string[]` - Current project tags
- `fullContent: string` - Complete project content

### `onApplyChanges: (result: AIQuickActionResult) => void`
Callback function called when user applies AI-generated changes.

### `className?: string`
Optional CSS classes for styling.

## Quick Actions

### Text-Based Actions (Require Selection)
- **Make Professional**: Rewrites text in professional tone
- **Make Casual**: Rewrites text in friendly, approachable tone
- **Expand**: Adds detail and context to selected text
- **Summarize**: Condenses text while preserving key information
- **Improve**: Enhances clarity, grammar, and flow

### Content-Based Actions (No Selection Required)
- **Suggest Tags**: Analyzes project content to suggest relevant tags

## AI Integration

The component integrates with the following API endpoints:
- `/api/admin/ai/edit-content` - For text editing operations
- `/api/admin/ai/suggest-tags` - For tag suggestions

## Error Handling

- Validates text selection for selection-required actions
- Validates model selection before making requests
- Displays user-friendly error messages
- Gracefully handles API failures

## Preview System

Before applying changes, the component shows:
- AI reasoning and confidence level
- Token usage and cost information
- Preview of content changes
- Tag suggestions with add/remove recommendations
- Warnings and validation messages

## Styling

The component uses Tailwind CSS classes and shadcn/ui components for consistent styling. Each action button has a color-coded theme:
- Blue: Professional actions
- Green: Casual/friendly actions
- Purple: Expansion actions
- Orange: Summarization actions
- Red: Improvement actions
- Gray: Analysis actions

## Dependencies

- `@/components/ui/*` - shadcn/ui components
- `@/components/admin/unified-model-selector` - AI model selection
- `lucide-react` - Icons
- React hooks for state management