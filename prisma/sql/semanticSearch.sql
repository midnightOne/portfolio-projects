-- Semantic search using cosine similarity
SELECT 
  c.id,
  c.title,
  c.content,
  c.tier,
  c.chunk_id,
  e.title as entity_title,
  e.slug as entity_slug,
  e."entityType" as entity_type,
  (1 - (c.embedding_vector <=> $1::vector(1536))) as similarity_score
FROM context_chunks c
JOIN content_entities e ON c.entity_id = e.id
WHERE c.embedding_vector IS NOT NULL
ORDER BY c.embedding_vector <=> $1::vector(1536)
LIMIT $2;