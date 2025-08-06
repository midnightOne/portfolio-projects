-- AlterTable
ALTER TABLE "public"."projects" ADD COLUMN     "search_vector" tsvector;

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

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_config_provider_key" ON "public"."ai_model_config"("provider");

-- CreateIndex
CREATE INDEX "ai_model_config_provider_idx" ON "public"."ai_model_config"("provider");

-- CreateIndex
CREATE INDEX "projects_search_vector_idx" ON "public"."projects" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "idx_tags_id" ON "public"."tags"("id");
