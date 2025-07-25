import { MediaProvider, MediaProviderConfig } from './types';
import { CloudinaryProvider } from './providers/cloudinary';
import { S3Provider } from './providers/s3';
import { VercelBlobProvider } from './providers/vercel-blob';
import { SupabaseStorageProvider } from './providers/supabase-storage';
import { GitHubJsDelivrProvider } from './providers/github-jsdelivr';

// Environment variable keys
const ENV_KEYS = {
  MEDIA_PROVIDER: 'MEDIA_PROVIDER',
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: 'CLOUDINARY_CLOUD_NAME',
  CLOUDINARY_API_KEY: 'CLOUDINARY_API_KEY',
  CLOUDINARY_API_SECRET: 'CLOUDINARY_API_SECRET',
  CLOUDINARY_FOLDER: 'CLOUDINARY_FOLDER',
  // AWS S3
  AWS_ACCESS_KEY_ID: 'AWS_ACCESS_KEY_ID',
  AWS_SECRET_ACCESS_KEY: 'AWS_SECRET_ACCESS_KEY',
  AWS_REGION: 'AWS_REGION',
  AWS_S3_BUCKET: 'AWS_S3_BUCKET',
  AWS_CLOUDFRONT_URL: 'AWS_CLOUDFRONT_URL',
  AWS_S3_ACL: 'AWS_S3_ACL',
  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: 'BLOB_READ_WRITE_TOKEN',
  // Supabase Storage
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_SERVICE_KEY: 'SUPABASE_SERVICE_KEY',
  SUPABASE_STORAGE_BUCKET: 'SUPABASE_STORAGE_BUCKET',
  // GitHub + jsDelivr
  GITHUB_TOKEN: 'GITHUB_TOKEN',
  GITHUB_OWNER: 'GITHUB_OWNER',
  GITHUB_REPO: 'GITHUB_REPO',
  GITHUB_BRANCH: 'GITHUB_BRANCH'
} as const;

/**
 * Creates a media provider instance based on environment configuration
 */
export function createMediaProvider(): MediaProvider {
  const config = getMediaProviderConfig();
  
  switch (config.provider) {
    case 'cloudinary':
      if (!config.cloudinary) {
        throw new Error('Cloudinary configuration is missing');
      }
      return new CloudinaryProvider(config.cloudinary);
      
    case 's3':
      if (!config.s3) {
        throw new Error('S3 configuration is missing');
      }
      return new S3Provider(config.s3);
      
    case 'vercel':
      if (!config.vercel) {
        throw new Error('Vercel Blob configuration is missing');
      }
      return new VercelBlobProvider(config.vercel);
      
    case 'supabase':
      if (!config.supabase) {
        throw new Error('Supabase Storage configuration is missing');
      }
      return new SupabaseStorageProvider(config.supabase);
      
    case 'github':
      if (!config.github) {
        throw new Error('GitHub + jsDelivr configuration is missing');
      }
      return new GitHubJsDelivrProvider(config.github);
      
    default:
      throw new Error(`Unsupported media provider: ${config.provider}`);
  }
}

/**
 * Gets media provider configuration from environment variables
 */
export function getMediaProviderConfig(): MediaProviderConfig {
  const provider = (process.env[ENV_KEYS.MEDIA_PROVIDER] || 'cloudinary') as MediaProviderConfig['provider'];
  
  const config: MediaProviderConfig = {
    provider
  };
  
  // Configure based on selected provider
  switch (provider) {
    case 'cloudinary':
      config.cloudinary = getCloudinaryConfig();
      break;
      
    case 's3':
      config.s3 = getS3Config();
      break;
      
    case 'vercel':
      config.vercel = getVercelBlobConfig();
      break;
      
    case 'supabase':
      config.supabase = getSupabaseStorageConfig();
      break;
      
    case 'github':
      config.github = getGitHubJsDelivrConfig();
      break;
      
    default:
      throw new Error(`Provider ${provider} configuration not implemented`);
  }
  
  return config;
}

/**
 * Gets Cloudinary configuration from environment variables
 */
function getCloudinaryConfig() {
  const cloudName = process.env[ENV_KEYS.CLOUDINARY_CLOUD_NAME];
  const apiKey = process.env[ENV_KEYS.CLOUDINARY_API_KEY];
  const apiSecret = process.env[ENV_KEYS.CLOUDINARY_API_SECRET];
  
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Missing required Cloudinary environment variables. ' +
      'Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    );
  }
  
  return {
    cloudName,
    apiKey,
    apiSecret,
    secure: true,
    folder: process.env[ENV_KEYS.CLOUDINARY_FOLDER] || 'portfolio-projects'
  };
}

/**
 * Gets S3 configuration from environment variables
 */
