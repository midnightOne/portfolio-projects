-- AlterTable
ALTER TABLE "public"."ai_public_access_settings" ADD COLUMN     "mcp_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mcp_requests_per_day" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "mcp_requests_per_minute" INTEGER NOT NULL DEFAULT 10;
