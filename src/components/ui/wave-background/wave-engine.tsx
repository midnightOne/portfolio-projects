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
  
  // Camera Position (normalized for resolution independence)
  cameraPosition: { x: number; y: number; z: number };
  cameraRotation: { x: number; y: number };
  cameraZoom: number;
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
}

interface WaveShaderUniforms {
  [uniform: string]: THREE.IUniform<any>;
  u_time: { value: number };
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
}

// ============================================================================
// SHADER DEFINITIONS
// ============================================================================

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
  cameraRotation: { x: 0, y: 0 },
  cameraZoom: 1.0
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
): { position: THREE.Vector3; rotation: THREE.Euler; fov: number } {
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
      0
    ),
    fov: Math.max(30, Math.min(90, 75 / config.cameraZoom))
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
  onPerformanceChange
}: WaveEngineProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const uniformsRef = useRef<WaveShaderUniforms | null>(null);
  
  // Performance monitoring
  const [fps, setFps] = useState<number>(60);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(Date.now());

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeThreeJS = useCallback(() => {
    if (!mountRef.current) return;

    try {
      // Scene setup
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera setup with resolution-aware positioning
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      const cameraConfig = adaptCameraForResolution(config, width, height);
      camera.position.copy(cameraConfig.position);
      camera.rotation.copy(cameraConfig.rotation);
      camera.fov = cameraConfig.fov;
      camera.updateProjectionMatrix();
      cameraRef.current = camera;

      // Renderer setup with performance optimizations
      const renderer = new THREE.WebGLRenderer({
        antialias: window.devicePixelRatio <= 1,
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendererRef.current = renderer;

      // Geometry with adaptive resolution
      const geometry = calculateOptimalGeometry(width, height);
      const planeGeometry = new THREE.PlaneGeometry(
        10, 
        10, 
        geometry.segmentsX, 
        geometry.segmentsY
      );

      // Shader uniforms
      const colorScheme = theme === 'dark' ? config.darkTheme : config.lightTheme;
      const uniforms: WaveShaderUniforms = {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(width, height) },
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
        u_flowMixAmount: { value: config.flowMixAmount }
      };
      uniformsRef.current = uniforms;

      // Shader material
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: waveVertexShader,
        fragmentShader: waveFragmentShader,
        transparent: true
      });

      // Mesh
      const mesh = new THREE.Mesh(planeGeometry, material);
      scene.add(mesh);
      meshRef.current = mesh;

      // Add to DOM
      mountRef.current.appendChild(renderer.domElement);

      // Start animation
      startAnimation();

    } catch (error) {
      console.error('Error initializing Three.js:', error);
      onError?.(error as Error);
    }
  }, [config, theme, width, height, onError]);

  // ============================================================================
  // ANIMATION LOOP
  // ============================================================================

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !uniformsRef.current) {
      return;
    }

    // Update time uniform
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    uniformsRef.current.u_time.value = elapsed;

    // Render
    rendererRef.current.render(sceneRef.current, cameraRef.current);

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

    animationIdRef.current = requestAnimationFrame(animate);
  }, [onPerformanceChange]);

  const startAnimation = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    startTimeRef.current = Date.now();
    animate();
  }, [animate]);

  // ============================================================================
  // CONFIGURATION UPDATES
  // ============================================================================

  const updateConfiguration = useCallback(() => {
    if (!uniformsRef.current) return;

    const colorScheme = theme === 'dark' ? config.darkTheme : config.lightTheme;
    
    // Update wave parameters
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

    // Update camera
    if (cameraRef.current) {
      const cameraConfig = adaptCameraForResolution(config, width, height);
      cameraRef.current.position.copy(cameraConfig.position);
      cameraRef.current.rotation.copy(cameraConfig.rotation);
      cameraRef.current.fov = cameraConfig.fov;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [config, theme, width, height]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  const cleanup = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }

    if (rendererRef.current) {
      rendererRef.current.dispose();
      if (mountRef.current && rendererRef.current.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current = null;
    }

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
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    initializeThreeJS();
    return cleanup;
  }, [initializeThreeJS, cleanup]);

  useEffect(() => {
    updateConfiguration();
  }, [updateConfiguration]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div 
      ref={mountRef} 
      className={className}
      style={{ width, height, position: 'relative' }}
    >
      {/* Performance indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
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