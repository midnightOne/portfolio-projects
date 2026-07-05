-- spendUsed accumulates sub-cent per-call costs; Decimal(10,2) rounded every
-- increment to zero so reflink budgets never accumulated (Phase 2 e2e finding).
ALTER TABLE "ai_reflinks" ALTER COLUMN "spend_used" SET DATA TYPE DECIMAL(12,6);
