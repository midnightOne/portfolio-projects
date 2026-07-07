-- D29 hybrid retrieval: full-text half. Generated tsvector over chunk
-- title+content (no trigger maintenance) + GIN index; ContentSearchService
-- fuses ts_rank with pgvector cosine similarity via reciprocal-rank fusion.
ALTER TABLE "context_chunks"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", '') || ' ' || "content")) STORED;

CREATE INDEX "idx_context_chunks_search_vector" ON "context_chunks" USING GIN ("search_vector");
