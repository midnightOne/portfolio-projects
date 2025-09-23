-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Update embedding_vector columns to use vector type instead of TEXT
-- Note: This will be applied manually after pgvector is available
-- ALTER TABLE "public"."project_ai_index" ALTER COLUMN "embeddingVector" TYPE vector(1536);
-- ALTER TABLE "public"."context_chunks" ALTER COLUMN "embedding_vector" TYPE vector(1536);

-- Create vector similarity indexes (will be applied after vector type conversion)
-- CREATE INDEX ON "public"."project_ai_index" USING ivfflat ("embeddingVector" vector_cosine_ops);
-- CREATE INDEX ON "public"."context_chunks" USING ivfflat ("embedding_vector" vector_cosine_ops);