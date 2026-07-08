-- Voice clips move from Postgres bytes to the media pipeline (owner,
-- 2026-07-08): rows now hold the CDN url + public id. Existing clips are
-- regenerable derived assets — cleared here; regenerate from
-- /admin/ai/voice-clips after deploy.
DELETE FROM "public"."voice_clips";

ALTER TABLE "public"."voice_clips" DROP COLUMN "audio",
ADD COLUMN "url" TEXT NOT NULL,
ADD COLUMN "public_id" TEXT NOT NULL;
