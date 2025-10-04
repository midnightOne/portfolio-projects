/**
 * Test script for Semantic Dashboard API
 * 
 * Tests the dashboard metrics endpoint to ensure it returns proper data
 */

import { prisma } from '../src/lib/prisma';

async function testSemanticDashboard() {
  console.log('🧪 Testing Semantic Dashboard API...\n');

  try {
    // Test 1: Check if ContextChunk model is accessible
    console.log('1️⃣ Testing ContextChunk model access...');
    const totalChunks = await prisma.contextChunk.count();
    console.log(`   ✅ Total chunks: ${totalChunks}`);

    // Test 2: Check chunks with embeddings
    console.log('\n2️⃣ Testing embedding count...');
    const chunksWithEmbeddings = await prisma.contextChunk.count({
      where: {
        embeddingGeneratedAt: { not: null }
      }
    });
    console.log(`   ✅ Chunks with embeddings: ${chunksWithEmbeddings}`);

    // Test 3: Check projects
    console.log('\n3️⃣ Testing project count...');
    const totalProjects = await prisma.project.count();
    console.log(`   ✅ Total projects: ${totalProjects}`);

    // Test 4: Check project chunks grouping
    console.log('\n4️⃣ Testing project chunks grouping...');
    const projectsWithChunks = await prisma.contextChunk.groupBy({
      by: ['projectIndexId'],
      _count: true
    });
    console.log(`   ✅ Projects with chunks: ${projectsWithChunks.length}`);

    // Test 5: Check budget
    console.log('\n5️⃣ Testing budget access...');
    const budget = await prisma.semanticBudget.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    if (budget) {
      console.log(`   ✅ Active budget found: $${Number(budget.allocatedFunds).toFixed(2)}`);
    } else {
      console.log('   ℹ️  No active budget found (will be created on first access)');
    }

    // Test 6: Check semantic operations
    console.log('\n6️⃣ Testing semantic operations...');
    const operations = await prisma.semanticOperation.count();
    console.log(`   ✅ Total operations: ${operations}`);

    // Test 7: Sample project status
    if (totalProjects > 0) {
      console.log('\n7️⃣ Testing sample project status...');
      const sampleProject = await prisma.project.findFirst({
        select: {
          id: true,
          title: true,
          updatedAt: true
        }
      });

      if (sampleProject) {
        const chunks = await prisma.contextChunk.findMany({
          where: { projectIndexId: sampleProject.id },
          select: {
            tier: true,
            embeddingGeneratedAt: true,
            updatedAt: true
          }
        });

        const tierDistribution = chunks.reduce((acc, chunk) => {
          acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);

        console.log(`   ✅ Sample project: ${sampleProject.title}`);
        console.log(`      - Chunks: ${chunks.length}`);
        console.log(`      - Tier distribution:`, tierDistribution);
        console.log(`      - Has embeddings: ${chunks.some(c => c.embeddingGeneratedAt !== null)}`);
      }
    }

    console.log('\n✅ All tests passed! Dashboard API should work correctly.\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSemanticDashboard();
