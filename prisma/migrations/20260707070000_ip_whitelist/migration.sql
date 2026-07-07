-- IP whitelist / exceptions (owner request 2026-07-07): whitelisted IPs are
-- never blacklisted or blocked; checked before every blacklist decision.
CREATE TABLE "ai_ip_whitelist" (
    "id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_ip_whitelist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_ip_whitelist_ip_address_key" ON "ai_ip_whitelist"("ip_address");
