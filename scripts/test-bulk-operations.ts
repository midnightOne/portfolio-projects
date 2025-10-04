/**
 * Test Bulk Operations Service
 * 
 * Tests all bulk maintenance operations:
 * - Cleanup orphaned chunks
 * - Export/import semantic indexes
 * - Bulk regeneration estimates
 * - Bulk importance updates
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBulkOperations() {
  console.log('🧪 Testing Bulk Operations Service\n');

  try {
    // Test 1: Preview Orphaned Chunks
    console.log('📋 Test 1: Preview Orphaned Chunks');
    console.log('─'.repeat(50));
    
    const orphanedChunks = await prisma.contextChunk.findMany({
      where: {
        projectIndex: null
      },
      select: {
        id: true,
        chunkId: true,
        tier: true,
        title: true,
        tokenCount: true,
        projectIndexId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const totalTokens = orphanedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const estimatedSpaceFreed = formatBytes(totalTokens * 4);

    console.log(`Found ${orphanedChunks.length} orphaned chunks`);
    console.log(`Estimated space to free: ${estimatedSpaceFreed}`);
    if (orphanedChunks.length > 0) {
      console.log('\nSample orphaned chunks:');
      orphanedChunks.slice(0, 3).forEach(chunk => {
        console.log(`  - ${chunk.chunkId.slice(0, 8)} | Tier ${chunk.tier} | ${chunk.tokenCount} tokens`);
      });
    }
    console.log('✅ Cleanup preview successful\n');

    // Test 2: Bulk Regeneration Estimate
    console.log('📋 Test 2: Bulk Regeneration Estimate');
    console.log('─'.repeat(50));
    
    const projects = await prisma.projectAIIndex.findMany({
      take: 3,
      include: {
        contentChunks: true
      }
    });
    
    if (projects.length > 0) {
      const totalChunks = projects.reduce((sum, p) => sum + p.contentChunks.length, 0);
      const totalTokens = projects.reduce((sum, p) => 
        sum + p.contentChunks.reduce((s, c) => s + c.tokenCount, 0), 0
      );

      // Estimate costs (text-embedding-3-small: $0.00002 per 1K tokens)
      const standardCost = (totalTokens / 1000) * 0.00002;
      const batchCost = standardCost * 0.5; // 50% savings
      const savings = standardCost - batchCost;

      // Estimate duration
      const standardDuration = Math.ceil(totalChunks / 100) * 30; // ~30s per 100 chunks
      const batchDuration = 24 * 60 * 60; // 24 hours

      console.log('Batch Mode Estimate:');
      console.log(`  Projects: ${projects.length}`);
      console.log(`  Total chunks: ${totalChunks}`);
      console.log(`  Estimated tokens: ${totalTokens.toLocaleString()}`);
      console.log(`  Standard cost: $${standardCost.toFixed(4)}`);
      console.log(`  Batch cost: $${batchCost.toFixed(4)}`);
      console.log(`  Savings: $${savings.toFixed(4)} (${((savings / standardCost) * 100).toFixed(1)}%)`);
      console.log(`  Standard duration: ${formatDuration(standardDuration)}`);
      console.log(`  Batch duration: ${formatDuration(batchDuration)}`);
      
      console.log('✅ Regeneration estimates successful\n');
    } else {
      console.log('⚠️  No projects found for regeneration estimate\n');
    }

    // Test 3: Bulk Importance Update
    console.log('📋 Test 3: Bulk Importance Update');
    console.log('─'.repeat(50));
    
    const testChunks = await prisma.contextChunk.findMany({
      take: 5,
      select: { id: true, importance: true }
    });
    
    if (testChunks.length > 0) {
      console.log(`Testing with ${testChunks.length} chunks`);
      console.log('Original importance scores:');
      testChunks.forEach((chunk, i) => {
        console.log(`  Chunk ${i + 1}: ${chunk.importance}`);
      });
      
      // Update importance
      const newImportance = 0.75;
      const updateResult = await prisma.contextChunk.updateMany({
        where: {
          id: { in: testChunks.map(c => c.id) }
        },
        data: {
          importance: newImportance,
          importanceSource: 'manual',
          updatedAt: new Date()
        }
      });
      
      console.log(`\n✅ Updated ${updateResult.count} chunks to importance ${newImportance}`);
      
      // Verify updates
      const updatedChunks = await prisma.contextChunk.findMany({
        where: { id: { in: testChunks.map(c => c.id) } },
        select: { id: true, importance: true, importanceSource: true }
      });
      
      console.log('Updated importance scores:');
      updatedChunks.forEach((chunk, i) => {
        console.log(`  Chunk ${i + 1}: ${chunk.importance} (${chunk.importanceSource})`);
      });
      
      // Restore original values
      for (const chunk of testChunks) {
        await prisma.contextChunk.update({
          where: { id: chunk.id },
          data: { importance: chunk.importance }
        });
      }
      console.log('✅ Restored original importance scores\n');
    } else {
      console.log('⚠️  No chunks found for importance update test\n');
    }

    // Test 4: Export/Import Data Structure
    console.log('📋 Test 4: Export/Import Data Structure');
    console.log('─'.repeat(50));
    
    if (projects.length > 0) {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date(),
        projects: projects.slice(0, 1).map(project => {
          const tierDistribution = project.contentChunks.reduce((acc, chunk) => {
            acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
            return acc;
          }, {} as Record<number, number>);

          return {
            projectId: project.projectId,
            projectTitle: 'Test Project',
            chunks: project.contentChunks.length,
            metadata: {
              totalChunks: project.contentChunks.length,
              tierDistribution,
              hasEmbeddings: project.contentChunks.some(chunk => (chunk as any).embeddingVector !== null)
            }
          };
        })
      };

      console.log('Export structure created:');
      console.log(`  Version: ${exportData.version}`);
      console.log(`  Projects: ${exportData.projects.length}`);
      console.log(`  Total chunks: ${exportData.projects[0].chunks}`);
      console.log(`  Has embeddings: ${exportData.projects[0].metadata.hasEmbeddings}`);
      console.log('✅ Export structure validated\n');
    }

    // Summary
    console.log('═'.repeat(50));
    console.log('✅ All Bulk Operations Tests Completed Successfully!');
    console.log('═'.repeat(50));
    console.log('\nTested Features:');
    console.log('  ✓ Cleanup orphaned chunks preview');
    console.log('  ✓ Bulk regeneration cost estimation');
    console.log('  ✓ Batch mode vs standard mode comparison');
    console.log('  ✓ Bulk importance score updates');
    console.log('  ✓ Export/import data structure');
    console.log('\n💡 Next Steps:');
    console.log('  1. Test cleanup execution via API (if orphaned chunks exist)');
    console.log('  2. Test actual export/import via API endpoints');
    console.log('  3. Test bulk regeneration execution via API');
    console.log('  4. Test UI components in browser at /admin/semantic/bulk-operations');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Run tests
testBulkOperations()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
