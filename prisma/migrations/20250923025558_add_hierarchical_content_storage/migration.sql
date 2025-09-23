-- CreateEnum
CREATE TYPE "public"."content_entity_type" AS ENUM ('PROJECT', 'BIO', 'RESUME', 'EXPERIENCE', 'SKILLS', 'CUSTOM');

-- AlterTable
ALTER TABLE "public"."project_ai_index" ADD COLUMN     "contentTiers" JSONB,
ADD COLUMN     "embeddingVector" TEXT;

-- CreateTable
CREATE TABLE "public"."content_entities" (
    "id" TEXT NOT NULL,
    "entityType" "public"."content_entity_type" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "technologies" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."context_chunks" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "project_index_id" TEXT,
    "tier" INTEGER NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "title" VARCHAR(255),
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "embedding_vector" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "context_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."content_versions" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "content_hash" VARCHAR(255) NOT NULL,
    "changes_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_entities_entityType_idx" ON "public"."content_entities"("entityType");

-- CreateIndex
CREATE INDEX "content_entities_slug_idx" ON "public"."content_entities"("slug");

-- CreateIndex
CREATE INDEX "content_entities_tags_idx" ON "public"."content_entities" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "content_entities_technologies_idx" ON "public"."content_entities" USING GIN ("technologies");

-- CreateIndex
CREATE UNIQUE INDEX "content_entities_entityType_slug_key" ON "public"."content_entities"("entityType", "slug");

-- CreateIndex
CREATE INDEX "context_chunks_entity_id_idx" ON "public"."context_chunks"("entity_id");

-- CreateIndex
CREATE INDEX "context_chunks_tier_idx" ON "public"."context_chunks"("tier");

-- CreateIndex
CREATE INDEX "context_chunks_chunk_id_idx" ON "public"."context_chunks"("chunk_id");

-- CreateIndex
CREATE INDEX "context_chunks_token_count_idx" ON "public"."context_chunks"("token_count");

-- CreateIndex
CREATE INDEX "context_chunks_project_index_id_idx" ON "public"."context_chunks"("project_index_id");

-- CreateIndex
CREATE UNIQUE INDEX "context_chunks_entity_id_tier_chunk_id_key" ON "public"."context_chunks"("entity_id", "tier", "chunk_id");

-- CreateIndex
CREATE INDEX "content_versions_entity_id_idx" ON "public"."content_versions"("entity_id");

-- CreateIndex
CREATE INDEX "content_versions_content_hash_idx" ON "public"."content_versions"("content_hash");

-- CreateIndex
CREATE INDEX "content_versions_created_at_idx" ON "public"."content_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_entity_id_version_number_key" ON "public"."content_versions"("entity_id", "version_number");

-- AddForeignKey
ALTER TABLE "public"."context_chunks" ADD CONSTRAINT "context_chunks_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."content_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."context_chunks" ADD CONSTRAINT "context_chunks_project_index_id_fkey" FOREIGN KEY ("project_index_id") REFERENCES "public"."project_ai_index"("projectId") ON DELETE SET NULL ON UPDATE CASCADE;
