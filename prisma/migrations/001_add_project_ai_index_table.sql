-- Add project AI index table for storing project summaries and indexes
-- This supports the Client-Side AI Assistant's context management system

CREATE TABLE IF NOT EXISTS project_ai_index (
    project_id VARCHAR(255) PRIMARY KEY,
    summary TEXT NOT NULL,
    keywords JSONB DEFAULT '[]'::jsonb,
    topics JSONB DEFAULT '[]'::jsonb,
    technologies JSONB DEFAULT '[]'::jsonb,
    sections_count INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    content_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_project_ai_index_project 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_ai_index_content_hash ON project_ai_index(content_hash);
CREATE INDEX IF NOT EXISTS idx_project_ai_index_updated_at ON project_ai_index(updated_at);
CREATE INDEX IF NOT EXISTS idx_project_ai_index_keywords ON project_ai_index USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_project_ai_index_topics ON project_ai_index USING GIN(topics);
CREATE INDEX IF NOT EXISTS idx_project_ai_index_technologies ON project_ai_index USING GIN(technologies);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_project_ai_index_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_ai_index_updated_at
    BEFORE UPDATE ON project_ai_index
    FOR EACH ROW
    EXECUTE FUNCTION update_project_ai_index_updated_at();