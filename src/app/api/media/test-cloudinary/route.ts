import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

export async function GET(request: NextRequest) {
  try {
    // Check authentication - admin only
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
        { status: 401 }
      );
    }

    // Check environment variables
    const config = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    };

    const configStatus = {
      hasCloudName: !!config.cloud_name,
      hasApiKey: !!config.api_key,
      hasApiSecret: !!config.api_secret,
      cloudName: config.cloud_name || 'NOT_SET'
    };

    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_CONFIG',
          message: 'Cloudinary configuration is incomplete',
          config: configStatus
        }
      });
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      api_secret: config.api_secret,
      secure: true
    });

    // Test API connectivity with a simple ping
    try {
      const pingResult = await cloudinary.api.ping();
      console.log('Cloudinary ping result:', pingResult);
    } catch (pingError) {
      console.error('Cloudinary ping failed:', pingError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'PING_FAILED',
          message: 'Failed to ping Cloudinary API',
          details: pingError instanceof Error ? pingError.message : JSON.stringify(pingError),
          config: configStatus
        }
      });
    }

    // Test fetching resources
    try {
      const resourcesResult = await cloudinary.api.resources({
        resource_type: 'image',
        type: 'upload',
        max_results: 10
      });

      return NextResponse.json({
        success: true,
        data: {
          config: configStatus,
          ping: 'success',
          sampleResources: {
            count: resourcesResult.resources.length,
            totalCount: resourcesResult.total_count,
            resources: resourcesResult.resources.map((r: any) => ({
              public_id: r.public_id,
              format: r.format,
              resource_type: r.resource_type,
              created_at: r.created_at,
              secure_url: r.secure_url
            }))
          }
        }
      });

    } catch (resourceError) {
      console.error('Cloudinary resources fetch failed:', resourceError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'RESOURCES_FETCH_FAILED',
          message: 'Failed to fetch resources from Cloudinary',
          details: resourceError instanceof Error ? resourceError.message : JSON.stringify(resourceError),
          config: configStatus
        }
      });
    }

  } catch (error) {
    console.error('Cloudinary test error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'TEST_FAILED',
        message: 'Cloudinary test failed',
        details: error instanceof Error ? error.message : JSON.stringify(error)
      }
    }, { status: 500 });
  }
}