-- Insert context chunk with vector embedding
INSERT INTO context_chunks (
  id, entity_id, tier, chunk_id, title, content, token_count, embedding_vector, metadata, created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8::vector(1536), $9::jsonb, NOW(), NOW()
) RETURNING id, created_at;