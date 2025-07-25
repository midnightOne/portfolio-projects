-- Full-text search setup for projects
-- This migration adds tsvector support for search functionality

-- Add search vector column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE projects ADD COLUMN search_vector tsvector;
    END IF;
END $$;

-- Create or replace the search vector update function
CREATE OR REPLACE FUNCTION update_projects_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."briefOverview", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS projects_search_vector_update ON projects;

-- Create the trigger
CREATE TRIGGER projects_search_vector_update
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_projects_search_vector();

-- Create GIN index for full-text search
DROP INDEX IF EXISTS projects_search_idx;
CREATE INDEX projects_search_idx ON projects USING GIN(search_vector);

-- Update existing records with search vectors
UPDATE projects SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("briefOverview", '')), 'C')
WHERE search_vector IS NULL;

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS projects_status_visibility_idx ON projects(status, visibility);
CREATE INDEX IF NOT EXISTS projects_work_date_idx ON projects("workDate" DESC);
CREATE INDEX IF NOT EXISTS projects_view_count_idx ON projects("viewCount" DESC);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects("createdAt" DESC);

-- Media items performance indexes
CREATE INDEX IF NOT EXISTS media_items_project_type_idx ON media_items("projectId", type);
CREATE INDEX IF NOT EXISTS media_items_display_order_idx ON media_items("projectId", "displayOrder");

-- Tags performance index
CREATE INDEX IF NOT EXISTS tags_name_idx ON tags(name);

-- Analytics performance indexes
CREATE INDEX IF NOT EXISTS analytics_project_event_idx ON project_analytics("projectId", event);
CREATE INDEX IF NOT EXISTS analytics_timestamp_idx ON project_analytics(timestamp DESC);

-- Project references performance indexes
CREATE INDEX IF NOT EXISTS project_refs_referencing_idx ON project_references("referencingProjectId");
CREATE INDEX IF NOT EXISTS project_refs_referenced_idx ON project_references("referencedProjectId");