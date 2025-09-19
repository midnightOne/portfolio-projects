"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface WaveConfiguration {
  id: string;
  name: string;
  isActive: boolean;
  
  // Wave Properties
  wavesX: number;              // 0.5 - 10.0 (wave frequency on X axis)
  wavesY: number;              // 0.5 - 10.0 (wave frequency on Y axis)
  displacementHeight: number;  // 0.0 - 2.0 (wave amplitude)
  speedX: number;              // 0.0 - 0.005 (animation speed X)
  speedY: number;              // 0.0 - 0.005 (animation speed Y)
  cylinderBend: number;        // 0.0 - 1.0 (tunnel effect intensity)
  
  // Theme-Specific Colors
  lightTheme: WaveColorScheme;
  darkTheme: WaveColorScheme;
  
  // Effects
  iridescenceWidth: number;    // 1.0 - 50.0 (shimmer effect width)
  iridescenceSpeed: number;    // 0.0 - 0.01 (shimmer animation speed)
  flowMixAmount: number;       // 0.0 - 1.0 (flow texture blend)
  revealAnimationSpeed: number; // 0.5 - 10.0 (reveal animation duration in seconds)
  
  // Camera Configuration (normalized for resolution independence)
  cameraPosition: { x: number; y: number; z: number };
  cameraRotation: { x: number; y: number; z: number };
  cameraZoom: number;
  cameraTarget: { x: number; y: number; z: number };
}

export interface WaveColorScheme {
  primaryColor: string;        // Main wave color
  valleyColor: string;         // Low points color
  peakColor: string;           // High points color
}

export interface WaveEngineProps {
  config: WaveConfiguration;
  theme: 'light' | 'dark';
  width?: number;
  height?: number;
  className?: string;
  interactive?: boolean;
  onError?: (error: Error) => void;
  onPerformanceChange?: (fps: number) => void;
  onCameraChange?: (cameraConfig: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    zoom: number;
    target: { x: number; y: number; z: number };
  }) => void;
}

interface WaveShaderUniforms {
  [uniform: string]: THREE.IUniform<any>;
  u_time: { value: number };
  u_constantTime: { value: number };
  u_resolution: { value: THREE.Vector2 };
  u_wavesX: { value: number };
  u_wavesY: { value: number };
  u_amplitude: { value: number };
  u_speedX: { value: number };
  u_speedY: { value: number };
  u_cylinderBend: { value: number };
  u_primaryColor: { value: THREE.Color };
  u_valleyColor: { value: THREE.Color };
  u_peakColor: { value: THREE.Color };
  u_iridescenceWidth: { value: number };
  u_iridescenceSpeed: { value: number };
  u_flowMixAmount: { value: number };
  u_flowPeakColor: { value: THREE.Color };
  u_flowValleyColor: { value: THREE.Color };
  u_flowPeakSpeed: { value: number };
  u_flowValleySpeed: { value: number };
  u_revealProgress: { value: number }; // 0.0 to 1.0 for circular reveal animation
  u_backgroundColor: { value: THREE.Color }; // Background color for non-transparent areas
}

// ============================================================================
// SHADER DEFINITIONS
// ============================================================================

