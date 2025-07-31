/**
 * Project-related TypeScript interfaces and types
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const ProjectStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const ProjectVisibility = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  UNLISTED: 'UNLISTED',
} as const;

export const MediaType = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  GIF: 'GIF',
  WEBM: 'WEBM',
  AUDIO: 'AUDIO',
  DOCUMENT: 'DOCUMENT',
} as const;

export const InteractiveType = {
  CANVAS: 'CANVAS',
  IFRAME: 'IFRAME',
  WEBXR: 'WEBXR',
  EMBED: 'EMBED',
} as const;

export const AnalyticsEvent = {
  VIEW: 'VIEW',
  DOWNLOAD: 'DOWNLOAD',
  EXTERNAL_LINK_CLICK: 'EXTERNAL_LINK_CLICK',
  INTERACTIVE_ENGAGE: 'INTERACTIVE_ENGAGE',
} as const;

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const ProjectStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const ProjectVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE', 'UNLISTED']);
export const MediaTypeSchema = z.enum(['IMAGE', 'VIDEO', 'GIF', 'WEBM', 'AUDIO', 'DOCUMENT']);
export const InteractiveTypeSchema = z.enum(['CANVAS', 'IFRAME', 'WEBXR', 'EMBED']);
export const AnalyticsEventSchema = z.enum(['VIEW', 'DOWNLOAD', 'EXTERNAL_LINK_CLICK', 'INTERACTIVE_ENGAGE']);

// Tag validation
export const TagSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  createdAt: z.date(),
});

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
});

// Media Item validation
export const MediaItemSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid().nullable().optional(),
  type: MediaTypeSchema,
  url: z.string().url().max(500),
  thumbnailUrl: z.string().url().max(500).nullable().optional(),
  altText: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  fileSize: z.bigint().positive().nullable().optional(),
  displayOrder: z.number().int().default(0),
  createdAt: z.date(),
});

export const CreateMediaItemSchema = z.object({
  projectId: z.string().cuid().nullable().optional(),
  type: MediaTypeSchema,
  url: z.string().url().max(500),
  thumbnailUrl: z.string().url().max(500).nullable().optional(),
  altText: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  fileSize: z.bigint().positive().nullable().optional(),
  displayOrder: z.number().int().default(0),
});

// External Link validation
export const ExternalLinkSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  label: z.string().min(1).max(255),
  url: z.string().url().max(500),
  icon: z.string().max(50).nullable().optional(),
  description: z.string().nullable().optional(),
  order: z.number().int().default(0),
  createdAt: z.date(),
});

export const CreateExternalLinkSchema = z.object({
  label: z.string().min(1).max(255),
  url: z.string().url().max(500),
  icon: z.string().max(50).nullable().optional(),
  description: z.string().nullable().optional(),
  order: z.number().int().default(0),
});

// Downloadable File validation
export const DownloadableFileSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  filename: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSize: z.bigint().positive(),
  downloadUrl: z.string().url().max(500),
  description: z.string().nullable().optional(),
  uploadDate: z.date(),
});

export const CreateDownloadableFileSchema = z.object({
  filename: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSize: z.bigint().positive(),
  downloadUrl: z.string().url().max(500),
  description: z.string().nullable().optional(),
});

// Interactive Example validation
export const InteractiveExampleSchema = z.object({
  id: z.string().cuid(),
  projectId: z.string().cuid(),
  type: InteractiveTypeSchema,
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  url: z.string().url().max(500).nullable().optional(),
  embedCode: z.string().nullable().optional(),
  fallbackContent: z.string().nullable().optional(),
  securitySettings: z.any().nullable().optional(),
  displayOrder: z.number().int().default(0),
  createdAt: z.date(),
});

export const CreateInteractiveExampleSchema = z.object({
  type: InteractiveTypeSchema,
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  url: z.string().url().max(500).nullable().optional(),
  embedCode: z.string().nullable().optional(),
  fallbackContent: z.string().nullable().optional(),
  securitySettings: z.any().nullable().optional(),
  displayOrder: z.number().int().default(0),
});

// Project validation
export const ProjectSchema = z.object({
  id: z.string().cuid(),
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  briefOverview: z.string().optional(),
  workDate: z.date().optional(),
  status: ProjectStatusSchema.default('DRAFT'),
  visibility: ProjectVisibilitySchema.default('PUBLIC'),
  viewCount: z.number().int().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  thumbnailImageId: z.string().cuid().optional(),
  metadataImageId: z.string().cuid().optional(),
});

export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  briefOverview: z.string().optional(),
  workDate: z.date().optional(),
  status: ProjectStatusSchema.default('DRAFT'),
  visibility: ProjectVisibilitySchema.default('PUBLIC'),
  thumbnailImageId: z.string().cuid().optional(),
  metadataImageId: z.string().cuid().optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  id: z.string().cuid(),
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectVisibility = z.infer<typeof ProjectVisibilitySchema>;
export type MediaType = z.infer<typeof MediaTypeSchema>;
export type InteractiveType = z.infer<typeof InteractiveTypeSchema>;
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

export type Tag = z.infer<typeof TagSchema>;
export type CreateTag = z.infer<typeof CreateTagSchema>;

export type MediaItem = z.infer<typeof MediaItemSchema>;
export type CreateMediaItem = z.infer<typeof CreateMediaItemSchema>;

export type ExternalLink = z.infer<typeof ExternalLinkSchema>;
export type CreateExternalLink = z.infer<typeof CreateExternalLinkSchema>;

export type DownloadableFile = z.infer<typeof DownloadableFileSchema>;
export type CreateDownloadableFile = z.infer<typeof CreateDownloadableFileSchema>;

export type InteractiveExample = z.infer<typeof InteractiveExampleSchema>;
export type CreateInteractiveExample = z.infer<typeof CreateInteractiveExampleSchema>;

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

export interface ProjectWithRelations extends Project {
  tags: Tag[];
  thumbnailImage?: MediaItem | null;
  metadataImage?: MediaItem | null;
  mediaItems: MediaItem[];
  articleContent?: ArticleContent | null;
  interactiveExamples: InteractiveExample[];
  externalLinks: ExternalLink[];
  downloadableFiles: DownloadableFile[];
  carousels: MediaCarousel[];
  analytics?: ProjectAnalytics[];
  _count?: {
    mediaItems: number;
    downloadableFiles: number;
    externalLinks: number;
    analytics: number;
  };
}

export interface ArticleContent {
  id: string;
  projectId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  embeddedMedia: EmbeddedMedia[];
}

export interface EmbeddedMedia {
  id: string;
  articleContentId: string;
  mediaItemId: string;
  position: number;
  caption?: string | null;
  mediaItem: MediaItem;
}

export interface MediaCarousel {
  id: string;
  projectId: string;
  title?: string | null;
  description?: string | null;
  displayOrder: number;
  createdAt: Date;
  images: CarouselImage[];
}

export interface CarouselImage {
  id: string;
  carouselId: string;
  mediaItemId: string;
  description?: string;
  order: number;
  mediaItem: MediaItem;
}

export interface ProjectReference {
  id: string;
  referencingProjectId: string;
  referencedProjectId: string;
  context?: string;
  createdAt: Date;
  referencingProject: Project;
  referencedProject: Project;
}

export interface ProjectAnalytics {
  id: string;
  projectId: string;
  event: AnalyticsEvent;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// AI-RELATED TYPES
// ============================================================================

export interface AISettings {
  id: string;
  anthropicApiKey?: string | null;
  openaiApiKey?: string | null;
  systemPrompt: string;
  preferredProvider: 'anthropic' | 'openai';
  preferredModel: string;
  temperature: number;
  maxTokens: number;
  dailyCostLimit: number;
  monthlyTokenLimit: number;
  conversationHistory: boolean;
  autoSaveInterval: number;
  maxVersionsPerProject: number;
  autoDeleteOldVersions: boolean;
  versionRetentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConversation {
  id: string;
  projectId: string;
  title?: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  messages: AIMessage[];
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string | null;
  tokens?: number | null;
  context?: Record<string, any> | null;
}

export interface ContentVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  contentSnapshot: Record<string, any>;
  changeSummary?: string | null;
  changedBy: 'user' | 'ai';
  aiConversationId?: string | null;
  createdAt: Date;
}

export interface AIProvider {
  name: 'anthropic' | 'openai';
  models: AIModel[];
  isConfigured: boolean;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface AIModel {
  id: string;
  name: string;
  maxTokens: number;
  costPer1kTokens: number;
  capabilities: string[];
}

export interface ProjectContext {
  currentContent: string;
  tags: string[];
  externalLinks: ExternalLink[];
  mediaItems: MediaItem[];
  selectedText?: TextSelection;
  metadata: {
    title: string;
    description: string;
    workDate?: Date;
    status: string;
  };
}

export interface TextSelection {
  start: number;
  end: number;
  text: string;
  context: string;
}

export interface AIRequest {
  prompt: string;
  context: ProjectContext;
  systemPrompt?: string;
  model: string;
  provider: 'anthropic' | 'openai';
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  error?: string;
  metadata: {
    model: string;
    tokens: number;
    cost: number;
    duration: number;
  };
}

export interface StructuredAIResponse {
  reasoning: string;
  changes: {
    articleContent?: string;
    partialUpdate?: {
      start: number;
      end: number;
      content: string;
      reasoning: string;
      preserveFormatting: boolean;
    };
    metadata?: {
      title?: string;
      description?: string;
      briefOverview?: string;
      tags?: {
        add: string[];
        remove: string[];
        reasoning: string;
      };
      externalLinks?: {
        add: ExternalLink[];
        remove: string[];
        reasoning: string;
      };
    };
    media?: {
      suggestions: MediaSuggestion[];
      reorder?: { id: string; newOrder: number }[];
      reasoning: string;
    };
  };
  confidence: number;
  warnings: string[];
  modelUsed: string;
  tokensUsed: number;
}

export interface MediaSuggestion {
  type: 'add' | 'remove' | 'replace';
  targetId?: string;
  suggestion: string;
  placement: 'inline' | 'gallery' | 'header';
  reasoning: string;
}

export interface ParsedChanges {
  articleContent?: string;
  partialUpdate?: {
    start: number;
    end: number;
    content: string;
    reasoning: string;
    preserveFormatting: boolean;
  };
  tagsToAdd: string[];
  tagsToRemove: string[];
  metadataChanges?: {
    title?: string;
    description?: string;
    briefOverview?: string;
    externalLinks?: {
      add: ExternalLink[];
      remove: string[];
    };
  };
  mediaSuggestions: MediaSuggestion[];
  confidence: number;
  warnings: string[];
}