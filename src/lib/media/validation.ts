import { FileValidation, ValidationResult } from './types';

// Default file validation configuration
export const DEFAULT_FILE_VALIDATION: FileValidation = {
  maxSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: [
    // Images
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    // Videos
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo', // .avi
    
    // Documents
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.android.package-archive', // .apk
    'application/octet-stream', // executables
    'text/plain',
    
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg'
  ],
  allowedExtensions: [
    // Images
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    
    // Videos
    '.mp4',
    '.webm',
    '.mov',
    '.avi',
    
    // Documents
    '.pdf',
    '.zip',
    '.apk',
    '.exe',
    '.dmg',
    '.txt',
    
    // Audio
    '.mp3',
    '.wav',
    '.ogg'
  ]
};

// Media type specific validations
export const MEDIA_TYPE_VALIDATIONS: Record<string, FileValidation> = {
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB for images
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  },
  
  video: {
    maxSize: 100 * 1024 * 1024, // 100MB for videos
    allowedTypes: [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo'
    ],
    allowedExtensions: ['.mp4', '.webm', '.mov', '.avi']
  },
  
  attachment: {
    maxSize: 50 * 1024 * 1024, // 50MB for attachments
    allowedTypes: [
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.android.package-archive',
      'application/octet-stream',
      'text/plain'
    ],
    allowedExtensions: ['.pdf', '.zip', '.apk', '.exe', '.dmg', '.txt']
  }
};

/**
 * Validates a file against the given validation rules
 */
export function validateFile(file: File, validation: FileValidation = DEFAULT_FILE_VALIDATION): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (file.size > validation.maxSize) {
    errors.push(`File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(validation.maxSize)})`);
  }

  // Check MIME type
  if (validation.allowedTypes.length > 0 && !validation.allowedTypes.includes(file.type)) {
    errors.push(`File type "${file.type}" is not allowed. Allowed types: ${validation.allowedTypes.join(', ')}`);
  }

  // Check file extension
  const extension = getFileExtension(file.name);
  if (validation.allowedExtensions.length > 0 && !validation.allowedExtensions.includes(extension)) {
    errors.push(`File extension "${extension}" is not allowed. Allowed extensions: ${validation.allowedExtensions.join(', ')}`);
  }

  // Check for potentially dangerous files
  const dangerousExtensions = ['.js', '.html', '.htm', '.php', '.asp', '.aspx', '.jsp'];
  if (dangerousExtensions.includes(extension.toLowerCase())) {
    errors.push(`File extension "${extension}" is not allowed for security reasons`);
  }

  // File size warnings
  const warningThreshold = validation.maxSize * 0.8; // 80% of max size
  if (file.size > warningThreshold && file.size <= validation.maxSize) {
    warnings.push(`File size is approaching the maximum limit (${formatFileSize(file.size)} / ${formatFileSize(validation.maxSize)})`);
  }

  // MIME type vs extension mismatch warning
  const expectedType = getMimeTypeFromExtension(extension);
  if (expectedType && expectedType !== file.type) {
    warnings.push(`File type "${file.type}" doesn't match extension "${extension}" (expected "${expectedType}")`);
  }

  return {
    valid: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validates multiple files at once
 */
export function validateFiles(files: File[], validation: FileValidation = DEFAULT_FILE_VALIDATION): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  files.forEach((file, index) => {
    const result = validateFile(file, validation);
    
    if (!result.valid && result.error) {
      allErrors.push(`File ${index + 1} (${file.name}): ${result.error}`);
    }
    
    if (result.warnings) {
      result.warnings.forEach(warning => {
        allWarnings.push(`File ${index + 1} (${file.name}): ${warning}`);
      });
    }
  });

  return {
    valid: allErrors.length === 0,
    error: allErrors.length > 0 ? allErrors.join('\n') : undefined,
    warnings: allWarnings.length > 0 ? allWarnings : undefined
  };
}

/**
 * Gets appropriate validation rules for a media type
 */
export function getValidationForMediaType(mediaType: 'image' | 'video' | 'attachment'): FileValidation {
  return MEDIA_TYPE_VALIDATIONS[mediaType] || DEFAULT_FILE_VALIDATION;
}

/**
 * Detects media type from file
 */
export function detectMediaType(file: File): 'image' | 'video' | 'attachment' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'attachment';
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot).toLowerCase() : '';
}

/**
 * Gets MIME type from file extension
 */
export function getMimeTypeFromExtension(extension: string): string | null {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
  };
  
  return mimeTypes[extension.toLowerCase()] || null;
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Checks if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Checks if file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Checks if file is safe to upload (basic security check)
 */
export function isFileSafe(file: File): boolean {
  const extension = getFileExtension(file.name);
  const dangerousExtensions = [
    '.js', '.html', '.htm', '.php', '.asp', '.aspx', '.jsp', 
    '.bat', '.cmd', '.com', '.scr', '.vbs', '.wsf', '.wsh'
  ];
  
  return !dangerousExtensions.includes(extension.toLowerCase());
}

/**
 * Generates a safe filename by removing/replacing unsafe characters
 */
export function sanitizeFilename(filename: string): string {
  // Replace unsafe characters with underscores
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
} 