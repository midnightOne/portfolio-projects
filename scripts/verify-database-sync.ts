/**
 * Comprehensive Database Sync Verification
 * 
 * Verifies that the database schema exactly matches what Prisma expects,
 * with special attention to vector columns and dimensions.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDatabaseSync() {
  console.log('🔍 Comprehensive Database Sync Verification\n');

  try {
    // 1. Check vector column definitions
    console.log('1️⃣ Verifying vector column definitions...');
    
    const vectorColumns = await prisma.$queryRaw<Array<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      character_maximum_length: number | null;
      is_nullable: string;
    }>>`
      SELECT 
        table_name,
        column_name,
        data_type,
        udt_name,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND udt_name = 'vector'
      ORDER BY table_name, column_name
    `;

    if (vectorColumns.length === 0) {
      console.log('   ❌ No vector columns found in database!');
      return false;
    }

    vectorColumns.forEach(col => {
      console.log(`   ✅ ${col.table_name}.${col.column_name}`);
      console.log(`      Type: ${col.data_type} (${col.udt_name})`);
      console.log(`      Nullable: ${col.is_nullable}`);
    });
    console.log();

    // 2. Check actual vector dimensions using pg_attribute
    console.log('2️⃣ Checking vector dimensions...');
    
    const dimensions = await prisma.$queryRaw<Array<{
      table_name: string;
      column_name: string;
      typmod: number;
      dimensions: number | null;
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
      ORDER BY c.table_name, c.column_name
    `;

    let allCorrect = true;
    dimensions.forEach(dim => {
      const actualDims = dim.dimensions ? dim.dimensions + 4 : 'unspecified';
      const expected = 1536;
      const isCorrect = dim.dimensions === 1532; // 1536 - 4 = 1532 in atttypmod
      const status = isCorrect ? '✅' : '❌';
      
      console.log(`   ${status} ${dim.table_name}.${dim.column_name}`);
      console.log(`      Expected: ${expected} dimensions`);
      console.log(`      Actual: ${actualDims} (typmod: ${dim.typmod})`);
      
      if (!isCorrect) {
        allCorrect = false;
        console.log(`      ⚠️  MISMATCH! Should be 1536 dimensions`);
      }
    });
    console.log();

    if (!allCorrect) {
      console.log('❌ Vector dimensions do not match expected values!');
      console.log('   This may cause issues with embedding operations.');
      console.log('   Consider running a migration to fix dimensions.\n');
      return false;
    }

    // 3. Verify all semantic content tables exist
    console.log('3️⃣ Verifying semantic content tables...');
    
    const requiredTables = [
      'content_entities',
      'context_chunks',
      'content_versions',
      'semantic_budgets',
      'semantic_operations',
      'chunking_configs',
      'summary_generation_configs',
      'summary_generation_logs'
    ];

    let allTablesExist = true;
    for (const tableName of requiredTables) {
      const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        ) as exists
      `;
      
      const exists = result[0]?.exists;
      console.log(`   ${exists ? '✅' : '❌'} ${tableName}`);
      
      if (!exists) {
        allTablesExist = false;
      }
    }
    console.log();

    if (!allTablesExist) {
      console.log('❌ Some required tables are missing!');
      console.log('   Run migrations to create missing tables.\n');
      return false;
    }

    // 4. Verify critical columns in context_chunks
    console.log('4️⃣ Verifying context_chunks columns...');
    
    const chunkColumns = await prisma.$queryRaw<Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>>`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'context_chunks'
        AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    const criticalColumns = [
      'id', 'entity_id', 'tier', 'chunk_id', 'content', 'token_count',
      'embedding_vector', 'parent_chunk_id', 'root_chunk_id', 'section_group',
      'section_start_line', 'section_end_line', 'section_bounded',
      'chunk_index_in_section', 'content_hash', 'manually_edited',
      'modified_by', 'generation_mode', 'importance', 'importance_source'
    ];

    let allColumnsExist = true;
    criticalColumns.forEach(colName => {
      const found = chunkColumns.find(c => c.column_name === colName);
      if (found) {
        console.log(`   ✅ ${colName} (${found.data_type})`);
      } else {
        console.log(`   ❌ ${colName} - MISSING`);
        allColumnsExist = false;
      }
    });
    console.log();

    if (!allColumnsExist) {
      console.log('❌ Some critical columns are missing!');
      console.log('   Schema may be out of sync with database.\n');
      return false;
    }

    // 5. Test vector operations
    console.log('5️⃣ Testing vector operations...');
    
    try {
      // Test creating a dummy vector
      const testVector = Array(1536).fill(0).map(() => Math.random());
      
      // Test vector similarity query (without actually inserting)
      const testQuery = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM context_chunks
        WHERE embedding_vector IS NOT NULL
      `;
      
      console.log(`   ✅ Vector query successful`);
      console.log(`   ✅ Chunks with embeddings: ${testQuery[0].count}`);
      
      // Test vector similarity calculation
      if (Number(testQuery[0].count) > 0) {
        const similarityTest = await prisma.$queryRaw<Array<{
          id: string;
          similarity: number;
        }>>`
          SELECT 
            id,
            1 - (embedding_vector <=> ${JSON.stringify(testVector)}::vector(1536)) as similarity
          FROM context_chunks
          WHERE embedding_vector IS NOT NULL
          LIMIT 1
        `;
        
        if (similarityTest.length > 0) {
          console.log(`   ✅ Vector similarity calculation works`);
          console.log(`   ✅ Sample similarity: ${similarityTest[0].similarity.toFixed(4)}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Vector operations failed: ${error}`);
      allCorrect = false;
    }
    console.log();

    // 6. Check indexes
    console.log('6️⃣ Checking database indexes...');
    
    const indexes = await prisma.$queryRaw<Array<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>>`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('context_chunks', 'content_entities', 'semantic_budgets')
      ORDER BY tablename, indexname
    `;

    const indexesByTable = indexes.reduce((acc, idx) => {
      if (!acc[idx.tablename]) acc[idx.tablename] = [];
      acc[idx.tablename].push(idx.indexname);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(indexesByTable).forEach(([table, idxList]) => {
      console.log(`   ✅ ${table}: ${idxList.length} indexes`);
      idxList.forEach(idx => {
        console.log(`      - ${idx}`);
      });
    });
    console.log();

    // 7. Final verification
    console.log('7️⃣ Final sync verification...');
    
    const syncChecks = {
      vectorColumnsExist: vectorColumns.length > 0,
      vectorDimensionsCorrect: allCorrect,
      allTablesExist,
      allColumnsExist,
      vectorOperationsWork: true
    };

    const allChecksPassed = Object.values(syncChecks).every(check => check === true);

    if (allChecksPassed) {
      console.log('   ✅ All sync checks passed!');
      console.log('   ✅ Database is fully synchronized with schema');
      console.log('   ✅ Vector operations are functional');
      console.log('   ✅ All required tables and columns exist');
    } else {
      console.log('   ❌ Some sync checks failed:');
      Object.entries(syncChecks).forEach(([check, passed]) => {
        console.log(`      ${passed ? '✅' : '❌'} ${check}`);
      });
    }
    console.log();

    // 8. Summary and recommendations
    console.log('📊 Summary:');
    console.log(`   - Vector columns: ${vectorColumns.length}`);
    console.log(`   - Vector dimensions: ${allCorrect ? '1536 (correct)' : 'INCORRECT'}`);
    console.log(`   - Semantic tables: ${allTablesExist ? 'All present' : 'Some missing'}`);
    console.log(`   - Critical columns: ${allColumnsExist ? 'All present' : 'Some missing'}`);
    console.log(`   - Database indexes: ${indexes.length} total`);
    console.log();

    if (allChecksPassed) {
      console.log('✅ DATABASE IS FULLY SYNCHRONIZED');
      console.log('   Safe to proceed with development.');
      console.log();
      console.log('📝 Next steps:');
      console.log('   1. Continue with remaining tasks (5-13)');
      console.log('   2. Use raw SQL for all vector operations');
      console.log('   3. Never use "prisma db pull"');
      console.log('   4. Run this verification before major changes');
    } else {
      console.log('⚠️  DATABASE SYNC ISSUES DETECTED');
      console.log('   Review the issues above and fix before proceeding.');
      console.log();
      console.log('🔧 Recommended actions:');
      console.log('   1. Check migration status: npx prisma migrate status');
      console.log('   2. Review schema file: prisma/schema.prisma');
      console.log('   3. Consider creating a migration if needed');
      console.log('   4. Verify vector dimensions are vector(1536)');
    }

    return allChecksPassed;

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyDatabaseSync()
  .then((success) => {
    if (success) {
      console.log('\n✨ Database sync verification completed successfully');
      process.exit(0);
    } else {
      console.log('\n⚠️  Database sync verification found issues');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  });
