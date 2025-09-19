/**
 * UI System - Main Export
 * 
 * Centralized UI system that provides theme management, design tokens,
 * layout constants, and animation orchestration for the portfolio platform.
 */

// Theme System
export { 
  ThemeProvider,
  useTheme,
  getCurrentTheme,
  getThemeConfig,
  isSystemDarkMode,
  isValidTheme,
  switchThemeWithAICoordination,
  themeConfigs,
  defaultLightTheme,
  defaultDarkTheme
} from './theme';
export * from './design-tokens';

// Layout System
export * from './layout-constants';

// Animation System
export { 
  initializeAnimationSystem,
  executeAnimation,
  executeHighlight,
  removeHighlight,
  executeProjectModalAnimation,
  clearAnimationQueue,
  pauseAnimations,
  resumeAnimations,
  getAnimationQueue,
  isAnimating,
  registerCustomAnimation,
  useAnimation,
  getAnimationPerformance
} from './animation';

// UI Control Hooks
export { 
  useUIControl,
  useNavigation,
  useHighlighting,
  useFocusManagement,
  useUIState,
  getUIState,
  setUIState,
  subscribeToStateChanges
} from './ui-control-hooks';

// Responsive Design
export * from './use-responsive';

// Types (excluding duplicates)
export type {
  ThemeTokens,
  ThemeConfig,
  ComponentTheme,
  AnimationTheme,
  AnimationCommand,
  AnimationOptions,
  HighlightOptions,
  NavigationCommand,
  ModalOptions,
  ScrollOptions,
  UIState,
  LayoutState,
  AIInterfaceState,
  HighlightCommand,
  AIControlProps,
  ThemeProviderProps,
  UseThemeReturn,
  UseUIControlReturn,
  UseAnimationReturn,
  UseResponsiveReturn
} from './types';