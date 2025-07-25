-- Fix N+1 query problems and add missing critical indexes
-- This addresses the slow _ProjectTags lookups causing 75-100ms per query

-- CRITICAL: Fix N+1 problem with project-tag relationships
-- These indexes are essential for the 998ms findManyOptimized query
CREATE INDEX IF NOT EXISTS idx_project_tags_project_id 
ON "_ProjectTags"("A"); -- A is projectId

CREATE INDEX IF NOT EXISTS idx_project_tags_tag_id 
ON "_ProjectTags"("B"); -- B is tagId

-- Composite index for both directions of the relationship
CREATE INDEX IF NOT EXISTS idx_project_tags_both 
ON "_ProjectTags"("A", "B");

-- Index for tags.id lookups (missing basic index)
CREATE INDEX IF NOT EXISTS idx_tags_id 
ON tags(id);

-- Improve project counting performance (195ms issue)
-- Add composite index for common count queries
CREATE INDEX IF NOT EXISTS idx_projects_count_optimized 
ON projects(status, visibility, id) WHERE status = 'PUBLISHED' AND visibility = 'PUBLIC';

-- Index for media items queries that are causing slowness
CREATE INDEX IF NOT EXISTS idx_media_items_project_type_order
ON media_items("projectId", type, "displayOrder") WHERE "projectId" IS NOT NULL;

-- Index for external links performance  
CREATE INDEX IF NOT EXISTS idx_external_links_project_id
ON external_links("projectId");

-- Index for downloadable files performance
CREATE INDEX IF NOT EXISTS idx_downloadable_files_project_id  
ON downloadable_files("projectId");

-- Update table statistics for query planner
ANALYZE "_ProjectTags";
ANALYZE tags;
ANALYZE projects;
ANALYZE media_items;
ANALYZE external_links; 
ANALYZE downloadable_files; 