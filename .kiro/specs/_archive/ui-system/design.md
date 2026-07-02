# UI System - Design Document

## Overview

The UI System takes over the UI domain from the portfolio-projects spec, providing a customized design layer built on the existing shadcn/ui foundation. This system manages the existing theme system (light/dark), adds AI-guided navigation with GSAP animations, and introduces a floating AI interface. The system integrates with the existing Next.js 14 architecture while adding desktop-first responsive design with mobile fallbacks, emphasizing smooth 0.7-second animations and programmatic UI control for AI-powered portfolio navigation.

## Integration with Existing Portfolio-Projects System

### Taking Over UI Responsibilities
The UI System assumes responsibility for all UI-related functionality currently in portfolio-projects:

**From portfolio-projects spec (Requirements 27.1-27.6):**
- Theme system with light/dark mode switching
- Theme persistence and system preference detection
- Smooth theme transitions and accessibility compliance
- Theme selector component integration

**From portfolio-projects tasks (9.18, 9.21):**
- Centralized UI constants and layout management
- Consistent component styling and responsive design
- Theme provider and context management

**Existing Components to Enhance:**
- All shadcn/ui components with custom styling
- Layout components (navigation, modals, cards)
- Form components with consistent theming
- Loading states and animations

## Architecture

### Core Architecture Principles

1. **Separation of Concerns**: Visual presentation completely separated from business logic
2. **AI-First Design**: UI components designed to be programmatically controllable by AI system
3. **Animation-Centric**: GSAP as the primary animation engine with coordinated transitions
4. **Theme Flexibility**: Custom light/dark themes with design token system
5. **Modular Extensibility**: Plugin-like architecture for custom animations and components

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Navigation Layer                      │
│  (Floating Interface, Command Processing, State Tracking)   │
├─────────────────────────────────────────────────────────────┤
│                   Animation Orchestration                   │
│     (GSAP Timeline Management, Queue System, Hooks)        │
├─────────────────────────────────────────────────────────────┤
│                  Enhanced Component Layer                   │
│    (Existing shadcn/ui + Custom Styling + New Components)  │
├─────────────────────────────────────────────────────────────┤
│                Enhanced Theme System Layer                  │
│  (Existing Theme + Design Tokens + Animation Coordination) │
├─────────────────────────────────────────────────────────────┤
│                 Existing Foundation Layer                   │
│     (Next.js 14, shadcn/ui, Tailwind CSS, React 18)       │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points with Existing System

**Existing Architecture to Preserve:**
- Next.js 14 with App Router
- PostgreSQL with Prisma ORM
- shadcn/ui component foundation
- Tailwind CSS styling system
- Existing authentication (NextAuth.js)
- Current project management functionality

**UI System Enhancements:**
- Add GSAP animation system on top of existing Framer Motion
- Enhance existing theme system with AI coordination
- Add floating AI interface to existing layouts
- Introduce programmatic UI control hooks
- Extend existing responsive design with desktop-first approach

## Components and Interfaces

### 1. Theme System

#### Design Token Architecture
```typescript
interface ThemeTokens {
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

interface ThemeManager {
  currentTheme: 'light' | 'dark';
  tokens: ThemeTokens;
  switchTheme: (theme: 'light' | 'dark') => void;
  applyTheme: (tokens: ThemeTokens) => void;
  getToken: (path: string) => string;
}
```

#### Theme Implementation (Enhancing Existing System)
- **Extend Existing Theme**: Build on portfolio-projects theme system (Requirements 27.1-27.6)
- **CSS Custom Properties**: Enhance existing CSS variables with animation-aware tokens
- **Preserve Existing Behavior**: Maintain current theme persistence and system preference detection
- **Add GSAP Coordination**: Ensure theme changes coordinate with ongoing animations
- **Backward Compatibility**: All existing theme functionality continues to work unchanged

### 2. Floating AI Interface with Reflink Access Control

#### Interface States with Access Levels
```typescript
interface AIInterfaceState {
  position: 'hero' | 'pinned';           // 30vh from bottom vs 24px from bottom
  mode: 'pill' | 'expanded';             // Compact vs full interface
  isListening: boolean;                  // Voice input active
  isProcessing: boolean;                 // AI processing request
  currentNarration: string | null;       // Subtitle text display
  hasUserInteracted: boolean;            // Determines pinning behavior
  
  // Reflink-based access control
  accessLevel: 'none' | 'basic' | 'limited' | 'premium';
  isVisible: boolean;                    // Controlled by access level
  welcomeMessage?: string;               // Personalized for reflink holders
  budgetStatus?: BudgetStatus;           // Budget tracking for premium users
}

interface AIInterfaceProps {
  onNavigate: (target: string) => void;
  onHighlight: (target: string, options: HighlightOptions) => void;
  onFilter: (query: string) => void;
  onModal: (projectId: string) => void;
  onInteraction: () => void;
  isPinned: boolean;
  
  // Reflink integration
  reflinkSession?: ReflinkSessionContext;
  publicAccessLevel: 'disabled' | 'basic_only' | 'limited_features';
  onAccessLevelChange?: (level: AccessLevel) => void;
  onBudgetExhausted?: () => void;
}

interface BudgetStatus {
  hasActiveBudget: boolean;
  isExhausted: boolean;
  estimatedRequestsRemaining: number;
  warningThreshold: number;
}

type AccessLevel = 'none' | 'basic' | 'limited' | 'premium';
```

#### Access Level Rendering Logic
```typescript
interface AccessLevelRenderer {
  // Conditional rendering based on access level
  shouldRenderInterface(accessLevel: AccessLevel, publicSettings: PublicAccessSettings): boolean;
  getInterfaceVariant(accessLevel: AccessLevel): 'hidden' | 'basic' | 'limited' | 'premium';
  getWelcomeMessage(reflinkSession?: ReflinkSessionContext): string;
  getBudgetWarningMessage(budgetStatus: BudgetStatus): string | null;
}

// Access level rendering rules
const accessLevelRules = {
  none: {
    render: false,
    message: "AI assistant available by invitation only"
  },
  basic: {
    render: true,
    features: ['text_chat'],
    message: "Basic AI assistant - Limited features available",
    dailyLimit: 5
  },
  limited: {
    render: true,
    features: ['text_chat', 'basic_voice'],
    message: "Limited AI assistant - Contact for premium access",
    dailyLimit: 20
  },
  premium: {
    render: true,
    features: ['text_chat', 'voice_ai', 'job_analysis', 'advanced_navigation'],
    message: (name: string) => `Welcome ${name}! You have premium AI access`,
    budgetBased: true
  }
};
```

