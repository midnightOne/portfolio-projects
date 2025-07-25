/**
 * Main types export file
 */

// Project types
export * from './project';
export * from './api';
export * from './auth';

// Re-export commonly used types
export type {
  Project,
  ProjectWithRelations,
  CreateProject,
  UpdateProject,
  Tag,
  MediaItem,
  ExternalLink,
  DownloadableFile,
  InteractiveExample,
  ArticleContent,
  MediaCarousel,
  CarouselImage,
  ProjectReference,
  ProjectAnalytics,
} from './project';

export type {
  SearchProjectsParams,
  FileUploadParams,
  TrackAnalyticsParams,
  BulkUpdateProjectsParams,
  ApiError,
  ApiSuccess,
  PaginatedResponse,
  ProjectsResponse,
  ProjectResponse,
  TagsResponse,
  MediaUploadResponse,
  AnalyticsResponse,
  DatabaseStatusResponse,
} from './api';

export type {
  AuthUser,
  LoginCredentials,
  AuthSession,
} from './auth';