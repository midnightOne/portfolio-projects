-- A document config owns at most one semantic entity. The nullable column
-- leaves project and script-ingested entities outside document ownership.
ALTER TABLE "public"."content_entities"
ADD COLUMN "source_config_id" TEXT;

CREATE UNIQUE INDEX "content_entities_source_config_id_key"
ON "public"."content_entities"("source_config_id");

-- Adopt only entities that were demonstrably produced by document ingestion.
-- A semantic type/slug match alone is intentionally insufficient ownership.
UPDATE "public"."content_entities" AS entity
SET "source_config_id" = config."id"
FROM "public"."ai_content_source_config" AS config
WHERE config."providerId" = 'document'
  AND config."sourceId" LIKE 'doc:%'
  AND entity."entityType"::text = config."config"->>'entityType'
  AND entity."slug" = config."config"->>'slug'
  AND EXISTS (
    SELECT 1
    FROM "public"."context_chunks" AS chunk
    WHERE chunk."entity_id" = entity."id"
      AND chunk."tier" = 0
      AND chunk."metadata"->>'source' = 'document-source'
  );

ALTER TABLE "public"."content_entities"
ADD CONSTRAINT "content_entities_source_config_id_fkey"
FOREIGN KEY ("source_config_id")
REFERENCES "public"."ai_content_source_config"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
