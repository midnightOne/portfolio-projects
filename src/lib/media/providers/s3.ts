import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { 
  MediaProvider, 
  MediaResult, 
  DeleteResult, 
  UploadOptions, 
  Transformation, 
  UrlOptions,
  S3Config 
} from '../types';

export class S3Provider implements MediaProvider {
  name = 's3';
  private config: S3Config;
  private client: S3Client;

  constructor(config: S3Config) {
    this.config = config;
    
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async upload(file: File | Buffer, options: UploadOptions = {}): Promise<MediaResult> {
    try {
      let buffer: Buffer;
      let contentType: string;
      let originalFilename: string | undefined;
      
      if (file instanceof File) {
        buffer = Buffer.from(await file.arrayBuffer());
        contentType = file.type;
        originalFilename = file.name;
      } else {
        buffer = file;
        contentType = 'application/octet-stream';
      }

      // Generate key (path in S3)
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const folder = options.folder || 'uploads';
      const publicId = options.publicId || `${timestamp}-${randomString}`;
      const key = `${folder}/${publicId}`;

      // Determine file extension and format
      const format = this.getFormatFromContentType(contentType);
      const finalKey = format ? `${key}.${format}` : key;

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: finalKey,
        Body: buffer,
        ContentType: contentType,
        ACL: this.config.acl || 'public-read',
        Metadata: {
          originalFilename: originalFilename || '',
          uploadedAt: new Date().toISOString(),
          ...(options.context || {})
        },
        ...(options.tags && { Tagging: this.buildTagString(options.tags) })
      });

      const result = await this.client.send(command);
      
      // Get object metadata for complete result
      const headCommand = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: finalKey
      });
      const headResult = await this.client.send(headCommand);

      const url = this.getUrl(finalKey);
      
      return {
        publicId: finalKey,
        url,
        secureUrl: url, // S3 URLs are always HTTPS when accessed through CloudFront/directly
        format: format || 'unknown',
        resourceType: this.getResourceType(contentType),
        bytes: headResult.ContentLength || buffer.length,
        createdAt: headResult.LastModified || new Date(),
        etag: headResult.ETag?.replace(/"/g, ''),
        versionId: headResult.VersionId,
        originalFilename,
        folder
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`S3 upload from path failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(publicId: string): Promise<DeleteResult> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: publicId
      });

      await this.client.send(command);
      
      return {
        publicId,
        result: 'ok'
      };
    } catch (error) {
      // S3 doesn't throw an error for non-existent objects in delete operations
      return {
        publicId,
        result: 'ok'
      };
    }
  }

  transform(url: string, transformations: Transformation[]): string {
    // S3 doesn't have built-in transformations like Cloudinary
    // This would typically be handled by a service like AWS Lambda@Edge or CloudFront Functions
    // For now, we'll return the original URL with a note
    console.warn('S3 Provider: Image transformations not supported natively. Consider using AWS Lambda@Edge or an image optimization service.');
    return url;
  }

  getUrl(publicId: string, options: UrlOptions = {}): string {
    const baseUrl = this.config.cloudFrontUrl || 
      `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`;
    
    return `${baseUrl}/${publicId}`;
  }

  async getUploadUrl(options: UploadOptions = {}): Promise<{ url: string; fields: Record<string, string> }> {
    try {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const folder = options.folder || 'uploads';
      const publicId = options.publicId || `${timestamp}-${randomString}`;
      const key = `${folder}/${publicId}`;

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ACL: this.config.acl || 'public-read'
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

      return {
        url: signedUrl,
        fields: {
          key,
          bucket: this.config.bucket
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate S3 upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildTagString(tags: string[]): string {
    return tags.map(tag => `tag=${encodeURIComponent(tag)}`).join('&');
  }

  private getFormatFromContentType(contentType: string): string | null {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg', 
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'application/pdf': 'pdf',
      'application/zip': 'zip'
    };
    
    return mimeToExt[contentType] || null;
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
      '.mov': 'video/quicktime',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip'
    };
    
    return extToMime[ext.toLowerCase()] || 'application/octet-stream';
  }

  private getResourceType(contentType: string): 'image' | 'video' | 'raw' {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    return 'raw';
  }
} 