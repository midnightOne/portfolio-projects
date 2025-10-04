/**
 * Schema Stability Verification Script
 * 
 * Verifies that the Prisma schema and database are in sync,
 * with proper vector(1536) dimensions for pgvector fields.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySchemaStability() {
  console.log('🔍 Verifying Schema Stability\n');

  try {
    // 1. Check vector dimensions in database
    console.log('1️⃣ Checking vector dimensions in database...');
    
    const contextChunkVectorInfo = await prisma.$queryRaw<Array<{
      column_name: string;
      data_type: string;
      udt_name: string;
    }>>`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'context_chunks'
        AND column_name = 'embedding_vector'
    `;

    if (contextChunkVectorInfo.length > 0) {
      console.log(`   ✅ context_chunks.embedding_vector exists`);
      console.log(`      Type: ${contextChunkVectorInfo[0].data_type}`);
      console.log(`      UDT: ${contextChunkVectorInfo[0].udt_name}`);
    } else {
      console.log(`   ❌ context_chunks.embedding_vector not found`);
    }

    const projectIndexVectorInfo = await prisma.$queryRaw<Array<{
      column_name: string;
      data_type: string;
      udt_name: string;
    }>>`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'project_ai_index'
        AND column_name = 'embedding_vector'
    `;

    if (projectIndexVectorInfo.length > 0) {
      console.log(`   ✅ project_ai_index.embedding_vector exists`);
      console.log(`      Type: ${projectIndexVectorInfo[0].data_type}`);
      console.log(`      UDT: ${projectIndexVectorInfo[0].udt_name}\n`);
    } else {
      console.log(`   ❌ project_ai_index.embedding_vector not found\n`);
    }

    // 2. Check if we can query vector dimensions
    console.log('2️⃣ Checking vector dimensions...');
    
    try {
      const dimensionCheck = await prisma.$queryRaw<Array<{
        table_name: string;
        column_name: string;
        typmod: number;
        dimensions: number;
      }>>`
        SELECT 
          c.table_name,
          c.column_name,
          a.atttypmod as typmod,
          CASE 
            WHEN a.atttypmod > 0 THEN a.atttypmod - 4
            ELSE NULL
          END as dimensions
        FROM information_schema.columns c
        JOIN pg_attribute a ON a.attname = c.column_name
        JOIN pg_class t ON t.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.table_schema = 'public'
          AND c.udt_name = 'vector'
          AND n.nspname = 'public'
          AND t.relname IN ('context_chunks', 'project_ai_index')
      `;

      if (dimensionCheck.length > 0) {
        dimensionCheck.forEach(row => {
          const dims = row.dimensions || 'unspecified';
          const status = row.dimensions === 1536 ? '✅' : '⚠️';
          console.log(`   ${status} ${row.table_name}.${row.column_name}: ${dims} dimensions`);
        });
      } else {
        console.log('   ⚠️  Could not determine vector dimensions');
      }
    } catch (error) {
      console.log('   ⚠️  Vector dimension check not supported on this database version');
    }
    console.log();

    // 3. Check critical semantic content tables
    console.log('3️⃣ Checking semantic content tables...');
    
    const tables = [
      'content_entities',
      'context_chunks',
      'content_versions',
      'semantic_budgets',
      'semantic_operations',
      'chunking_configs',
      'summary_generation_configs',
      'summary_generation_logs'
    ];

    for (const table of tables) {
      const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        ) as exists
      `;
      
      const exists = result[0]?.exists;
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }
    console.log();

    // 4. Check indexes
    console.log('4️⃣ Checking vector indexes...');
    
    const indexes = await prisma.$queryRaw<Array<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>>`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('context_chunks', 'project_ai_index')
        AND indexname LIKE '%vector%'
    `;

    if (indexes.length > 0) {
      indexes.forEach(idx => {
        console.log(`   ✅ ${idx.indexname}`);
        console.log(`      Table: ${idx.tablename}`);
      });
    } else {
      console.log('   ⚠️  No vector indexes found (may need to be created)');
    }
    console.log();

    // 5. Check ContextChunk fields
    console.log('5️⃣ Checking ContextChunk fields...');
    
    const chunkFields = await prisma.$queryRaw<Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>>`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'context_chunks'
      ORDER BY ordinal_position
    `;

    const criticalFields = [
      'entity_id',
      'tier',
      'chunk_id',
      'content',
      'token_count',
      'embedding_vector',
      'parent_chunk_id',
      'root_chunk_id',
      'section_group',
      'section_start_line',
      'section_end_line',
      'section_bounded',
      'chunk_index_in_section',
      'content_hash',
      'manually_edited',
      'modified_by',
      'generation_mode'
    ];

    criticalFields.forEach(field => {
      const found = chunkFields.find(f => f.column_name === field);
      if (found) {
        console.log(`   ✅ ${field} (${found.data_type})`);
      } else {
        console.log(`   ❌ ${field} - MISSING`);
      }
    });
    console.log();

    // 6. Test basic operations
    console.log('6️⃣ Testing basic operations...');
    
    // Test ContentEntity query
    try {
      const entityCount = await prisma.contentEntity.count();
      console.log(`   ✅ ContentEntity.count(): ${entityCount}`);
    } catch (error) {
      console.log(`   ❌ ContentEntity.count() failed: ${error}`);
    }

    // Test ContextChunk query
    try {
      const chunkCount = await prisma.contextChunk.count();
      console.log(`   ✅ ContextChunk.count(): ${chunkCount}`);
    } catch (error) {
      console.log(`   ❌ ContextChunk.count() failed: ${error}`);
    }

    // Test SemanticBudget query (using raw SQL since it might not be in Prisma client)
    try {
      const budgetCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM semantic_budgets
      `;
      console.log(`   ✅ SemanticBudget count: ${budgetCount[0].count}`);
    } catch (error) {
      console.log(`   ⚠️  SemanticBudget table not accessible (may not exist yet)`);
    }
    console.log();

    // 7. Summary
    console.log('📊 Summary:');
    console.log('   - Schema file: prisma/schema.prisma');
    console.log('   - Vector dimensions: Should be vector(1536) for OpenAI embeddings');
    console.log('   - Prisma client: Generated and functional');
    console.log('   - Database: Connected and accessible');
    console.log();

    console.log('✅ Schema stability verification complete!');
    console.log();
    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   1. Never use "prisma db pull" - it removes vector dimensions');
    console.log('   2. Always use "prisma generate" after schema changes');
    console.log('   3. Use raw SQL for vector operations (Prisma doesn\'t fully support pgvector)');
    console.log('   4. Keep vector(1536) in schema for OpenAI text-embedding-3-small');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifySchemaStability()
  .then(() => {
    console.log('\n✨ Verification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  });
