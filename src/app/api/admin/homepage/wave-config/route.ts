import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { WaveConfiguration } from '@/components/ui/wave-background/wave-engine';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const WaveColorSchemeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  valleyColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  peakColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
});

const WaveConfigurationSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  wavesX: z.number().min(0.5).max(10.0),
  wavesY: z.number().min(0.5).max(10.0),
  displacementHeight: z.number().min(0.0).max(2.0),
  speedX: z.number().min(0.0).max(0.005),
  speedY: z.number().min(0.0).max(0.005),
  cylinderBend: z.number().min(0.0).max(1.0),
  lightTheme: WaveColorSchemeSchema,
  darkTheme: WaveColorSchemeSchema,
  iridescenceWidth: z.number().min(1.0).max(50.0),
  iridescenceSpeed: z.number().min(0.0).max(0.01),
  flowMixAmount: z.number().min(0.0).max(1.0),
  cameraPosition: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number()
  }),
  cameraRotation: z.object({
    x: z.number(),
    y: z.number()
  }),
  cameraZoom: z.number().min(0.1).max(5.0)
});

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const defaultWaveConfig: WaveConfiguration = {
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
  cameraPosition: { x: 0, y: 0, z: 5 },
  cameraRotation: { x: 0, y: 0 },
  cameraZoom: 1.0
};

// ============================================================================
// GET WAVE CONFIGURATION
// ============================================================================

export async function GET() {
  try {
    // For now, just return the default configuration
    // Database integration will be completed once Prisma client is fully updated
    return NextResponse.json({
      success: true,
      data: { config: defaultWaveConfig }
    });

  } catch (error) {
    console.error('Error fetching wave configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wave configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// UPDATE WAVE CONFIGURATION
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate the request body
    const validationResult = WaveConfigurationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid wave configuration data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }

    const waveConfig = validationResult.data;

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Find or create homepage config
      let homepageConfig = await tx.homepageConfig.findFirst();
      
      if (!homepageConfig) {
        // Create new homepage config with default sections and wave config
        homepageConfig = await tx.homepageConfig.create({
          data: {
            sections: [],
            globalTheme: 'default',
            layout: 'standard',
            waveConfig: waveConfig
          }
        });
      } else {
        // Update existing homepage config with new wave config
        homepageConfig = await tx.homepageConfig.update({
          where: { id: homepageConfig.id },
          data: {
            waveConfig: waveConfig,
            updatedAt: new Date()
          }
        });
      }

      return homepageConfig;
    });

    return NextResponse.json({
      success: true,
      data: { config: waveConfig }
    });

  } catch (error) {
    console.error('Error updating wave configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update wave configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET WAVE PRESETS
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'get-presets') {
      const presets = {
        startup: {
          ...defaultWaveConfig,
          id: 'startup',
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
          ...defaultWaveConfig,
          id: 'ocean',
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
          ...defaultWaveConfig,
          id: 'tunnel',
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

      return NextResponse.json({
        success: true,
        data: { presets }
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error handling wave configuration action:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}