#### Visual Design with Access Level Indicators
- **Pill Shape**: Rounded full (border-radius: 9999px) in compact mode
- **Floating Position**: Dynamically positioned with GSAP animations
- **Backdrop**: Subtle blur and shadow effects
- **Access Level Badge**: Visual indicator for current access level (Basic/Limited/Premium)
- **Budget Indicator**: Progress bar or warning for premium users approaching budget limits
- **Personalization**: Custom welcome message for reflink holders
- **Components**: Text input, microphone button, settings button
- **Narration Display**: Subtitle-style text above the interface
- **Responsive**: Simplified on mobile devices

### 3. 3D Wave Background System

#### Wave Configuration Architecture
```typescript
interface WaveConfiguration {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Wave Properties
  wavesX: number;              // 0.5 - 10.0 (wave frequency on X axis)
  wavesY: number;              // 0.5 - 10.0 (wave frequency on Y axis)
  displacementHeight: number;  // 0.0 - 2.0 (wave amplitude)
  speedX: number;              // -0.05 - 0.05 (animation speed X, negative values reverse direction)
  speedY: number;              // -0.05 - 0.05 (animation speed Y, negative values reverse direction)
  cylinderBend: number;        // 0.0 - 1.0 (tunnel effect intensity)
  
  // Theme-Specific Colors
  lightTheme: WaveColorScheme;
  darkTheme: WaveColorScheme;
  
  // Effects
  iridescenceWidth: number;    // 1.0 - 50.0 (shimmer effect width)
  iridescenceSpeed: number;    // -2.0 - 2.0 (shimmer animation speed, negative values reverse direction)
  flowMixAmount: number;       // 0.0 - 1.0 (flow texture blend)
  
  // Camera Position
  cameraPosition: { x: number; y: number; z: number };
  cameraRotation: { x: number; y: number };
  cameraZoom: number;
}

interface WaveColorScheme {
  primaryColor: string;        // Main wave color
  valleyColor: string;         // Low points color
  peakColor: string;           // High points color
  gradientStops?: string[];    // Optional gradient colors
}

interface WaveEngineProps {
  config: WaveConfiguration;
  theme: 'light' | 'dark';
  width?: number;
  height?: number;
  className?: string;
  interactive?: boolean;
  onError?: (error: Error) => void;
}
```

#### Three.js Integration Architecture
```typescript
interface WaveEngine {
  // Core Three.js components
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  geometry: THREE.PlaneGeometry;
  material: THREE.ShaderMaterial;
  
  // Animation state
  animationId: number | null;
  startTime: number;
  isAnimating: boolean;
  
  // Configuration management
  currentConfig: WaveConfiguration;
  currentTheme: 'light' | 'dark';
  
  // Methods
  initialize: (canvas: HTMLCanvasElement) => void;
  updateConfig: (config: WaveConfiguration) => void;
  updateTheme: (theme: 'light' | 'dark') => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}
```

