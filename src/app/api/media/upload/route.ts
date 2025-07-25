import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMediaProvider, validateFile, getValidationForMediaType, detectMediaType, sanitizeFilename } from '@/lib/media';
import { prisma } from '@/lib/database';
import { MediaType } from '@/lib/types/project';
import { z } from 'zod';

// Upload request validation schema
const UploadRequestSchema = z.object({
  type: z.enum(['image', 'video', 'attachment']).optional(),
  projectId: z.string().optional(),
  description: z.string().optional(),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_FILE', message: 'No file provided' } },
        { status: 400 }
      );
    }

    // Parse and validate metadata
    let uploadOptions = {};
    if (metadata) {
      try {
        const parsedMetadata = JSON.parse(metadata);
        const validationResult = UploadRequestSchema.safeParse(parsedMetadata);
        
        if (!validationResult.success) {
          return NextResponse.json(
            { 
              success: false, 
              error: { 
                code: 'INVALID_METADATA', 
                message: 'Invalid metadata format',
                details: validationResult.error.issues
              } 
            },
            { status: 400 }
          );
        }
        
        uploadOptions = validationResult.data;
      } catch (error) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_METADATA', message: 'Failed to parse metadata' } },
          { status: 400 }
        );
      }
    }

    // Detect media type and validate file
    const detectedType = detectMediaType(file);
    const mediaType = (uploadOptions as any).type || detectedType;
    const validation = getValidationForMediaType(mediaType);
    const validationResult = validateFile(file, validation);

    if (!validationResult.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_FAILED', 
            message: validationResult.error || 'File validation failed' 
          } 
        },
        { status: 400 }
      );
    }

    // Get media provider and upload file
    const mediaProvider = getMediaProvider();
    
    const uploadResult = await mediaProvider.upload(file, {
      folder: (uploadOptions as any).folder || `${mediaType}s`,
      tags: (uploadOptions as any).tags,
      publicId: sanitizeFilename(file.name.split('.')[0]) + '-' + Date.now()
    });

    // Save media item to database
    const mediaItem = await prisma.mediaItem.create({
      data: {
        type: mapToDbMediaType(mediaType) as any,
        url: uploadResult.secureUrl,
        thumbnailUrl: uploadResult.secureUrl, // For now, use same URL
        altText: file.name,
        description: (uploadOptions as any).description,
        width: uploadResult.width,
        height: uploadResult.height,
        fileSize: BigInt(uploadResult.bytes),
        displayOrder: 0,
        projectId: (uploadOptions as any).projectId || null
      }
    });

    // Prepare response data
    const responseData = {
      id: mediaItem.id,
      url: uploadResult.secureUrl,
      publicId: uploadResult.publicId,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
      resourceType: uploadResult.resourceType,
      provider: mediaProvider.name,
      createdAt: uploadResult.createdAt.toISOString()
    };

    // Include warnings if any
    const response: any = {
      success: true,
      data: responseData
    };

    if (validationResult.warnings) {
      response.warnings = validationResult.warnings;
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Media upload error:', error);
    
    // Handle specific provider errors
    if (error instanceof Error) {
      if (error.message.includes('Cloudinary')) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'CLOUDINARY_ERROR', 
              message: 'Cloudinary upload failed',
              details: error.message
            } 
          },
          { status: 500 }
        );
      }
      
      if (error.message.includes('S3')) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'S3_ERROR', 
              message: 'S3 upload failed',
              details: error.message
            } 
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'UPLOAD_FAILED', 
          message: 'Failed to upload file',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

// Get upload configuration and supported providers
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { getAvailableProviders, getCurrentProviderName, validateMediaProviderConfig } = await import('@/lib/media');
    
    const providerValidation = validateMediaProviderConfig();
    const currentProvider = getCurrentProviderName();
    const availableProviders = getAvailableProviders();

    return NextResponse.json({
      success: true,
      data: {
        currentProvider,
        availableProviders,
        providerConfigured: providerValidation.valid,
        configurationErrors: providerValidation.errors,
        maxFileSize: {
          image: '10MB',
          video: '100MB',
          attachment: '50MB'
        },
        supportedFormats: {
          image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
          video: ['mp4', 'webm', 'mov', 'avi'],
          attachment: ['pdf', 'zip', 'apk', 'exe', 'dmg', 'txt']
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'CONFIG_ERROR', 
          message: 'Failed to get upload configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    );
  }
}

// Helper function to map media types to database enum
function mapToDbMediaType(mediaType: string): string {
  switch (mediaType) {
    case 'image':
      return 'IMAGE';
    case 'video':
      return 'VIDEO';
    case 'attachment':
      return 'DOCUMENT';
    default:
      return 'DOCUMENT';
  }
} 