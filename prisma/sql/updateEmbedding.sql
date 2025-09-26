-- Update embedding vector for existing chunk
UPDATE context_chunks 
SET 
  embedding_vector = $2::vector(1536),
  updated_at = NOW()
WHERE id = $1
RETURNING id, updated_at;