-- Squashed single init migration (D54). pgvector extension + HNSW index are
-- baked in, so `prisma migrate reset`/`deploy` provisions them automatically
-- (no hand steps on clear+reseed). The one non-Prisma line is the HNSW index
-- below, which Prisma emits as a btree; keep the `USING hnsw (...)` form.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

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

-- CreateEnum
CREATE TYPE "public"."content_entity_type" AS ENUM ('PROJECT', 'BIO', 'RESUME', 'EXPERIENCE', 'SKILLS', 'CUSTOM');

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
    "contentTiers" JSONB,
    "embeddingVector" vector(1536),

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
    "waveConfig" JSONB,

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
    "embedding_vector" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "parent_chunk_id" TEXT,
    "root_chunk_id" TEXT,
    "section_group" TEXT,
    "derivation_path" TEXT,
    "chunk_index_in_section" INTEGER,
    "content_hash" VARCHAR(255),
    "embedding_generated_at" TIMESTAMP(3),
    "embedding_model" TEXT,
    "generation_mode" TEXT NOT NULL DEFAULT 'system',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "importance_source" TEXT NOT NULL DEFAULT 'ai',
    "last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manually_edited" BOOLEAN NOT NULL DEFAULT false,
    "modified_by" TEXT NOT NULL DEFAULT 'system',
    "section_bounded" BOOLEAN NOT NULL DEFAULT false,
    "section_content_hash" VARCHAR(255),
    "section_end_line" INTEGER,
    "section_start_line" INTEGER,

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

