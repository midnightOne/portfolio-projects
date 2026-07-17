-- ai-assistant 7.16: client/project-request intake — free-form message + pasted
-- spec text ride the ConversationLead row (pass-to-owner path, Block H2 seam).
ALTER TABLE "conversation_leads" ADD COLUMN "message" TEXT;
ALTER TABLE "conversation_leads" ADD COLUMN "spec_text" TEXT;
