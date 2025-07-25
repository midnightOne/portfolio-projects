import { put, del, PutBlobResult } from '@vercel/blob';
import { 
  MediaProvider, 
  MediaResult, 
  DeleteResult, 
  UploadOptions, 
  Transformation, 
  UrlOptions,
  VercelBlobConfig 
} from '../types';

export class VercelBlobProvider implements MediaProvider {
  name = 'vercel';
  private config: VercelBlobConfig;

  constructor(config: VercelBlobConfig) {
    this.config = config;
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

      // Generate pathname for the blob
      const folder = options.folder || 'uploads';
      const publicId = options.publicId || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const extension = this.getExtensionFromFilename(filename) || this.getExtensionFromContentType(contentType);
      const pathname = `${folder}/${publicId}${extension}`;

      // Upload to Vercel Blob
      const result: PutBlobResult = await put(pathname, buffer, {
        access: 'public',
        token: this.config.token,
        contentType
      });

      return this.mapVercelBlobResult(result, {
        contentType,
        originalFilename: filename,
        folder,
        bytes: buffer.length
      });
    } catch (error) {
      throw new Error(`Vercel Blob upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Vercel Blob upload from path failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(publicId: string): Promise<DeleteResult> {
    try {
      await del(publicId, {
        token: this.config.token
      });
      
      return {
        publicId,
        result: 'ok'
      };
    } catch (error) {
      // Vercel Blob returns 404 for non-existent files, treat as success
      return {
        publicId,
        result: 'ok'
      };
    }
  }

  transform(url: string, transformations: Transformation[]): string {
    // Vercel Blob doesn't have built-in transformations
    // Could integrate with services like Next.js Image Optimization or external services
    console.warn('Vercel Blob: Image transformations not supported natively. Consider using Next.js Image component for optimization.');
    return url;
  }

  getUrl(publicId: string, options: UrlOptions = {}): string {
    // For Vercel Blob, the publicId is typically the full URL
    // If it's just the pathname, we need to construct the full URL
    if (publicId.startsWith('https://')) {
      return publicId;
    }
    
    // This would need to be constructed based on your Vercel deployment
    // For now, return as-is since Vercel Blob URLs are typically full URLs
    return publicId;
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

  private mapVercelBlobResult(result: PutBlobResult, metadata: {
    contentType: string;
    originalFilename: string;
    folder: string;
    bytes: number;
  }): MediaResult {
    // Extract pathname from URL for publicId
    const url = new URL(result.url);
    const publicId = url.pathname.substring(1); // Remove leading slash

    return {
      publicId,
      url: result.url,
      secureUrl: result.url, // Vercel Blob URLs are always HTTPS
      format: this.getFormatFromContentType(metadata.contentType),
      resourceType: this.getResourceType(metadata.contentType),
      bytes: metadata.bytes,
      createdAt: new Date(),
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