# Semantic Chunk Editor Integration Guide

## Overview

The Semantic Chunk Editor component provides a comprehensive interface for editing semantic content chunks with AI assistance, importance scoring, and manual preservation controls.

## Component Location

```
src/components/admin/semantic-chunk-editor.tsx
```

## API Endpoints

### 1. Get Chunk Details
```
GET /api/admin/semantic/chunks/[id]
```

Returns chunk data with relationships (parent, children, siblings).

### 2. Update Chunk
```
PUT /api/admin/semantic/chunks/[id]
```

Updates chunk content, title, importance, and manual edit flag.

### 3. AI-Assisted Editing
```
POST /api/admin/semantic/chunks/[id]/ai-edit
```

Processes custom AI prompts for chunk content editing.

## Integration with Tree View

### Example: Adding Edit Button to Tree View

```tsx
import { useState } from 'react';
import { SemanticChunkEditor } from '@/components/admin/semantic-chunk-editor';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';

function SemanticTreeView({ projectId }: { projectId: string }) {
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);

  const handleEditChunk = (chunkId: string) => {
    setEditingChunkId(chunkId);
  };

  const handleCloseEditor = () => {
    setEditingChunkId(null);
  };

  const handleSaveChunk = (updatedChunk: any) => {
    // Refresh tree view or update local state
    console.log('Chunk saved:', updatedChunk);
    setEditingChunkId(null);
  };

  return (
    <div>
      {editingChunkId ? (
        <SemanticChunkEditor
          chunkId={editingChunkId}
          projectId={projectId}
          onClose={handleCloseEditor}
          onSave={handleSaveChunk}
        />
      ) : (
        <div>
          {/* Tree view with edit buttons */}
          <Button onClick={() => handleEditChunk('chunk-id')}>
            <Edit className="h-4 w-4 mr-1" />
            Edit Chunk
          </Button>
        </div>
      )}
    </div>
  );
}
```

## Features

### 1. Inline Text Editing
- Title field (for T1, T2, T3 chunks)
- Content textarea with character/token count
- Real-time validation

### 2. AI-Assisted Editing
- Integrated AI prompt interface
- Text selection support
- Full content or partial editing
- Undo/redo functionality

### 3. Importance Score Adjustment
- Slider control (0-1 range)
- Visual feedback
- Automatic source tracking (AI vs manual)

### 4. Metadata Display
- Modified by (system/ai/user)
- Last modified timestamp
- Generation mode
- Embedding status
- Section group

### 5. Chunk Relationships
- Parent chunk display
- Children count and preview
- Siblings count and preview

### 6. Preservation Toggle
- "Preserve during regeneration" switch
- Prevents automatic regeneration
- Visual indicator when enabled

### 7. Save/Cancel Controls
- Unsaved changes detection
- Confirmation on cancel with changes
- Optimistic updates
- Error handling

## Usage Examples

### Basic Usage

```tsx
<SemanticChunkEditor
  chunkId="cmg9y6wg10008w5r4q67jjbw0"
  projectId="project-123"
  onClose={() => console.log('Editor closed')}
  onSave={(chunk) => console.log('Chunk saved:', chunk)}
/>
```

### With Modal

```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';

function ChunkEditorModal({ chunkId, projectId, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <SemanticChunkEditor
          chunkId={chunkId}
          projectId={projectId}
          onClose={() => onOpenChange(false)}
          onSave={(chunk) => {
            console.log('Saved:', chunk);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
```

### With Tree View Integration

```tsx
function TreeNodeWithEdit({ node, projectId }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span>{node.title}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
        >
          <Edit className="h-3 w-3" />
        </Button>
      </div>

      {isEditing && (
        <div className="mt-4 border-t pt-4">
          <SemanticChunkEditor
            chunkId={node.chunkId}
            projectId={projectId}
            onClose={() => setIsEditing(false)}
            onSave={(chunk) => {
              // Update node in tree
              setIsEditing(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
```

## API Request/Response Examples

