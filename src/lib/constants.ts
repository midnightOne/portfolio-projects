// Application constants

export const APP_CONFIG = {
  name: 'Portfolio Projects',
  description: 'A showcase of creative and technical projects',
  version: '1.0.0',
} as const;

export const API_ROUTES = {
  projects: '/api/projects',
  search: '/api/projects/search',
  media: '/api/media',
  analytics: '/api/analytics',
  auth: '/api/auth',
} as const;

export const MEDIA_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedVideoTypes: ['video/mp4', 'video/webm'],
  allowedAttachmentTypes: [
    'application/zip',
    'application/pdf',
    'application/vnd.android.package-archive', // APK
    'application/x-msdownload', // EXE
  ],
} as const;

export const PAGINATION = {
  defaultLimit: 12,
  maxLimit: 50,
} as const;

export const TAGS = {
  colors: [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ],
} as const;

// Re-export layout constants for convenience
export * from './constants/layout';