/**
 * Setup script for pgvector extension and vector columns
 * 
 * This script should be run after pgvector extension is available in the database.
 * It will:
 * 1. Enable the pgvector extension
 * 2. Convert TEXT embedding columns to vector(1536) type
 * 3. Create vector similarity indexes for efficient semantic search
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupPgVector() {
  console.log('🔧 Setting up pgvector extension...');

  try {
    // Enable pgvector extension
    console.log('📦 Enabling pgvector extension...');
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log('✅ pgvector extension enabled');

    // Check if we can use vector type
    console.log('🔍 Checking vector type availability...');
    try {
      // Create a test vector with proper dimensions
      await prisma.$executeRaw`SELECT ARRAY[0.1, 0.2, 0.3]::vector(3);`;
      console.log('✅ Vector type is available');
    } catch (error) {
      console.error('❌ Vector type not available. Make sure pgvector is properly installed.');
      throw error;
    }

    // Convert embedding columns to vector type
    console.log('🔄 Converting embedding columns to vector type...');
    
    // Update project_ai_index table
    await prisma.$executeRaw`
      ALTER TABLE "public"."project_ai_index" 
      ALTER COLUMN "embeddingVector" TYPE vector(1536) 
      USING CASE 
        WHEN "embeddingVector" IS NULL THEN NULL 
        ELSE "embeddingVector"::vector(1536) 
      END;
    `;
    console.log('✅ Updated project_ai_index.embeddingVector column');

    // Update context_chunks table
    await prisma.$executeRaw`
      ALTER TABLE "public"."context_chunks" 
      ALTER COLUMN "embedding_vector" TYPE vector(1536) 
      USING CASE 
        WHEN "embedding_vector" IS NULL THEN NULL 
        ELSE "embedding_vector"::vector(1536) 
      END;
    `;
    console.log('✅ Updated context_chunks.embedding_vector column');

    // Create vector similarity indexes
    console.log('📊 Creating vector similarity indexes...');
    
    // Index for project_ai_index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "project_ai_index_embedding_cosine_idx" 
      ON "public"."project_ai_index" 
      USING ivfflat ("embeddingVector" vector_cosine_ops)
      WITH (lists = 100);
    `;
    console.log('✅ Created cosine similarity index for project_ai_index');

    // Index for context_chunks
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "context_chunks_embedding_cosine_idx" 
      ON "public"."context_chunks" 
      USING ivfflat ("embedding_vector" vector_cosine_ops)
      WITH (lists = 100);
    `;
    console.log('✅ Created cosine similarity index for context_chunks');

    // Create additional indexes for L2 distance if needed
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "context_chunks_embedding_l2_idx" 
      ON "public"."context_chunks" 
      USING ivfflat ("embedding_vector" vector_l2_ops)
      WITH (lists = 100);
    `;
    console.log('✅ Created L2 distance index for context_chunks');

    console.log('🎉 pgvector setup completed successfully!');

    // Verify the setup
    console.log('🔍 Verifying setup...');
    const result = await prisma.$queryRaw`
      SELECT 
        table_name,
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns 
      WHERE table_name IN ('project_ai_index', 'context_chunks') 
      AND column_name LIKE '%embedding%';
    `;
    
    console.log('📋 Vector columns:');
    console.table(result);

    // Check indexes
    const indexes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename IN ('project_ai_index', 'context_chunks')
      AND indexname LIKE '%embedding%';
    `;

    console.log('📊 Vector indexes:');
    console.table(indexes);

  } catch (error) {
    console.error('❌ pgvector setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Function to check if pgvector is available
async function checkPgVectorAvailability(): Promise<boolean> {
  try {
    await prisma.$executeRaw`SELECT '[]'::vector(1536);`;
    return true;
  } catch (error) {
    return false;
  }
}

// Function to generate sample embeddings for testing
async function generateSampleEmbeddings() {
  console.log('🧪 Generating sample embeddings for testing...');
  
  // This would typically use OpenAI's embedding API
  // For now, we'll create random vectors for testing
  const sampleEmbedding = Array.from({ length: 1536 }, () => Math.random() - 0.5);
  const embeddingString = `[${sampleEmbedding.join(',')}]`;

  try {
    // Test inserting a sample embedding
    await prisma.$executeRaw`
      INSERT INTO "public"."context_chunks" (
        "id", "entity_id", "tier", "chunk_id", "content", "embedding_vector"
      ) VALUES (
        'test-embedding-' || gen_random_uuid()::text,
        (SELECT id FROM "public"."content_entities" LIMIT 1),
        0,
        'test-chunk',
        'Test content for embedding',
        ${embeddingString}::vector(1536)
      )
      ON CONFLICT DO NOTHING;
    `;
    
    console.log('✅ Sample embedding inserted successfully');
    
      // Test similarity search
    const similarityTest = await prisma.$queryRaw`
      SELECT 
        "chunk_id",
        "content",
        1 - ("embedding_vector" <=> ${embeddingString}::vector(1536)) as similarity
      FROM "public"."context_chunks"
      WHERE "embedding_vector" IS NOT NULL
      ORDER BY "embedding_vector" <=> ${embeddingString}::vector(1536)
      LIMIT 5;
    `;
    
    console.log('🔍 Similarity search test results:');
    console.table(similarityTest);
    
  } catch (error) {
    console.error('❌ Sample embedding test failed:', error);
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupPgVector()
    .then(() => generateSampleEmbeddings())
    .catch((error) => {
      console.error('Setup script failed:', error);
      process.exit(1);
    });
}

export { setupPgVector, checkPgVectorAvailability, generateSampleEmbeddings };