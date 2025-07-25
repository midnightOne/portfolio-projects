import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MediaProvider, 
  MediaResult, 
  DeleteResult, 
  UploadOptions, 
  Transformation, 
  UrlOptions,
  SupabaseStorageConfig 
} from '../types';

export class SupabaseStorageProvider implements MediaProvider {
  name = 'supabase';
  private config: SupabaseStorageConfig;
  private client: SupabaseClient;

  constructor(config: SupabaseStorageConfig) {
    this.config = config;
    
    this.client = createClient(config.url, config.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  async upload(file: File | Buffer, options: UploadOptions = {}): Promise<MediaResult> {
    try {
      let buffer: Buffer;
      let filename: string;
      let contentType: string;
      
      if (file instanceof File) {
        buffer = Buffer.from(await file.arrayBuffer());
        filename = file.name;
        contentType = file.type;
      } else {
        buffer = file;
        filename = options.publicId || `upload-${Date.now()}`;
        contentType = 'application/octet-stream';
      }

      // Generate file path
      const folder = options.folder || 'uploads';
      const publicId = options.publicId || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const extension = this.getExtensionFromFilename(filename) || this.getExtensionFromContentType(contentType);
      const filePath = `${folder}/${publicId}${extension}`;

      // Upload to Supabase Storage
      const { data, error } = await this.client.storage
        .from(this.config.bucket)
        .upload(filePath, buffer, {
          contentType,
          duplex: 'half'
        });

      if (error) {
        throw new Error(`Supabase Storage error: ${error.message}`);
      }

      if (!data) {
        throw new Error('Supabase Storage upload returned no data');
      }

      // Get public URL
      const { data: urlData } = this.client.storage
        .from(this.config.bucket)
        .getPublicUrl(data.path);

      return this.mapSupabaseResult(data, urlData.publicUrl, {
        contentType,
        originalFilename: filename,
        folder,
        bytes: buffer.length
      });
    } catch (error) {
      throw new Error(`Supabase Storage upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFromPath(filePath: string, options: UploadOptions = {}): Promise<MediaResult> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const buffer = fs.readFileSync(filePath);
      const filename = path.basename(filePath);
      
      // Create a File-like object for consistency
      const file = new File([buffer], filename, {
        type: this.getMimeTypeFromExtension(path.extname(filename))
      });
      
      return this.upload(file, options);
    } catch (error) {
      throw new Error(`Supabase Storage upload from path failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(publicId: string): Promise<DeleteResult> {
    try {
      const { error } = await this.client.storage
        .from(this.config.bucket)
        .remove([publicId]);

      if (error) {
        throw new Error(`Supabase Storage delete error: ${error.message}`);
      }
      
      return {
        publicId,
        result: 'ok'
      };
    } catch (error) {
      // Treat as success if file doesn't exist
      return {
        publicId,
        result: 'ok'
      };
    }
  }

  transform(url: string, transformations: Transformation[]): string {
    // Supabase Storage doesn't have built-in transformations
    // Could integrate with Supabase Image Transformations (if available) or external services
    console.warn('Supabase Storage: Image transformations not supported natively. Consider using external image optimization services.');
    return url;
  }

  getUrl(publicId: string, options: UrlOptions = {}): string {
    const { data } = this.client.storage
      .from(this.config.bucket)
      .getPublicUrl(publicId);
    
    return data.publicUrl;
  }

  async getSignedUrl(publicId: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.config.bucket)
      .createSignedUrl(publicId, expiresIn);

    if (error) {
      throw new Error(`Supabase Storage signed URL error: ${error.message}`);
    }

    return data.signedUrl;
  }

  private getExtensionFromFilename(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  }

  private getExtensionFromContentType(contentType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf',
      'application/zip': '.zip',
      'text/plain': '.txt'
    };
    
    return mimeToExt[contentType] || '';
  }

  private getMimeTypeFromExtension(ext: string): string {
    const extToMime: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.txt': 'text/plain'
    };
    
    return extToMime[ext.toLowerCase()] || 'application/octet-stream';
  }

  private mapSupabaseResult(uploadData: any, publicUrl: string, metadata: {
    contentType: string;
    originalFilename: string;
    folder: string;
    bytes: number;
  }): MediaResult {
    return {
      publicId: uploadData.path,
      url: publicUrl,
      secureUrl: publicUrl, // Supabase URLs are HTTPS
      format: this.getFormatFromContentType(metadata.contentType),
      resourceType: this.getResourceType(metadata.contentType),
      bytes: metadata.bytes,
      createdAt: new Date(),
      etag: uploadData.id || undefined,
      originalFilename: metadata.originalFilename,
      folder: metadata.folder
    };
  }

  private getFormatFromContentType(contentType: string): string {
    const mimeToFormat: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'application/pdf': 'pdf',
      'application/zip': 'zip',
      'text/plain': 'txt'
    };
    
    return mimeToFormat[contentType] || 'unknown';
  }

  private getResourceType(contentType: string): 'image' | 'video' | 'raw' {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    return 'raw';
  }
} 