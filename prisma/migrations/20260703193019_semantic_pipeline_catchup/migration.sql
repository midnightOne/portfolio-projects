-- AlterTable
ALTER TABLE "public"."context_chunks" ADD COLUMN     "chunk_index_in_section" INTEGER,
ADD COLUMN     "content_hash" VARCHAR(255),
ADD COLUMN     "embedding_generated_at" TIMESTAMP(3),
ADD COLUMN     "embedding_model" TEXT,
ADD COLUMN     "generation_mode" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "importance_source" TEXT NOT NULL DEFAULT 'ai',
ADD COLUMN     "last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "manually_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modified_by" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "section_bounded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "section_content_hash" VARCHAR(255),
ADD COLUMN     "section_end_line" INTEGER,
ADD COLUMN     "section_start_line" INTEGER;

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
-- HNSW vector index (hand-written: Prisma cannot express pgvector index types; matches scripts/setup-vector-indexes.ts)
CREATE INDEX "idx_context_chunks_embedding_hnsw" ON "public"."context_chunks" USING hnsw ("embedding_vector" vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- CreateIndex
CREATE INDEX "idx_context_chunks_entity_tier" ON "public"."context_chunks"("entity_id", "tier");

-- CreateIndex
CREATE INDEX "context_chunks_project_index_id_tier_idx" ON "public"."context_chunks"("project_index_id", "tier");

-- CreateIndex
CREATE INDEX "context_chunks_importance_idx" ON "public"."context_chunks"("importance");

-- CreateIndex
CREATE INDEX "context_chunks_manually_edited_idx" ON "public"."context_chunks"("manually_edited");

-- CreateIndex
CREATE INDEX "context_chunks_embedding_generated_at_idx" ON "public"."context_chunks"("embedding_generated_at");

-- AddForeignKey
ALTER TABLE "public"."semantic_operations" ADD CONSTRAINT "semantic_operations_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."semantic_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."summary_generation_logs" ADD CONSTRAINT "summary_generation_logs_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."summary_generation_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
