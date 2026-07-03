-- Add hierarchical relationship fields to context_chunks table
ALTER TABLE "context_chunks" 
ADD COLUMN "parent_chunk_id" TEXT,
ADD COLUMN "root_chunk_id" TEXT,
ADD COLUMN "section_group" TEXT,
ADD COLUMN "derivation_path" TEXT;

-- Add foreign key constraint for parent_chunk_id
ALTER TABLE "context_chunks" 
ADD CONSTRAINT "context_chunks_parent_chunk_id_fkey" 
FOREIGN KEY ("parent_chunk_id") REFERENCES "context_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for hierarchical queries
CREATE INDEX "idx_context_chunks_parent_chunk_id" ON "context_chunks"("parent_chunk_id");
CREATE INDEX "idx_context_chunks_root_chunk_id" ON "context_chunks"("root_chunk_id");
CREATE INDEX "idx_context_chunks_section_group" ON "context_chunks"("section_group");