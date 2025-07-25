-- Add indexes for text search performance
-- This will make the search queries much faster

-- Composite index for the main query filters
CREATE INDEX IF NOT EXISTS "projects_status_visibility_idx" ON "projects" ("status", "visibility");

-- Indexes for text search columns
CREATE INDEX IF NOT EXISTS "projects_title_gin_idx" ON "projects" USING gin (to_tsvector('english', "title"));
CREATE INDEX IF NOT EXISTS "projects_description_gin_idx" ON "projects" USING gin (to_tsvector('english', "description"));
CREATE INDEX IF NOT EXISTS "projects_brief_overview_gin_idx" ON "projects" USING gin (to_tsvector('english', "briefOverview"));

-- Trigram indexes for fuzzy text search (case-insensitive contains)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "projects_title_trgm_idx" ON "projects" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "projects_description_trgm_idx" ON "projects" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "projects_brief_overview_trgm_idx" ON "projects" USING gin ("briefOverview" gin_trgm_ops);

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS "project_tags_project_id_tag_name_idx" ON "_ProjectTags" ("A", "B");

-- Index for sorting options
CREATE INDEX IF NOT EXISTS "projects_work_date_idx" ON "projects" ("workDate" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "projects_view_count_idx" ON "projects" ("viewCount" DESC);
CREATE INDEX IF NOT EXISTS "projects_created_at_idx" ON "projects" ("createdAt" DESC); 