/**
 * Enable pgvector extension in Neon database
 * 
 * This script enables the pgvector extension and updates the schema
 * to use proper vector columns for embeddings.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function enablePgVector() {
  console.log('🚀 Enabling pgvector extension in Neon database...');

  try {
    // Step 1: Enable pgvector extension
    console.log('📦 Enabling pgvector extension...');
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log('✅ pgvector extension enabled');

    // Step 2: Check if extension is available
    console.log('🔍 Checking pgvector availability...');
    const extensions = await prisma.$queryRaw`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector';
    `;
    console.log('📋 Extensions:', extensions);

    // Step 3: Test vector operations
    console.log('🧪 Testing vector operations...');
    
    // Create a test table to verify vector functionality
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS vector_test (
        id SERIAL PRIMARY KEY,
        embedding vector(1536)
      );
    `;

    // Insert a test vector
    const testVector = Array(1536).fill(0).map(() => Math.random());
    await prisma.$executeRaw`
      INSERT INTO vector_test (embedding) 
      VALUES (${`[${testVector.join(',')}]`}::vector);
    `;

    // Test similarity search
    const result = await prisma.$queryRaw`
      SELECT id, embedding <-> ${`[${testVector.join(',')}]`}::vector as distance
      FROM vector_test 
      ORDER BY embedding <-> ${`[${testVector.join(',')}]`}::vector
      LIMIT 1;
    `;
    
    console.log('✅ Vector operations working:', result);

    // Clean up test table
    await prisma.$executeRaw`DROP TABLE IF EXISTS vector_test;`;

    console.log('🎉 pgvector is properly enabled and working!');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to enable pgvector:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('permission denied')) {
        console.log('\n💡 Solution: You need to enable pgvector in your Neon dashboard:');
        console.log('   1. Go to https://console.neon.tech/');
        console.log('   2. Select your project');
        console.log('   3. Go to "Extensions" tab');
        console.log('   4. Enable "pgvector" extension');
        console.log('   5. Run this script again');
      } else if (error.message.includes('does not exist')) {
        console.log('\n💡 pgvector extension is not available in this Neon plan');
        console.log('   - pgvector is available in Neon Pro plans and above');
        console.log('   - Check your plan at https://console.neon.tech/');
      }
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function updateSchemaForPgVector() {
  console.log('\n📝 Next steps to update your schema:');
  console.log('1. Update prisma/schema.prisma:');
  console.log('   Change: embeddingVector Unsupported("vector(1536)")?');
  console.log('   To:     embeddingVector Unsupported("vector(1536)")?');
  console.log('');
  console.log('2. Run: npx prisma db push');
  console.log('3. Update ContentIngestionService to use embeddingVector field');
  console.log('');
  console.log('🔧 Would you like me to create the migration script?');
}

async function main() {
  const success = await enablePgVector();
  
  if (success) {
    await updateSchemaForPgVector();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { enablePgVector };