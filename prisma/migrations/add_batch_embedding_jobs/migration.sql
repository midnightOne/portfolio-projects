-- CreateTable
CREATE TABLE "batch_embedding_jobs" (
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

-- CreateIndex
CREATE UNIQUE INDEX "batch_embedding_jobs_batch_id_key" ON "batch_embedding_jobs"("batch_id");

-- CreateIndex
CREATE INDEX "batch_embedding_jobs_batch_id_idx" ON "batch_embedding_jobs"("batch_id");

-- CreateIndex
CREATE INDEX "batch_embedding_jobs_status_idx" ON "batch_embedding_jobs"("status");

-- CreateIndex
CREATE INDEX "batch_embedding_jobs_priority_idx" ON "batch_embedding_jobs"("priority");

-- CreateIndex
CREATE INDEX "batch_embedding_jobs_created_at_idx" ON "batch_embedding_jobs"("created_at");
