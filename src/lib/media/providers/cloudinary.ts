import { v2 as cloudinary } from 'cloudinary';
import { 
  MediaProvider, 
  MediaResult, 
  DeleteResult, 
  UploadOptions, 
  Transformation, 
  UrlOptions,
  CloudinaryConfig 
} from '../types';

export class CloudinaryProvider implements MediaProvider {
  name = 'cloudinary';
  private config: CloudinaryConfig;

  constructor(config: CloudinaryConfig) {
    this.config = config;
    
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: config.secure ?? true
    });
  }

  async upload(file: File | Buffer, options: UploadOptions = {}): Promise<MediaResult> {
    try {
      let buffer: Buffer;
      
      if (file instanceof File) {
        buffer = Buffer.from(await file.arrayBuffer());
      } else {
        buffer = file;
      }

      const uploadOptions: any = {
        folder: options.folder || this.config.folder,
        public_id: options.publicId,
        tags: options.tags,
        context: options.context,
        resource_type: 'auto'
        // Note: format and quality 'auto' should be applied in transformations, not upload options
      };

      // Apply transformations if provided
      if (options.transformation && options.transformation.length > 0) {
        uploadOptions.transformation = this.buildTransformations(options.transformation);
      }

      const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(buffer);
      });

      return this.mapCloudinaryResult(result);
    } catch (error) {
      console.error('Cloudinary upload error details:', error);
      throw new Error(`Cloudinary upload failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  }

  async uploadFromPath(filePath: string, options: UploadOptions = {}): Promise<MediaResult> {
    try {
      const uploadOptions: any = {
        folder: options.folder || this.config.folder,
        public_id: options.publicId,
        tags: options.tags,
        context: options.context,
        resource_type: 'auto'
        // Note: format and quality 'auto' should be applied in transformations, not upload options
      };

      // Apply transformations if provided
      if (options.transformation && options.transformation.length > 0) {
        uploadOptions.transformation = this.buildTransformations(options.transformation);
      }

      const result = await cloudinary.uploader.upload(filePath, uploadOptions);
      return this.mapCloudinaryResult(result);
    } catch (error) {
      console.error('Cloudinary upload from path error details:', error);
      throw new Error(`Cloudinary upload from path failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  }

  async delete(publicId: string): Promise<DeleteResult> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      
      return {
        publicId,
        result: result.result === 'ok' ? 'ok' : 'not found'
      };
    } catch (error) {
      throw new Error(`Cloudinary delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  transform(url: string, transformations: Transformation[]): string {
    try {
      // Extract public ID from Cloudinary URL
      const publicId = this.extractPublicId(url);
      
      if (!publicId) {
        return url; // Return original URL if can't extract public ID
      }

      const transformation = this.buildTransformations(transformations);
      
      return cloudinary.url(publicId, {
        transformation,
        secure: this.config.secure ?? true
      });
    } catch (error) {
      console.warn('Failed to transform Cloudinary URL:', error);
      return url; // Return original URL on error
    }
  }

  getUrl(publicId: string, options: UrlOptions = {}): string {
    const transformations = options.transformation ? 
      this.buildTransformations(options.transformation) : undefined;

    return cloudinary.url(publicId, {
      transformation: transformations,
      secure: options.secure ?? this.config.secure ?? true,
      format: options.format
    });
  }

  private buildTransformations(transformations: Transformation[]): any {
    return transformations.map(t => {
      const transformation: any = {};
      
      if (t.width) transformation.width = t.width;
      if (t.height) transformation.height = t.height;
      if (t.crop) transformation.crop = t.crop;
      if (t.quality) transformation.quality = t.quality;
      if (t.format) transformation.format = t.format;
      if (t.gravity) transformation.gravity = t.gravity;
      
      return transformation;
    });
  }

  private extractPublicId(url: string): string | null {
    try {
      // Match Cloudinary URL pattern and extract public ID
      const match = url.match(/\/(?:v\d+\/)?([^\/]+\/[^\/]+)(?:\.[^.]+)?$/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  private mapCloudinaryResult(result: any): MediaResult {
    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      resourceType: this.mapResourceType(result.resource_type),
      bytes: result.bytes,
      createdAt: new Date(result.created_at),
      etag: result.etag,
      signature: result.signature,
      versionId: result.version?.toString(),
      folder: result.folder,
      originalFilename: result.original_filename
    };
  }

  private mapResourceType(cloudinaryType: string): 'image' | 'video' | 'raw' {
    switch (cloudinaryType) {
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      default:
        return 'raw';
    }
  }
} 