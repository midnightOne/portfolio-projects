// Media provider types and interfaces

export interface UploadOptions {
  folder?: string;
  publicId?: string;
  transformation?: Transformation[];
  tags?: string[];
  context?: Record<string, any>;
}

export interface Transformation {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'pad';
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  gravity?: 'auto' | 'face' | 'center';
}

export interface UrlOptions {
  transformation?: Transformation[];
  secure?: boolean;
  format?: string;
}

export interface MediaResult {
  publicId: string;
  url: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format: string;
  resourceType: 'image' | 'video' | 'raw';
  bytes: number;
  createdAt: Date;
  etag?: string;
  signature?: string;
  versionId?: string;
  folder?: string;
  originalFilename?: string;
}

export interface DeleteResult {
  publicId: string;
  result: 'ok' | 'not found';
}

// Core media provider interface that all providers must implement
export interface MediaProvider {
  name: string;
  upload(file: File | Buffer, options: UploadOptions): Promise<MediaResult>;
  uploadFromPath(filePath: string, options: UploadOptions): Promise<MediaResult>;
  delete(publicId: string): Promise<DeleteResult>;
  transform(url: string, transformations: Transformation[]): string;
  getUrl(publicId: string, options?: UrlOptions): string;
  getUploadUrl?(options: UploadOptions): Promise<{ url: string; fields: Record<string, string> }>;
}

// Provider configuration interfaces
export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  secure?: boolean;
  folder?: string;
}

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  cloudFrontUrl?: string;
  acl?: 'public-read' | 'private';
}

export interface VercelBlobConfig {
  token: string;
}

export interface SupabaseStorageConfig {
  url: string;
  serviceKey: string;
  bucket: string;
}

export interface GitHubJsDelivrConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

// Unified provider configuration
export interface MediaProviderConfig {
  provider: 'cloudinary' | 's3' | 'vercel' | 'supabase' | 'github';
  cloudinary?: CloudinaryConfig;
  s3?: S3Config;
  vercel?: VercelBlobConfig;
  supabase?: SupabaseStorageConfig;
  github?: GitHubJsDelivrConfig;
}

// File validation types
export interface FileValidation {
  maxSize: number; // in bytes
  allowedTypes: string[];
  allowedExtensions: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

// Upload result for API responses
export interface UploadApiResult {
  success: boolean;
  data?: {
    id: string;
    url: string;
    publicId: string;
    format: string;
    width?: number;
    height?: number;
    bytes: number;
    resourceType: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
} 