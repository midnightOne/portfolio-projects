-- Performance optimization indexes for portfolio projects
-- This migration adds indexes to improve query performance

-- Index for projects filtering by status and visibility (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status_visibility 
ON projects(status, visibility) WHERE status = 'PUBLISHED' AND visibility = 'PUBLIC';

-- Composite index for projects search and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_search_composite 
ON projects(status, visibility, "workDate") WHERE status = 'PUBLISHED';

-- Index for projects title search (case insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_title_gin 
ON projects USING gin(to_tsvector('english', title));

-- Index for projects description search (case insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_description_gin 
ON projects USING gin(to_tsvector('english', description));

-- Index for tag filtering with project relationships (using correct relationship table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_tags_composite
ON "_ProjectToTag"("B") INCLUDE ("A"); -- B is tagId, A is projectId

-- Index for media items by project (for thumbnail fallbacks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_items_project_order
ON media_items("projectId", "displayOrder") WHERE "projectId" IS NOT NULL;

-- Index for external links by project
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_external_links_project_order
ON external_links("projectId", "order");

-- Index for downloadable files by project
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_downloadable_files_project_date
ON downloadable_files("projectId", "uploadDate" DESC);

-- Index for project analytics (for view counting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_analytics_project_date
ON project_analytics("projectId", "timestamp" DESC);

-- Partial index for published projects sorted by view count (popularity)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_popular
ON projects("viewCount" DESC, "createdAt" DESC) 
WHERE status = 'PUBLISHED' AND visibility = 'PUBLIC';

-- Partial index for published projects sorted by work date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_by_date
ON projects("workDate" DESC NULLS LAST, "createdAt" DESC) 
WHERE status = 'PUBLISHED' AND visibility = 'PUBLIC';

-- Update table statistics for better query planning
ANALYZE projects;
ANALYZE media_items;
ANALYZE tags;
ANALYZE external_links;
ANALYZE downloadable_files; 