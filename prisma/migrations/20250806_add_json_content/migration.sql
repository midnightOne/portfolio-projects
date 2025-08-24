-- Add JSON content field to article_content table
ALTER TABLE "article_content" ADD COLUMN "jsonContent" JSONB;

-- Add index for JSON content queries
CREATE INDEX "article_content_jsonContent_idx" ON "article_content" USING GIN ("jsonContent");

-- Add content_type field to track whether content is plain text or JSON
ALTER TABLE "article_content" ADD COLUMN "contentType" VARCHAR(20) DEFAULT 'text';

-- Update existing records to mark them as text content
UPDATE "article_content" SET "contentType" = 'text' WHERE "contentType" IS NULL;