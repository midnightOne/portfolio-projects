-- CreateTable
CREATE TABLE "public"."voice_clip_phrases" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_clip_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voice_clips" (
    "id" TEXT NOT NULL,
    "voice_id" TEXT NOT NULL,
    "phrase_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audio" BYTEA NOT NULL,
    "content_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_clip_phrases_tag_idx" ON "public"."voice_clip_phrases"("tag");

-- CreateIndex
CREATE INDEX "voice_clips_voice_id_idx" ON "public"."voice_clips"("voice_id");

-- CreateIndex
CREATE UNIQUE INDEX "voice_clips_voice_id_phrase_id_key" ON "public"."voice_clips"("voice_id", "phrase_id");

-- AddForeignKey
ALTER TABLE "public"."voice_clips" ADD CONSTRAINT "voice_clips_phrase_id_fkey" FOREIGN KEY ("phrase_id") REFERENCES "public"."voice_clip_phrases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