function getS3Config() {
  const accessKeyId = process.env[ENV_KEYS.AWS_ACCESS_KEY_ID];
  const secretAccessKey = process.env[ENV_KEYS.AWS_SECRET_ACCESS_KEY];
  const region = process.env[ENV_KEYS.AWS_REGION];
  const bucket = process.env[ENV_KEYS.AWS_S3_BUCKET];
  
  if (!accessKeyId || !secretAccessKey || !region || !bucket) {
    throw new Error(
      'Missing required S3 environment variables. ' +
      'Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET.'
    );
  }
  
  return {
    accessKeyId,
    secretAccessKey,
    region,
    bucket,
    cloudFrontUrl: process.env[ENV_KEYS.AWS_CLOUDFRONT_URL],
    acl: (process.env[ENV_KEYS.AWS_S3_ACL] as 'public-read' | 'private') || 'public-read'
  };
}

/**
 * Gets Vercel Blob configuration from environment variables
 */
function getVercelBlobConfig() {
  const token = process.env[ENV_KEYS.BLOB_READ_WRITE_TOKEN];
  
  if (!token) {
    throw new Error(
      'Missing required Vercel Blob environment variable. ' +
      'Please set BLOB_READ_WRITE_TOKEN.'
    );
  }
  
  return {
    token
  };
}

/**
 * Gets Supabase Storage configuration from environment variables
 */
function getSupabaseStorageConfig() {
  const url = process.env[ENV_KEYS.SUPABASE_URL];
  const serviceKey = process.env[ENV_KEYS.SUPABASE_SERVICE_KEY];
  const bucket = process.env[ENV_KEYS.SUPABASE_STORAGE_BUCKET];
  
  if (!url || !serviceKey || !bucket) {
    throw new Error(
      'Missing required Supabase Storage environment variables. ' +
      'Please set SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_STORAGE_BUCKET.'
    );
  }
  
  return {
    url,
    serviceKey,
    bucket
  };
}

/**
 * Gets GitHub + jsDelivr configuration from environment variables
 */
function getGitHubJsDelivrConfig() {
  const token = process.env[ENV_KEYS.GITHUB_TOKEN];
  const owner = process.env[ENV_KEYS.GITHUB_OWNER];
  const repo = process.env[ENV_KEYS.GITHUB_REPO];
  
  if (!token || !owner || !repo) {
    throw new Error(
      'Missing required GitHub environment variables. ' +
      'Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO.'
    );
  }
  
  return {
    token,
    owner,
    repo,
    branch: process.env[ENV_KEYS.GITHUB_BRANCH] || 'main'
  };
}

/**
 * Validates that the current media provider configuration is complete
 */
export function validateMediaProviderConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    const config = getMediaProviderConfig();
    
    // Attempt to create provider to validate configuration
    const provider = createMediaProvider();
    
    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown configuration error');
    return { valid: false, errors };
  }
}

/**
 * Gets the current media provider name without creating an instance
 */
export function getCurrentProviderName(): string {
  return process.env[ENV_KEYS.MEDIA_PROVIDER] || 'cloudinary';
}

/**
 * Gets available provider names
 */
export function getAvailableProviders(): string[] {
  return ['cloudinary', 's3', 'vercel', 'supabase', 'github'];
}

/**
 * Gets provider-specific configuration requirements
 */
export function getProviderRequirements(provider: string): { required: string[]; optional: string[] } {
  switch (provider) {
    case 'cloudinary':
      return {
        required: [
          'CLOUDINARY_CLOUD_NAME',
          'CLOUDINARY_API_KEY', 
          'CLOUDINARY_API_SECRET'
        ],
        optional: ['CLOUDINARY_FOLDER']
      };
      
    case 's3':
      return {
        required: [
          'AWS_ACCESS_KEY_ID',
          'AWS_SECRET_ACCESS_KEY',
          'AWS_REGION',
          'AWS_S3_BUCKET'
        ],
        optional: ['AWS_CLOUDFRONT_URL', 'AWS_S3_ACL']
      };
      
    case 'vercel':
      return {
        required: ['BLOB_READ_WRITE_TOKEN'],
        optional: []
      };
      
    case 'supabase':
      return {
        required: [
          'SUPABASE_URL',
          'SUPABASE_SERVICE_KEY',
          'SUPABASE_STORAGE_BUCKET'
        ],
        optional: []
      };
      
    case 'github':
      return {
        required: [
          'GITHUB_TOKEN',
          'GITHUB_OWNER',
          'GITHUB_REPO'
        ],
        optional: ['GITHUB_BRANCH']
      };
      
    default:
      return { required: [], optional: [] };
  }
}

// Singleton instance for the application
let mediaProviderInstance: MediaProvider | null = null;

/**
 * Gets or creates a singleton media provider instance
 */
export function getMediaProvider(): MediaProvider {
  if (!mediaProviderInstance) {
    mediaProviderInstance = createMediaProvider();
  }
  return mediaProviderInstance;
}

/**
 * Resets the singleton instance (useful for testing or config changes)
 */
export function resetMediaProvider(): void {
  mediaProviderInstance = null;
} 