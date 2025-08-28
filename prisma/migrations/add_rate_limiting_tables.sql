-- Add rate limiting and reflink management tables

-- Rate limiting tracking table
CREATE TABLE "ai_rate_limits" (
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

-- Reflink management table
CREATE TABLE "ai_reflinks" (
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

    CONSTRAINT "ai_reflinks_pkey" PRIMARY KEY ("id")
);

-- IP blacklist table
CREATE TABLE "ai_ip_blacklist" (
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

-- Rate limit usage logs for analytics
CREATE TABLE "ai_rate_limit_logs" (
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

-- Create indexes for performance
CREATE UNIQUE INDEX "ai_rate_limits_identifier_window_idx" ON "ai_rate_limits"("identifier", "identifier_type", "window_start");
CREATE INDEX "ai_rate_limits_window_end_idx" ON "ai_rate_limits"("window_end");
CREATE INDEX "ai_rate_limits_reflink_idx" ON "ai_rate_limits"("reflink_id");

CREATE UNIQUE INDEX "ai_reflinks_code_idx" ON "ai_reflinks"("code");
CREATE INDEX "ai_reflinks_active_idx" ON "ai_reflinks"("is_active");
CREATE INDEX "ai_reflinks_expires_idx" ON "ai_reflinks"("expires_at");

CREATE UNIQUE INDEX "ai_ip_blacklist_ip_idx" ON "ai_ip_blacklist"("ip_address");
CREATE INDEX "ai_ip_blacklist_blocked_idx" ON "ai_ip_blacklist"("blocked_at");

CREATE INDEX "ai_rate_limit_logs_identifier_idx" ON "ai_rate_limit_logs"("identifier", "identifier_type");
CREATE INDEX "ai_rate_limit_logs_timestamp_idx" ON "ai_rate_limit_logs"("timestamp");
CREATE INDEX "ai_rate_limit_logs_reflink_idx" ON "ai_rate_limit_logs"("reflink_id");
CREATE INDEX "ai_rate_limit_logs_blocked_idx" ON "ai_rate_limit_logs"("was_blocked");

-- Add foreign key constraints
ALTER TABLE "ai_rate_limits" ADD CONSTRAINT "ai_rate_limits_reflink_fkey" FOREIGN KEY ("reflink_id") REFERENCES "ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_rate_limit_logs" ADD CONSTRAINT "ai_rate_limit_logs_reflink_fkey" FOREIGN KEY ("reflink_id") REFERENCES "ai_reflinks"("id") ON DELETE SET NULL ON UPDATE CASCADE;