const waveVertexShader = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vTime;
  varying float vConstantTime;
  varying float vDisplaceNoise;
  
  uniform float u_wavesX;
  uniform float u_wavesY;
  uniform float u_amplitude;
  uniform float u_time;
  uniform float u_constantTime;
  uniform float u_speedX;
  uniform float u_speedY;
  uniform float u_cylinderBend;
  uniform vec3 u_primaryColor;
  uniform vec3 u_valleyColor;
  uniform vec3 u_peakColor;

  vec3 permute(vec3 x) {
    return mod(((x*34.0)+1.0)*x, 289.0);
  }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float remap(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  void main() {
    vUv = uv;
    
    vec2 waveUv = vec2(
      (uv.x + u_time * u_speedX) * u_wavesX, 
      (uv.y + u_time * u_speedY) * u_wavesY
    );
    
    float noiseValue = snoise(waveUv);
    
    vec3 transformed = position;
    transformed += normalize(normal) * noiseValue * u_amplitude;
    
    // Apply cylinder bending
    if (u_cylinderBend > 0.0) {
      float radius = 2.0 / max(u_cylinderBend, 0.001);
      float angle = transformed.x / radius;
      
      float newX = radius * sin(angle);
      float newZ = radius * (cos(angle) - 1.0) + transformed.z;
      
      transformed.x = newX;
      transformed.z = newZ;
    }
    
    float remapedNoise = remap(noiseValue, -1.0, 1.0, 0.0, 1.0);
    vColor = u_primaryColor;
    vColor = mix(u_peakColor, vColor, smoothstep(0.0, 0.5, remapedNoise));
    vColor = mix(vColor, u_valleyColor, smoothstep(0.5, 1.0, remapedNoise));
    
    vTime = u_time;
    vConstantTime = u_constantTime;
    vDisplaceNoise = noiseValue;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const waveFragmentShader = `
  varying vec3 vColor;
  varying vec2 vUv;
  varying float vTime;
  varying float vConstantTime;
  varying float vDisplaceNoise;
  
  uniform float u_iridescenceWidth;
  uniform float u_iridescenceSpeed;
  uniform float u_flowMixAmount;
  uniform vec3 u_flowPeakColor;
  uniform vec3 u_flowValleyColor;
  uniform float u_flowPeakSpeed;
  uniform float u_flowValleySpeed;
  uniform float u_revealProgress;
  uniform vec3 u_backgroundColor;

  void main() {
    vec3 color = vColor;
    
    // Calculate wave effects
    float iridescence = sin(vUv.x * u_iridescenceWidth + vTime * u_iridescenceSpeed);
    iridescence = pow(abs(iridescence), 2.0);
    
    vec3 flowPeak = u_flowPeakColor * sin(vTime * u_flowPeakSpeed + vUv.x * 10.0);
    vec3 flowValley = u_flowValleyColor * cos(vTime * u_flowValleySpeed + vUv.y * 8.0);
    
    color = mix(color, flowPeak, u_flowMixAmount * 0.3);
    color = mix(color, flowValley, u_flowMixAmount * 0.2);
    color = mix(color, vec3(0.5, 0.8, 1.0), iridescence * 0.2);
    
    // Circular reveal mask - transparency only
    vec2 center = vec2(0.5, 0.5);
    float distanceFromCenter = distance(vUv, center);
    
    // Maximum distance from center to corner (for full coverage)
    float maxDistance = distance(center, vec2(0.0, 0.0));
    
    // Create smooth circular reveal with soft edges
    float revealRadius = u_revealProgress * maxDistance * 1.2; // 1.2 for slight overshoot
    float revealMask = smoothstep(revealRadius - 0.1, revealRadius + 0.05, distanceFromCenter);
    
    // Use only transparency for clean reveal effect
    float alpha = 1.0 - revealMask;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const defaultWaveConfig: WaveConfiguration = {
  id: 'default',
  name: 'Default Wave',
  isActive: true,
  wavesX: 2.0,
  wavesY: 1.5,
  displacementHeight: 0.8,
  speedX: 0.002,
  speedY: 0.001,
  cylinderBend: 0.3,
  lightTheme: {
    primaryColor: '#6366f1',    // Indigo
    valleyColor: '#e0e7ff',     // Light indigo
    peakColor: '#a855f7',       // Purple
  },
  darkTheme: {
    primaryColor: '#4f46e5',    // Darker indigo
    valleyColor: '#1e1b4b',     // Dark indigo
    peakColor: '#7c3aed',       // Darker purple
  },
  iridescenceWidth: 20.0,
  iridescenceSpeed: 0.005,
  flowMixAmount: 0.4,
  cameraPosition: { x: 0, y: 0, z: 5 },
  cameraRotation: { x: 0, y: 0, z: 0 },
  cameraZoom: 1.0,
  cameraTarget: { x: 0, y: 0, z: 0 }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function calculateOptimalGeometry(width: number, height: number): { segmentsX: number; segmentsY: number } {
  // Calculate geometry resolution based on viewport size
  const pixelDensity = Math.min(window.devicePixelRatio || 1, 2);
  const baseSegments = Math.min(width, height) / 20;
  
  return {
    segmentsX: Math.max(32, Math.min(128, Math.floor(baseSegments * pixelDensity))),
    segmentsY: Math.max(24, Math.min(96, Math.floor(baseSegments * 0.75 * pixelDensity)))
  };
}

function adaptCameraForResolution(
  config: WaveConfiguration,
  width: number,
  height: number
): { position: THREE.Vector3; rotation: THREE.Euler; fov: number; target: THREE.Vector3 } {
  const aspectRatio = width / height;
  const referenceAspect = 16 / 9; // Reference aspect ratio
  const aspectCompensation = referenceAspect / aspectRatio;
  
  return {
    position: new THREE.Vector3(
      config.cameraPosition.x * aspectCompensation,
      config.cameraPosition.y,
      config.cameraPosition.z * config.cameraZoom
    ),
    rotation: new THREE.Euler(
      config.cameraRotation.x * Math.PI / 180,
      config.cameraRotation.y * Math.PI / 180,
      config.cameraRotation.z * Math.PI / 180
    ),
    fov: Math.max(30, Math.min(90, 75 / config.cameraZoom)),
    target: new THREE.Vector3(
      config.cameraTarget.x * aspectCompensation,
      config.cameraTarget.y,
      config.cameraTarget.z
    )
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WaveEngine({
  config,
  theme,
  width = 800,
  height = 600,
  className,
  interactive = false,
  onError,
  onPerformanceChange,
  onCameraChange
}: WaveEngineProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // Track our canvas separately
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const uniformsRef = useRef<WaveShaderUniforms | null>(null);
  const dimensionsRef = useRef({ width, height });
  const isInitializedRef = useRef(false);
  const revealStartTimeRef = useRef<number | null>(null);
  const isRevealingRef = useRef(false);
  
  // Focus tracking to exclude unfocused time from animation
  const focusOffTimeRef = useRef<number>(0); // Total time spent unfocused since start
  const lastFocusOffTimeRef = useRef<number | null>(null); // When focus was lost
  
  // Update dimensions ref when props change
  dimensionsRef.current = { width, height };
  
  // Performance monitoring
  const [fps, setFps] = useState<number>(60);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(Date.now());

  // Interactive camera controls (matching original structure)
  const cameraStateRef = useRef({
    isMouseDown: false,
    isPanning: false,
    lastMouseX: 0,
    lastMouseY: 0,
    rotationX: 0.3,
    rotationY: 0,
    zoom: 6,
    panX: 0,
    panY: 0
  });

  const notifyCameraChangeThrottled = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // FOCUS TRACKING FUNCTIONS
  // ============================================================================

  const handleVisibilityChange = useCallback(() => {
    const now = Date.now();
    
    if (document.hidden) {
      // Browser lost focus - start tracking unfocused time
      lastFocusOffTimeRef.current = now;
    } else {
      // Browser gained focus - add unfocused time to total
      if (lastFocusOffTimeRef.current !== null) {
        const unfocusedDuration = now - lastFocusOffTimeRef.current;
        focusOffTimeRef.current += unfocusedDuration;
        lastFocusOffTimeRef.current = null;
        
        console.log(`Focus restored. Unfocused for ${unfocusedDuration}ms. Total unfocused time: ${focusOffTimeRef.current}ms`);
      }
    }
  }, []);

  // ============================================================================
  // CAMERA CONTROL FUNCTIONS
  // ============================================================================

  const initializeCameraState = useCallback(() => {
    // Initialize from config but keep the original structure
    cameraStateRef.current.rotationX = config.cameraRotation.x * Math.PI / 180;
    cameraStateRef.current.rotationY = config.cameraRotation.y * Math.PI / 180;
    cameraStateRef.current.zoom = config.cameraZoom * 6; // Scale to match original range
    cameraStateRef.current.panX = config.cameraTarget.x;
    cameraStateRef.current.panY = config.cameraTarget.y;
  }, [config]);

  const updateCameraFromState = useCallback(() => {
    if (!cameraRef.current) return;
    
    const camera = cameraRef.current;
    const state = cameraStateRef.current;
    
    // Use original camera positioning logic
    const radius = state.zoom;
    camera.position.x = state.panX + radius * Math.sin(state.rotationY) * Math.cos(state.rotationX);
    camera.position.y = state.panY + radius * Math.sin(state.rotationX);
    camera.position.z = radius * Math.cos(state.rotationY) * Math.cos(state.rotationX);
    camera.lookAt(state.panX, state.panY, 0);
  }, []);

  const notifyCameraChange = useCallback(() => {
    if (!onCameraChange) return;
    
    // Throttle camera change notifications to avoid too many updates
    if (notifyCameraChangeThrottled.current) {
      clearTimeout(notifyCameraChangeThrottled.current);
    }
    
    notifyCameraChangeThrottled.current = setTimeout(() => {
      const state = cameraStateRef.current;
      const camera = cameraRef.current;
      
      if (camera) {
        onCameraChange({
          position: { 
            x: camera.position.x,
            y: camera.position.y, 
            z: camera.position.z
          },
          rotation: { 
            x: state.rotationX * 180 / Math.PI,
            y: state.rotationY * 180 / Math.PI,
            z: 0
          },
          zoom: state.zoom / 6, // Scale back to config range
          target: { x: state.panX, y: state.panY, z: 0 }
        });
      }
    }, 50);
  }, [onCameraChange]);

  // ============================================================================
  // MOUSE EVENT HANDLERS
  // ============================================================================

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!interactive) return;
    
    event.preventDefault();
    cameraStateRef.current.isMouseDown = true;
    cameraStateRef.current.isPanning = event.button === 1; // Middle mouse button for panning
    cameraStateRef.current.lastMouseX = event.clientX;
    cameraStateRef.current.lastMouseY = event.clientY;
  }, [interactive]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!interactive || !cameraStateRef.current.isMouseDown) return;
    
    event.preventDefault();
    
    const deltaX = event.clientX - cameraStateRef.current.lastMouseX;
    const deltaY = event.clientY - cameraStateRef.current.lastMouseY;
    
    if (cameraStateRef.current.isPanning) {
      cameraStateRef.current.panX += deltaX * 0.01;
      cameraStateRef.current.panY -= deltaY * 0.01;
    } else {
      cameraStateRef.current.rotationY += deltaX * 0.01;
      cameraStateRef.current.rotationX += deltaY * 0.01;
      cameraStateRef.current.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraStateRef.current.rotationX));
    }
    
    // Update camera position using original logic
    if (cameraRef.current) {
      const radius = cameraStateRef.current.zoom;
      cameraRef.current.position.x = cameraStateRef.current.panX + radius * Math.sin(cameraStateRef.current.rotationY) * Math.cos(cameraStateRef.current.rotationX);
      cameraRef.current.position.y = cameraStateRef.current.panY + radius * Math.sin(cameraStateRef.current.rotationX);
      cameraRef.current.position.z = radius * Math.cos(cameraStateRef.current.rotationY) * Math.cos(cameraStateRef.current.rotationX);
      cameraRef.current.lookAt(cameraStateRef.current.panX, cameraStateRef.current.panY, 0);
    }
    
    cameraStateRef.current.lastMouseX = event.clientX;
    cameraStateRef.current.lastMouseY = event.clientY;
    
    notifyCameraChange();
  }, [interactive, notifyCameraChange]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!interactive) return;
    
    event.preventDefault();
    cameraStateRef.current.isMouseDown = false;
    cameraStateRef.current.isPanning = false;
  }, [interactive]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!interactive) return;
    
    event.preventDefault();
    
    cameraStateRef.current.zoom += event.deltaY * 0.01;
    cameraStateRef.current.zoom = Math.max(1, Math.min(20, cameraStateRef.current.zoom));
    
    // Update camera position using original logic
    if (cameraRef.current) {
      const radius = cameraStateRef.current.zoom;
      cameraRef.current.position.x = cameraStateRef.current.panX + radius * Math.sin(cameraStateRef.current.rotationY) * Math.cos(cameraStateRef.current.rotationX);
      cameraRef.current.position.y = cameraStateRef.current.panY + radius * Math.sin(cameraStateRef.current.rotationX);
      cameraRef.current.position.z = radius * Math.cos(cameraStateRef.current.rotationY) * Math.cos(cameraStateRef.current.rotationX);
      cameraRef.current.lookAt(cameraStateRef.current.panX, cameraStateRef.current.panY, 0);
    }
    
    notifyCameraChange();
  }, [interactive, notifyCameraChange]);

  const handleDoubleClick = useCallback(() => {
    if (!interactive) return;
    
    cameraStateRef.current.rotationX = 0.3;
    cameraStateRef.current.rotationY = 0;
    cameraStateRef.current.zoom = 6;
    cameraStateRef.current.panX = 0;
    cameraStateRef.current.panY = 0;
    
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 3, 5);
      cameraRef.current.lookAt(0, 0, 0);
    }
    
    notifyCameraChange();
  }, [interactive, notifyCameraChange]);

  // ============================================================================
  // WAVE MESH SETUP
  // ============================================================================

  const setupWaveMesh = useCallback(() => {
    if (!sceneRef.current || !rendererRef.current || meshRef.current) return; // Prevent multiple setups

    const { width: currentWidth, height: currentHeight } = dimensionsRef.current;

    try {
      console.log('Setting up wave mesh with config...');
      
      // Geometry matching original (4x4 with 256x256 segments for high detail)
      const planeGeometry = new THREE.PlaneGeometry(4, 4, 256, 256);

      // Shader uniforms
      const colorScheme = theme === 'dark' ? config.darkTheme : config.lightTheme;
      const uniforms: WaveShaderUniforms = {
        u_time: { value: 0 },
        u_constantTime: { value: 0 },
        u_resolution: { value: new THREE.Vector2(currentWidth, currentHeight) },
        u_wavesX: { value: config.wavesX },
        u_wavesY: { value: config.wavesY },
        u_amplitude: { value: config.displacementHeight },
        u_speedX: { value: config.speedX },
        u_speedY: { value: config.speedY },
        u_cylinderBend: { value: config.cylinderBend },
        u_primaryColor: { value: hexToThreeColor(colorScheme.primaryColor) },
        u_valleyColor: { value: hexToThreeColor(colorScheme.valleyColor) },
        u_peakColor: { value: hexToThreeColor(colorScheme.peakColor) },
        u_iridescenceWidth: { value: config.iridescenceWidth },
        u_iridescenceSpeed: { value: config.iridescenceSpeed },
        u_flowMixAmount: { value: config.flowMixAmount },
        u_flowPeakColor: { value: new THREE.Color(0x06b6d4) },
        u_flowValleyColor: { value: new THREE.Color(0xf59e0b) },
        u_flowPeakSpeed: { value: 0.0008 },
        u_flowValleySpeed: { value: 0.0006 },
        u_revealProgress: { value: 0.0 }, // Start with no reveal
        u_backgroundColor: { value: theme === 'dark' ? new THREE.Color(0x0a0a0a) : new THREE.Color(0xffffff) }
      };
      uniformsRef.current = uniforms;

      // Shader material
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: waveVertexShader,
        fragmentShader: waveFragmentShader,
        transparent: true,
        side: THREE.DoubleSide
      });

      // Mesh (rotate to match original orientation)
      const mesh = new THREE.Mesh(planeGeometry, material);
      mesh.rotateX(-Math.PI / 2); // Rotate to horizontal plane
      sceneRef.current.add(mesh);
      meshRef.current = mesh;

      // Lighting (matching original)
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      sceneRef.current.add(ambientLight);

      const pointLight1 = new THREE.PointLight(0xffffff, 1, 20);
      pointLight1.position.set(0, 2, 0);
      sceneRef.current.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0x6366f1, 0.8, 20);
      pointLight2.position.set(2, 2, 0);
      sceneRef.current.add(pointLight2);

      const pointLight3 = new THREE.PointLight(0xa855f7, 0.6, 20);
      pointLight3.position.set(-2, 2, 0);
      sceneRef.current.add(pointLight3);

      sceneRef.current.fog = new THREE.Fog(0x000000, 1, 15);

      // Initialize camera state and position
      initializeCameraState();
      updateCameraFromState();

      console.log('Wave mesh setup completed');
      
      // Start the reveal animation
      startRevealAnimation();
    } catch (error) {
      console.error('Error setting up wave mesh:', error);
      onError?.(error as Error);
    }
  }, [config, theme, width, height, onError, initializeCameraState, updateCameraFromState]);

  // ============================================================================
  // REVEAL ANIMATION
  // ============================================================================

  const startRevealAnimation = useCallback(() => {
    if (!rendererRef.current) return;
    
    console.log('Starting reveal animation...');
    revealStartTimeRef.current = Date.now();
    isRevealingRef.current = true;
    
    // Make canvas visible and start the reveal
    const canvas = rendererRef.current.domElement;
    canvas.style.visibility = 'visible';
    canvas.style.opacity = '1';
    canvas.style.transition = 'opacity 0.2s ease-in-out';
  }, []);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeThreeJS = useCallback(() => {
    // Prevent initialization if component is unmounted or already initialized
    if (!mountRef.current || rendererRef.current || isInitializedRef.current) return;
    
    // Additional safety check - ensure mount ref is still connected to DOM
    if (!mountRef.current.isConnected) {
      console.warn('Mount ref is not connected to DOM, skipping Three.js initialization');
      return;
    }

    const { width: currentWidth, height: currentHeight } = dimensionsRef.current;
    if (currentWidth <= 0 || currentHeight <= 0) return;

    try {
      console.log('Initializing Three.js scene...');
      isInitializedRef.current = true;
      
      // Scene setup
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera setup with resolution-aware positioning
      const camera = new THREE.PerspectiveCamera(75, currentWidth / currentHeight, 0.1, 1000);
      cameraRef.current = camera;

      // Renderer setup with performance optimizations
      const renderer = new THREE.WebGLRenderer({
        antialias: window.devicePixelRatio <= 1,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
        premultipliedAlpha: false
      });
      renderer.setSize(currentWidth, currentHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = true;
      renderer.sortObjects = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;

      // React-friendly approach: Only remove our own canvas if it exists
      if (mountRef.current) {
        console.log('Mount ref exists, children count:', mountRef.current.children.length);
        
        // Only remove our previous canvas if it exists and is still in the DOM
        if (canvasRef.current && canvasRef.current.parentNode === mountRef.current) {
          try {
            console.log('Removing previous canvas');
            mountRef.current.removeChild(canvasRef.current);
            console.log('Previous canvas removed successfully');
          } catch (error) {
            console.warn('Could not remove previous canvas (may have been removed by React):', error);
          }
        }
      }

      // Add to DOM and ensure proper styling
      const canvas = renderer.domElement;
      canvasRef.current = canvas; // Store reference to our canvas
      canvas.style.display = 'block';
      canvas.style.width = `${currentWidth}px`;
      canvas.style.height = `${currentHeight}px`;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.opacity = '0'; // Start invisible until mesh is ready
      canvas.style.visibility = 'hidden'; // Also hide from layout
      
      if (mountRef.current) {
        try {
          console.log('Appending new canvas to mount ref');
          mountRef.current.appendChild(canvas);
          console.log('Canvas successfully appended');
        } catch (error) {
          console.error('Error appending canvas to mount ref:', error);
          console.log('Mount ref state:', {
            exists: !!mountRef.current,
            isConnected: mountRef.current?.isConnected,
            childrenCount: mountRef.current?.children.length,
            parentNode: !!mountRef.current?.parentNode
          });
        }
      } else {
        console.warn('Mount ref is null, cannot append canvas');
      }

      // Add focus tracking listener
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Add interactive event listeners if enabled
      if (interactive) {
        const canvas = renderer.domElement;
        canvas.addEventListener('mousedown', handleMouseDown, { passive: false });
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('dblclick', handleDoubleClick);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Disable right-click menu
        canvas.style.cursor = 'grab';
        
        // Add global mouse move and up listeners for better interaction
        document.addEventListener('mousemove', handleMouseMove, { passive: false });
        document.addEventListener('mouseup', handleMouseUp, { passive: false });
      }

      console.log('Three.js scene initialized successfully');
      
      // Setup wave mesh and start animation
      setupWaveMesh();
      startAnimation();

    } catch (error) {
      console.error('Error initializing Three.js:', error);
      onError?.(error as Error);
    }
  }, [config, theme, width, height, onError, interactive, initializeCameraState, updateCameraFromState, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleDoubleClick, handleVisibilityChange]);

  // ============================================================================
  // ANIMATION LOOP
  // ============================================================================

  const animate = useCallback(() => {
    // Check if component is still mounted and refs are valid
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !uniformsRef.current) {
      // Only continue animation if we still have a mount ref (component not unmounted)
      if (mountRef.current && mountRef.current.isConnected) {
        animationIdRef.current = requestAnimationFrame(animate);
      }
      return;
    }

    // Skip rendering if page is not visible (performance optimization and prevents alt+tab issues)
    if (document.hidden) {
      animationIdRef.current = requestAnimationFrame(animate);
      return;
    }

    try {
      // Update time uniform (excluding unfocused time)
      const rawElapsed = (Date.now() - startTimeRef.current) / 1000;
      const adjustedElapsed = rawElapsed - (focusOffTimeRef.current / 1000);
      uniformsRef.current.u_time.value = adjustedElapsed;
      uniformsRef.current.u_constantTime.value = Date.now();

      // Update reveal animation
      if (isRevealingRef.current && revealStartTimeRef.current) {
        const revealDuration = config.revealAnimationSpeed; // Use configurable duration
        const revealElapsed = (Date.now() - revealStartTimeRef.current) / 1000;
        const revealProgress = Math.min(revealElapsed / revealDuration, 1.0);
        
        // Smooth easing function for reveal
        const easedProgress = revealProgress * revealProgress * (3.0 - 2.0 * revealProgress); // smoothstep
        uniformsRef.current.u_revealProgress.value = easedProgress;
        
        // Stop revealing when complete
        if (revealProgress >= 1.0) {
          isRevealingRef.current = false;
          console.log('Reveal animation completed');
        }
      }

      // Debug: Log time every few seconds
      /*if (Math.floor(adjustedElapsed) % 5 === 0 && Math.floor(adjustedElapsed * 10) % 10 === 0) {
        console.log('Animation time:', adjustedElapsed.toFixed(2), 'Raw elapsed:', rawElapsed.toFixed(2), 'Focus off time:', (focusOffTimeRef.current / 1000).toFixed(2), 'Wave params:', {
          wavesX: uniformsRef.current.u_wavesX.value,
          amplitude: uniformsRef.current.u_amplitude.value,
          speedX: uniformsRef.current.u_speedX.value,
          time: uniformsRef.current.u_time.value
        });
      }*/

      // Ensure the renderer is properly rendering
      const canvas = rendererRef.current.domElement;
      if (canvas && canvas.parentNode) {
        // Force a complete render cycle
        rendererRef.current.setRenderTarget(null);
        rendererRef.current.clear(true, true, true);
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        
        // Force canvas update
        const gl = rendererRef.current.getContext();
        if (gl) {
          gl.flush();
          gl.finish();
        }
      }

      // Performance monitoring
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsUpdateRef.current >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current));
        setFps(currentFps);
        onPerformanceChange?.(currentFps);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      // Only continue animation if component is still mounted
      if (mountRef.current && mountRef.current.isConnected) {
        animationIdRef.current = requestAnimationFrame(animate);
      }
    } catch (error) {
      console.error('Animation loop error:', error);
      onError?.(error as Error);
      // Continue animation even if there's an error, but only if still mounted
      if (mountRef.current && mountRef.current.isConnected) {
        animationIdRef.current = requestAnimationFrame(animate);
      }
    }
  }, [onPerformanceChange, onError]);

  const startAnimation = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    startTimeRef.current = Date.now();
    // Reset focus tracking when animation restarts
    focusOffTimeRef.current = 0;
    lastFocusOffTimeRef.current = null;
    animate();
  }, [animate]);

  // ============================================================================
  // CONFIGURATION UPDATES
  // ============================================================================

  const updateConfiguration = useCallback(() => {
    if (!uniformsRef.current || !meshRef.current) return;

    const colorScheme = theme === 'dark' ? config.darkTheme : config.lightTheme;
    
    // Update wave parameters (don't reset time!)
    uniformsRef.current.u_wavesX.value = config.wavesX;
    uniformsRef.current.u_wavesY.value = config.wavesY;
    uniformsRef.current.u_amplitude.value = config.displacementHeight;
    uniformsRef.current.u_speedX.value = config.speedX;
    uniformsRef.current.u_speedY.value = config.speedY;
    uniformsRef.current.u_cylinderBend.value = config.cylinderBend;
    
    // Update colors
    uniformsRef.current.u_primaryColor.value = hexToThreeColor(colorScheme.primaryColor);
    uniformsRef.current.u_valleyColor.value = hexToThreeColor(colorScheme.valleyColor);
    uniformsRef.current.u_peakColor.value = hexToThreeColor(colorScheme.peakColor);
    
    // Update effects
    uniformsRef.current.u_iridescenceWidth.value = config.iridescenceWidth;
    uniformsRef.current.u_iridescenceSpeed.value = config.iridescenceSpeed;
    uniformsRef.current.u_flowMixAmount.value = config.flowMixAmount;
    
    // Update background color based on theme
    uniformsRef.current.u_backgroundColor.value = theme === 'dark' 
      ? new THREE.Color(0x0a0a0a) 
      : new THREE.Color(0xffffff);

    // Force material uniform updates
    if (meshRef.current.material instanceof THREE.ShaderMaterial) {
      meshRef.current.material.uniformsNeedUpdate = true;
    }

    // Update camera state and position (only if not interactive to avoid interrupting user control)
    if (cameraRef.current && !interactive) {
      initializeCameraState();
      updateCameraFromState();
    }
    
    // Don't restart reveal animation on config changes, only on initial setup
  }, [config, theme, interactive, initializeCameraState, updateCameraFromState]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  const cleanup = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }

    // Remove focus tracking listener (safe to call even if not added)
    try {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    } catch (error) {
      console.warn('Error removing visibility listener (safe to ignore):', error);
    }

    if (rendererRef.current) {
      const canvas = canvasRef.current || rendererRef.current.domElement;
      
      // Remove event listeners safely
      if (interactive && canvas) {
        try {
          canvas.removeEventListener('mousedown', handleMouseDown);
          canvas.removeEventListener('wheel', handleWheel);
          canvas.removeEventListener('dblclick', handleDoubleClick);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        } catch (error) {
          console.warn('Error removing canvas listeners (safe to ignore):', error);
        }
      }
      
      // Only try to remove our canvas if we created it and it's still in our mount ref
      if (canvas && canvasRef.current) {
        console.log('Cleanup: Canvas state:', {
          tagName: canvas.tagName,
          isConnected: canvas.isConnected,
          parentNode: !!canvas.parentNode,
          parentNodeType: canvas.parentNode?.nodeName,
          mountRefExists: !!mountRef.current,
          mountRefConnected: mountRef.current?.isConnected,
          canvasInMountRef: mountRef.current?.contains(canvas),
          parentIsMountRef: canvas.parentNode === mountRef.current
        });
        
        try {
          // Only remove if the canvas is our canvas and it's in our mount ref
          if (canvas.parentNode === mountRef.current && mountRef.current?.contains(canvas)) {
            console.log('Removing our canvas from mount ref');
            mountRef.current.removeChild(canvas);
            console.log('Canvas removed successfully');
          } else {
            console.log('Canvas not in our mount ref or already removed, skipping removal');
          }
        } catch (error) {
          // This error is expected if React has already removed the node
          console.error('Canvas removal error (may be expected during React unmount):', error);
          console.log('Error details:', {
            message: error.message,
            canvasExists: !!canvas,
            parentExists: !!canvas.parentNode,
            isConnected: canvas.isConnected,
            parentIsMountRef: canvas.parentNode === mountRef.current
          });
        }
      } else {
        console.log('Cleanup: No canvas to remove or canvas not tracked');
      }
      
      // Dispose of renderer resources
      try {
        rendererRef.current.dispose();
      } catch (error) {
        console.warn('Error disposing renderer (safe to ignore):', error);
      }
      rendererRef.current = null;
    }
    
    // Clear canvas reference
    canvasRef.current = null;

    if (meshRef.current) {
      if (meshRef.current.geometry) {
        meshRef.current.geometry.dispose();
      }
      if (meshRef.current.material) {
        (meshRef.current.material as THREE.Material).dispose();
      }
      meshRef.current = null;
    }

    sceneRef.current = null;
    cameraRef.current = null;
    uniformsRef.current = null;
    isInitializedRef.current = false; // Reset initialization flag
    revealStartTimeRef.current = null;
    isRevealingRef.current = false;
    // Reset focus tracking
    focusOffTimeRef.current = 0;
    lastFocusOffTimeRef.current = null;
  }, [interactive, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleDoubleClick, handleVisibilityChange]);

  // ============================================================================
  // RESIZE HANDLER
  // ============================================================================

  const handleResize = useCallback(() => {
    if (!rendererRef.current || !cameraRef.current || !uniformsRef.current) return;

    const { width: currentWidth, height: currentHeight } = dimensionsRef.current;

    // Update renderer size
    rendererRef.current.setSize(currentWidth, currentHeight);
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Update camera aspect ratio
    cameraRef.current.aspect = currentWidth / currentHeight;
    cameraRef.current.updateProjectionMatrix();

    // Update uniform resolution
    uniformsRef.current.u_resolution.value.set(currentWidth, currentHeight);

    // Force a render
    if (sceneRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize Three.js only once when component mounts
  useEffect(() => {
    // Add a small delay to prevent multiple initializations during fast refresh
    const timer = setTimeout(() => {
      if (dimensionsRef.current.width > 0 && dimensionsRef.current.height > 0 && !rendererRef.current) {
        initializeThreeJS();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, []); // Empty dependency array - only run once on mount

  // Separate useEffect to handle canvas DOM lifecycle
  useEffect(() => {
    // This effect ensures the canvas is properly managed by React
    return () => {
      // When component unmounts, let React handle the DOM cleanup
      // We just need to dispose Three.js resources
      if (canvasRef.current) {
        console.log('Component unmounting, clearing canvas reference');
        canvasRef.current = null;
      }
    };
  }, []);

  // Setup wave mesh when config is available and Three.js is initialized
  useEffect(() => {
    if (rendererRef.current && sceneRef.current && !meshRef.current) {
      setupWaveMesh();
    }
  }, [setupWaveMesh]);

  // Update configuration when config or theme changes (without re-initializing)
  useEffect(() => {
    if (uniformsRef.current && meshRef.current) {
      updateConfiguration();
    }
  }, [config, theme, updateConfiguration]);

  // Handle resize when dimensions change
  useEffect(() => {
    if (rendererRef.current && cameraRef.current) {
      handleResize();
    }
  }, [width, height]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Ref callback to handle mount/unmount more gracefully
  const handleMountRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      console.log('Mount ref set, node connected:', node.isConnected);
      mountRef.current = node;
    } else {
      console.log('Mount ref cleared');
      mountRef.current = null;
    }
  }, []);

  return (
    <div 
      ref={handleMountRef} 
      className={className}
      style={{ 
        width, 
        height, 
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'transparent'
      }}
    >
      {/* Performance indicator (development only) */}
      {process.env.NODE_ENV === 'development' && fps > 0 && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-20 pointer-events-none">
          {fps} FPS
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WAVE PRESETS
// ============================================================================

export const wavePresets: Record<string, Partial<WaveConfiguration>> = {
  startup: {
    name: 'Startup Theme',
    wavesX: 3.0,
    wavesY: 2.0,
    displacementHeight: 1.2,
    speedX: 0.003,
    speedY: 0.002,
    cylinderBend: 0.1,
    iridescenceWidth: 15.0,
    iridescenceSpeed: 0.008,
    flowMixAmount: 0.6,
    revealAnimationSpeed: 1.2,
    cameraPosition: { x: 0, y: 0, z: 5 },
    cameraRotation: { x: -10, y: 15, z: 0 },
    cameraZoom: 1.2,
    cameraTarget: { x: 0, y: 0, z: 0 },
    lightTheme: {
      primaryColor: '#3b82f6',
      valleyColor: '#dbeafe',
      peakColor: '#8b5cf6'
    },
    darkTheme: {
      primaryColor: '#2563eb',
      valleyColor: '#1e3a8a',
      peakColor: '#7c3aed'
    }
  },
  
  ocean: {
    name: 'Ocean Waves',
    wavesX: 1.5,
    wavesY: 1.0,
    displacementHeight: 0.6,
    speedX: 0.001,
    speedY: 0.0005,
    cylinderBend: 0.0,
    iridescenceWidth: 30.0,
    iridescenceSpeed: 0.003,
    flowMixAmount: 0.8,
    revealAnimationSpeed: 2.0,
    cameraPosition: { x: 0, y: 1, z: 4 },
    cameraRotation: { x: -20, y: 0, z: 0 },
    cameraZoom: 1.0,
    cameraTarget: { x: 0, y: 0, z: 0 },
    lightTheme: {
      primaryColor: '#0ea5e9',
      valleyColor: '#e0f2fe',
      peakColor: '#06b6d4'
    },
    darkTheme: {
      primaryColor: '#0284c7',
      valleyColor: '#0c4a6e',
      peakColor: '#0891b2'
    }
  },
  
  tunnel: {
    name: 'Cylinder Tunnel',
    wavesX: 4.0,
    wavesY: 3.0,
    displacementHeight: 0.4,
    speedX: 0.004,
    speedY: 0.003,
    cylinderBend: 0.8,
    iridescenceWidth: 10.0,
    iridescenceSpeed: 0.01,
    flowMixAmount: 0.3,
    revealAnimationSpeed: 0.8,
    cameraPosition: { x: 0, y: 0, z: 8 },
    cameraRotation: { x: 0, y: 0, z: 0 },
    cameraZoom: 0.8,
    cameraTarget: { x: 0, y: 0, z: 0 },
    lightTheme: {
      primaryColor: '#f59e0b',
      valleyColor: '#fef3c7',
      peakColor: '#ef4444'
    },
    darkTheme: {
      primaryColor: '#d97706',
      valleyColor: '#92400e',
      peakColor: '#dc2626'
    }
  }
};