# SmartTagInput Component

A modular, reusable inline tag input component with advanced features including autocomplete, duplicate detection, and keyboard navigation. Tags appear as chips within the input field itself, providing a modern Gmail-like experience.

## Features

- ✅ **Inline tag display** - Tags appear as chips within the input field
- ✅ **Comma/semicolon separation** - Type tags separated by commas or semicolons
- ✅ **TAB autocomplete** - Press Tab to complete from existing tags
- ✅ **Case-insensitive matching** - Configurable case sensitivity for duplicates
- ✅ **Duplicate detection with animation** - Visual feedback for duplicate attempts
- ✅ **Visual tag chips with X-button** - Clean inline badge display with removal
- ✅ **Keyboard navigation** - Arrow keys, Enter, Escape, Backspace support
- ✅ **Modular design** - Extractable utility functions and clean interfaces
- ✅ **Accessibility** - ARIA labels and keyboard navigation
- ✅ **IME support** - Handles composition events for international input

## Basic Usage

```tsx
import { SmartTagInput, Tag } from '@/components/admin/smart-tag-input';

const existingTags: Tag[] = [
  { id: '1', name: 'React', projectCount: 5 },
  { id: '2', name: 'TypeScript', projectCount: 8 },
  { id: '3', name: 'Next.js', projectCount: 3 },
];

function MyComponent() {
  const [tags, setTags] = useState<string[]>([]);

  return (
    <SmartTagInput
      value={tags}
      onChange={setTags}
      existingTags={existingTags}
      placeholder="Add tags..."
    />
  );
}
```

## Advanced Usage

```tsx
<SmartTagInput
  value={tags}
  onChange={setTags}
  existingTags={existingTags}
  placeholder="Add project tags..."
  separators={[',', ';', '|']} // Custom separators
  maxTags={10}
  caseSensitive={false}
  showSuggestions={true}
  maxSuggestions={5}
  animateDuplicates={true}
  onTagCreate={(tagName) => console.log('New tag:', tagName)}
  onDuplicateAttempt={(tagName) => console.log('Duplicate:', tagName)}
  error="Please add at least one tag"
  className="my-custom-class"
/>
```

## Props Interface

```tsx
interface SmartTagInputProps {
  // Core functionality
  value: string[];                    // Current tags
  onChange: (tags: string[]) => void; // Tag change handler
  existingTags: Tag[];               // Available tags for autocomplete
  
  // Configuration
  placeholder?: string;              // Input placeholder
  separators?: string[];            // Tag separators (default: [',', ';'])
  maxTags?: number;                 // Maximum number of tags
  caseSensitive?: boolean;          // Case sensitivity (default: false)
  
  // UI options
  className?: string;               // Custom CSS classes
  error?: string;                   // Error message to display
  showSuggestions?: boolean;        // Show autocomplete (default: true)
  maxSuggestions?: number;          // Max suggestions shown (default: 5)
  animateDuplicates?: boolean;      // Animate duplicates (default: true)
  
  // Callbacks
  onTagCreate?: (tagName: string) => void;      // New tag created
  onDuplicateAttempt?: (tagName: string) => void; // Duplicate attempted
}
```

## Tag Interface

```tsx
interface Tag {
  id: string;
  name: string;
  color?: string | null;
  createdAt?: Date;
  projectCount?: number; // For sorting suggestions
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Complete with selected suggestion |
| `Enter` | Add current input or selected suggestion |
| `↑/↓` | Navigate suggestions |
| `Escape` | Close suggestions |
| `Backspace` | Remove last tag (when input is empty) |
| `,` or `;` | Add current input as tag |

## Modular Utilities

The component includes extractable utility functions in `TagInputBehavior`:

```tsx
import { TagInputBehavior } from '@/components/admin/smart-tag-input';

// Find existing tag (case-insensitive by default)
const existingTag = TagInputBehavior.findExistingTag('react', tags, false);

// Process separator-delimited input
const tagList = TagInputBehavior.processSeparators('tag1,tag2;tag3', [',', ';']);

// Get matching suggestions with smart sorting
const suggestions = TagInputBehavior.getMatchingSuggestions(
  'rea',           // input
  existingTags,    // available tags
  currentTags,     // current tags to exclude
  false,           // case sensitive
  5                // max results
);
```

## Styling

The component uses Tailwind CSS classes and can be customized:

```tsx
// Custom styling
<SmartTagInput
  className="my-tag-input"
  // ... other props
/>
```

```css
/* Custom styles */
.my-tag-input .suggestions-dropdown {
  @apply border-blue-300 shadow-lg;
}

.my-tag-input .tag-badge {
  @apply bg-blue-100 text-blue-800;
}
```

## Accessibility

- ARIA labels for remove buttons
- Keyboard navigation support
- Screen reader friendly
- Focus management
- High contrast support

## Testing

Comprehensive test suite included:

```bash
npm test smart-tag-input.test.tsx
```

Test coverage includes:
- Basic functionality
- Separator handling
- Autocomplete behavior
- Duplicate detection
- Keyboard navigation
- Configuration options
- Utility functions

## Extractability

This component is designed to be easily extracted to a separate npm package:

1. **Clean interfaces** - All types are exported and well-defined
2. **Minimal dependencies** - Only uses common UI libraries
3. **Utility separation** - Core logic in `TagInputBehavior` class
4. **No internal coupling** - Doesn't depend on project-specific code
5. **Comprehensive tests** - Full test suite for reliability

To extract:
1. Copy `smart-tag-input.tsx` and `smart-tag-input.test.tsx`
2. Update imports for UI components (Button, Badge, Input)
3. Add peer dependencies for React and UI library
4. Package and publish

## Performance

- Debounced suggestion updates
- Efficient duplicate detection
- Minimal re-renders
- Lazy suggestion loading
- Memory-efficient event handling

## Browser Support

- Modern browsers (ES2018+)
- Mobile touch support
- IME composition support
- Accessibility features

## Migration from Basic Tag Input

If migrating from a basic tag input:

```tsx
// Before
<input 
  value={tagString} 
  onChange={(e) => setTagString(e.target.value)}
  placeholder="Tags..."
/>

// After
<SmartTagInput
  value={tagString.split(',').filter(Boolean)}
  onChange={(tags) => setTagString(tags.join(','))}
  existingTags={availableTags}
  placeholder="Tags..."
/>
```