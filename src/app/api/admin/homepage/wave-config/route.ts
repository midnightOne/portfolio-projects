import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { WaveConfiguration } from '@/components/ui/wave-background/wave-engine';
import { defaultWaveConfig } from '@/lib/constants/wave-config';

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
    x: z.number().min(-20).max(20),
    y: z.number().min(-20).max(20),
    z: z.number().min(-20).max(20)
  }),
  cameraRotation: z.object({
    x: z.number().min(-90).max(90),
    y: z.number().min(-360).max(360),
    z: z.number().min(-360).max(360)
  }),
  cameraZoom: z.number().min(0.01).max(10.0),
  cameraTarget: z.object({
    x: z.number().min(-10).max(10),
    y: z.number().min(-10).max(10),
    z: z.number().min(-10).max(10)
  })
});

// ============================================================================
// GET WAVE CONFIGURATION
// ============================================================================

export async function GET() {
  try {
    // Fetch the homepage configuration from database
    const homepageConfig = await prisma.homepageConfig.findFirst();
    
    if (!homepageConfig) {
      console.log('No homepage config found, returning default wave config');
      // Return default configuration if none exists
      return NextResponse.json({
        success: true,
        data: { config: defaultWaveConfig }
      });
    }

    // Check if waveConfig exists and is valid
    let waveConfig = defaultWaveConfig;
    if (homepageConfig.waveConfig && typeof homepageConfig.waveConfig === 'object') {
      try {
        // Ensure the wave config has all required fields
        waveConfig = {
          ...defaultWaveConfig,
          ...homepageConfig.waveConfig
        };
      } catch (parseError) {
        console.warn('Invalid wave config in database, using default:', parseError);
        waveConfig = defaultWaveConfig;
      }
    }

    // Return the wave configuration
    return NextResponse.json({
      success: true,
      data: { config: waveConfig }
    });

  } catch (error) {
    console.error('Error fetching wave configuration:', error);
    // Return default config even on error to prevent homepage from breaking
    return NextResponse.json({
      success: true,
      data: { config: defaultWaveConfig }
    });
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
    
    // Log the incoming request body for debugging
    console.log('=== WAVE CONFIG VALIDATION DEBUG ===');
    console.log('Incoming request body:', JSON.stringify(body, null, 2));
    
    // Validate the request body
    const validationResult = WaveConfigurationSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('❌ VALIDATION FAILED');
      console.log('Validation errors:', JSON.stringify(validationResult.error.errors, null, 2));
      
      // Log specific field values that failed validation
      console.log('=== DETAILED FIELD ANALYSIS ===');
      validationResult.error.errors.forEach((error, index) => {
        const path = error.path.join('.');
        const actualValue = path.split('.').reduce((obj, key) => obj?.[key], body);
        console.log(`Error ${index + 1}:`);
        console.log(`  Field: ${path}`);
        console.log(`  Expected: ${error.message}`);
        console.log(`  Actual value: ${JSON.stringify(actualValue)}`);
        console.log(`  Value type: ${typeof actualValue}`);
      });
      console.log('=== END VALIDATION DEBUG ===');
      
      return NextResponse.json(
        { 
          error: 'Invalid wave configuration data',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }
    
    console.log('✅ VALIDATION PASSED');
    console.log('=== END VALIDATION DEBUG ===');

    const waveConfig = validationResult.data;

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Find or create homepage config
      let homepageConfig = await tx.homepageConfig.findFirst();
      
      if (!homepageConfig) {
        console.log('Creating new homepage config with wave configuration');
        
        // Default sections for new homepage config
        const defaultSections = [
          {
            id: 'hero-main',
            type: 'hero',
            enabled: true,
            order: 1,
            config: {
              title: 'John Doe',
              subtitle: 'Full Stack Developer',
              description: 'Building digital experiences that make a difference.',
              theme: 'default',
              showScrollIndicator: true,
              ctaText: 'View My Work',
              ctaLink: '#projects',
              enableWaveBackground: true
            }
          }
        ];
        
        // Create new homepage config with default sections and wave config
        homepageConfig = await tx.homepageConfig.create({
          data: {
            sections: defaultSections,
            globalTheme: 'default',
            layout: 'standard',
            waveConfig: waveConfig
          }
        });
        
        // Create the hero section config
        await tx.sectionConfig.create({
          data: {
            homepageConfigId: homepageConfig.id,
            sectionId: 'hero-main',
            type: 'hero',
            enabled: true,
            order: 1,
            config: defaultSections[0].config
          }
        });
        
      } else {
        console.log('Updating existing homepage config with wave configuration');
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