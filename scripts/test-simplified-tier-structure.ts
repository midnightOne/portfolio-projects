#!/usr/bin/env tsx

/**
 * Test script for simplified T0-T3 tier structure with heading-bounded chunking
 */

import { SmartContentGenerator } from '../src/lib/content/SmartContentGenerator';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSimplifiedTierStructure() {
  console.log('🧪 Testing Simplified T0-T3 Tier Structure with Heading-Bounded Chunking');
  
  try {
    // Get a test project
    const project = await prisma.project.findFirst({
      where: { status: 'PUBLISHED' },
      include: {
        articleContent: true,
        tags: true,
        aiIndex: true
      }
    });

    if (!project) {
      console.log('❌ No published projects found for testing');
      return;
    }

    console.log(`📋 Testing with project: ${project.title}`);

    // Initialize SmartContentGenerator
    const generator = new SmartContentGenerator();

    // Generate hierarchical content with simplified structure
    console.log('🔄 Generating hierarchical content...');
    const result = await generator.generateHierarchicalContent(project);

    console.log('\n📊 Generation Results:');
    console.log(`- Total tiers generated: ${result.tiers.length}`);
    console.log(`- Processing time: ${result.processingStats.processingTime}ms`);
    console.log(`- Sections reused: ${result.processingStats.reusedSections}`);
    console.log(`- Cost saved: $${result.costSavings.estimatedCostSaved.toFixed(4)}`);

    // Analyze tier distribution
    const tierDistribution = result.tiers.reduce((acc, tier) => {
      acc[tier.tier] = (acc[tier.tier] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('\n🏗️ Tier Distribution:');
    Object.entries(tierDistribution).forEach(([tier, count]) => {
      const tierName = {
        '0': 'T0 (Metadata)',
        '1': 'T1 (Summary)', 
        '2': 'T2 (Headings)',
        '3': 'T3 (Content)'
      }[tier] || `T${tier}`;
      console.log(`- ${tierName}: ${count} chunks`);
    });

    // Validate tier structure
    console.log('\n✅ Validation Results:');
    
    // Check T0 (should be exactly 1)
    const t0Chunks = result.tiers.filter(t => t.tier === 0);
    console.log(`- T0 chunks: ${t0Chunks.length} (expected: 1) ${t0Chunks.length === 1 ? '✅' : '❌'}`);
    
    // Check T1 (should be exactly 1)
    const t1Chunks = result.tiers.filter(t => t.tier === 1);
    console.log(`- T1 chunks: ${t1Chunks.length} (expected: 1) ${t1Chunks.length === 1 ? '✅' : '❌'}`);
    
    // Check T2 (headings)
    const t2Chunks = result.tiers.filter(t => t.tier === 2);
    console.log(`- T2 chunks: ${t2Chunks.length} (headings)`);
    
    // Check T3 (content chunks)
    const t3Chunks = result.tiers.filter(t => t.tier === 3);
    console.log(`- T3 chunks: ${t3Chunks.length} (content)`);
    
    // Validate heading-bounded chunking for T3
    const invalidT3Chunks = t3Chunks.filter(chunk => {
      const hasHeadingMarkers = /^#{1,6}\s+/gm.test(chunk.content);
      return hasHeadingMarkers;
    });
    
    console.log(`- T3 heading boundary validation: ${invalidT3Chunks.length === 0 ? '✅' : '❌'}`);
    if (invalidT3Chunks.length > 0) {
      console.log(`  Found ${invalidT3Chunks.length} T3 chunks crossing heading boundaries`);
    }

    // Check hierarchical relationships
    const orphanedChunks = result.tiers.filter(t => 
      t.tier > 0 && !t.parentChunkId
    );
    console.log(`- Hierarchical relationships: ${orphanedChunks.length === 0 ? '✅' : '❌'}`);
    if (orphanedChunks.length > 0) {
      console.log(`  Found ${orphanedChunks.length} orphaned chunks`);
    }

    // Sample tier content
    console.log('\n📝 Sample Tier Content:');
    
    if (t0Chunks.length > 0) {
      console.log(`\nT0 (${t0Chunks[0].chunkId}):`);
      console.log(`  Content: ${t0Chunks[0].content.substring(0, 100)}...`);
      console.log(`  Parent: ${t0Chunks[0].parentChunkId || 'none (root)'}`);
    }
    
    if (t1Chunks.length > 0) {
      console.log(`\nT1 (${t1Chunks[0].chunkId}):`);
      console.log(`  Content: ${t1Chunks[0].content.substring(0, 100)}...`);
      console.log(`  Parent: ${t1Chunks[0].parentChunkId}`);
    }
    
    if (t2Chunks.length > 0) {
      console.log(`\nT2 Sample (${t2Chunks[0].chunkId}):`);
      console.log(`  Title: ${t2Chunks[0].title}`);
      console.log(`  Content: ${t2Chunks[0].content.substring(0, 100)}...`);
      console.log(`  Parent: ${t2Chunks[0].parentChunkId}`);
      console.log(`  Section Group: ${t2Chunks[0].sectionGroup}`);
    }
    
    if (t3Chunks.length > 0) {
      console.log(`\nT3 Sample (${t3Chunks[0].chunkId}):`);
      console.log(`  Title: ${t3Chunks[0].title}`);
      console.log(`  Content: ${t3Chunks[0].content.substring(0, 100)}...`);
      console.log(`  Parent: ${t3Chunks[0].parentChunkId}`);
      console.log(`  Section Bounded: ${t3Chunks[0].sectionBounded}`);
      console.log(`  Chunk Index: ${t3Chunks[0].chunkIndexInSection}`);
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testSimplifiedTierStructure().catch(console.error);
}

export { testSimplifiedTierStructure };