-- D37: retire ProjectAIIndex (one semantic index).
-- Data migration first: salvage summary/keywords/topics/technologies into the
-- surviving structures (ContentEntity + ContextChunk metadata / T1 chunk),
-- then drop the FK column and the table. Git history is the archive (D42).

-- 1. Technologies -> content_entities.technologies (where the entity has none)
UPDATE "content_entities" ce
SET "technologies" = pai."technologies"
FROM "projects" p
JOIN "project_ai_index" pai ON pai."projectId" = p."id"
WHERE ce."entityType" = 'PROJECT'
  AND ce."slug" = p."slug"
  AND pai."technologies" IS NOT NULL
  AND pai."technologies"::text <> '[]'
  AND (ce."technologies" IS NULL OR ce."technologies"::text = '[]');

-- 2. Keywords/topics -> T1 chunk metadata (merged, existing keys win)
UPDATE "context_chunks" cc
SET "metadata" = jsonb_build_object(
      'keywords', COALESCE(pai."keywords", '[]'::jsonb),
      'topics',   COALESCE(pai."topics",   '[]'::jsonb)
    ) || cc."metadata"
FROM "content_entities" ce
JOIN "projects" p ON p."slug" = ce."slug" AND ce."entityType" = 'PROJECT'
JOIN "project_ai_index" pai ON pai."projectId" = p."id"
WHERE cc."entity_id" = ce."id"
  AND cc."tier" = 1
  AND (COALESCE(pai."keywords"::text, '[]') <> '[]' OR COALESCE(pai."topics"::text, '[]') <> '[]');

-- 3. Summary -> new T1 chunk where the project has none (no embedding; next
--    ingestion run generates it through the stage-based pipeline)
INSERT INTO "context_chunks" (
  "id", "entity_id", "tier", "chunk_id", "title", "content", "token_count",
  "metadata", "generation_mode", "created_at", "updated_at", "last_modified"
)
SELECT
  gen_random_uuid()::text,
  ce."id",
  1,
  p."slug" || '-t1',
  p."title",
  pai."summary",
  GREATEST(1, length(pai."summary") / 4),
  jsonb_build_object(
    'keywords', COALESCE(pai."keywords", '[]'::jsonb),
    'topics',   COALESCE(pai."topics",   '[]'::jsonb),
    'migratedFrom', 'project_ai_index'
  ),
  'system',
  NOW(), NOW(), NOW()
FROM "project_ai_index" pai
JOIN "projects" p ON p."id" = pai."projectId"
JOIN "content_entities" ce ON ce."entityType" = 'PROJECT' AND ce."slug" = p."slug"
WHERE pai."summary" IS NOT NULL AND pai."summary" <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "context_chunks" cc WHERE cc."entity_id" = ce."id" AND cc."tier" = 1
  );

-- 4. Drop the legacy FK plumbing and the table
ALTER TABLE "context_chunks" DROP CONSTRAINT IF EXISTS "context_chunks_project_index_id_fkey";
ALTER TABLE "project_ai_index" DROP CONSTRAINT IF EXISTS "project_ai_index_projectId_fkey";
DROP INDEX IF EXISTS "context_chunks_project_index_id_idx";
DROP INDEX IF EXISTS "context_chunks_project_index_id_tier_idx";
ALTER TABLE "context_chunks" DROP COLUMN IF EXISTS "project_index_id";
DROP TABLE IF EXISTS "project_ai_index";
