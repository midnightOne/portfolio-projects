# Enhanced UI Components - UI System

Enhanced shadcn/ui components with AI control hooks and advanced animation capabilities. These components maintain backward compatibility while adding AI navigation, highlighting, and programmatic control features.

## Features

- **AI Control Hooks**: Programmatic control for AI system integration
- **Advanced Animations**: GSAP-powered animations with Framer Motion fallbacks
- **SSR Compatibility**: Server-side rendering with progressive enhancement
- **Backward Compatibility**: Drop-in replacements for existing components
- **Theme Coordination**: Seamless integration with theme system
- **Accessibility**: Maintains WCAG 2.1 AA compliance

## Components

### Enhanced Base Components

#### EnhancedButton
Enhanced shadcn/ui Button with AI control hooks and animation coordination.

```tsx
import { EnhancedButton } from '@/components/ui/enhanced';

<EnhancedButton
  variant="default"
  aiControlEnabled={true}
  aiId="my-button"
  onAINavigate={handleAICommand}
  animated={true}
>
  Click me
</EnhancedButton>
```

**Props:**
- `aiControlEnabled?: boolean` - Enable AI control capabilities
- `aiId?: string` - Unique identifier for AI targeting
- `animated?: boolean` - Enable hover/tap animations
- `onAINavigate?: (command: NavigationCommand) => void` - AI command handler
- `onAIHighlight?: (options: HighlightOptions) => void` - AI highlight handler

#### EnhancedCard
Enhanced shadcn/ui Card with highlighting and AI interaction capabilities.

```tsx
import { EnhancedCard, EnhancedCardHeader, EnhancedCardTitle, EnhancedCardContent } from '@/components/ui/enhanced';

<EnhancedCard
  aiControlEnabled={true}
  aiId="my-card"
  highlightable={true}
  onAIHighlight={handleHighlight}
>
  <EnhancedCardHeader>
    <EnhancedCardTitle>Card Title</EnhancedCardTitle>
  </EnhancedCardHeader>
  <EnhancedCardContent>
    Card content here
  </EnhancedCardContent>
</EnhancedCard>
```

**Props:**
- `highlightable?: boolean` - Enable AI highlighting
- `animated?: boolean` - Enable hover animations
- All AI control props from base interface

#### EnhancedDialog
Enhanced shadcn/ui Dialog with GSAP animation coordination.

```tsx
import { EnhancedDialog, EnhancedDialogContent, EnhancedDialogTrigger } from '@/components/ui/enhanced';

<EnhancedDialog>
  <EnhancedDialogTrigger>Open Dialog</EnhancedDialogTrigger>
  <EnhancedDialogContent
    animationType="scale"
    aiControlEnabled={true}
    aiId="my-dialog"
  >
    Dialog content
  </EnhancedDialogContent>
</EnhancedDialog>
```

**Props:**
- `animationType?: 'fade' | 'slide' | 'scale'` - Animation style
- `animated?: boolean` - Enable animations
- All AI control props from base interface

### Enhanced Project Components

#### EnhancedProjectModal
Enhanced ProjectModal with AI control and advanced animations.

```tsx
import { EnhancedProjectModal } from '@/components/ui/enhanced';

<EnhancedProjectModal
  project={project}
  isOpen={isOpen}
  onClose={onClose}
  aiControlEnabled={true}
  aiId="project-modal"
  onAINavigate={handleAICommand}
  animationType="scale"
/>
```

#### EnhancedProjectGrid
Enhanced ProjectGrid with AI navigation and iPad-style animations.

```tsx
import { EnhancedProjectGrid, AIProjectGrid } from '@/components/ui/enhanced';

// Standard enhanced grid
<EnhancedProjectGrid
  projects={projects}
  loading={loading}
  onProjectClick={handleClick}
  aiControlEnabled={true}
  animationType="ipad-grid"
/>

// AI-optimized grid
<AIProjectGrid
  projects={projects}
  loading={loading}
  onProjectClick={handleClick}
  selectedProjectId={selectedId}
/>
```

#### EnhancedNavigationBar
Enhanced NavigationBar with AI control and advanced interactions.

```tsx
import { EnhancedNavigationBar } from '@/components/ui/enhanced';

<EnhancedNavigationBar
  tags={tags}
  selectedTags={selectedTags}
  onTagSelect={setSelectedTags}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  sortBy={sortBy}
  onSortChange={setSortBy}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  aiControlEnabled={true}
  aiId="navigation-bar"
  onAINavigate={handleAICommand}
/>
```

## SSR-Compatible Variants

For server-side rendering with progressive enhancement:

```tsx
import { SSRProjectModal, SSRProjectGrid, SSRNavigationBar } from '@/components/ui/enhanced';

// Renders with original component on server, enhances on client
<SSRProjectModal
  project={project}
  isOpen={isOpen}
  onClose={onClose}
  enableClientFeatures={true}
  aiEnabled={false} // Enable after user interaction
/>
```

**SSR Props:**
- `enableClientFeatures?: boolean` - Enable client-side enhancements
- `aiEnabled?: boolean` - Enable AI features after hydration
- `initialData?: any` - Server-side data for initial render

