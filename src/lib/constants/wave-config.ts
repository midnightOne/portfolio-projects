import type { WaveConfiguration } from '@/components/ui/wave-background/wave-engine';

// ============================================================================
// DEFAULT WAVE CONFIGURATION
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
    primaryColor: '#6366f1',
    valleyColor: '#e0e7ff',
    peakColor: '#a855f7'
  },
  darkTheme: {
    primaryColor: '#4f46e5',
    valleyColor: '#1e1b4b',
    peakColor: '#7c3aed'
  },
  iridescenceWidth: 20.0,
  iridescenceSpeed: 0.005,
  flowMixAmount: 0.4,
  revealAnimationSpeed: 1.5,
  cameraPosition: { x: 0, y: 0, z: 5 },
  cameraRotation: { x: 0, y: 0, z: 0 },
  cameraZoom: 1.0,
  cameraTarget: { x: 0, y: 0, z: 0 }
};