/*
  Warnings:

  - You are about to alter the column `embedding_vector` on the `context_chunks` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Unsupported("vector(1536)")`.
  - You are about to alter the column `embeddingVector` on the `project_ai_index` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Unsupported("vector(1536)")`.

*/

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- First, clear any existing data that might cause casting issues
UPDATE "public"."context_chunks" SET "embedding_vector" = NULL WHERE "embedding_vector" IS NOT NULL;
UPDATE "public"."project_ai_index" SET "embeddingVector" = NULL WHERE "embeddingVector" IS NOT NULL;

-- AlterTable - Use USING clause for safe casting
ALTER TABLE "public"."context_chunks" ALTER COLUMN "embedding_vector" SET DATA TYPE vector(1536) USING embedding_vector::vector(1536);

-- AlterTable
ALTER TABLE "public"."project_ai_index" ALTER COLUMN "embeddingVector" SET DATA TYPE vector(1536) USING "embeddingVector"::vector(1536);

-- Create indexes for vector similarity search (optional but recommended for performance)
-- Note: These will be created manually as Prisma doesn't support vector indexes yet
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS context_chunks_embedding_vector_idx ON "public"."context_chunks" USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS project_ai_index_embedding_vector_idx ON "public"."project_ai_index" USING ivfflat (embeddingVector vector_cosine_ops) WITH (lists = 100);