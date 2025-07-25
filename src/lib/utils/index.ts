/**
 * Main utilities export file
 */

export * from './project-utils';

// Re-export commonly used utilities
export {
  generateSlug,
  generateUniqueSlug,
  calculateReadingTime,
  extractExcerpt,
  getTagColor,
  filterProjectsByTags,
  getOptimizedImageUrl,
  getResponsiveImageSrcSet,
  formatFileSize,
  calculatePopularityScore,
  getRelatedProjects,
  formatDate,
  groupProjectsByPeriod,
} from './project-utils';