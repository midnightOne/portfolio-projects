-- CreateTable
CREATE TABLE "public"."ai_email_sends" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "session_id" TEXT,
    "analysis_id" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider_id" TEXT,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_email_sends_session_id_idx" ON "public"."ai_email_sends"("session_id");

-- CreateIndex
CREATE INDEX "ai_email_sends_status_idx" ON "public"."ai_email_sends"("status");

-- CreateIndex
CREATE INDEX "ai_email_sends_created_at_idx" ON "public"."ai_email_sends"("created_at");
