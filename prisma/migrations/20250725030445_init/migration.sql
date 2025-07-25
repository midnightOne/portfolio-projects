-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "project_visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('IMAGE', 'VIDEO', 'GIF', 'WEBM', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "interactive_type" AS ENUM ('CANVAS', 'IFRAME', 'WEBXR', 'EMBED');

-- CreateEnum
CREATE TYPE "analytics_event" AS ENUM ('VIEW', 'DOWNLOAD', 'EXTERNAL_LINK_CLICK', 'INTERACTIVE_ENGAGE');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "briefOverview" TEXT,
    "workDate" TIMESTAMP(3),
    "status" "project_status" NOT NULL DEFAULT 'DRAFT',
    "visibility" "project_visibility" NOT NULL DEFAULT 'PUBLIC',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchVector" TEXT,
    "thumbnailImageId" TEXT,
    "metadataImageId" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_items" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "media_type" NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "thumbnailUrl" VARCHAR(500),
    "altText" VARCHAR(255),
    "description" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" BIGINT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_content" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedded_media" (
    "id" TEXT NOT NULL,
    "articleContentId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "caption" TEXT,

    CONSTRAINT "embedded_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_carousels" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_carousels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_images" (
    "id" TEXT NOT NULL,
    "carouselId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "carousel_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactive_examples" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "interactive_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "url" VARCHAR(500),
    "embedCode" TEXT,
    "fallbackContent" TEXT,
    "securitySettings" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactive_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloadable_files" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "fileType" VARCHAR(100) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "downloadUrl" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloadable_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_links" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "icon" VARCHAR(50),
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_references" (
    "id" TEXT NOT NULL,
    "referencingProjectId" TEXT NOT NULL,
    "referencedProjectId" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_analytics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "event" "analytics_event" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" VARCHAR(45),
    "metadata" JSONB,

    CONSTRAINT "project_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_status_visibility_idx" ON "projects"("status", "visibility");

-- CreateIndex
CREATE INDEX "projects_workDate_idx" ON "projects"("workDate");

-- CreateIndex
CREATE INDEX "projects_viewCount_idx" ON "projects"("viewCount");

-- CreateIndex
CREATE INDEX "projects_slug_idx" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_name_idx" ON "tags"("name");

-- CreateIndex
CREATE INDEX "media_items_projectId_idx" ON "media_items"("projectId");

-- CreateIndex
CREATE INDEX "media_items_type_idx" ON "media_items"("type");

-- CreateIndex
CREATE INDEX "media_items_displayOrder_idx" ON "media_items"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "article_content_projectId_key" ON "article_content"("projectId");

-- CreateIndex
CREATE INDEX "embedded_media_articleContentId_idx" ON "embedded_media"("articleContentId");

-- CreateIndex
CREATE INDEX "embedded_media_position_idx" ON "embedded_media"("position");

-- CreateIndex
CREATE INDEX "media_carousels_projectId_idx" ON "media_carousels"("projectId");

-- CreateIndex
CREATE INDEX "media_carousels_displayOrder_idx" ON "media_carousels"("displayOrder");

-- CreateIndex
CREATE INDEX "carousel_images_carouselId_idx" ON "carousel_images"("carouselId");

-- CreateIndex
CREATE INDEX "carousel_images_order_idx" ON "carousel_images"("order");

-- CreateIndex
CREATE INDEX "interactive_examples_projectId_idx" ON "interactive_examples"("projectId");

-- CreateIndex
CREATE INDEX "interactive_examples_type_idx" ON "interactive_examples"("type");

-- CreateIndex
CREATE INDEX "interactive_examples_displayOrder_idx" ON "interactive_examples"("displayOrder");

-- CreateIndex
CREATE INDEX "downloadable_files_projectId_idx" ON "downloadable_files"("projectId");

-- CreateIndex
CREATE INDEX "downloadable_files_fileType_idx" ON "downloadable_files"("fileType");

-- CreateIndex
CREATE INDEX "external_links_projectId_idx" ON "external_links"("projectId");

-- CreateIndex
CREATE INDEX "external_links_order_idx" ON "external_links"("order");

-- CreateIndex
CREATE INDEX "project_references_referencingProjectId_idx" ON "project_references"("referencingProjectId");

-- CreateIndex
CREATE INDEX "project_references_referencedProjectId_idx" ON "project_references"("referencedProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_references_referencingProjectId_referencedProjectId_key" ON "project_references"("referencingProjectId", "referencedProjectId");

-- CreateIndex
CREATE INDEX "project_analytics_projectId_idx" ON "project_analytics"("projectId");

-- CreateIndex
CREATE INDEX "project_analytics_event_idx" ON "project_analytics"("event");

-- CreateIndex
CREATE INDEX "project_analytics_timestamp_idx" ON "project_analytics"("timestamp");

-- CreateIndex
CREATE INDEX "_ProjectTags_B_index" ON "_ProjectTags"("B");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_thumbnailImageId_fkey" FOREIGN KEY ("thumbnailImageId") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_metadataImageId_fkey" FOREIGN KEY ("metadataImageId") REFERENCES "media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_content" ADD CONSTRAINT "article_content_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embedded_media" ADD CONSTRAINT "embedded_media_articleContentId_fkey" FOREIGN KEY ("articleContentId") REFERENCES "article_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embedded_media" ADD CONSTRAINT "embedded_media_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_carousels" ADD CONSTRAINT "media_carousels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carousel_images" ADD CONSTRAINT "carousel_images_carouselId_fkey" FOREIGN KEY ("carouselId") REFERENCES "media_carousels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carousel_images" ADD CONSTRAINT "carousel_images_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactive_examples" ADD CONSTRAINT "interactive_examples_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloadable_files" ADD CONSTRAINT "downloadable_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_references" ADD CONSTRAINT "project_references_referencingProjectId_fkey" FOREIGN KEY ("referencingProjectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_references" ADD CONSTRAINT "project_references_referencedProjectId_fkey" FOREIGN KEY ("referencedProjectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_analytics" ADD CONSTRAINT "project_analytics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTags" ADD CONSTRAINT "_ProjectTags_A_fkey" FOREIGN KEY ("A") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectTags" ADD CONSTRAINT "_ProjectTags_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
