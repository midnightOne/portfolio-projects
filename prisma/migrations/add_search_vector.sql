-- Add full-text search support to projects table
-- This migration adds search vector functionality for better search performance

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
  -- Create search vector from title (weight A), description (weight B), and brief_overview (weight C)
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.brief_overview, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS projects_search_vector_update ON projects;
CREATE TRIGGER projects_search_vector_update
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_projects_search_vector();

-- Create GIN index for fast full-text search
DROP INDEX IF EXISTS projects_search_vector_idx;
CREATE INDEX projects_search_vector_idx ON projects USING GIN(search_vector);

-- Update existing records to populate search vector
UPDATE projects SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(brief_overview, '')), 'C')
WHERE search_vector IS NULL;

-- Add index for search performance on text fields (fallback)
CREATE INDEX IF NOT EXISTS projects_title_search_idx ON projects USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS projects_description_search_idx ON projects USING GIN(to_tsvector('english', description));