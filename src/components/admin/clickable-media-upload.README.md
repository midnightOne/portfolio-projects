# ClickableMediaUpload Component

## Overview

The `ClickableMediaUpload` component is a modular, reusable media upload component that provides a seamless interface for selecting and uploading media files. It integrates with the existing media library system and supports both modal-based selection and direct drag-and-drop uploads.

## Task Requirements Fulfilled

### ✅ 1. Clickable thumbnail area that opens existing media modal
- Component renders a clickable area that opens the `MediaSelectionModal`
- Modal integration allows browsing and selecting from existing project media
- Proper project ID handling for accessing project-specific media library

### ✅ 2. Drag-and-drop bypass for direct file upload to thumbnail
- Implements drag-and-drop event handlers (`onDragOver`, `onDragLeave`, `onDrop`)
- Visual feedback during drag operations (border color changes, scaling effect)
- Direct file upload bypasses modal for quick uploads
- Fallback to default upload API when no custom handler is provided

### ✅ 3. Integrate with existing project media library and upload system
- Uses existing `MediaSelectionModal` component
- Integrates with `/api/media/upload` endpoint
- Proper MediaItem type usage from shared types
- Handles API response format correctly

### ✅ 4. Handle aspect ratio flexibility within left panel constraints
- Configurable aspect ratios: `'square' | '16:9' | '4:3' | 'auto'`
- Responsive design that adapts to container constraints
- Proper CSS classes for different aspect ratios

### ✅ 5. Design as modular component for reuse in other projects
- Well-documented interface with JSDoc comments
- Comprehensive prop types with clear descriptions
- Example usage provided in documentation
- Reusable across different contexts (see `clickable-media-upload.example.tsx`)

## Features

### Core Functionality
- **Modal Integration**: Opens existing media selection modal for browsing project media
- **Drag & Drop**: Direct file upload with visual feedback
- **Validation**: File type and size validation with error callbacks
- **Aspect Ratios**: Flexible aspect ratio handling
- **Error Handling**: Comprehensive error handling with user feedback

### Visual Features
- **Loading States**: Shows upload progress with spinner
- **Hover Effects**: Interactive buttons appear on hover for existing media
- **Drag Feedback**: Visual feedback during drag operations
- **Responsive Design**: Adapts to different screen sizes and containers

### Accessibility
- **Alt Text**: Proper alt text for images
- **Keyboard Navigation**: Clickable areas are keyboard accessible
- **Screen Reader Support**: Semantic HTML structure

## API Reference

### Props

```typescript
interface ClickableMediaUploadProps {
  /** Currently selected media item to display */
  currentMedia?: MediaItem;
  
  /** Project ID for accessing project media library */
  projectId?: string;
  
  /** Callback when media is selected from modal or uploaded */
  onMediaSelect: (media: MediaItem) => void;
  
  /** Callback when current media is removed */
  onMediaRemove: () => void;
  
  /** Optional custom upload handler for direct file uploads */
  onDirectUpload?: (file: File) => Promise<MediaItem>;
  
  /** Error callback for validation and upload errors */
  onError?: (error: string) => void;
  
  /** Aspect ratio constraint for the upload area */
  aspectRatio?: 'square' | '16:9' | '4:3' | 'auto';
  
  /** Custom placeholder content when no media is selected */
  placeholder?: React.ReactNode;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number;
  
  /** Accepted MIME types (default: common image formats) */
  acceptedTypes?: string[];
  
  /** External error message to display */
  error?: string;
}
```

## Usage Examples

### Basic Usage
```tsx
<ClickableMediaUpload
  currentMedia={project.thumbnailImage}
  projectId={project.id}
  onMediaSelect={(media) => setProjectImage(media)}
  onMediaRemove={() => setProjectImage(null)}
  aspectRatio="16:9"
/>
```

### With Error Handling
```tsx
<ClickableMediaUpload
  currentMedia={thumbnail}
  projectId={projectId}
  onMediaSelect={setThumbnail}
  onMediaRemove={() => setThumbnail(undefined)}
  onError={(error) => showToast(error, 'error')}
  aspectRatio="square"
  maxSize={5 * 1024 * 1024} // 5MB limit
/>
```

### Custom Upload Handler
```tsx
<ClickableMediaUpload
  onMediaSelect={setMedia}
  onMediaRemove={() => setMedia(undefined)}
  onDirectUpload={async (file) => {
    // Custom upload logic
    const result = await uploadToCustomService(file);
    return result.mediaItem;
  }}
  placeholder={<CustomPlaceholder />}
/>
```

## Integration Points

### Media Selection Modal
- Integrates with existing `MediaSelectionModal` component
- Passes project ID for accessing project-specific media
- Handles media selection and modal state management

### Upload API
- Uses `/api/media/upload` endpoint for direct uploads
- Handles API response format and error states
- Converts API response to MediaItem format

### Type System
- Uses shared `MediaItem` type from `@/lib/types/project`
- Proper TypeScript integration with existing codebase
- Type-safe prop interfaces

## File Structure

```
src/components/admin/
├── clickable-media-upload.tsx           # Main component
├── clickable-media-upload.example.tsx   # Usage examples
├── clickable-media-upload.README.md     # This documentation
└── __tests__/
    └── clickable-media-upload.test.tsx  # Component tests
```

## Testing

The component includes comprehensive tests covering:
- Rendering states (empty, with media, loading)
- User interactions (click, drag & drop, hover)
- Modal integration
- File validation
- Error handling
- Aspect ratio handling

Run tests with:
```bash
npm test clickable-media-upload
```

## Dependencies

- `@/components/ui/button` - UI button component
- `@/components/admin/media-selection-modal` - Media selection modal
- `@/lib/types/project` - MediaItem type definition
- `@/lib/utils` - Utility functions (cn)
- `lucide-react` - Icons (X, Image, Upload)

## Browser Support

- Modern browsers with drag-and-drop API support
- File API support for file validation
- CSS Grid and Flexbox support for layout

## Performance Considerations

- Lazy loading of media selection modal
- Efficient drag-and-drop event handling
- Optimized re-renders with proper prop dependencies
- File validation happens before upload to prevent unnecessary API calls

## Future Enhancements

- Multiple file selection support
- Progress tracking for large uploads
- Image preview and cropping
- Integration with more media providers
- Batch upload capabilities