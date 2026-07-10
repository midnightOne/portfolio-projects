-- AlterTable
ALTER TABLE "public"."ai_job_analyses" ADD COLUMN     "email_requested_at" TIMESTAMP(3),
ADD COLUMN     "visitor_email" TEXT;

-- CreateTable
CREATE TABLE "public"."ai_owner_preferences" (
    "id" TEXT NOT NULL DEFAULT 'owner',
    "work_preferences" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_owner_preferences_pkey" PRIMARY KEY ("id")
);