#### Shader System
```typescript
interface WaveShaderUniforms {
  // Time and animation
  u_time: { value: number };
  u_resolution: { value: THREE.Vector2 };
  
  // Wave parameters
  u_wavesX: { value: number };
  u_wavesY: { value: number };
  u_amplitude: { value: number };
  u_speedX: { value: number };
  u_speedY: { value: number };
  u_cylinderBend: { value: number };
  
  // Colors (theme-aware)
  u_primaryColor: { value: THREE.Color };
  u_valleyColor: { value: THREE.Color };
  u_peakColor: { value: THREE.Color };
  
  // Effects
  u_iridescenceWidth: { value: number };
  u_iridescenceSpeed: { value: number };
  u_flowMixAmount: { value: number };
}

// Vertex shader for wave displacement
const waveVertexShader = `
  uniform float u_time;
  uniform float u_wavesX;
  uniform float u_wavesY;
  uniform float u_amplitude;
  uniform float u_speedX;
  uniform float u_speedY;
  uniform float u_cylinderBend;
  
  varying vec2 vUv;
  varying float vElevation;
  
  void main() {
    vUv = uv;
    
    // Calculate wave displacement
    float waveX = sin(position.x * u_wavesX + u_time * u_speedX) * u_amplitude;
    float waveY = sin(position.y * u_wavesY + u_time * u_speedY) * u_amplitude;
    float elevation = waveX + waveY;
    
    // Apply cylinder bend effect
    float bendAmount = u_cylinderBend * 0.5;
    float bendX = position.x * bendAmount;
    float bendY = position.y * bendAmount;
    
    vec3 newPosition = position;
    newPosition.z += elevation;
    newPosition.x += bendX * bendX;
    newPosition.y += bendY * bendY;
    
    vElevation = elevation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

// Fragment shader for colors and effects
const waveFragmentShader = `
  uniform vec3 u_primaryColor;
  uniform vec3 u_valleyColor;
  uniform vec3 u_peakColor;
  uniform float u_time;
  uniform float u_iridescenceWidth;
  uniform float u_iridescenceSpeed;
  uniform float u_flowMixAmount;
  
  varying vec2 vUv;
  varying float vElevation;
  
  void main() {
    // Color mixing based on elevation
    float normalizedElevation = (vElevation + 1.0) * 0.5;
    vec3 baseColor = mix(u_valleyColor, u_peakColor, normalizedElevation);
    baseColor = mix(baseColor, u_primaryColor, 0.3);
    
    // Iridescence effect
    float iridescence = sin(vUv.x * u_iridescenceWidth + u_time * u_iridescenceSpeed);
    iridescence = (iridescence + 1.0) * 0.5;
    
    // Flow texture simulation
    vec2 flowUv = vUv + vec2(u_time * 0.1, u_time * 0.05);
    float flowPattern = sin(flowUv.x * 10.0) * sin(flowUv.y * 8.0);
    flowPattern = (flowPattern + 1.0) * 0.5;
    
    // Combine effects
    vec3 finalColor = mix(baseColor, baseColor * 1.2, iridescence * 0.3);
    finalColor = mix(finalColor, finalColor * 1.1, flowPattern * u_flowMixAmount);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
```

#### Theme Integration
```typescript
interface WaveThemeManager {
  // Theme-aware color management
  getCurrentColorScheme: (theme: 'light' | 'dark') => WaveColorScheme;
  updateWaveColors: (theme: 'light' | 'dark') => void;
  
  // Coordinate with main theme system
  onThemeChange: (theme: 'light' | 'dark') => void;
  
  // Default color schemes
  defaultLightScheme: WaveColorScheme;
  defaultDarkScheme: WaveColorScheme;
}

// Default color schemes
const defaultWaveThemes = {
  light: {
    primaryColor: '#6366f1',    // Indigo
    valleyColor: '#e0e7ff',     // Light indigo
    peakColor: '#a855f7',       // Purple
  },
  dark: {
    primaryColor: '#4f46e5',    // Darker indigo
    valleyColor: '#1e1b4b',     // Dark indigo
    peakColor: '#7c3aed',       // Darker purple
  }
};
```

#### Admin Configuration Interface
```typescript
interface WaveConfigPanelProps {
  initialConfig?: WaveConfiguration;
  onSave?: (config: WaveConfiguration) => void;
  onPreview?: (config: WaveConfiguration) => void;
  presets?: WavePreset[];
}

interface WaveConfigPanel {
  // Real-time preview
  previewEngine: WaveEngine;
  previewMode: boolean;
  
  // Configuration state
  currentConfig: WaveConfiguration;
  isDirty: boolean;
  saving: boolean;
  
  // Parameter controls
  waveControls: ParameterSlider[];
  colorPickers: ThemeColorPicker[];
  cameraControls: CameraController;
  
  // Preset management
  presets: WavePreset[];
  customPresets: WavePreset[];
  
  // Methods
  handleParameterChange: (key: string, value: any) => void;
  handleThemeColorChange: (theme: 'light' | 'dark', colorKey: string, value: string) => void;
  applyPreset: (preset: WavePreset) => void;
  saveConfiguration: () => Promise<void>;
  exportConfiguration: () => string;
  importConfiguration: (json: string) => void;
}
```

#### Resolution-Independent Camera System
```typescript
interface ResolutionIndependentCamera {
  // Normalized camera settings (0-1 range, aspect-ratio independent)
  normalizedPosition: {
    x: number;        // -1 to 1 (left to right)
    y: number;        // -1 to 1 (bottom to top)  
    z: number;        // 0 to 1 (near to far, normalized to scene bounds)
  };
  
  normalizedRotation: {
    x: number;        // -1 to 1 (pitch: looking down to up)
    y: number;        // -1 to 1 (yaw: looking left to right)
  };
  
  fieldOfView: number;          // 30-90 degrees (consistent across resolutions)
  
  // Resolution adaptation
  adaptToViewport: (width: number, height: number) => THREE.PerspectiveCamera;
  maintainVisualConsistency: (aspectRatio: number) => CameraAdjustments;
}

interface CameraAdjustments {
  positionOffset: THREE.Vector3;    // Adjust position for aspect ratio
  fovAdjustment: number;            // Adjust FOV to maintain visual scale
  scaleCompensation: number;        // Compensate for different screen sizes
}

// Camera configuration that works across resolutions
interface ResolutionAwareCameraConfig {
  // Base configuration (what user sets in admin)
  basePosition: { x: number; y: number; z: number };
  baseRotation: { x: number; y: number };
  baseFOV: number;
  
  // Reference resolution (admin preview resolution)
  referenceWidth: number;
  referenceHeight: number;
  
  // Adaptation rules
  maintainVerticalFOV: boolean;     // Keep vertical field of view consistent
  compensateForAspectRatio: boolean; // Adjust position for different aspect ratios
  scaleWithScreenSize: boolean;     // Scale distance based on screen size
  
  // Methods
  calculateCameraForResolution: (width: number, height: number) => THREE.PerspectiveCamera;
  normalizeToReference: (camera: THREE.PerspectiveCamera) => NormalizedCameraState;
  applyToResolution: (normalized: NormalizedCameraState, width: number, height: number) => THREE.PerspectiveCamera;
}

// Ensure consistent visual appearance across resolutions
const cameraResolutionAdapter = {
  // Convert admin camera settings to resolution-independent format
  normalizeCamera: (camera: THREE.PerspectiveCamera, referenceWidth: number, referenceHeight: number) => {
    const referenceAspect = referenceWidth / referenceHeight;
    const referenceDistance = Math.sqrt(referenceWidth * referenceWidth + referenceHeight * referenceHeight);
    
    return {
      normalizedPosition: {
        x: camera.position.x / (referenceWidth * 0.5),
        y: camera.position.y / (referenceHeight * 0.5),
        z: camera.position.z / referenceDistance
      },
      normalizedRotation: {
        x: camera.rotation.x / Math.PI,
        y: camera.rotation.y / Math.PI
      },
      fieldOfView: camera.fov,
      referenceAspect
    };
  },
  
  // Apply normalized settings to target resolution
  applyToResolution: (normalized: NormalizedCameraState, targetWidth: number, targetHeight: number) => {
    const targetAspect = targetWidth / targetHeight;
    const targetDistance = Math.sqrt(targetWidth * targetWidth + targetHeight * targetHeight);
    const aspectRatioCompensation = normalized.referenceAspect / targetAspect;
    
    const camera = new THREE.PerspectiveCamera(
      normalized.fieldOfView,
      targetAspect,
      0.1,
      1000
    );
    
    // Apply position with aspect ratio compensation
    camera.position.set(
      normalized.normalizedPosition.x * (targetWidth * 0.5) * aspectRatioCompensation,
      normalized.normalizedPosition.y * (targetHeight * 0.5),
      normalized.normalizedPosition.z * targetDistance
    );
    
    // Apply rotation
    camera.rotation.set(
      normalized.normalizedRotation.x * Math.PI,
      normalized.normalizedRotation.y * Math.PI,
      0
    );
    
    return camera;
  }
};
```

#### Performance Optimization
```typescript
interface WavePerformanceManager {
  // Performance monitoring
  fps: number;
  frameTime: number;
  isPerformanceOptimal: boolean;
  
  // Optimization strategies
  enableLOD: boolean;           // Level of detail based on distance
  enableFrustumCulling: boolean; // Cull off-screen geometry
  enableMobileOptimizations: boolean;
  
  // Resolution-aware optimization
  adaptGeometryToResolution: (width: number, height: number) => GeometrySettings;
  optimizeForViewport: (viewport: ViewportInfo) => OptimizationSettings;
  
  // Fallback management
  shouldUseFallback: () => boolean;
  getFallbackGradient: (config: WaveConfiguration, theme: 'light' | 'dark') => string;
  
  // Methods
  measurePerformance: () => PerformanceMetrics;
  optimizeForDevice: (deviceInfo: DeviceInfo) => OptimizationSettings;
  enableFallbackMode: () => void;
}

interface ViewportInfo {
  width: number;
  height: number;
  aspectRatio: number;
  pixelDensity: number;
  isRetina: boolean;
}

interface GeometrySettings {
  segmentsX: number;            // Adjust geometry detail based on resolution
  segmentsY: number;
  renderScale: number;          // Render at lower resolution for performance
}

interface PerformanceMetrics {
  averageFPS: number;
  frameTimeMs: number;
  memoryUsageMB: number;
  gpuUtilization: number;
}

interface OptimizationSettings {
  geometryResolution: number;   // Lower resolution for mobile
  animationQuality: 'high' | 'medium' | 'low';
  effectsEnabled: boolean;
  antialiasing: boolean;
  renderScale: number;          // Render scale for performance
}
```

#### Database Integration
```typescript
// Prisma schema addition
model WaveConfiguration {
  id        String   @id @default(cuid())
  name      String
  isActive  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Wave Properties
  wavesX             Float
  wavesY             Float
  displacementHeight Float
  speedX             Float
  speedY             Float
  cylinderBend       Float
  
  // Light Theme Colors
  lightPrimaryColor String
  lightValleyColor  String
  lightPeakColor    String
  
  // Dark Theme Colors
  darkPrimaryColor String
  darkValleyColor  String
  darkPeakColor    String
  
  // Effects
  iridescenceWidth Float
  iridescenceSpeed Float
  flowMixAmount    Float
  
  // Camera
  cameraPosX Float
  cameraPosY Float
  cameraPosZ Float
  cameraRotX Float
  cameraRotY Float
  cameraZoom Float
  
  @@map("wave_configurations")
}

// API interface
interface WaveConfigAPI {
  "GET /api/wave-config": {
    purpose: "Get active wave configuration";
    response: "WaveConfiguration";
  };
  
  "POST /api/wave-config": {
    purpose: "Create new wave configuration";
    body: "WaveConfiguration";
    response: "WaveConfiguration";
  };
  
  "PUT /api/wave-config": {
    purpose: "Update existing wave configuration";
    body: "WaveConfiguration";
    response: "WaveConfiguration";
  };
  
  "GET /api/wave-config/presets": {
    purpose: "Get available wave presets";
    response: "WavePreset[]";
  };
}
```

### 4. Animation System

#### GSAP Timeline Architecture
```typescript
interface AnimationQueue {
  current: GSAPTimeline | null;
  queue: AnimationCommand[];
  isPlaying: boolean;
  
  add: (command: AnimationCommand) => void;
  play: () => void;
  pause: () => void;
  clear: () => void;
  interrupt: (override?: boolean) => void;
}

interface AnimationCommand {
  id: string;
  type: 'navigate' | 'highlight' | 'modal' | 'custom';
  target: string;
  duration: number;
  options: AnimationOptions;
  priority: 'normal' | 'high' | 'override';
}

interface AnimationOptions {
  easing?: string;
  delay?: number;
  onComplete?: () => void;
  onStart?: () => void;
  coordinated?: boolean;  // Execute with other animations
}
```

#### Core Animation Types

**Project Modal Transition (0.7s coordinated)**
```typescript
const projectModalAnimation = {
  // Simultaneous animations
  projectGrowth: gsap.to(projectCard, {
    duration: 0.7,
    scale: 1.2,
    zIndex: 100,
    ease: "power2.out"
  }),
  
  backgroundBlur: gsap.to(background, {
    duration: 0.7,
    backdropFilter: "blur(8px)",
    backgroundColor: "rgba(0,0,0,0.5)",
    ease: "power2.out"
  }),
  
  modalAppear: gsap.fromTo(modal, {
    opacity: 0,
    scale: 0.8
  }, {
    duration: 0.7,
    opacity: 1,
    scale: 1,
    ease: "power2.out"
  })
};
```

**Highlighting System**
```typescript
interface HighlightOptions {
  type: 'spotlight' | 'outline' | 'color' | 'glow';
  duration: 'persistent' | 'timed';
  timing?: number;  // For timed highlights
  intensity: 'subtle' | 'medium' | 'strong';
}

const highlightAnimations = {
  spotlight: (element: Element, options: HighlightOptions) => {
    return gsap.timeline()
      .to(element, {
        duration: 0.3,
        boxShadow: "0 0 0 4px rgba(99, 102, 241, 0.3)",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        ease: "power2.out"
      });
  },
  
  outline: (element: Element, options: HighlightOptions) => {
    return gsap.timeline()
      .to(element, {
        duration: 0.3,
        outline: "2px solid var(--accent)",
        outlineOffset: "4px",
        ease: "power2.out"
      });
  }
};
```

### 5. Navigation Hooks System

#### UI Control Hooks
```typescript
interface UIControlHooks {
  navigation: {
    scrollTo: (target: string, options?: ScrollOptions) => Promise<void>;
    navigateTo: (page: string, options?: NavigationOptions) => Promise<void>;
    openModal: (modalId: string, data?: any) => Promise<void>;
    closeModal: (modalId?: string) => Promise<void>;
  };
  
  highlighting: {
    highlight: (target: string, options: HighlightOptions) => Promise<void>;
    removeHighlight: (target?: string) => Promise<void>;
    clearAllHighlights: () => Promise<void>;
  };
  
  focus: {
    setFocus: (target: string) => Promise<void>;
    selectText: (target: string, range?: TextRange) => Promise<void>;
    scrollIntoView: (target: string, options?: ScrollIntoViewOptions) => Promise<void>;
  };
  
  state: {
    getUIState: () => UIState;
    setUIState: (state: Partial<UIState>) => Promise<void>;
    subscribeToChanges: (callback: (state: UIState) => void) => () => void;
  };
}
```

#### Command Processing Interface
```typescript
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

### 6. Custom Animation System

#### Plugin Architecture
```typescript
interface AnimationPlugin {
  name: string;
  version: string;
  animations: Record<string, AnimationDefinition>;
  register: () => void;
  unregister: () => void;
}

interface AnimationDefinition {
  name: string;
  duration: number;
  create: (target: Element, options: any) => GSAPTimeline;
  preview?: (target: Element) => GSAPTimeline;
  fallback?: (target: Element) => GSAPTimeline;
}

// Example: iPad-style grid animation
const iPadGridAnimation: AnimationDefinition = {
  name: 'ipad-grid-transition',
  duration: 0.7,
  create: (target: Element, options: { selectedIndex: number }) => {
    const timeline = gsap.timeline();
    const gridItems = target.querySelectorAll('.project-card');
    
    gridItems.forEach((item, index) => {
      if (index === options.selectedIndex) {
        // Selected item grows
        timeline.to(item, {
          duration: 0.7,
          scale: 1.2,
          zIndex: 100,
          ease: "power2.out"
        }, 0);
      } else {
        // Other items animate away
        const direction = index < options.selectedIndex ? -1 : 1;
        timeline.to(item, {
          duration: 0.7,
          x: direction * 200,
          opacity: 0,
          scale: 0.8,
          ease: "power2.out"
        }, 0);
      }
    });
    
    return timeline;
  }
};
```

### 7. Layout Management (Enhancing Existing Components)

#### Enhanced Layout Components
```typescript
// Enhance existing portfolio-projects components
interface EnhancedLayoutComponents {
  // Existing components with AI control hooks
  ProjectModal: React.ComponentType<ProjectModalProps & AIControlProps>;
  ProjectGrid: React.ComponentType<ProjectGridProps & AIControlProps>;
  NavigationBar: React.ComponentType<NavigationBarProps & AIControlProps>;
  
  // New AI-specific components
  AIInterface: React.ComponentType<AIInterfaceProps>;
  AINavigationOverlay: React.ComponentType<AINavigationOverlayProps>;
}

interface AIControlProps {
  // Hooks for AI system to control component
  onAINavigate?: (command: NavigationCommand) => void;
  onAIHighlight?: (target: string, options: HighlightOptions) => void;
  aiControlEnabled?: boolean;
}

interface LayoutManager {
  // Extend existing layout management
  currentLayout: string;
  layouts: Record<string, LayoutDefinition>;
  
  // Add AI control capabilities
  setLayout: (layoutId: string) => void;
  updateLayout: (updates: Partial<LayoutState>) => void;
  getLayoutState: () => LayoutState;
  
  // AI navigation hooks
  executeAICommand: (command: NavigationCommand) => Promise<void>;
  getAIControllableElements: () => AIControllableElement[];
}

interface LayoutState {
  // Existing layout state
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
  
  // New AI interface state
  aiInterface: {
    position: 'hero' | 'pinned';
    mode: 'pill' | 'expanded';
    visible: boolean;
    currentNarration: string | null;
  };
  
  // AI navigation state
  aiNavigation: {
    activeHighlights: Record<string, HighlightOptions>;
    navigationHistory: NavigationCommand[];
    isAnimating: boolean;
  };
}
```

## Data Models

### Theme Configuration
```typescript
interface ThemeConfig {
  id: string;
  name: string;
  type: 'light' | 'dark';
  tokens: ThemeTokens;
  customizations: {
    components: Record<string, ComponentTheme>;
    animations: AnimationTheme;
  };
}

interface ComponentTheme {
  variants: Record<string, CSSProperties>;
  defaultProps: Record<string, any>;
}
```

### Animation State
```typescript
interface AnimationState {
  queue: AnimationCommand[];
  current: {
    id: string;
    progress: number;
    timeline: GSAPTimeline;
  } | null;
  history: AnimationCommand[];
  settings: {
    globalDuration: number;
    globalEasing: string;
    respectReducedMotion: boolean;
  };
}
```

### UI State Management
```typescript
interface UIState {
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
```

## Error Handling

### Animation Error Recovery
```typescript
interface AnimationErrorHandler {
  onAnimationError: (error: Error, command: AnimationCommand) => void;
  onTimelineStall: (timeline: GSAPTimeline) => void;
  onPerformanceDrop: (fps: number) => void;
  
  fallbackStrategies: {
    skipAnimation: (command: AnimationCommand) => void;
    simplifyAnimation: (command: AnimationCommand) => AnimationCommand;
    disableAnimations: () => void;
  };
}
```

### Theme Error Handling
```typescript
interface ThemeErrorHandler {
  onThemeLoadError: (themeId: string, error: Error) => void;
  onTokenMissing: (tokenPath: string) => string;
  onContrastFailure: (colors: ColorPair) => ColorPair;
  
  fallbacks: {
    defaultTheme: ThemeConfig;
    safeColors: Record<string, string>;
    minimumContrast: number;
  };
}
```

### AI Integration Error Handling
```typescript
interface AIIntegrationErrorHandler {
  onCommandParseError: (command: string, error: Error) => void;
  onNavigationError: (target: string, error: Error) => void;
  onHighlightError: (target: string, error: Error) => void;
  
  recovery: {
    retryCommand: (command: NavigationCommand) => Promise<void>;
    fallbackNavigation: (target: string) => void;
    notifyAISystem: (error: Error, context: any) => void;
  };
}
```

## Testing Strategy

### Animation Testing
```typescript
interface AnimationTestSuite {
  performance: {
    measureFPS: (animation: GSAPTimeline) => Promise<number>;
    testMemoryLeaks: (animations: GSAPTimeline[]) => Promise<boolean>;
    validateDuration: (animation: GSAPTimeline, expected: number) => boolean;
  };
  
  visual: {
    screenshotComparison: (before: string, after: string) => Promise<boolean>;
    recordAnimation: (animation: GSAPTimeline) => Promise<VideoBlob>;
    validateTransitions: (states: UIState[]) => Promise<boolean>;
  };
  
  integration: {
    testAICommands: (commands: NavigationCommand[]) => Promise<TestResult[]>;
    testCrossBrowser: (animations: AnimationDefinition[]) => Promise<BrowserTestResult[]>;
    testResponsive: (breakpoints: number[]) => Promise<ResponsiveTestResult[]>;
  };
}
```

### Theme Testing
```typescript
interface ThemeTestSuite {
  accessibility: {
    validateContrast: (theme: ThemeConfig) => Promise<ContrastResult[]>;
    testScreenReader: (theme: ThemeConfig) => Promise<A11yResult>;
    validateFocusIndicators: (theme: ThemeConfig) => Promise<FocusResult[]>;
  };
  
  visual: {
    generateThemePreview: (theme: ThemeConfig) => Promise<ImageBlob>;
    compareThemes: (theme1: ThemeConfig, theme2: ThemeConfig) => Promise<ComparisonResult>;
    validateTokenUsage: (theme: ThemeConfig) => Promise<TokenUsageResult>;
  };
}
```

### Integration Testing
```typescript
interface IntegrationTestSuite {
  crossDomain: {
    testMediaManagement: () => Promise<TestResult>;
    testAISystem: () => Promise<TestResult>;
    testContentSystem: () => Promise<TestResult>;
  };
  
  performance: {
    measureBundleSize: () => Promise<BundleSizeResult>;
    testLoadTime: () => Promise<LoadTimeResult>;
    validateMemoryUsage: () => Promise<MemoryResult>;
  };
  
  userExperience: {
    testNavigationFlow: (flow: NavigationStep[]) => Promise<FlowResult>;
    validateResponsiveness: () => Promise<ResponsivenessResult>;
    testAccessibility: () => Promise<A11yResult>;
  };
}
```

## Performance Optimization

### Animation Performance
- **Hardware Acceleration**: Use transform and opacity for animations
- **Timeline Pooling**: Reuse GSAP timelines to reduce garbage collection
- **Batch Updates**: Group DOM updates to minimize reflows
- **Reduced Motion**: Respect user preferences and provide alternatives
- **Frame Rate Monitoring**: Automatically adjust animation complexity based on performance

### Bundle Optimization
- **Tree Shaking**: Only import used shadcn/ui components
- **Code Splitting**: Lazy load animation plugins and complex components
- **CSS Optimization**: Use CSS custom properties for theme switching
- **GSAP Optimization**: Import only required GSAP modules

### Memory Management
- **Timeline Cleanup**: Properly dispose of completed animations
- **Event Listener Management**: Clean up event listeners on component unmount
- **State Management**: Use efficient state updates and avoid unnecessary re-renders
- **Cache Management**: Implement LRU cache for theme tokens and animation definitions

## Migration Strategy from Portfolio-Projects

### Phase 1: Extract and Enhance Existing UI Components
1. **Move Theme System**: Extract theme logic from portfolio-projects to UI system
2. **Enhance shadcn/ui Components**: Add AI control hooks to existing components
3. **Centralize Layout Constants**: Move hardcoded values to centralized constants (portfolio-projects task 9.21)
4. **Add GSAP Foundation**: Install and configure GSAP alongside existing Framer Motion

### Phase 2: Add AI Navigation Layer
1. **Floating AI Interface**: Add new floating interface component
2. **Animation Queue System**: Implement GSAP timeline management
3. **UI Control Hooks**: Add programmatic control to existing components
4. **Navigation Command Processing**: Create command interpretation system

### Phase 3: Integration Testing
1. **Backward Compatibility**: Ensure all existing functionality continues to work
2. **Performance Testing**: Verify no regression in existing performance
3. **Theme Consistency**: Ensure enhanced themes work with all existing components
4. **AI Integration**: Test AI control of existing UI elements

### Existing Components to Enhance

**From portfolio-projects/src/components:**
```typescript
// Existing components that need AI control hooks
ProjectModal → Enhanced with AI navigation and highlighting
ProjectGrid → Enhanced with AI-controlled filtering and selection
NavigationBar → Enhanced with AI-controlled navigation
ProjectCard → Enhanced with AI highlighting and selection
AdminDashboard → Enhanced with AI-assisted content management

// Existing layout components to enhance
Layout components → Add AI interface integration
Theme components → Enhance with animation coordination
Form components → Add AI-assisted input capabilities
```

**Existing Files to Modify:**
- `src/components/ui/` - Enhance shadcn/ui components with AI hooks
- `src/lib/constants/layout.ts` - Centralize layout constants (from task 9.21)
- `src/styles/globals.css` - Add GSAP and AI interface styles
- `src/providers/theme-provider.tsx` - Enhance with AI coordination

**New Files to Add:**
- `src/components/ai/floating-interface.tsx` - New floating AI interface
- `src/lib/animations/gsap-manager.ts` - GSAP animation orchestration
- `src/lib/ui/navigation-hooks.ts` - AI navigation control hooks
- `src/lib/ui/animation-queue.ts` - Animation queue management

## SSR and SEO Coordination

### UI System's Role in SEO (Coordinates with Portfolio-Projects)

The UI System must support the SSR approach defined in portfolio-projects:

**SSR-Compatible Components:**
```typescript
// Components must work with SSR initial render
interface SSRCompatibleComponent {
  // Render with server-side data
  initialData?: any;
  // Hydrate with client-side features after load
  enableClientFeatures?: boolean;
  // AI features only activate after hydration
  aiEnabled?: boolean;
}

// Example: ProjectGrid with SSR support
interface ProjectGridProps extends SSRCompatibleComponent {
  projects: Project[]; // SSR data
  enableFiltering?: boolean; // Client-side only
  enableAINavigation?: boolean; // Client-side only
}
```

**Progressive Enhancement Strategy:**
1. **SSR First**: Components render with server data, no AI features
2. **Hydration**: Client-side features activate (filtering, search, AI)
3. **AI Activation**: Floating interface appears after full hydration

**SEO-Friendly AI Interface:**
- Floating AI interface hidden during SSR
- AI navigation respects URL structure for SEO
- AI-triggered navigation updates URLs properly
- Meta tags and structured data preserved during AI navigation

**Coordination with Portfolio-Projects:**
- UI System provides SSR-compatible component variants
- Portfolio-Projects handles SSR data fetching and routing
- UI System enhances with client-side features post-hydration
- Both systems coordinate on URL structure and meta tag management

## External API Dependencies

### Required from Portfolio-Projects System
```typescript
interface RequiredPortfolioAPIs {
  "GET /api/projects": {
    provider: "portfolio-projects";
    version: "1.0.0";
    purpose: "Get project data for AI navigation and highlighting";
    requiredFields: ["id", "title", "slug", "tags"];
    usage: "AI system needs project data to generate navigation commands";
  };
  
  "GET /api/projects/[slug]": {
    provider: "portfolio-projects";
    version: "1.0.0";
    purpose: "Get individual project data for modal display";
    requiredFields: ["id", "title", "content", "mediaItems"];
    usage: "Display project details in AI-controlled modals";
  };
  
  auth: {
    provider: "portfolio-projects";
    version: "1.0.0";
    purpose: "User session management for admin features";
    implementation: "NextAuth session validation";
    usage: "Protect admin UI features and theme customization";
  };
}
```

### Required from Media Management System
```typescript
interface RequiredMediaAPIs {
  components: {
    MediaPickerModal: "Media selection interface for theme customization";
    ImageOptimizer: "Optimized image display for theme previews";
  };
  
  hooks: {
    useMediaUpload: "Upload custom theme assets and backgrounds";
    useImageOptimization: "Optimize theme-related images";
  };
}
```

### Required Database Schema Extensions
```typescript
interface RequiredDatabaseSchema {
  // Extend existing homepage settings with wave configuration
  HomepageSettings: {
    provider: "portfolio-projects";
    purpose: "Extend existing homepage settings to include wave background configuration";
    additionalFields: {
      waveConfig: "Json?"; // Optional JSON field for complete wave configuration
    };
    usage: "Store wave background configuration as part of existing homepage settings";
  };
}

// Wave configuration stored as JSON in homepage settings
interface WaveConfigurationJSON {
  // Wave Properties
  wavesX: number;              // 0.5 - 10.0
  wavesY: number;              // 0.5 - 10.0
  displacementHeight: number;  // 0.0 - 2.0
  speedX: number;              // 0.0 - 0.005
  speedY: number;              // 0.0 - 0.005
  cylinderBend: number;        // 0.0 - 1.0
  
  // Theme-Specific Colors
  lightTheme: {
    primaryColor: string;
    valleyColor: string;
    peakColor: string;
  };
  darkTheme: {
    primaryColor: string;
    valleyColor: string;
    peakColor: string;
  };
  
  // Effects
  iridescenceWidth: number;    // 1.0 - 50.0
  iridescenceSpeed: number;    // 0.0 - 0.01
  flowMixAmount: number;       // 0.0 - 1.0
  
  // Resolution-Independent Camera Configuration
  camera: {
    // Normalized position (-1 to 1, aspect-ratio independent)
    normalizedPosition: { x: number; y: number; z: number };
    normalizedRotation: { x: number; y: number };
    fieldOfView: number;       // 30-90 degrees
    
    // Reference resolution (admin preview size)
    referenceResolution: { width: number; height: number };
    
    // Adaptation settings
    maintainVerticalFOV: boolean;
    compensateAspectRatio: boolean;
    scaleWithScreenSize: boolean;
  };
  
  // Metadata
  enabled: boolean;            // Enable/disable wave background
  preset?: string;             // Applied preset name
  lastModified: string;        // ISO timestamp
}
```

## Provided APIs

### UI System APIs
```typescript
interface ProvidedAPIs {
  // Theme System APIs
  "GET /api/ui/themes": {
    version: "1.0.0";
    consumers: ["portfolio-projects", "ai-system", "rich-content-system"];
    purpose: "Get available themes and current theme state";
    response: "ThemeConfig[]";
    changelog: {
      "1.0.0": "Initial theme system with light/dark modes";
    };
  };
  
  "POST /api/ui/themes/switch": {
    version: "1.0.0";
    consumers: ["ai-system"];
    purpose: "Programmatically switch themes via AI commands";
    requestBody: {
      theme: "light | dark";
      animate: "boolean";
    };
    response: "ThemeSwitchResult";
  };
  
  // Animation Control APIs
  "POST /api/ui/animate": {
    version: "1.0.0";
    consumers: ["ai-system"];
    purpose: "Execute coordinated animations via AI commands";
    requestBody: {
      command: "NavigationCommand";
      options: "AnimationOptions";
    };
    response: "AnimationResult";
  };
  
  // Wave Background Configuration APIs (integrated with homepage settings)
  "GET /api/homepage-settings": {
    version: "1.1.0";
    consumers: ["portfolio-projects"];
    purpose: "Get homepage settings including wave background configuration";
    response: "HomepageSettings & { waveConfig?: WaveConfigurationJSON }";
    changelog: {
      "1.0.0": "Initial homepage settings";
      "1.1.0": "Added wave background configuration support";
    };
  };
  
  "PUT /api/homepage-settings": {
    version: "1.1.0";
    consumers: ["admin-system"];
    purpose: "Update homepage settings including wave background configuration";
    requestBody: {
      settings: "Partial<HomepageSettings>";
      waveConfig?: "WaveConfigurationJSON";
    };
    response: "HomepageSettings";
  };
  
  "GET /api/wave-config/presets": {
    version: "1.0.0";
    consumers: ["admin-system"];
    purpose: "Get available wave background presets for configuration UI";
    response: "WavePreset[]";
  };
}
```

## Provided Components

### React Components
```typescript
interface ProvidedComponents {
  // Enhanced Base Components
  Button: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "media-management-system", "ai-system", "rich-content-system"];
    location: "src/components/ui/button.tsx";
    purpose: "Enhanced shadcn/ui button with AI control hooks and theme coordination";
    props: {
      variant: "default | destructive | outline | secondary | ghost | link";
      size: "default | sm | lg | icon";
      aiControllable?: "boolean";
      onAIInteraction?: "(command: NavigationCommand) => void";
    };
    dependencies: ["Theme System"];
  };
  
  Modal: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "media-management-system", "rich-content-system"];
    location: "src/components/ui/modal.tsx";
    purpose: "Enhanced modal with GSAP animations and AI control";
    props: {
      isOpen: "boolean";
      onClose: "() => void";
      animationType?: "fade | slide | scale";
      aiControllable?: "boolean";
    };
    dependencies: ["Animation System", "Theme System"];
  };
  
  Card: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "media-management-system", "ai-system"];
    location: "src/components/ui/card.tsx";
    purpose: "Enhanced card component with highlighting and AI interaction";
    props: {
      variant: "default | outlined | elevated";
      highlightable?: "boolean";
      onAIHighlight?: "(options: HighlightOptions) => void";
    };
    dependencies: ["Theme System", "Animation System"];
  };
  
  // AI-Specific Components
  FloatingAIInterface: {
    version: "1.0.0";
    consumers: ["ai-system"];
    location: "src/components/ai/floating-interface.tsx";
    purpose: "Pill-shaped floating AI interface with position transitions";
    props: {
      position: "hero | pinned";
      mode: "pill | expanded";
      onInteraction: "() => void";
      currentNarration?: "string";
    };
    dependencies: ["Animation System", "Theme System"];
  };
  
  NavigationOverlay: {
    version: "1.0.0";
    consumers: ["ai-system"];
    location: "src/components/ai/navigation-overlay.tsx";
    purpose: "Overlay for AI-controlled highlighting and navigation";
    props: {
      activeHighlights: "Record<string, HighlightOptions>";
      onUserInteraction: "(action: UserAction) => void";
    };
    dependencies: ["Animation System"];
  };
  
  // 3D Wave Background Components
  WaveBackground: {
    version: "1.0.0";
    consumers: ["portfolio-projects"];
    location: "src/components/wave/wave-background.tsx";
    purpose: "3D wave background for hero section with theme-aware colors";
    props: {
      className?: "string";
      fallbackConfig?: "Partial<WaveConfiguration>";
      onError?: "(error: Error) => void";
    };
    dependencies: ["Theme System", "Wave Engine"];
  };
  
  WaveEngine: {
    version: "1.0.0";
    consumers: ["WaveBackground", "WaveConfigPanel"];
    location: "src/components/wave/wave-engine.tsx";
    purpose: "Core Three.js wave rendering engine with configurable parameters";
    props: {
      config: "WaveConfiguration";
      theme: "light | dark";
      width?: "number";
      height?: "number";
      interactive?: "boolean";
    };
    dependencies: ["Three.js"];
  };
  
  WaveConfigSection: {
    version: "1.0.0";
    consumers: ["admin-system"];
    location: "src/components/wave/wave-config-section.tsx";
    purpose: "Wave configuration section for existing homepage settings page with real-time preview";
    props: {
      waveConfig?: "WaveConfigurationJSON";
      onConfigChange: "(config: WaveConfigurationJSON) => void";
      presets?: "WavePreset[]";
      isPreviewMode?: "boolean";
    };
    dependencies: ["Wave Engine", "Theme System", "Homepage Settings"];
  };
}
```

### React Hooks
```typescript
interface ProvidedHooks {
  useTheme: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "media-management-system", "ai-system", "rich-content-system"];
    location: "src/hooks/use-theme.ts";
    purpose: "Theme management with AI coordination";
    returns: {
      theme: "light | dark";
      switchTheme: "(theme: string, animate?: boolean) => void";
      isAnimating: "boolean";
    };
  };
  
  useUIControl: {
    version: "1.0.0";
    consumers: ["ai-system"];
    location: "src/hooks/use-ui-control.ts";
    purpose: "Programmatic UI control for AI navigation";
    returns: {
      navigate: "(command: NavigationCommand) => Promise<void>";
      highlight: "(target: string, options: HighlightOptions) => Promise<void>";
      getUIState: "() => UIState";
    };
  };
  
  useAnimation: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "media-management-system", "rich-content-system"];
    location: "src/hooks/use-animation.ts";
    purpose: "GSAP animation management with queue system";
    returns: {
      animate: "(target: Element, options: AnimationOptions) => Promise<void>";
      isAnimating: "boolean";
      queue: "AnimationCommand[]";
    };
  };
  
  useResponsive: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "media-management-system", "ai-system", "rich-content-system"];
    location: "src/hooks/use-responsive.ts";
    purpose: "Desktop-first responsive design utilities";
    returns: {
      breakpoint: "desktop | tablet | mobile";
      isMobile: "boolean";
      isDesktop: "boolean";
    };
  };
  
  // Wave Background Hooks
  useWaveConfig: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "admin-system"];
    location: "src/hooks/use-wave-config.ts";
    purpose: "Wave background configuration management integrated with homepage settings";
    returns: {
      waveConfig: "WaveConfigurationJSON | null";
      loading: "boolean";
      error: "string | null";
      updateWaveConfig: "(config: WaveConfigurationJSON) => Promise<void>";
      loadFromHomepageSettings: "() => Promise<void>";
      applyPreset: "(presetName: string) => void";
    };
  };
  
  useWaveEngine: {
    version: "1.0.0";
    consumers: ["WaveBackground", "WaveConfigPanel"];
    location: "src/hooks/use-wave-engine.ts";
    purpose: "Three.js wave engine lifecycle management with performance monitoring";
    returns: {
      engineRef: "React.RefObject<WaveEngine>";
      isInitialized: "boolean";
      performance: "PerformanceMetrics";
      updateConfig: "(config: WaveConfiguration) => void";
      updateTheme: "(theme: 'light' | 'dark') => void";
    };
  };
}
```

### Design System
```typescript
interface ProvidedDesignSystem {
  designTokens: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "media-management-system", "ai-system", "rich-content-system"];
    location: "src/lib/design-tokens.ts";
    purpose: "Centralized design tokens for consistent styling";
    exports: {
      colors: "ColorPalette";
      spacing: "SpacingScale";
      typography: "TypographyScale";
      animations: "AnimationTokens";
    };
  };
  
  layoutConstants: {
    version: "1.0.0";
    consumers: ["portfolio-projects", "media-management-system", "ai-system", "rich-content-system"];
    location: "src/lib/constants/layout.ts";
    purpose: "Centralized layout constants (extracted from portfolio-projects task 9.21)";
    exports: {
      maxWidths: "MaxWidthPresets";
      spacing: "SpacingConstants";
      breakpoints: "BreakpointConstants";
    };
  };
}
```

This design provides a comprehensive foundation for the AI-guided portfolio navigation system while maintaining full backward compatibility with the existing portfolio-projects system, supporting SSR for SEO, and ensuring optimal performance across all devices.