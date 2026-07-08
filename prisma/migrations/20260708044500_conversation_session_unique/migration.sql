-- One conversation per logical session (D49): concurrent first writes raced the
-- check-then-create in getOrCreateConversationId and split a session across two
-- conversation rows (legs in one, turns in the other). Found by the AC8
-- duration-cap drill 2026-07-08; dev data was deduped before this applies.
DROP INDEX "public"."ai_conversations_session_id_idx";

CREATE UNIQUE INDEX "ai_conversations_session_id_key" ON "public"."ai_conversations"("session_id");