## AI Control Interface

All enhanced components implement the `AIControlProps` interface:

```tsx
interface AIControlProps {
  aiControlEnabled?: boolean;
  aiId?: string;
  onAINavigate?: (command: NavigationCommand) => void;
  onAIHighlight?: (options: HighlightOptions) => void;
}
```

### Navigation Commands

```tsx
interface NavigationCommand {
  action: 'navigate' | 'highlight' | 'modal' | 'scroll' | 'focus';
  target: string;
  options?: {
    duration?: number;
    easing?: string;
    highlight?: HighlightOptions;
    modal?: ModalOptions;
    scroll?: ScrollOptions;
  };
  metadata?: {
    source: 'ai' | 'user';
    timestamp: number;
    sessionId: string;
  };
}
```

### Highlight Options

```tsx
interface HighlightOptions {
  type: 'spotlight' | 'outline' | 'color' | 'glow';
  duration: 'persistent' | 'timed';
  timing?: number; // For timed highlights
  intensity: 'subtle' | 'medium' | 'strong';
}
```

## Usage Patterns

### Basic Enhancement
Replace existing components with enhanced versions:

```tsx
// Before
import { Button } from '@/components/ui/button';
<Button>Click me</Button>

// After
import { EnhancedButton } from '@/components/ui/enhanced';
<EnhancedButton aiControlEnabled={false}>Click me</EnhancedButton>
```

### AI Integration
Enable AI control for specific components:

```tsx
import { EnhancedCard } from '@/components/ui/enhanced';
import { useUIControl } from '@/lib/ui/ui-control-hooks';

function MyComponent() {
  const { navigate, highlight } = useUIControl();

  const handleAICommand = (command: NavigationCommand) => {
    navigate(command);
  };

  const handleAIHighlight = (options: HighlightOptions) => {
    // Custom highlight handling
  };

  return (
    <EnhancedCard
      aiControlEnabled={true}
      aiId="my-card"
      onAINavigate={handleAICommand}
      onAIHighlight={handleAIHighlight}
      highlightable={true}
    >
      Content
    </EnhancedCard>
  );
}
```

### Progressive Enhancement
Use SSR variants for better performance:

```tsx
import { SSRProjectGrid, useProgressiveEnhancement } from '@/components/ui/enhanced';

function ProjectsPage() {
  const { shouldUseEnhanced } = useProgressiveEnhancement();

  return (
    <SSRProjectGrid
      projects={projects}
      loading={loading}
      onProjectClick={handleClick}
      enableClientFeatures={shouldUseEnhanced}
      aiEnabled={false} // Enable based on user preference
    />
  );
}
```

## Animation Types

### Standard Animations
- `fade` - Opacity transitions
- `slide` - Slide in/out animations
- `scale` - Scale up/down animations

### Advanced Animations
- `ipad-grid` - iPad-style grid transitions where selected items grow and others animate away
- `spotlight` - Highlight with spotlight effect
- `outline` - Highlight with outline animation

## Performance Considerations

1. **Lazy Loading**: Enhanced features load after initial render
2. **Animation Optimization**: Uses hardware acceleration and respects `prefers-reduced-motion`
3. **Bundle Splitting**: Enhanced components are code-split from base components
4. **SSR Compatibility**: Server renders with base components, enhances on client

## Accessibility

- Maintains all shadcn/ui accessibility features
- Adds ARIA attributes for AI-controlled elements
- Respects `prefers-reduced-motion` settings
- Provides keyboard navigation for all interactive elements
- Screen reader compatible with enhanced features

## Testing

Test enhanced components with the test page:

```bash
npm run dev
# Navigate to /test-enhanced-components
```

The test page demonstrates:
- All enhanced component variants
- AI control capabilities
- SSR compatibility
- Animation types
- Accessibility features

## Migration Guide

### From Standard Components

1. **Import Enhanced Components**:
   ```tsx
   // Before
   import { Button, Card } from '@/components/ui';
   
   // After
   import { EnhancedButton, EnhancedCard } from '@/components/ui/enhanced';
   ```

2. **Add AI Props (Optional)**:
   ```tsx
   <EnhancedButton
     aiControlEnabled={aiEnabled}
     aiId="unique-id"
     onAINavigate={handleAICommand}
   >
     Button Text
   </EnhancedButton>
   ```

3. **Enable Animations (Optional)**:
   ```tsx
   <EnhancedCard animated={true} highlightable={true}>
     Content
   </EnhancedCard>
   ```

### For SSR Applications

Use SSR variants for better performance:

```tsx
import { SSRProjectModal } from '@/components/ui/enhanced';

<SSRProjectModal
  project={project}
  isOpen={isOpen}
  onClose={onClose}
  enableClientFeatures={true}
  aiEnabled={userPreferences.aiEnabled}
/>
```

## API Reference

See the TypeScript definitions in each component file for complete API documentation. All enhanced components extend their base shadcn/ui counterparts with additional AI and animation capabilities.