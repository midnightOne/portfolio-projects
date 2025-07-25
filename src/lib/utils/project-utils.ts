/**
 * Utility functions for working with project data
 */

import { ProjectWithRelations, Project, Tag, MediaItem } from '../types/project';

// ============================================================================
// PROJECT UTILITIES
// ============================================================================

/**
 * Generate a URL-friendly slug from a title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

/**
 * Validate if a slug is available (not used by another project)
 */
export function isSlugAvailable(slug: string, existingSlugs: string[]): boolean {
  return !existingSlugs.includes(slug);
}

/**
 * Generate a unique slug by appending numbers if needed
 */
export function generateUniqueSlug(title: string, existingSlugs: string[]): string {
  let baseSlug = generateSlug(title);
  let slug = baseSlug;
  let counter = 1;

  while (!isSlugAvailable(slug, existingSlugs)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Calculate reading time for article content
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Extract excerpt from article content
 */
export function extractExcerpt(content: string, maxLength: number = 160): string {
  // Remove markdown formatting
  const plainText = content
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`(.*?)`/g, '$1') // Remove inline code
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Find the last complete sentence within the limit
  const truncated = plainText.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('.');
  
  if (lastSentence > maxLength * 0.7) {
    return truncated.substring(0, lastSentence + 1);
  }

  // If no good sentence break, truncate at word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace) + '...';
}

// ============================================================================
// TAG UTILITIES
// ============================================================================

/**
 * Sort tags by usage count (most used first)
 */
export function sortTagsByUsage(tags: (Tag & { _count?: { projects: number } })[]): Tag[] {
  return tags.sort((a, b) => {
    const aCount = a._count?.projects || 0;
    const bCount = b._count?.projects || 0;
    return bCount - aCount;
  });
}

/**
 * Get tag color or generate one if not set
 */
export function getTagColor(tag: Tag): string {
  if (tag.color) {
    return tag.color;
  }

  // Generate a consistent color based on tag name
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F4A261', '#E76F51', '#2A9D8F'
  ];
  
  let hash = 0;
  for (let i = 0; i < tag.name.length; i++) {
    hash = tag.name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Filter projects by tags (OR logic)
 */
export function filterProjectsByTags(projects: ProjectWithRelations[], tagNames: string[]): ProjectWithRelations[] {
  if (tagNames.length === 0) {
    return projects;
  }

  return projects.filter(project =>
    project.tags.some(tag => tagNames.includes(tag.name))
  );
}

// ============================================================================
// MEDIA UTILITIES
// ============================================================================

/**
 * Get optimized image URL with transformations
 */
export function getOptimizedImageUrl(
  mediaItem: MediaItem,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  } = {}
): string {
  const { width, height, quality = 80, format = 'webp' } = options;
  
  // If it's already an optimized URL (contains transformations), return as-is
  if (mediaItem.url.includes('w_') || mediaItem.url.includes('h_')) {
    return mediaItem.url;
  }

  // For Cloudinary URLs, add transformations
  if (mediaItem.url.includes('cloudinary.com')) {
    const parts = mediaItem.url.split('/upload/');
    if (parts.length === 2) {
      const transformations = [];
      
      if (width) transformations.push(`w_${width}`);
      if (height) transformations.push(`h_${height}`);
      transformations.push(`q_${quality}`);
      transformations.push(`f_${format}`);
      
      return `${parts[0]}/upload/${transformations.join(',')}/${parts[1]}`;
    }
  }

  // For other URLs, return as-is (could be enhanced with other CDN support)
  return mediaItem.url;
}

/**
 * Get responsive image srcset
 */
export function getResponsiveImageSrcSet(mediaItem: MediaItem): string {
  const sizes = [400, 800, 1200, 1600];
  
  return sizes
    .map(size => `${getOptimizedImageUrl(mediaItem, { width: size })} ${size}w`)
    .join(', ');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: bigint | number): string {
  const size = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let fileSize = size;

  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }

  return `${fileSize.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// ============================================================================
// ANALYTICS UTILITIES
// ============================================================================

/**
 * Calculate project popularity score
 */
export function calculatePopularityScore(project: ProjectWithRelations): number {
  const viewWeight = 1;
  const downloadWeight = 3;
  const linkClickWeight = 2;
  const recencyWeight = 0.1;

  const views = project.viewCount || 0;
  const downloads = project._count?.analytics || 0; // This would need proper analytics filtering
  const linkClicks = 0; // Would need to be calculated from analytics
  
  // Recency factor (newer projects get slight boost)
  const daysSinceCreation = Math.floor(
    (Date.now() - project.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const recencyFactor = Math.max(0, 365 - daysSinceCreation) * recencyWeight;

  return (
    views * viewWeight +
    downloads * downloadWeight +
    linkClicks * linkClickWeight +
    recencyFactor
  );
}

/**
 * Get related projects based on shared tags
 */
export function getRelatedProjects(
  currentProject: ProjectWithRelations,
  allProjects: ProjectWithRelations[],
  limit: number = 5
): ProjectWithRelations[] {
  const currentTags = currentProject.tags.map(tag => tag.name);
  
  return allProjects
    .filter(project => project.id !== currentProject.id)
    .map(project => ({
      ...project,
      sharedTagCount: project.tags.filter(tag => currentTags.includes(tag.name)).length,
    }))
    .filter(project => project.sharedTagCount > 0)
    .sort((a, b) => b.sharedTagCount - a.sharedTagCount)
    .slice(0, limit);
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Format date for display
 */
export function formatDate(date: Date, format: 'short' | 'long' | 'relative' = 'short'): string {
  switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    
    case 'long':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    
    case 'relative':
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    
    default:
      return date.toLocaleDateString();
  }
}

/**
 * Group projects by time period
 */
export function groupProjectsByPeriod(
  projects: ProjectWithRelations[],
  period: 'year' | 'month' = 'year'
): Record<string, ProjectWithRelations[]> {
  return projects.reduce((groups, project) => {
    const date = project.workDate || project.createdAt;
    let key: string;
    
    if (period === 'year') {
      key = date.getFullYear().toString();
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    
    groups[key].push(project);
    return groups;
  }, {} as Record<string, ProjectWithRelations[]>);
}