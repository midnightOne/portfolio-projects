import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/health/homepage - Health check for homepage configuration
export async function GET() {
  try {
    // Test database connection
    let dbStatus = 'ok';
    let configExists = false;
    let sectionCount = 0;
    
    try {
      const homepageConfig = await prisma.homepageConfig.findFirst({
        include: {
          sectionConfigs: true
        }
      });
      
      configExists = !!homepageConfig;
      sectionCount = homepageConfig?.sectionConfigs?.length || 0;
    } catch (dbError) {
      dbStatus = 'error';
      console.error('Database health check failed:', dbError);
    }

    // Test public endpoint
    let publicEndpointStatus = 'ok';
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/homepage-config-public`);
      if (!response.ok) {
        publicEndpointStatus = 'error';
      }
    } catch (fetchError) {
      publicEndpointStatus = 'error';
      console.error('Public endpoint health check failed:', fetchError);
    }

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        database: {
          status: dbStatus,
          configExists,
          sectionCount
        },
        endpoints: {
          public: publicEndpointStatus
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          nextAuthUrl: process.env.NEXTAUTH_URL || 'not-set'
        }
      }
    });

  } catch (error) {
    console.error('Homepage health check failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}