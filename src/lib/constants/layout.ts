/**
 * Layout Constants
 * 
 * Centralized layout constants to ensure consistent spacing, sizing, and responsive behavior
 * across the portfolio application. These constants replace hardcoded Tailwind classes
 * and provide a single source of truth for layout values.
 */

// Max-width presets for different contexts
export const MAX_WIDTHS = {
  // Default content width (80rem = 1280px)
  default: '80rem',
  // Editor interface width (105rem = 1680px) 
  editor: '105rem',
  // Admin dashboard width (120rem = 1920px)
  admin: '120rem',
  // Modal content width
  modal: '95vw',
  // Prose content width
  prose: '65ch',
} as const;

// Container classes with consistent padding
export const CONTAINERS = {
  // Standard container with auto margins and responsive padding
  default: 'container mx-auto px-4 sm:px-6 lg:px-8',
  // Compact container for smaller content
  compact: 'container mx-auto px-4',
  // Wide container for admin interfaces
  wide: 'w-full mx-auto px-4 sm:px-6 lg:px-8',
} as const;

// Spacing constants for consistent gaps and padding
export const SPACING = {
  // Section padding (vertical spacing between major sections)
  section: {
    sm: 'py-4',
    md: 'py-6',
    lg: 'py-8',
    xl: 'py-12',
  },
  // Container margins (horizontal spacing)
  container: {
    sm: 'px-4',
    md: 'px-6',
    lg: 'px-8',
  },
  // Component gaps (spacing between related elements)
  gap: {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  },
  // Vertical spacing between elements
  stack: {
    xs: 'space-y-2',
    sm: 'space-y-3',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8',
  },
  // Horizontal spacing between elements
  inline: {
    xs: 'space-x-2',
    sm: 'space-x-3',
    md: 'space-x-4',
    lg: 'space-x-6',
    xl: 'space-x-8',
  },
} as const;

// Grid system constants
export const GRID = {
  // Dashboard stats grid
  stats: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
  // Project cards grid
  projects: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  // Admin content grid
  admin: 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
  // Two column layout
  twoCol: 'grid grid-cols-1 lg:grid-cols-2',
} as const;

// Flex layout constants
export const FLEX = {
  // Common flex patterns
  center: 'flex items-center justify-center',
  between: 'flex items-center justify-between',
  start: 'flex items-center justify-start',
  end: 'flex items-center justify-end',
  col: 'flex flex-col',
  colCenter: 'flex flex-col items-center justify-center',
  // Responsive flex directions
  responsive: 'flex flex-col lg:flex-row',
} as const;

// Modal and dialog sizing
export const MODAL = {
  // Modal widths (full classes)
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  xxl: 'max-w-6xl',
  full: 'max-w-7xl',
  // Modal heights
  height: {
    sm: 'max-h-[50vh]',
    md: 'max-h-[70vh]',
    lg: 'max-h-[85vh]',
    full: 'max-h-[95vh]',
  },
  // Modal width values (for interpolation)
  width: {
    sm: '28rem',
    md: '32rem',
    lg: '42rem',
    xl: '56rem',
    xxl: '72rem',
    full: '80rem',
  },
} as const;

// Component-specific layout constants
export const COMPONENTS = {
  // Card padding
  card: {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  },
  // Button spacing
  button: {
    gap: 'gap-2',
    padding: 'px-4 py-2',
  },
  // Form spacing
  form: {
    field: 'space-y-2',
    group: 'space-y-4',
    section: 'space-y-6',
  },
  // Navigation spacing
  nav: {
    item: 'px-3 py-2',
    gap: 'gap-4',
  },
} as const;

// Responsive breakpoint helpers
export const BREAKPOINTS = {
  // Common responsive patterns
  hide: {
    mobile: 'hidden sm:block',
    desktop: 'block sm:hidden',
  },
  show: {
    mobile: 'block sm:hidden',
    desktop: 'hidden sm:block',
  },
} as const;

// TypeScript types for layout constants
export type MaxWidth = keyof typeof MAX_WIDTHS;
export type Container = keyof typeof CONTAINERS;
export type SpacingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type GridType = keyof typeof GRID;
export type FlexType = keyof typeof FLEX;
export type ModalSize = keyof typeof MODAL;

// Helper functions for dynamic class generation
export const getMaxWidth = (size: MaxWidth): string => MAX_WIDTHS[size];
export const getContainer = (type: Container): string => CONTAINERS[type];
export const getSpacing = (type: keyof typeof SPACING, size: SpacingSize): string => {
  const spacingGroup = SPACING[type];
  if (size in spacingGroup) {
    return spacingGroup[size as keyof typeof spacingGroup];
  }
  throw new Error(`Invalid spacing size "${size}" for type "${type}"`);
};
export const getGrid = (type: GridType): string => GRID[type];
export const getFlex = (type: FlexType): string => FLEX[type];

// Validation helpers
export const isValidMaxWidth = (value: string): value is MaxWidth =>
  value in MAX_WIDTHS;

export const isValidSpacingSize = (value: string): value is SpacingSize =>
  ['xs', 'sm', 'md', 'lg', 'xl'].includes(value);

// Default layout configurations for common use cases
export const LAYOUT_PRESETS = {
  // Standard page layout
  page: {
    container: CONTAINERS.default,
    spacing: SPACING.section.lg,
    maxWidth: MAX_WIDTHS.default,
  },
  // Admin page layout  
  admin: {
    container: CONTAINERS.wide,
    spacing: SPACING.section.md,
    maxWidth: MAX_WIDTHS.admin,
  },
  // Editor layout
  editor: {
    container: CONTAINERS.wide,
    spacing: SPACING.section.sm,
    maxWidth: MAX_WIDTHS.editor,
  },
  // Modal layout
  modal: {
    maxWidth: MODAL.xxl,
    height: MODAL.height.lg,
    padding: COMPONENTS.card.lg,
  },
} as const;

export type LayoutPreset = keyof typeof LAYOUT_PRESETS;
export const getLayoutPreset = (preset: LayoutPreset) => LAYOUT_PRESETS[preset];