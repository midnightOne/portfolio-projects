/*
  Warnings:

  - You are about to alter the column `cost_usd` on the `ai_usage_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,4)` to `Decimal(10,6)`.

*/
-- AlterTable
ALTER TABLE "public"."ai_usage_logs" ADD COLUMN     "feature" TEXT,
ADD COLUMN     "hashed_ip" TEXT,
ADD COLUMN     "input_tokens" INTEGER,
ADD COLUMN     "output_tokens" INTEGER,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "request_id" TEXT,
ALTER COLUMN "cost_usd" SET DATA TYPE DECIMAL(10,6);

-- CreateTable
CREATE TABLE "public"."ai_global_limits" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "daily_spend_cap_usd" DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    "monthly_spend_cap_usd" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "day_spend_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "month_spend_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "day_key" TEXT NOT NULL DEFAULT '',
    "month_key" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "tripped_at" TIMESTAMP(3),
    "trip_reason" TEXT,
    "trip_history" JSONB NOT NULL DEFAULT '[]',
    "public_ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "disable_reflinks_on_trip" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_global_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_public_access_settings" (
    "id" TEXT NOT NULL DEFAULT 'public',
    "publicTier" TEXT NOT NULL DEFAULT 'text_chat',
    "turnstile_enabled" BOOLEAN NOT NULL DEFAULT false,
    "session_ttl_minutes" INTEGER NOT NULL DEFAULT 30,
    "sessions_per_ip_per_hour" INTEGER NOT NULL DEFAULT 10,
    "messages_per_minute" INTEGER NOT NULL DEFAULT 6,
    "messages_per_day" INTEGER NOT NULL DEFAULT 60,
    "tokens_per_day" INTEGER NOT NULL DEFAULT 150000,
    "max_history_messages" INTEGER NOT NULL DEFAULT 12,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_public_access_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_model_aliases" (
    "alias" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_aliases_pkey" PRIMARY KEY ("alias")
);

-- CreateTable
CREATE TABLE "public"."ai_model_pricing" (
    "model_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "input_per_mtok_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "output_per_mtok_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_pricing_pkey" PRIMARY KEY ("model_id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_feature_idx" ON "public"."ai_usage_logs"("feature");

-- CreateIndex
CREATE INDEX "ai_usage_logs_hashed_ip_idx" ON "public"."ai_usage_logs"("hashed_ip");

-- CreateIndex
CREATE INDEX "ai_usage_logs_request_id_idx" ON "public"."ai_usage_logs"("request_id");