-- CreateTable
CREATE TABLE "public"."semantic_budgets" (
    "id" TEXT NOT NULL,
    "allocated_funds" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "remaining_funds" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total_spent" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "embedding_costs" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "summarization_costs" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "warning_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "critical_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_allocated_at" TIMESTAMP(3),
    "depleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."semantic_operations" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "project_id" TEXT,
    "operation_type" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,4) NOT NULL DEFAULT 0.00,
    "model" TEXT,
    "chunks_processed" INTEGER NOT NULL DEFAULT 0,
    "tiers_affected" JSONB NOT NULL DEFAULT '[]',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "semantic_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chunking_configs" (
    "id" TEXT NOT NULL,
    "respect_heading_boundaries" BOOLEAN NOT NULL DEFAULT true,
    "target_chunk_size" INTEGER NOT NULL DEFAULT 300,
    "max_section_size" INTEGER NOT NULL DEFAULT 500,
    "min_section_size" INTEGER NOT NULL DEFAULT 50,
    "section_boundary_overlap" INTEGER NOT NULL DEFAULT 25,
    "splitStrategy" TEXT NOT NULL DEFAULT 'paragraph',
    "embedding_model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "t1_max_length" INTEGER NOT NULL DEFAULT 200,
    "t2_max_length" INTEGER NOT NULL DEFAULT 150,
    "section_change_percent" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "minor_change_threshold" INTEGER NOT NULL DEFAULT 2,
    "defaultBehavior" TEXT NOT NULL DEFAULT 'prompt',
    "draft_mode_skip_indexing" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chunking_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."summary_generation_configs" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "t1_system_prompt" TEXT NOT NULL,
    "t2_system_prompt" TEXT NOT NULL,
    "t1_max_length" INTEGER NOT NULL DEFAULT 200,
    "t2_max_length" INTEGER NOT NULL DEFAULT 150,
    "prevent_hallucination" BOOLEAN NOT NULL DEFAULT true,
    "preserve_keywords" BOOLEAN NOT NULL DEFAULT true,
    "require_factual_accuracy" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summary_generation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."summary_generation_logs" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "chunk_id" TEXT,
    "original_content" TEXT NOT NULL,
    "prompt_used" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "generated_summary" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL,
    "cost" DECIMAL(10,4) NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "manual_review_flag" BOOLEAN NOT NULL DEFAULT false,
    "quality_rating" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,

    CONSTRAINT "summary_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."batch_embedding_jobs" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "request_count" INTEGER NOT NULL,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "estimated_tokens" INTEGER NOT NULL,
    "actual_tokens" INTEGER,
    "estimated_cost" DECIMAL(10,4) NOT NULL,
    "actual_cost" DECIMAL(10,4),
    "estimated_savings" DECIMAL(10,4) NOT NULL,
    "actual_savings" DECIMAL(10,4),
    "project_ids" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "batch_embedding_jobs_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "idx_context_chunks_embedding_hnsw" ON "public"."context_chunks" USING hnsw ("embedding_vector" vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- CreateIndex
CREATE INDEX "idx_context_chunks_entity_tier" ON "public"."context_chunks"("entity_id", "tier");

-- CreateIndex
CREATE INDEX "idx_context_chunks_parent_chunk_id" ON "public"."context_chunks"("parent_chunk_id");

-- CreateIndex
CREATE INDEX "idx_context_chunks_root_chunk_id" ON "public"."context_chunks"("root_chunk_id");

-- CreateIndex
CREATE INDEX "idx_context_chunks_section_group" ON "public"."context_chunks"("section_group");

-- CreateIndex
CREATE INDEX "idx_context_chunks_tier" ON "public"."context_chunks"("tier");

-- CreateIndex
CREATE INDEX "context_chunks_project_index_id_tier_idx" ON "public"."context_chunks"("project_index_id", "tier");

-- CreateIndex
CREATE INDEX "context_chunks_importance_idx" ON "public"."context_chunks"("importance");

-- CreateIndex
CREATE INDEX "context_chunks_manually_edited_idx" ON "public"."context_chunks"("manually_edited");

-- CreateIndex
CREATE INDEX "context_chunks_embedding_generated_at_idx" ON "public"."context_chunks"("embedding_generated_at");

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

-- CreateIndex
CREATE INDEX "semantic_operations_budget_id_idx" ON "public"."semantic_operations"("budget_id");

-- CreateIndex
CREATE INDEX "semantic_operations_project_id_idx" ON "public"."semantic_operations"("project_id");

-- CreateIndex
CREATE INDEX "semantic_operations_operation_type_idx" ON "public"."semantic_operations"("operation_type");

-- CreateIndex
CREATE INDEX "semantic_operations_started_at_idx" ON "public"."semantic_operations"("started_at");

-- CreateIndex
CREATE INDEX "semantic_operations_success_idx" ON "public"."semantic_operations"("success");

-- CreateIndex
CREATE INDEX "summary_generation_logs_config_id_idx" ON "public"."summary_generation_logs"("config_id");

-- CreateIndex
CREATE INDEX "summary_generation_logs_chunk_id_idx" ON "public"."summary_generation_logs"("chunk_id");

-- CreateIndex
CREATE INDEX "summary_generation_logs_generated_at_idx" ON "public"."summary_generation_logs"("generated_at");

-- CreateIndex
CREATE INDEX "summary_generation_logs_manual_review_flag_idx" ON "public"."summary_generation_logs"("manual_review_flag");

-- CreateIndex
CREATE INDEX "summary_generation_logs_quality_rating_idx" ON "public"."summary_generation_logs"("quality_rating");

-- CreateIndex
CREATE UNIQUE INDEX "batch_embedding_jobs_batch_id_key" ON "public"."batch_embedding_jobs"("batch_id");

-- CreateIndex
CREATE INDEX "batch_embedding_jobs_batch_id_idx" ON "public"."batch_embedding_jobs"("batch_id");

-- CreateIndex
CREATE INDEX "batch_embedding_jobs_status_idx" ON "public"."batch_embedding_jobs"("status");

-- CreateIndex
CREATE INDEX "batch_embedding_jobs_priority_idx" ON "public"."batch_embedding_jobs"("priority");

-- CreateIndex
CREATE INDEX "batch_embedding_jobs_created_at_idx" ON "public"."batch_embedding_jobs"("created_at");

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
ALTER TABLE "public"."context_chunks" ADD CONSTRAINT "context_chunks_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."content_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."context_chunks" ADD CONSTRAINT "context_chunks_parent_chunk_id_fkey" FOREIGN KEY ("parent_chunk_id") REFERENCES "public"."context_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."context_chunks" ADD CONSTRAINT "context_chunks_project_index_id_fkey" FOREIGN KEY ("project_index_id") REFERENCES "public"."project_ai_index"("projectId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."semantic_operations" ADD CONSTRAINT "semantic_operations_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."semantic_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."summary_generation_logs" ADD CONSTRAINT "summary_generation_logs_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."summary_generation_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProjectTags" ADD CONSTRAINT "_ProjectTags_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProjectTags" ADD CONSTRAINT "_ProjectTags_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
