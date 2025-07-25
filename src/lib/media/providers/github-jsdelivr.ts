import { Octokit } from '@octokit/rest';
import { 
  MediaProvider, 
  MediaResult, 
  DeleteResult, 
  UploadOptions, 
  Transformation, 
  UrlOptions,
  GitHubJsDelivrConfig 
} from '../types';

export class GitHubJsDelivrProvider implements MediaProvider {
  name = 'github';
  private config: GitHubJsDelivrConfig;
  private octokit: Octokit;

  constructor(config: GitHubJsDelivrConfig) {
    this.config = config;
    
    this.octokit = new Octokit({
      auth: config.token
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

      // Convert buffer to base64
      const content = buffer.toString('base64');

      // Upload to GitHub repository
      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.config.owner,
        repo: this.config.repo,
        path: filePath,
        message: `Upload ${filename}`,
        content,
        branch: this.config.branch || 'main'
      });

      // Generate jsDelivr CDN URL
      const jsdelivrUrl = this.generateJsDelivrUrl(filePath);

      return this.mapGitHubResult(data, jsdelivrUrl, {
        contentType,
        originalFilename: filename,
        folder,
        bytes: buffer.length,
        filePath
      });
    } catch (error) {
      throw new Error(`GitHub upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`GitHub upload from path failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(publicId: string): Promise<DeleteResult> {
    try {
      // Get file info first to get the SHA
      const { data: fileData } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path: publicId,
        ref: this.config.branch || 'main'
      });

      if (!Array.isArray(fileData) && 'sha' in fileData) {
        // Delete the file
        await this.octokit.rest.repos.deleteFile({
          owner: this.config.owner,
          repo: this.config.repo,
          path: publicId,
          message: `Delete ${publicId}`,
          sha: fileData.sha,
          branch: this.config.branch || 'main'
        });
      }
      
      return {
        publicId,
        result: 'ok'
      };
    } catch (error) {
      // File might not exist, treat as success
      return {
        publicId,
        result: 'ok'
      };
    }
  }

  transform(url: string, transformations: Transformation[]): string {
    // GitHub + jsDelivr doesn't have built-in image transformations
    // Could potentially use query parameters for basic transformations if supported
    console.warn('GitHub + jsDelivr: Image transformations not supported. Consider using external image optimization services.');
    return url;
  }

  getUrl(publicId: string, options: UrlOptions = {}): string {
    return this.generateJsDelivrUrl(publicId);
  }

  private generateJsDelivrUrl(filePath: string): string {
    const branch = this.config.branch || 'main';
    return `https://cdn.jsdelivr.net/gh/${this.config.owner}/${this.config.repo}@${branch}/${filePath}`;
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

  private mapGitHubResult(uploadData: any, jsdelivrUrl: string, metadata: {
    contentType: string;
    originalFilename: string;
    folder: string;
    bytes: number;
    filePath: string;
  }): MediaResult {
    return {
      publicId: metadata.filePath,
      url: jsdelivrUrl,
      secureUrl: jsdelivrUrl, // jsDelivr URLs are HTTPS
      format: this.getFormatFromContentType(metadata.contentType),
      resourceType: this.getResourceType(metadata.contentType),
      bytes: metadata.bytes,
      createdAt: new Date(),
      etag: uploadData.content?.sha || undefined,
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