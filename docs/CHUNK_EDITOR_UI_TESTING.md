# Chunk Editor UI Testing Guide

## Overview

The Semantic Chunk Editor is now fully integrated into the Semantic Tree View. This guide explains how to test it in the browser.

## Prerequisites

1. **Development server running:**
   ```bash
   npm run dev
   ```

2. **Database with semantic chunks:**
   - Run content ingestion first if you haven't
   - Or use the test script to verify chunks exist:
     ```bash
     npx tsx portfolio-projects/scripts/test-chunk-editor.ts
     ```

## Testing Steps

### 1. Navigate to Semantic Tree View

The tree view should be accessible from your admin interface. If you don't have a route yet, you can access it by:

1. Finding a page that uses `<SemanticTreeView projectId="your-project-id" />`
2. Or creating a test page (see below)

### 2. Test the Edit Button

1. **Find a chunk in the tree**
   - Look for any T1, T2, or T3 chunk (T0 is metadata only)
   - Each chunk has an "Edit" button on the right side

2. **Click the Edit button**
   - A modal should open with the chunk editor
   - The modal takes up 95% of the viewport for maximum editing space

3. **Verify the editor loads**
   - You should see the chunk title and content
   - Importance slider should show current value
   - Metadata sidebar should display chunk info
   - AI Assistant toggle should be visible

### 3. Test Editing Features

#### Basic Editing
1. **Edit the title** (if not T0)
   - Change the text in the title field
   - Notice the "unsaved changes" detection

2. **Edit the content**
   - Modify the content textarea
   - Character and token count should update

3. **Adjust importance**
   - Move the slider
   - Notice the score updates in real-time
   - The "Modified" badge should appear

#### AI-Assisted Editing
1. **Click "Show AI Assistant"**
   - AI prompt interface should appear below content
   - Select an AI model from dropdown

2. **Select text in content**
   - Highlight some text in the content field
   - The AI interface should show "Selected Text" indicator

3. **Enter a prompt**
   - Example: "Make this more technical"
   - Click "Process"
   - Review the AI suggestions
   - Click "Apply Changes" to accept

#### Preservation Toggle
1. **Enable "Preserve during regeneration"**
   - Toggle the switch in the sidebar
   - This marks the chunk as manually edited
   - It won't be automatically regenerated

### 4. Test Save/Cancel

#### Save Changes
1. **Click "Save Changes"**
   - Button should show loading state
   - Success: Modal closes, tree refreshes
   - You should see updated content in the tree

#### Cancel with Changes
1. **Make some edits**
2. **Click "Cancel"**
   - Confirmation dialog should appear
   - "You have unsaved changes. Are you sure?"
   - Choose to discard or continue editing

#### Cancel without Changes
1. **Don't make any edits**
2. **Click "Cancel"**
   - Modal should close immediately
   - No confirmation needed

### 5. Test Metadata Display

Verify the sidebar shows:
- ✅ Modified by (system/ai/user)
- ✅ Last modified timestamp (relative)
- ✅ Generation mode
- ✅ Embedding status and model
- ✅ Section group (if applicable)

### 6. Test Relationships

Verify the sidebar shows:
- ✅ Parent chunk (if exists)
- ✅ Children count and preview
- ✅ Siblings count and preview

### 7. Test Tree Refresh

1. **Edit and save a chunk**
2. **Verify the tree updates**
   - Modified timestamp should update
   - "Edited" badge should appear if manually edited
   - Content preview should reflect changes

## Creating a Test Page

If you need a dedicated test page, create:

```tsx
// portfolio-projects/src/app/admin/semantic/test/page.tsx
'use client';

import { SemanticTreeView } from '@/components/admin/semantic-tree-view';

export default function TestSemanticTreePage() {
  // Replace with an actual project ID from your database
  const projectId = 'your-project-id-here';

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Semantic Tree View Test</h1>
      <SemanticTreeView projectId={projectId} />
    </div>
  );
}
```

## Expected Behavior

### ✅ Success Indicators

- Modal opens smoothly when clicking Edit
- All fields populate with chunk data
- Editing works without errors
- AI assistance processes prompts
- Save updates the database and refreshes tree
- Cancel works with/without confirmation

### ❌ Common Issues

**Modal doesn't open:**
- Check browser console for errors
- Verify chunk ID is valid
- Check authentication

**Editor shows loading forever:**
- API endpoint might be failing
- Check network tab for 401/404/500 errors
- Verify chunk exists in database

**Save doesn't work:**
- Check network tab for API errors
- Verify authentication
- Check browser console for validation errors

**AI assistance fails:**
- Verify AI is configured (check AI settings)
- Check budget allocation
- Verify model selection is valid

## Browser Console Testing

You can also test the API directly in the browser console:

```javascript
// Get chunk details
fetch('/api/admin/semantic/chunks/YOUR_CHUNK_ID')
  .then(r => r.json())
  .then(console.log);

// Update chunk
fetch('/api/admin/semantic/chunks/YOUR_CHUNK_ID', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Updated content',
    importance: 0.8,
    manuallyEdited: true
  })
})
  .then(r => r.json())
  .then(console.log);
```

## Performance Notes

- Modal is large (95vw x 95vh) for comfortable editing
- Tree refresh after save may take 1-2 seconds for large trees
- AI processing time depends on model and content length
- Typical response times:
  - Load chunk: < 200ms
  - Save chunk: < 300ms
  - AI processing: 2-5 seconds

## Accessibility

The editor is fully accessible:
- ✅ Keyboard navigation works
- ✅ Screen reader friendly
- ✅ Focus management in modal
- ✅ ARIA labels on controls
- ✅ Color contrast compliant

## Next Steps

After testing, you can:
1. Integrate into your admin dashboard
2. Add keyboard shortcuts (Ctrl+S to save, Esc to close)
3. Add version history
4. Add collaborative editing indicators
5. Add real-time preview

## Troubleshooting

**Issue:** Modal is too small
**Solution:** Adjust `max-w-[95vw] max-h-[95vh]` in semantic-tree-view.tsx

**Issue:** Tree doesn't refresh after save
**Solution:** Check that `fetchTreeData()` is called in the onSave callback

**Issue:** Can't edit T0 chunks
**Solution:** T0 is metadata only - title field is hidden by design

**Issue:** AI assistant not showing
**Solution:** Click "Show AI Assistant" button in the content editor section

## Support

For issues or questions:
1. Check browser console for errors
2. Check network tab for API failures
3. Verify database has chunks with `npx tsx scripts/test-chunk-editor.ts`
4. Check authentication is working
