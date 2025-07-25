/**
 * API-specific types and validation schemas
 */

import { z } from 'zod';
import { ProjectStatusSchema, ProjectVisibilitySchema, MediaTypeSchema } from './project';

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================

// Search and filtering
export const SearchProjectsSchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: ProjectStatusSchema.optional(),
  visibility: ProjectVisibilitySchema.optional(),
  sortBy: z.enum(['relevance', 'date', 'title', 'popularity']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// File upload
export const FileUploadSchema = z.object({
  type: z.enum(['image', 'video', 'attachment']),
  projectId: z.string().cuid().optional(),
  description: z.string().optional(),
});

// Analytics tracking
export const TrackAnalyticsSchema = z.object({
  projectId: z.string().cuid(),
  event: z.enum(['VIEW', 'DOWNLOAD', 'EXTERNAL_LINK_CLICK', 'INTERACTIVE_ENGAGE']),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Bulk operations
export const BulkUpdateProjectsSchema = z.object({
  projectIds: z.array(z.string().cuid()),
  updates: z.object({
    status: ProjectStatusSchema.optional(),
    visibility: ProjectVisibilitySchema.optional(),
    tags: z.array(z.string()).optional(),
  }),
});

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  timestamp: z.string(),
  path: z.string(),
});

export const ApiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  timestamp: z.string().optional(),
});

export const PaginatedResponseSchema = z.object({
  items: z.array(z.any()),
  totalCount: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  hasMore: z.boolean(),
  totalPages: z.number().int(),
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type SearchProjectsParams = z.infer<typeof SearchProjectsSchema>;
export type FileUploadParams = z.infer<typeof FileUploadSchema>;
export type TrackAnalyticsParams = z.infer<typeof TrackAnalyticsSchema>;
export type BulkUpdateProjectsParams = z.infer<typeof BulkUpdateProjectsSchema>;

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiSuccess<T = any> = {
  success: true;
  data: T;
  timestamp?: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  totalPages: number;
};

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ProjectsResponse {
  projects: any[];
  totalCount: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

export interface ProjectResponse {
  project: any;
  relatedProjects: any[];
}

export interface TagsResponse {
  tags: any[];
}

export interface MediaUploadResponse {
  mediaItem: any;
  url: string;
}

export interface AnalyticsResponse {
  totalViews: number;
  popularProjects: any[];
  viewsByDate: Array<{
    date: string;
    views: number;
  }>;
}

export interface DatabaseStatusResponse {
  provider: string;
  connected: boolean;
  version?: string;
  features: string[];
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate and parse API request data
 */
export function validateApiRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return {
      success: false,
      errors: ['Invalid request data'],
    };
  }
}

/**
 * Create standardized API error response
 */
export function createApiError(
  code: string,
  message: string,
  details?: any,
  path?: string
): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    path: path || '',
  };
}

/**
 * Create standardized API success response
 */
export function createApiSuccess<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(totalCount / limit);
  const hasMore = page < totalPages;

  return {
    items,
    totalCount,
    page,
    limit,
    hasMore,
    totalPages,
  };
}