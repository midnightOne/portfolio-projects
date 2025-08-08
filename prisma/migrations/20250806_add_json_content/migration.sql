-- Add JSON content field to article_content table
ALTER TABLE "article_content" ADD COLUMN "json_content" JSONB;

-- Add index for JSON content queries
CREATE INDEX "idx_article_content_json_content" ON "article_content" USING GIN ("json_content");

-- Add content_type field to track whether content is plain text or JSON
ALTER TABLE "article_content" ADD COLUMN "content_type" VARCHAR(20) DEFAULT 'text';

-- Update existing records to mark them as text content
UPDATE "article_content" SET "content_type" = 'text' WHERE "content_type" IS NULL;