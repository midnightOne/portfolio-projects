-- AlterTable
ALTER TABLE "public"."ai_public_access_settings" ADD COLUMN     "default_voice_provider" TEXT NOT NULL DEFAULT 'openai';

-- CreateIndex
CREATE INDEX "ai_conversations_session_id_idx" ON "public"."ai_conversations"("session_id");
