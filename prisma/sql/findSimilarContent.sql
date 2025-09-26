-- Find similar content using L2 distance
SELECT 
  c.id,
  c.title,
  c.content,
  c.tier,
  c.token_count,
  e.title as entity_title,
  e.slug as entity_slug,
  (c.embedding_vector <-> $1::vector(1536)) as l2_distance
FROM context_chunks c
JOIN content_entities e ON c.entity_id = e.id
WHERE c.embedding_vector IS NOT NULL
  AND c.tier <= $3
ORDER BY c.embedding_vector <-> $1::vector(1536)
LIMIT $2;