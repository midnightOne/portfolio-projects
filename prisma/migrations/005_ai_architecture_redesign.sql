-- AI Architecture Redesign Migration
-- This migration removes the old complex AI tables and creates a simplified schema
-- that stores only non-sensitive configuration in the database

-- Drop existing AI-related tables
DROP TABLE IF EXISTS "ai_messages" CASCADE;
DROP TABLE IF EXISTS "content_versions" CASCADE;
DROP TABLE IF EXISTS "ai_conversations" CASCADE;
DROP TABLE IF EXISTS "ai_settings" CASCADE;

-- Create simplified AI model configuration table
CREATE TABLE "ai_model_config" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "models" TEXT NOT NULL, -- comma-separated model IDs
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_config_pkey" PRIMARY KEY ("id")
);

-- Create AI general settings table (non-sensitive settings only)
CREATE TABLE "ai_general_settings" (
    "id" TEXT NOT NULL,
    "default_provider" TEXT NOT NULL DEFAULT 'openai',
    "system_prompt" TEXT NOT NULL DEFAULT 'You are an expert content editor for portfolio projects. Help improve and edit project content while maintaining the author''s voice and style.',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 4000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_general_settings_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX "ai_model_config_provider_idx" ON "ai_model_config"("provider");
CREATE UNIQUE INDEX "ai_model_config_provider_unique" ON "ai_model_config"("provider");

-- Insert default configuration
INSERT INTO "ai_model_config" ("id", "provider", "models", "updated_at") VALUES
    ('openai_default', 'openai', 'gpt-4o,gpt-4o-mini,gpt-3.5-turbo', CURRENT_TIMESTAMP),
    ('anthropic_default', 'anthropic', 'claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022', CURRENT_TIMESTAMP);

INSERT INTO "ai_general_settings" ("id", "updated_at") VALUES
    ('default', CURRENT_TIMESTAMP);