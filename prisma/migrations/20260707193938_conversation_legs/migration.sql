-- AlterTable
ALTER TABLE "public"."ai_conversation_messages" ADD COLUMN     "leg_id" TEXT;

-- AlterTable
ALTER TABLE "public"."ai_conversations" ADD COLUMN     "latest_state" JSONB;

-- CreateTable
CREATE TABLE "public"."ai_conversation_legs" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_alias" TEXT,
    "model_id" TEXT,
    "provider_session_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ai_conversation_legs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversation_legs_conversation_id_idx" ON "public"."ai_conversation_legs"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_conversation_legs_started_at_idx" ON "public"."ai_conversation_legs"("started_at");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_leg_id_idx" ON "public"."ai_conversation_messages"("leg_id");

-- AddForeignKey
ALTER TABLE "public"."ai_conversation_legs" ADD CONSTRAINT "ai_conversation_legs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
