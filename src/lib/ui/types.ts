/**
 * UI System Types
 * 
 * TypeScript type definitions for the UI system components,
 * theme management, animations, and layout constants.
 */

// Theme Types
export interface ThemeTokens {
  colors: {
    background: string;
    foreground: string;
    accent: string;
    accentHover: string;
    muted: string;
    card: {
      background: string;
      border: string;
    };
    ai: {
      background: string;
      border: string;
    };
  };
  gradients: {
    primary: string;
    accent: string;
    background: string;
  };
  animations: {
    duration: {
      fast: string;      // 0.2s
      normal: string;    // 0.7s (primary)
      slow: string;      // 1.2s
    };
    easing: {
      smooth: string;    // power2.out
      bounce: string;    // back.out(1.7)
      elastic: string;   // elastic.out(1, 0.3)
    };
  };
}

export interface ThemeConfig {
  id: string;
  name: string;
  type: 'light' | 'dark';
  tokens: ThemeTokens;
  customizations: {
    components: Record<string, ComponentTheme>;
    animations: AnimationTheme;
  };
}

export interface ComponentTheme {
  variants: Record<string, React.CSSProperties>;
  defaultProps: Record<string, any>;
}

export interface AnimationTheme {
  duration: number;
  easing: string;
  respectReducedMotion: boolean;
}

// Animation Types
export interface AnimationCommand {
  id: string;
  type: 'navigate' | 'highlight' | 'modal' | 'custom';
  target: string;
  duration: number;
  options: AnimationOptions;
  priority: 'normal' | 'high' | 'override';
}

export interface AnimationOptions {
  duration?: number;
  easing?: string;
  delay?: number;
  onComplete?: () => void;
  onStart?: () => void;
  coordinated?: boolean;  // Execute with other animations
}

export interface HighlightOptions {
  type: 'spotlight' | 'outline' | 'color' | 'glow';
  duration: 'persistent' | 'timed';
  timing?: number;  // For timed highlights
  intensity: 'subtle' | 'medium' | 'strong';
}

// UI Control Types
export interface NavigationCommand {
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

export interface ModalOptions {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'full';
  animation?: 'fade' | 'slide' | 'scale';
  backdrop?: boolean;
}

export interface ScrollOptions {
  behavior?: 'smooth' | 'instant';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

// Layout Types (from existing constants)
export type MaxWidth = 'default' | 'editor' | 'admin' | 'modal' | 'prose';
export type Container = 'default' | 'compact' | 'wide';
export type SpacingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type GridType = 'stats' | 'projects' | 'admin' | 'twoCol';
export type FlexType = 'center' | 'between' | 'start' | 'end' | 'col' | 'colCenter' | 'responsive';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'full';
export type LayoutPreset = 'page' | 'admin' | 'editor' | 'modal';

// UI State Types
export interface UIState {
  theme: 'light' | 'dark';
  layout: LayoutState;
  navigation: {
    currentSection: string;
    history: string[];
    canGoBack: boolean;
    canGoForward: boolean;
  };
  highlighting: {
    active: Record<string, HighlightOptions>;
    history: HighlightCommand[];
  };
  ai: {
    interface: AIInterfaceState;
    lastCommand: NavigationCommand | null;
    isProcessing: boolean;
  };
  performance: {
    animationFPS: number;
    lastFrameTime: number;
    skipAnimations: boolean;
  };
}

export interface LayoutState {
  header: {
    visible: boolean;
    height: number;
    transparent: boolean;
  };
  modal: {
    open: boolean;
    component: string | null;
    data: any;
  };
  aiInterface: {
    position: 'hero' | 'pinned';
    mode: 'pill' | 'expanded';
    visible: boolean;
    currentNarration: string | null;
  };
  aiNavigation: {
    activeHighlights: Record<string, HighlightOptions>;
    navigationHistory: NavigationCommand[];
    isAnimating: boolean;
  };
}

export interface AIInterfaceState {
  position: 'hero' | 'pinned';
  mode: 'pill' | 'expanded';
  isListening: boolean;
  isProcessing: boolean;
  currentNarration: string | null;
  hasUserInteracted: boolean;
}

export interface HighlightCommand {
  target: string;
  options: HighlightOptions;
  timestamp: number;
}

// Component Props Types
export interface AIControlProps {
  onAINavigate?: (command: NavigationCommand) => void;
  onAIHighlight?: (target: string, options: HighlightOptions) => void;
  aiControlEnabled?: boolean;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark';
  storageKey?: string;
  enableSystem?: boolean;
}

// Floating AI Interface Types
export interface QuickAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  command?: string;
}

export interface FloatingAIInterfaceProps {
  // Position Management
  position: 'hero' | 'pinned';
  onPositionChange?: (position: 'hero' | 'pinned') => void;
  autoPin?: boolean;
  
  // Mode Management
  mode: 'pill' | 'expanded';
  onModeChange?: (mode: 'pill' | 'expanded') => void;
  expandOnFocus?: boolean;
  
  // Content
  currentNarration?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  
  // Interaction Handlers
  onTextSubmit?: (text: string) => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: (transcript: string) => void;
  onSettingsClick?: () => void;
  onClear?: () => void;
  
  // State
  isListening?: boolean;
  isProcessing?: boolean;
  isTyping?: boolean;
  
  // Voice Features
  voiceEnabled?: boolean;
  voiceLanguage?: string;
  voiceAutoStart?: boolean;
  
  // Quick Actions
  showQuickActions?: boolean;
  quickActions?: QuickAction[];
  onQuickAction?: (action: QuickAction) => void;
  
  // Styling
  theme?: 'default' | 'minimal' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  
  // Behavior
  hideOnScroll?: boolean;
  persistPosition?: boolean;
  animationDuration?: number;
  
  // Accessibility
  ariaLabel?: string;
  announceNarration?: boolean;
}

// Hook Return Types
export interface UseThemeReturn {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  systemTheme: 'light' | 'dark';
  resolvedTheme: 'light' | 'dark';
  isAnimating: boolean;
}

export interface UseUIControlReturn {
  navigate: (command: NavigationCommand) => Promise<void>;
  highlight: (target: string, options: HighlightOptions) => Promise<void>;
  removeHighlight: (target?: string) => Promise<void>;
  getUIState: () => UIState;
  setUIState: (state: Partial<UIState>) => Promise<void>;
  isAnimating: boolean;
}

export interface UseAnimationReturn {
  animate: (target: Element, options: AnimationOptions) => Promise<void>;
  isAnimating: boolean;
  queue: AnimationCommand[];
  clearQueue: () => void;
  pauseAnimations: () => void;
  resumeAnimations: () => void;
}

export interface UseResponsiveReturn {
  breakpoint: 'desktop' | 'tablet' | 'mobile';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}