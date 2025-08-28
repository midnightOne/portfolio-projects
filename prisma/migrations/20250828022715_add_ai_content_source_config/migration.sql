/*
  Warnings:

  - Made the column `contentType` on table `article_content` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."article_content_jsonContent_idx";

-- AlterTable
ALTER TABLE "public"."article_content" ALTER COLUMN "contentType" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."ai_content_source_config" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_content_source_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_content_source_config_sourceId_key" ON "public"."ai_content_source_config"("sourceId");

-- CreateIndex
CREATE INDEX "ai_content_source_config_sourceId_idx" ON "public"."ai_content_source_config"("sourceId");

-- CreateIndex
CREATE INDEX "ai_content_source_config_enabled_idx" ON "public"."ai_content_source_config"("enabled");

-- CreateIndex
CREATE INDEX "ai_content_source_config_priority_idx" ON "public"."ai_content_source_config"("priority");

-- CreateIndex
CREATE INDEX "article_content_contentType_idx" ON "public"."article_content"("contentType");
