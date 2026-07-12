-- AlterTable
ALTER TABLE "public"."conversation_leads" ADD COLUMN     "handled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."conversation_retention_config" (
    "id" TEXT NOT NULL DEFAULT 'retention',
    "transcript_retention_days" INTEGER,
    "summary_retention_days" INTEGER,
    "lead_retention_days" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_retention_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_lifecycle_audits" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "counts" JSONB NOT NULL DEFAULT '{}',
    "initiated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_lifecycle_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_lifecycle_audits_created_at_idx" ON "public"."data_lifecycle_audits"("created_at");
