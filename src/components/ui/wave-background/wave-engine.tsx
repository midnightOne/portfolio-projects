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
    
    // Calculate wave displacement with proper time-based animation
    float timeX = u_time * u_speedX * 1000.0; // Scaled for visible but smooth animation
    float timeY = u_time * u_speedY * 1000.0;
    
    float waveX = sin(position.x * u_wavesX + timeX) * u_amplitude;
    float waveY = sin(position.y * u_wavesY + timeY) * u_amplitude;
    float elevation = waveX + waveY;
    
    // Apply cylinder bend effect
    vec3 newPosition = position;
    newPosition.z += elevation;
    
    if (u_cylinderBend > 0.0) {
      float bendAmount = u_cylinderBend * 0.5;
      float radius = 2.0 / max(bendAmount, 0.001);
      float angle = newPosition.x / radius;
      
      newPosition.x = radius * sin(angle);
      newPosition.z = radius * (cos(angle) - 1.0) + newPosition.z;
    }
    
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
    // Color mixing based on elevation with more contrast
    float normalizedElevation = clamp((vElevation + 2.0) * 0.25, 0.0, 1.0);
    vec3 baseColor = mix(u_valleyColor, u_peakColor, normalizedElevation);
    baseColor = mix(baseColor, u_primaryColor, 0.5);
    
    // Animated iridescence effect
    float timeIridescence = u_time * u_iridescenceSpeed * 1000.0;
    float iridescence = sin(vUv.x * u_iridescenceWidth + timeIridescence);
    iridescence = (iridescence + 1.0) * 0.5;
    
    // Animated flow texture simulation
    float timeFlow = u_time * 100.0;
    vec2 flowUv = vUv + vec2(timeFlow * 0.001, timeFlow * 0.0005);
    float flowPattern = sin(flowUv.x * 10.0) * sin(flowUv.y * 8.0);
    flowPattern = (flowPattern + 1.0) * 0.5;
    
    // Combine effects with more visible animation
    vec3 finalColor = mix(baseColor, baseColor * 1.3, iridescence * 0.4);
    finalColor = mix(finalColor, finalColor * 1.2, flowPattern * u_flowMixAmount * 0.5);
    
    // Add subtle brightness variation based on time for smooth animation
    float brightness = 1.0 + sin(u_time * 1.0) * 0.1; // Subtle pulsing
    finalColor *= brightness;
    
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

  // Interactive camera controls
  const mouseStateRef = useRef({
    isDown: false,
    isPanning: false,
    button: -1,
    lastX: 0,
    lastY: 0,
    rotationSpeed: 0.01,
    panSpeed: 0.01,
    zoomSpeed: 0.1
  });
  
  const cameraStateRef = useRef({
    position: { x: 0, y: 0, z: 5 },
    rotation: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 1.0
  });

  const notifyCameraChangeThrottled = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // CAMERA CONTROL FUNCTIONS
  // ============================================================================

  const initializeCameraState = useCallback(() => {
    cameraStateRef.current = {
      position: { ...config.cameraPosition },
      rotation: { 
        x: config.cameraRotation.x * Math.PI / 180,
        y: config.cameraRotation.y * Math.PI / 180,
        z: config.cameraRotation.z * Math.PI / 180
      },
      target: { ...config.cameraTarget },
      zoom: config.cameraZoom
    };
  }, [config]);

  const updateCameraFromState = useCallback(() => {
    if (!cameraRef.current) return;
    
    const camera = cameraRef.current;
    const state = cameraStateRef.current;
    
    // Calculate camera position based on spherical coordinates around target
    const distance = 5 * state.zoom; // Base distance of 5 units
    const x = state.target.x + distance * Math.sin(state.rotation.y) * Math.cos(state.rotation.x);
    const y = state.target.y + distance * Math.sin(state.rotation.x);
    const z = state.target.z + distance * Math.cos(state.rotation.y) * Math.cos(state.rotation.x);
    
    camera.position.set(x, y, z);
    camera.lookAt(state.target.x, state.target.y, state.target.z);
    camera.fov = Math.max(30, Math.min(90, 75 / state.zoom));
    camera.updateProjectionMatrix();
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
            x: state.rotation.x * 180 / Math.PI,
            y: state.rotation.y * 180 / Math.PI,
            z: state.rotation.z * 180 / Math.PI
          },
          zoom: state.zoom,
          target: { ...state.target }
        });
      }
    }, 50); // Reduced throttle for more responsive updates
  }, [onCameraChange]);

  // ============================================================================
  // MOUSE EVENT HANDLERS
  // ============================================================================

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!interactive) return;
    
    mouseStateRef.current.isDown = true;
    mouseStateRef.current.isPanning = event.button === 1; // Middle mouse button for panning
    mouseStateRef.current.button = event.button;
    mouseStateRef.current.lastX = event.clientX;
    mouseStateRef.current.lastY = event.clientY;
    
    // Change cursor based on button
    if (event.target instanceof HTMLElement) {
      if (event.button === 0) {
        event.target.style.cursor = 'grabbing';
      } else if (event.button === 1) {
        event.target.style.cursor = 'move';
      }
    }
    
    event.preventDefault();
  }, [interactive]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!interactive || !mouseStateRef.current.isDown) return;
    
    const deltaX = event.clientX - mouseStateRef.current.lastX;
    const deltaY = event.clientY - mouseStateRef.current.lastY;
    
    const { isPanning, rotationSpeed, panSpeed } = mouseStateRef.current;
    
    if (isPanning) { // Middle mouse button - panning
      cameraStateRef.current.target.x -= deltaX * panSpeed * 0.01;
      cameraStateRef.current.target.y += deltaY * panSpeed * 0.01;
    } else { // Left mouse button - rotation
      cameraStateRef.current.rotation.y += deltaX * rotationSpeed;
      cameraStateRef.current.rotation.x += deltaY * rotationSpeed;
      
      // Clamp vertical rotation to prevent flipping
      cameraStateRef.current.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraStateRef.current.rotation.x));
    }
    
    mouseStateRef.current.lastX = event.clientX;
    mouseStateRef.current.lastY = event.clientY;
    
    updateCameraFromState();
    notifyCameraChange();
    
    event.preventDefault();
  }, [interactive, updateCameraFromState, notifyCameraChange]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!interactive) return;
    
    mouseStateRef.current.isDown = false;
    mouseStateRef.current.button = -1;
    
    // Reset cursor
    const canvas = rendererRef.current?.domElement;
    if (canvas) {
      canvas.style.cursor = 'grab';
    }
    
    event.preventDefault();
  }, [interactive]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!interactive) return;
    
    const zoomDelta = event.deltaY * mouseStateRef.current.zoomSpeed * 0.01;
    cameraStateRef.current.zoom = Math.max(0.1, Math.min(5.0, cameraStateRef.current.zoom + zoomDelta));
    
    updateCameraFromState();
    notifyCameraChange();
    
    event.preventDefault();
  }, [interactive, updateCameraFromState, notifyCameraChange]);

  const handleDoubleClick = useCallback(() => {
    if (!interactive) return;
    
    // Reset to default camera position
    cameraStateRef.current.rotation.x = 0.3;
    cameraStateRef.current.rotation.y = 0;
    cameraStateRef.current.zoom = 1.0;
    cameraStateRef.current.target.x = 0;
    cameraStateRef.current.target.y = 0;
    cameraStateRef.current.target.z = 0;
    
    updateCameraFromState();
    notifyCameraChange();
  }, [interactive, updateCameraFromState, notifyCameraChange]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeThreeJS = useCallback(() => {
    if (!mountRef.current) return;

    try {
      // Initialize camera state from config
      initializeCameraState();

      // Scene setup
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera setup with resolution-aware positioning
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      cameraRef.current = camera;
      
      // Initialize camera state and position
      initializeCameraState();
      if (interactive) {
        updateCameraFromState();
      } else {
        const cameraConfig = adaptCameraForResolution(config, width, height);
        camera.position.copy(cameraConfig.position);
        camera.lookAt(cameraConfig.target);
        camera.fov = cameraConfig.fov;
        camera.updateProjectionMatrix();
      }

      // Renderer setup with performance optimizations
      const renderer = new THREE.WebGLRenderer({
        antialias: window.devicePixelRatio <= 1,
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
        premultipliedAlpha: false
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = true;
      renderer.sortObjects = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;

      // Geometry with sufficient resolution for wave effects
      const geometry = calculateOptimalGeometry(width, height);
      const planeGeometry = new THREE.PlaneGeometry(
        8, 
        8, 
        Math.max(64, geometry.segmentsX), // Ensure minimum resolution for waves
        Math.max(48, geometry.segmentsY)
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
        transparent: true,
        side: THREE.DoubleSide
      });

      // Mesh
      const mesh = new THREE.Mesh(planeGeometry, material);
      scene.add(mesh);
      meshRef.current = mesh;

      // Add to DOM and ensure proper styling
      const canvas = renderer.domElement;
      canvas.style.display = 'block';
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      
      // Clear any existing canvas
      while (mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
      
      mountRef.current.appendChild(canvas);

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

      // Start animation
      startAnimation();

    } catch (error) {
      console.error('Error initializing Three.js:', error);
      onError?.(error as Error);
    }
  }, [config, theme, width, height, onError, interactive, initializeCameraState, updateCameraFromState, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleDoubleClick]);

  // ============================================================================
  // ANIMATION LOOP
  // ============================================================================

  const animate = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !uniformsRef.current) {
      animationIdRef.current = requestAnimationFrame(animate);
      return;
    }

    try {
      // Update time uniform
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      uniformsRef.current.u_time.value = elapsed;

      // Debug: Log time every few seconds
      if (Math.floor(elapsed) % 5 === 0 && Math.floor(elapsed * 10) % 10 === 0) {
        console.log('Animation time:', elapsed.toFixed(2), 'Wave params:', {
          wavesX: uniformsRef.current.u_wavesX.value,
          amplitude: uniformsRef.current.u_amplitude.value,
          speedX: uniformsRef.current.u_speedX.value,
          time: uniformsRef.current.u_time.value
        });
      }

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

      animationIdRef.current = requestAnimationFrame(animate);
    } catch (error) {
      console.error('Animation loop error:', error);
      onError?.(error as Error);
      // Continue animation even if there's an error
      animationIdRef.current = requestAnimationFrame(animate);
    }
  }, [onPerformanceChange, onError]);

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
    if (!uniformsRef.current || !meshRef.current) return;

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

    // Force material uniform updates
    if (meshRef.current.material instanceof THREE.ShaderMaterial) {
      meshRef.current.material.uniformsNeedUpdate = true;
    }

    // Update camera state and position
    if (cameraRef.current) {
      initializeCameraState();
      if (interactive) {
        updateCameraFromState();
      } else {
        const cameraConfig = adaptCameraForResolution(config, width, height);
        cameraRef.current.position.copy(cameraConfig.position);
        cameraRef.current.lookAt(cameraConfig.target);
        cameraRef.current.fov = cameraConfig.fov;
        cameraRef.current.updateProjectionMatrix();
      }
    }

    // Force a render to show changes immediately
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
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
  }, [config, theme, width, height, interactive, initializeCameraState, updateCameraFromState]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  const cleanup = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }

    if (rendererRef.current) {
      // Remove event listeners
      if (interactive) {
        const canvas = rendererRef.current.domElement;
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('dblclick', handleDoubleClick);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }
      
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
  }, [interactive, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleDoubleClick]);

  // ============================================================================
  // RESIZE HANDLER
  // ============================================================================

  const handleResize = useCallback(() => {
    if (!rendererRef.current || !cameraRef.current || !uniformsRef.current) return;

    // Update renderer size
    rendererRef.current.setSize(width, height);
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Update camera aspect ratio
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();

    // Update uniform resolution
    uniformsRef.current.u_resolution.value.set(width, height);

    // Force a render
    if (sceneRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [width, height]);

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

  // Handle resize
  useEffect(() => {
    handleResize();
  }, [handleResize]);

  // Force re-render when config changes for real-time preview
  useEffect(() => {
    if (uniformsRef.current) {
      updateConfiguration();
    }
  }, [config, theme, updateConfiguration]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div 
      ref={mountRef} 
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