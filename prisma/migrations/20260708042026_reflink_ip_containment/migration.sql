-- AlterTable
ALTER TABLE "public"."ai_reflinks" ADD COLUMN     "bound_ip_hashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "max_ips" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "per_ip_daily_limit" INTEGER NOT NULL DEFAULT 300;
