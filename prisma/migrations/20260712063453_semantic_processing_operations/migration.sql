-- CreateTable
CREATE TABLE "public"."semantic_processing_operations" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "scope" TEXT NOT NULL,
    "project_id" TEXT,
    "section_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "current_stage" TEXT,
    "stages" JSONB NOT NULL DEFAULT '[]',
    "stage_progress" JSONB NOT NULL DEFAULT '{}',
    "overall_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "cost_accumulated" DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "child_outcomes" JSONB,
    "can_resume" BOOLEAN NOT NULL DEFAULT false,
    "next_stage" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "semantic_processing_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semantic_processing_operations_parent_id_idx" ON "public"."semantic_processing_operations"("parent_id");

-- CreateIndex
CREATE INDEX "semantic_processing_operations_status_idx" ON "public"."semantic_processing_operations"("status");

-- CreateIndex
CREATE INDEX "semantic_processing_operations_project_id_idx" ON "public"."semantic_processing_operations"("project_id");

-- CreateIndex
CREATE INDEX "semantic_processing_operations_started_at_idx" ON "public"."semantic_processing_operations"("started_at");
