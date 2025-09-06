-- CreateEnum
CREATE TYPE "public"."project_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."project_visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "public"."media_type" AS ENUM ('IMAGE', 'VIDEO', 'GIF', 'WEBM', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "public"."interactive_type" AS ENUM ('CANVAS', 'IFRAME', 'WEBXR', 'EMBED');

-- CreateEnum
CREATE TYPE "public"."analytics_event" AS ENUM ('VIEW', 'DOWNLOAD', 'EXTERNAL_LINK_CLICK', 'INTERACTIVE_ENGAGE');

-- CreateEnum
CREATE TYPE "public"."ai_rate_limit_tier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM', 'UNLIMITED');

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "briefOverview" TEXT,
    "workDate" TIMESTAMP(3),
    "status" "public"."project_status" NOT NULL DEFAULT 'DRAFT',
    "visibility" "public"."project_visibility" NOT NULL DEFAULT 'PUBLIC',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchVector" TEXT,
    "thumbnailImageId" TEXT,
    "metadataImageId" TEXT,
    "search_vector" tsvector,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_items" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "public"."media_type" NOT NULL,
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
CREATE TABLE "public"."article_content" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "jsonContent" JSONB,
    "contentType" VARCHAR(20) NOT NULL DEFAULT 'text',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."embedded_media" (
    "id" TEXT NOT NULL,
    "articleContentId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "caption" TEXT,

    CONSTRAINT "embedded_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_carousels" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_carousels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carousel_images" (
    "id" TEXT NOT NULL,
    "carouselId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "carousel_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."interactive_examples" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "public"."interactive_type" NOT NULL,
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
CREATE TABLE "public"."downloadable_files" (
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
CREATE TABLE "public"."external_links" (
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
CREATE TABLE "public"."project_references" (
    "id" TEXT NOT NULL,
    "referencingProjectId" TEXT NOT NULL,
    "referencedProjectId" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_analytics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "event" "public"."analytics_event" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" VARCHAR(45),
    "metadata" JSONB,

    CONSTRAINT "project_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_model_config" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "models" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_general_settings" (
    "id" TEXT NOT NULL,
    "defaultProvider" TEXT NOT NULL DEFAULT 'openai',
    "systemPrompt" TEXT NOT NULL DEFAULT 'You are an expert content editor for portfolio projects. Help improve and edit project content while maintaining the author''s voice and style.',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 4000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_general_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_ai_index" (
    "projectId" VARCHAR(255) NOT NULL,
    "summary" TEXT NOT NULL,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "topics" JSONB NOT NULL DEFAULT '[]',
    "technologies" JSONB NOT NULL DEFAULT '[]',
    "sectionsCount" INTEGER NOT NULL DEFAULT 0,
    "mediaCount" INTEGER NOT NULL DEFAULT 0,
    "contentHash" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_ai_index_pkey" PRIMARY KEY ("projectId")
);

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

-- CreateTable
CREATE TABLE "public"."homepage_config" (
    "id" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "globalTheme" TEXT NOT NULL DEFAULT 'default',
    "layout" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."section_configs" (
    "id" TEXT NOT NULL,
    "homepageConfigId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "className" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_rate_limits" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "identifier_type" TEXT NOT NULL,
    "requests_count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "reflink_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_reflinks" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "rate_limit_tier" TEXT NOT NULL DEFAULT 'standard',
    "daily_limit" INTEGER NOT NULL DEFAULT 50,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "custom_context" TEXT,
    "enable_advanced_navigation" BOOLEAN NOT NULL DEFAULT true,
    "enable_job_analysis" BOOLEAN NOT NULL DEFAULT true,
    "enable_voice_ai" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "recipient_email" VARCHAR(255),
    "recipient_name" VARCHAR(255),
    "spend_limit" DECIMAL(10,2),
    "spend_used" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "token_limit" INTEGER,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_reflinks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_ip_blacklist" (
    "id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "violation_count" INTEGER NOT NULL DEFAULT 1,
    "first_violation_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_violation_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "can_reinstate" BOOLEAN NOT NULL DEFAULT true,
    "reinstated_at" TIMESTAMP(3),
    "reinstated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_ip_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_rate_limit_logs" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "identifier_type" TEXT NOT NULL,
    "reflink_id" TEXT,
    "endpoint" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "was_blocked" BOOLEAN NOT NULL DEFAULT false,
    "requests_remaining" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_rate_limit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_usage_logs" (
    "id" TEXT NOT NULL,
    "reflink_id" TEXT,
    "session_id" TEXT,
    "usage_type" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "cost_usd" DECIMAL(10,4) NOT NULL,
    "model_used" TEXT,
    "endpoint" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_conversations" (
    "id" TEXT NOT NULL,
    "reflink_id" TEXT,
    "session_id" TEXT NOT NULL,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "cost_usd" DECIMAL(10,4),
    "model_used" TEXT,
    "transport_mode" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_job_analyses" (
    "id" TEXT NOT NULL,
    "reflink_id" TEXT,
    "session_id" TEXT,
    "job_specification" TEXT NOT NULL,
    "company_name" TEXT,
    "position_title" TEXT,
    "analysis_result" JSONB NOT NULL,
    "tokens_used" INTEGER,
    "cost_usd" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ai_job_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voice_provider_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ProjectTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "public"."projects"("slug");

-- CreateIndex
CREATE INDEX "projects_status_visibility_idx" ON "public"."projects"("status", "visibility");

-- CreateIndex
CREATE INDEX "projects_workDate_idx" ON "public"."projects"("workDate");

-- CreateIndex
CREATE INDEX "projects_viewCount_idx" ON "public"."projects"("viewCount");

-- CreateIndex
CREATE INDEX "projects_slug_idx" ON "public"."projects"("slug");

-- CreateIndex
CREATE INDEX "projects_search_vector_idx" ON "public"."projects" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "public"."tags"("name");

-- CreateIndex
CREATE INDEX "tags_name_idx" ON "public"."tags"("name");

-- CreateIndex
CREATE INDEX "idx_tags_id" ON "public"."tags"("id");

-- CreateIndex
CREATE INDEX "media_items_projectId_idx" ON "public"."media_items"("projectId");

-- CreateIndex
CREATE INDEX "media_items_type_idx" ON "public"."media_items"("type");

-- CreateIndex
CREATE INDEX "media_items_displayOrder_idx" ON "public"."media_items"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "article_content_projectId_key" ON "public"."article_content"("projectId");

-- CreateIndex
CREATE INDEX "article_content_contentType_idx" ON "public"."article_content"("contentType");

-- CreateIndex
CREATE INDEX "embedded_media_articleContentId_idx" ON "public"."embedded_media"("articleContentId");

-- CreateIndex
CREATE INDEX "embedded_media_position_idx" ON "public"."embedded_media"("position");

-- CreateIndex
CREATE INDEX "media_carousels_projectId_idx" ON "public"."media_carousels"("projectId");

-- CreateIndex
CREATE INDEX "media_carousels_displayOrder_idx" ON "public"."media_carousels"("displayOrder");

-- CreateIndex
CREATE INDEX "carousel_images_carouselId_idx" ON "public"."carousel_images"("carouselId");

-- CreateIndex
CREATE INDEX "carousel_images_order_idx" ON "public"."carousel_images"("order");

-- CreateIndex
CREATE INDEX "interactive_examples_projectId_idx" ON "public"."interactive_examples"("projectId");

-- CreateIndex
CREATE INDEX "interactive_examples_type_idx" ON "public"."interactive_examples"("type");

-- CreateIndex
CREATE INDEX "interactive_examples_displayOrder_idx" ON "public"."interactive_examples"("displayOrder");

-- CreateIndex
CREATE INDEX "downloadable_files_projectId_idx" ON "public"."downloadable_files"("projectId");

-- CreateIndex
CREATE INDEX "downloadable_files_fileType_idx" ON "public"."downloadable_files"("fileType");

-- CreateIndex
CREATE INDEX "external_links_projectId_idx" ON "public"."external_links"("projectId");

-- CreateIndex
CREATE INDEX "external_links_order_idx" ON "public"."external_links"("order");

-- CreateIndex
CREATE INDEX "project_references_referencingProjectId_idx" ON "public"."project_references"("referencingProjectId");

-- CreateIndex
CREATE INDEX "project_references_referencedProjectId_idx" ON "public"."project_references"("referencedProjectId");

-- CreateIndex
CREATE INDEX "project_refs_referenced_idx" ON "public"."project_references"("referencedProjectId");

-- CreateIndex
CREATE INDEX "project_refs_referencing_idx" ON "public"."project_references"("referencingProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_references_referencingProjectId_referencedProjectId_key" ON "public"."project_references"("referencingProjectId", "referencedProjectId");

-- CreateIndex
CREATE INDEX "project_analytics_projectId_idx" ON "public"."project_analytics"("projectId");

-- CreateIndex
CREATE INDEX "project_analytics_event_idx" ON "public"."project_analytics"("event");

-- CreateIndex
CREATE INDEX "project_analytics_timestamp_idx" ON "public"."project_analytics"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_config_provider_key" ON "public"."ai_model_config"("provider");

-- CreateIndex
CREATE INDEX "ai_model_config_provider_idx" ON "public"."ai_model_config"("provider");

-- CreateIndex
CREATE INDEX "project_ai_index_contentHash_idx" ON "public"."project_ai_index"("contentHash");

-- CreateIndex
CREATE INDEX "project_ai_index_updatedAt_idx" ON "public"."project_ai_index"("updatedAt");

-- CreateIndex
CREATE INDEX "project_ai_index_keywords_idx" ON "public"."project_ai_index" USING GIN ("keywords");

-- CreateIndex
CREATE INDEX "project_ai_index_topics_idx" ON "public"."project_ai_index" USING GIN ("topics");

-- CreateIndex
CREATE INDEX "project_ai_index_technologies_idx" ON "public"."project_ai_index" USING GIN ("technologies");

-- CreateIndex
CREATE UNIQUE INDEX "ai_content_source_config_sourceId_key" ON "public"."ai_content_source_config"("sourceId");

-- CreateIndex
CREATE INDEX "ai_content_source_config_sourceId_idx" ON "public"."ai_content_source_config"("sourceId");

-- CreateIndex
CREATE INDEX "ai_content_source_config_enabled_idx" ON "public"."ai_content_source_config"("enabled");

-- CreateIndex
CREATE INDEX "ai_content_source_config_priority_idx" ON "public"."ai_content_source_config"("priority");

-- CreateIndex
CREATE INDEX "section_configs_homepageConfigId_idx" ON "public"."section_configs"("homepageConfigId");

-- CreateIndex
CREATE INDEX "section_configs_order_idx" ON "public"."section_configs"("order");

-- CreateIndex
CREATE UNIQUE INDEX "section_configs_homepageConfigId_sectionId_key" ON "public"."section_configs"("homepageConfigId", "sectionId");

-- CreateIndex
CREATE INDEX "ai_rate_limits_window_end_idx" ON "public"."ai_rate_limits"("window_end");

-- CreateIndex
CREATE INDEX "ai_rate_limits_reflink_id_idx" ON "public"."ai_rate_limits"("reflink_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_rate_limits_identifier_identifier_type_window_start_key" ON "public"."ai_rate_limits"("identifier", "identifier_type", "window_start");

-- CreateIndex
CREATE UNIQUE INDEX "ai_reflinks_code_key" ON "public"."ai_reflinks"("code");

-- CreateIndex
CREATE INDEX "ai_reflinks_is_active_idx" ON "public"."ai_reflinks"("is_active");

-- CreateIndex
CREATE INDEX "ai_reflinks_expires_at_idx" ON "public"."ai_reflinks"("expires_at");

-- CreateIndex
CREATE INDEX "ai_reflinks_recipient_email_idx" ON "public"."ai_reflinks"("recipient_email");

-- CreateIndex
CREATE UNIQUE INDEX "ai_ip_blacklist_ip_address_key" ON "public"."ai_ip_blacklist"("ip_address");

-- CreateIndex
CREATE INDEX "ai_ip_blacklist_blocked_at_idx" ON "public"."ai_ip_blacklist"("blocked_at");

-- CreateIndex
CREATE INDEX "ai_rate_limit_logs_identifier_identifier_type_idx" ON "public"."ai_rate_limit_logs"("identifier", "identifier_type");

-- CreateIndex
CREATE INDEX "ai_rate_limit_logs_timestamp_idx" ON "public"."ai_rate_limit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "ai_rate_limit_logs_reflink_id_idx" ON "public"."ai_rate_limit_logs"("reflink_id");

-- CreateIndex
CREATE INDEX "ai_rate_limit_logs_was_blocked_idx" ON "public"."ai_rate_limit_logs"("was_blocked");

-- CreateIndex
CREATE INDEX "ai_usage_logs_reflink_id_idx" ON "public"."ai_usage_logs"("reflink_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_timestamp_idx" ON "public"."ai_usage_logs"("timestamp");

-- CreateIndex
CREATE INDEX "ai_usage_logs_usage_type_idx" ON "public"."ai_usage_logs"("usage_type");

-- CreateIndex
CREATE INDEX "ai_conversations_reflink_id_idx" ON "public"."ai_conversations"("reflink_id");

-- CreateIndex
CREATE INDEX "ai_conversations_session_id_idx" ON "public"."ai_conversations"("session_id");

-- CreateIndex
CREATE INDEX "ai_conversations_started_at_idx" ON "public"."ai_conversations"("started_at");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_conversation_id_idx" ON "public"."ai_conversation_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_timestamp_idx" ON "public"."ai_conversation_messages"("timestamp");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_role_idx" ON "public"."ai_conversation_messages"("role");

-- CreateIndex
CREATE INDEX "ai_job_analyses_reflink_id_idx" ON "public"."ai_job_analyses"("reflink_id");

-- CreateIndex
CREATE INDEX "ai_job_analyses_created_at_idx" ON "public"."ai_job_analyses"("created_at");

-- CreateIndex
CREATE INDEX "ai_job_analyses_company_name_idx" ON "public"."ai_job_analyses"("company_name");

-- CreateIndex
CREATE INDEX "voice_provider_configs_provider_idx" ON "public"."voice_provider_configs"("provider");

-- CreateIndex
CREATE INDEX "voice_provider_configs_is_default_idx" ON "public"."voice_provider_configs"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "voice_provider_configs_provider_name_key" ON "public"."voice_provider_configs"("provider", "name");

-- CreateIndex
CREATE UNIQUE INDEX "voice_provider_configs_provider_is_default_key" ON "public"."voice_provider_configs"("provider", "is_default");

-- CreateIndex
CREATE INDEX "_ProjectTags_B_index" ON "public"."_ProjectTags"("B");

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_metadataImageId_fkey" FOREIGN KEY ("metadataImageId") REFERENCES "public"."media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_thumbnailImageId_fkey" FOREIGN KEY ("thumbnailImageId") REFERENCES "public"."media_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_items" ADD CONSTRAINT "media_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."article_content" ADD CONSTRAINT "article_content_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embedded_media" ADD CONSTRAINT "embedded_media_articleContentId_fkey" FOREIGN KEY ("articleContentId") REFERENCES "public"."article_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."embedded_media" ADD CONSTRAINT "embedded_media_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_carousels" ADD CONSTRAINT "media_carousels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carousel_images" ADD CONSTRAINT "carousel_images_carouselId_fkey" FOREIGN KEY ("carouselId") REFERENCES "public"."media_carousels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carousel_images" ADD CONSTRAINT "carousel_images_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."interactive_examples" ADD CONSTRAINT "interactive_examples_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."downloadable_files" ADD CONSTRAINT "downloadable_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."external_links" ADD CONSTRAINT "external_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_references" ADD CONSTRAINT "project_references_referencedProjectId_fkey" FOREIGN KEY ("referencedProjectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_references" ADD CONSTRAINT "project_references_referencingProjectId_fkey" FOREIGN KEY ("referencingProjectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_analytics" ADD CONSTRAINT "project_analytics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_ai_index" ADD CONSTRAINT "project_ai_index_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."section_configs" ADD CONSTRAINT "section_configs_homepageConfigId_fkey" FOREIGN KEY ("homepageConfigId") REFERENCES "public"."homepage_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_rate_limits" ADD CONSTRAINT "ai_rate_limits_reflink_id_fkey" FOREIGN KEY ("reflink_id") REFERENCES "public"."ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_rate_limit_logs" ADD CONSTRAINT "ai_rate_limit_logs_reflink_id_fkey" FOREIGN KEY ("reflink_id") REFERENCES "public"."ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_reflink_id_fkey" FOREIGN KEY ("reflink_id") REFERENCES "public"."ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_conversations" ADD CONSTRAINT "ai_conversations_reflink_id_fkey" FOREIGN KEY ("reflink_id") REFERENCES "public"."ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_conversation_messages" ADD CONSTRAINT "ai_conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_job_analyses" ADD CONSTRAINT "ai_job_analyses_reflink_id_fkey" FOREIGN KEY ("reflink_id") REFERENCES "public"."ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProjectTags" ADD CONSTRAINT "_ProjectTags_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProjectTags" ADD CONSTRAINT "_ProjectTags_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
