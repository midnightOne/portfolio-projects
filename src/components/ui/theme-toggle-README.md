# Theme Toggle Components

This directory contains theme toggle components for switching between light and dark themes in the portfolio application.

## Components

### SimpleThemeToggle
A lightweight theme toggle component that works independently without requiring the enhanced theme system.

**Features:**
- ✅ Light/Dark theme switching
- ✅ **Starts with user's system theme preference**
- ✅ Theme persistence in localStorage (overrides system)
- ✅ System preference detection and monitoring
- ✅ Automatic theme updates when system changes (no stored preference)
- ✅ Smooth icon transitions
- ✅ Multiple sizes (sm, md, lg)
- ✅ Accessible with proper ARIA labels

**Usage:**
```tsx
import { SimpleThemeToggle } from '@/components/ui/simple-theme-toggle';

<SimpleThemeToggle size="md" />
```

### ThemeToggle (Enhanced)
A more advanced theme toggle component that integrates with the enhanced theme system when available, with fallback to simple functionality.

**Features:**
- ✅ All SimpleThemeToggle features
- ✅ **Starts with user's system theme preference**
- ✅ Multiple variants (button, dropdown, icon-only)
- ✅ Animated transitions with Framer Motion
- ✅ Dropdown with system theme display
- ✅ Loading states during theme transitions
- ✅ Enhanced theme system integration (when available)
- ✅ Real-time system theme change detection

**Usage:**
```tsx
import { ThemeToggle } from '@/components/ui/theme-toggle';

// Simple button
<ThemeToggle variant="button" size="md" />

// Button with label
<ThemeToggle variant="button" size="md" showLabel />

// Dropdown with options
<ThemeToggle variant="dropdown" size="md" />
```

## Integration

### Homepage Navigation
The theme toggle has been integrated into the main navigation component:

- **Desktop**: Shows in the navigation bar next to menu items
- **Mobile**: Shows both in the header and in the mobile menu
- **Responsive**: Adapts size and placement based on screen size

### Implementation Details

1. **System-First Approach**: Starts with user's system theme preference by default
2. **Theme Persistence**: Uses `portfolio-theme` localStorage key for user overrides
3. **System Detection**: Respects `prefers-color-scheme` media query and listens for changes
4. **Priority Order**: Stored preference → System preference → Light (fallback)
5. **CSS Classes**: Applies `light` or `dark` class to `document.documentElement`
6. **Smooth Transitions**: Uses CSS transitions for theme changes
7. **Hydration Safe**: Prevents hydration mismatches with proper mounting checks
8. **Dynamic Updates**: Automatically follows system theme changes when no user preference is stored

## System Theme Behavior

The theme toggle components follow this priority order:

1. **Stored User Preference** - If user has manually set a theme, use that
2. **System Preference** - If no stored preference, use system `prefers-color-scheme`
3. **Light Theme** - Fallback if system preference unavailable

### Dynamic System Theme Updates

- When **no stored preference** exists: Theme automatically updates when system theme changes
- When **stored preference** exists: Theme remains fixed until user manually changes it
- **Clearing stored preference**: Returns to following system theme automatically

### First Visit Experience

- New users see their preferred system theme immediately
- No flash of wrong theme during initial load
- Smooth transition if they choose to override system preference

## Testing

Test pages are available to verify functionality:

- `/test-simple-toggle` - Simple theme toggle variants
- `/test-enhanced-toggle` - Enhanced theme toggle variants  
- `/test-homepage-theme` - Homepage with integrated theme toggle
- `/test-system-theme` - System theme detection and behavior testing

## Theme System Integration

The components work with both:

1. **Simple Theme System**: Direct DOM manipulation and localStorage
2. **Enhanced Theme System**: Full integration with the UI system's theme management

The enhanced version automatically falls back to simple functionality if the enhanced theme system is not available, ensuring compatibility across the application.

## Accessibility

- Proper ARIA labels for screen readers
- Keyboard navigation support
- High contrast icon visibility
- Loading states for better UX
- Semantic button elements

## Customization

Both components support:
- Multiple sizes (sm, md, lg)
- Custom CSS classes
- Theme-aware styling
- Responsive behavior
- Animation preferences (respects `prefers-reduced-motion`)