### Get Chunk Details

**Request:**
```
GET /api/admin/semantic/chunks/cmg9y6wg10008w5r4q67jjbw0
```

**Response:**
```json
{
  "id": "cmg9y6wg10008w5r4q67jjbw0",
  "entityId": "entity-123",
  "projectIndexId": "project-123",
  "tier": 2,
  "chunkId": "chunk-001",
  "title": "Project Overview",
  "content": "This is the project overview content...",
  "tokenCount": 150,
  "importance": 0.75,
  "importanceSource": "ai",
  "generationMode": "ai",
  "lastModified": "2025-01-04T10:30:00Z",
  "modifiedBy": "system",
  "manuallyEdited": false,
  "embeddingModel": "text-embedding-3-small",
  "embeddingGeneratedAt": "2025-01-04T10:30:00Z",
  "parent": {
    "id": "parent-id",
    "tier": 1,
    "title": "Project Summary",
    "chunkId": "chunk-000"
  },
  "children": [],
  "siblings": [
    {
      "id": "sibling-1",
      "tier": 2,
      "title": "Technical Details",
      "chunkId": "chunk-002"
    }
  ]
}
```

### Update Chunk

**Request:**
```
PUT /api/admin/semantic/chunks/cmg9y6wg10008w5r4q67jjbw0
Content-Type: application/json

{
  "title": "Updated Project Overview",
  "content": "This is the updated content...",
  "importance": 0.85,
  "manuallyEdited": true
}
```

**Response:**
```json
{
  "id": "cmg9y6wg10008w5r4q67jjbw0",
  "title": "Updated Project Overview",
  "content": "This is the updated content...",
  "importance": 0.85,
  "importanceSource": "manual",
  "manuallyEdited": true,
  "lastModified": "2025-01-04T11:00:00Z",
  "modifiedBy": "user",
  ...
}
```

### AI-Assisted Editing

**Request:**
```
POST /api/admin/semantic/chunks/cmg9y6wg10008w5r4q67jjbw0/ai-edit
Content-Type: application/json

{
  "model": "gpt-4o-mini",
  "prompt": "Make this more technical and add specific details",
  "content": "This is the current content...",
  "context": {
    "projectTitle": "My Project"
  }
}
```

**Response:**
```json
{
  "success": true,
  "changes": {
    "fullContent": "This is the improved technical content with specific implementation details..."
  },
  "reasoning": "Enhanced the content with technical terminology and specific implementation details",
  "confidence": 0.9,
  "warnings": [],
  "model": "gpt-4o-mini",
  "tokensUsed": 250,
  "cost": 0.00015
}
```

## Styling and Layout

The component uses a responsive 3-column layout:
- **Left 2/3**: Content editor and AI assistant
- **Right 1/3**: Sidebar with importance, preservation, metadata, and relationships

On mobile, the layout stacks vertically.

## Best Practices

1. **Always check for unsaved changes** before closing the editor
2. **Use the manual edit flag** to preserve important manual edits
3. **Adjust importance scores** to influence search ranking
4. **Use AI assistance** for content improvement and refinement
5. **Monitor token usage** when using AI features
6. **Refresh tree view** after saving to show updated content

## Testing

Run the test script to verify implementation:

```bash
npx tsx scripts/test-chunk-editor.ts
```

This tests:
- Chunk data structure
- Update operations
- Manual edit flag
- Relationships
- API endpoints

## Dependencies

- `@/components/ui/*` - UI components (Button, Card, Input, etc.)
- `@/components/admin/ai-prompt-interface` - AI assistance
- `@/components/admin/text-selection-manager` - Text selection
- `date-fns` - Date formatting
- `lucide-react` - Icons

## Future Enhancements

- [ ] Bulk edit multiple chunks
- [ ] Chunk comparison view
- [ ] Version history
- [ ] Collaborative editing
- [ ] Real-time preview
- [ ] Keyboard shortcuts
- [ ] Drag-and-drop reordering
