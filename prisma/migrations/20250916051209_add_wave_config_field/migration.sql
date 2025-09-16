-- AlterTable
ALTER TABLE "public"."homepage_config" ADD COLUMN     "waveConfig" JSONB,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
