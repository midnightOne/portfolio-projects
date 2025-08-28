-- Migration to add enhanced reflink features
-- Add recipient information and budget tracking to AIReflink table

ALTER TABLE "ai_reflinks" ADD COLUMN "recipient_name" VARCHAR(255);
ALTER TABLE "ai_reflinks" ADD COLUMN "recipient_email" VARCHAR(255);
ALTER TABLE "ai_reflinks" ADD COLUMN "custom_context" TEXT;
ALTER TABLE "ai_reflinks" ADD COLUMN "token_limit" INTEGER;
ALTER TABLE "ai_reflinks" ADD COLUMN "tokens_used" INTEGER DEFAULT 0;
ALTER TABLE "ai_reflinks" ADD COLUMN "spend_limit" DECIMAL(10,2);
ALTER TABLE "ai_reflinks" ADD COLUMN "spend_used" DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE "ai_reflinks" ADD COLUMN "enable_voice_ai" BOOLEAN DEFAULT true;
ALTER TABLE "ai_reflinks" ADD COLUMN "enable_job_analysis" BOOLEAN DEFAULT true;
ALTER TABLE "ai_reflinks" ADD COLUMN "enable_advanced_navigation" BOOLEAN DEFAULT true;
ALTER TABLE "ai_reflinks" ADD COLUMN "last_used_at" TIMESTAMP;

-- Create table for tracking AI usage costs per reflink
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "reflink_id" TEXT,
    "session_id" TEXT,
    "usage_type" TEXT NOT NULL, -- 'llm_request', 'voice_generation', 'voice_processing'
    "tokens_used" INTEGER,
    "cost_usd" DECIMAL(10,4) NOT NULL,
    "model_used" TEXT,
    "endpoint" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX "ai_usage_logs_reflink_id_idx" ON "ai_usage_logs"("reflink_id");
CREATE INDEX "ai_usage_logs_timestamp_idx" ON "ai_usage_logs"("timestamp");
CREATE INDEX "ai_usage_logs_usage_type_idx" ON "ai_usage_logs"("usage_type");

-- Add foreign key constraint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_reflink_id_fkey" FOREIGN KEY ("reflink_id") REFERENCES "ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create table for AI conversations with reflink attribution
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "reflink_id" TEXT,
    "session_id" TEXT NOT NULL,
    "message_count" INTEGER DEFAULT 0,
    "total_tokens" INTEGER DEFAULT 0,
    "total_cost" DECIMAL(10,4) DEFAULT 0.0000,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- Create indexes for conversations
CREATE INDEX "ai_conversations_reflink_id_idx" ON "ai_conversations"("reflink_id");
CREATE INDEX "ai_conversations_session_id_idx" ON "ai_conversations"("session_id");
CREATE INDEX "ai_conversations_started_at_idx" ON "ai_conversations"("started_at");

-- Add foreign key constraint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_reflink_id_fkey" FOREIGN KEY ("reflink_id") REFERENCES "ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create table for individual conversation messages
CREATE TABLE "ai_conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL, -- 'user', 'assistant', 'system'
    "content" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "cost_usd" DECIMAL(10,4),
    "model_used" TEXT,
    "transport_mode" TEXT, -- 'text', 'voice', 'hybrid'
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- Create indexes for messages
CREATE INDEX "ai_conversation_messages_conversation_id_idx" ON "ai_conversation_messages"("conversation_id");
CREATE INDEX "ai_conversation_messages_timestamp_idx" ON "ai_conversation_messages"("timestamp");
CREATE INDEX "ai_conversation_messages_role_idx" ON "ai_conversation_messages"("role");

-- Add foreign key constraint
ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "ai_conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create table for job analysis reports with reflink attribution
CREATE TABLE "ai_job_analyses" (
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
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "ai_job_analyses_pkey" PRIMARY KEY ("id")
);

-- Create indexes for job analyses
CREATE INDEX "ai_job_analyses_reflink_id_idx" ON "ai_job_analyses"("reflink_id");
CREATE INDEX "ai_job_analyses_created_at_idx" ON "ai_job_analyses"("created_at");
CREATE INDEX "ai_job_analyses_company_name_idx" ON "ai_job_analyses"("company_name");

-- Add foreign key constraint
ALTER TABLE "ai_job_analyses" ADD CONSTRAINT "ai_job_analyses_reflink_id_fkey" FOREIGN KEY ("reflink_id") REFERENCES "ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;