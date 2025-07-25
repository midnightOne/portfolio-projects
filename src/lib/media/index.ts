// Main media module exports
export * from './types';
export * from './factory';
export * from './validation';

// Provider exports
export { CloudinaryProvider } from './providers/cloudinary';
export { S3Provider } from './providers/s3';
export { VercelBlobProvider } from './providers/vercel-blob';
export { SupabaseStorageProvider } from './providers/supabase-storage';
export { GitHubJsDelivrProvider } from './providers/github-jsdelivr';

// Re-export commonly used functions for convenience
export {
  getMediaProvider,
  createMediaProvider,
  validateMediaProviderConfig,
  getCurrentProviderName,
  getAvailableProviders
} from './factory';

export {
  validateFile,
  validateFiles,
  getValidationForMediaType,
  detectMediaType,
  formatFileSize,
  isImageFile,
  isVideoFile,
  isFileSafe,
  sanitizeFilename
} from './validation'; 