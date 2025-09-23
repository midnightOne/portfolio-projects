#!/usr/bin/env tsx

/**
 * Vector Index Setup Script
 * 
 * This script ensures all necessary vector indexes are created for optimal performance.
 * Run this script when:
 * - Setting up a new environment
 * - After database migrations
 * - When vector search performance is poor
 * 
 * This script is idempotent - it's safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client';
import { IndexMaintenanceService } from '../src/lib/database/IndexMaintenanceService';

const prisma = new PrismaClient();

async function setupVectorIndexes() {
  console.log('🚀 Setting up Vector Indexes for Optimal Performance\n');

  const indexMaintenance = IndexMaintenanceService.getInstance(prisma);

  try {
    // 1. Check current state
    console.log('1. Checking current index state...');
    const indexCheck = await indexMaintenance.verifyIndexes();
    
    console.log(`   Vector index exists: ${indexCheck.vectorIndexExists ? '✅' : '❌'}`);
    console.log(`   Supporting indexes exist: ${indexCheck.supportingIndexesExist ? '✅' : '❌'}`);

    // 2. Create missing indexes
    let indexesCreated = 0;

    if (!indexCheck.vectorIndexExists) {
      console.log('\n2. Creating HNSW vector index...');
      console.log('   ⚠️  This may take several minutes for large datasets.');
      
      try {
        await prisma.$executeRaw`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_chunks_embedding_hnsw
          ON context_chunks USING hnsw (embedding_vector vector_cosine_ops)
          WITH (m = 16, ef_construction = 64)
        `;
        console.log('   ✅ HNSW vector index created successfully');
        indexesCreated++;
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log('   ✅ HNSW vector index already exists');
        } else {
          console.log('   ❌ Failed to create HNSW index:', error.message);
          
          // Try IVFFlat as fallback
          console.log('   🔄 Trying IVFFlat index as fallback...');
          try {
            await prisma.$executeRaw`
              CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_chunks_embedding_ivfflat
              ON context_chunks USING ivfflat (embedding_vector vector_cosine_ops)
              WITH (lists = 100)
            `;
            console.log('   ✅ IVFFlat vector index created as fallback');
            indexesCreated++;
          } catch (fallbackError: any) {
            console.log('   ❌ IVFFlat index creation also failed:', fallbackError.message);
          }
        }
      }
    }

    if (!indexCheck.supportingIndexesExist) {
      console.log('\n3. Creating supporting indexes...');
      
      // Tier index
      try {
        await prisma.$executeRaw`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_chunks_tier
          ON context_chunks (tier)
        `;
        console.log('   ✅ Tier index created');
        indexesCreated++;
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.log('   ❌ Failed to create tier index:', error.message);
        }
      }

      // Entity-tier composite index
      try {
        await prisma.$executeRaw`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_context_chunks_entity_tier
          ON context_chunks (entity_id, tier)
        `;
        console.log('   ✅ Entity-tier composite index created');
        indexesCreated++;
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.log('   ❌ Failed to create entity-tier index:', error.message);
        }
      }
    }

    // 3. Update table statistics
    console.log('\n4. Updating table statistics...');
    try {
      await prisma.$executeRaw`ANALYZE context_chunks`;
      console.log('   ✅ Table statistics updated');
    } catch (error: any) {
      console.log('   ❌ Failed to update statistics:', error.message);
    }

    // 4. Verify final state
    console.log('\n5. Verifying final index state...');
    const finalCheck = await indexMaintenance.verifyIndexes();
    const stats = await indexMaintenance.getIndexStats();

    console.log(`   Vector index: ${finalCheck.vectorIndexExists ? '✅ Ready' : '❌ Missing'}`);
    console.log(`   Supporting indexes: ${finalCheck.supportingIndexesExist ? '✅ Ready' : '❌ Missing'}`);
    console.log(`   Total rows: ${stats.totalRows}`);
    console.log(`   Rows with embeddings: ${stats.rowsWithEmbeddings}`);
    console.log(`   Index size: ${stats.indexSize}`);

    // 5. Performance test
    if (finalCheck.vectorIndexExists && stats.rowsWithEmbeddings > 0) {
      console.log('\n6. Testing vector search performance...');
      
      try {
        // Create a test vector
        const testVector = Array(1536).fill(0.1);
        
        const searchStart = Date.now();
        const searchResults = await prisma.$queryRaw<Array<{
          id: string;
          title: string;
          distance: number;
        }>>`
          SELECT 
            id,
            title,
            (embedding_vector <=> ${testVector}::vector) as distance
          FROM context_chunks 
          WHERE embedding_vector IS NOT NULL
          ORDER BY embedding_vector <=> ${testVector}::vector
          LIMIT 10
        `;
        const searchTime = Date.now() - searchStart;
        
        console.log(`   Search time: ${searchTime}ms`);
        console.log(`   Results found: ${searchResults.length}`);
        
        if (searchTime < 50) {
          console.log('   🎉 Excellent performance! (<50ms)');
        } else if (searchTime < 100) {
          console.log('   ✅ Good performance! (<100ms)');
        } else if (searchTime < 500) {
          console.log('   ⚠️  Moderate performance (100-500ms)');
        } else {
          console.log('   ❌ Poor performance (>500ms)');
        }
      } catch (error) {
        console.log('   ❌ Performance test failed:', error);
      }
    } else {
      console.log('\n6. Skipping performance test (no embeddings available)');
    }

    // 6. Summary and recommendations
    console.log('\n🎯 Setup Summary:');
    console.log(`   Indexes created: ${indexesCreated}`);
    
    if (finalCheck.vectorIndexExists && finalCheck.supportingIndexesExist) {
      console.log('   ✅ Vector search system is ready for production!');
      
      console.log('\n📋 Next Steps:');
      console.log('   1. Run content ingestion to generate embeddings:');
      console.log('      npx tsx scripts/test-hybrid-content-ingestion.ts');
      console.log('   2. Test search performance:');
      console.log('      npx tsx scripts/test-vector-performance.ts');
      console.log('   3. Set up automated maintenance (optional):');
      console.log('      npx tsx scripts/maintain-vector-indexes.ts check');
    } else {
      console.log('   ⚠️  Some indexes are missing - manual intervention may be required');
      
      if (finalCheck.recommendations.length > 0) {
        console.log('\n🔧 Manual Steps Required:');
        finalCheck.recommendations.forEach(rec => {
          console.log(`   - ${rec}`);
        });
      }
    }

    // 7. Maintenance recommendations
    console.log('\n🔧 Maintenance Recommendations:');
    console.log('   - Run "npx tsx scripts/maintain-vector-indexes.ts check" weekly');
    console.log('   - Monitor search performance and run maintenance as needed');
    console.log('   - Consider setting up automated maintenance for production');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  setupVectorIndexes().catch(console.error);
}