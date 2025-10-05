/**
 * Check Current Chunks for Project
 * Examines the current chunk structure to understand the issues
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error']
});

async function checkCurrentChunks() {
  console.log('🔍 Checking current chunks for project cmgctydc40000w50wzzoebhb0...\n');
  
  try {
    // Get all chunks for the project
    const chunks = await prisma.contextChunk.findMany({
      where: {
        projectIndexId: 'cmgctydc40000w50wzzoebhb0'
      },
      orderBy: [
        { tier: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    console.log(`Found ${chunks.length} total chunks\n`);

    // Group by tier
    const tierCounts: Record<number, number> = {};
    const tierTitles: Record<number, string[]> = {};
    
    chunks.forEach(chunk => {
      tierCounts[chunk.tier] = (tierCounts[chunk.tier] || 0) + 1;
      if (!tierTitles[chunk.tier]) tierTitles[chunk.tier] = [];
      tierTitles[chunk.tier].push(chunk.title || 'Untitled');
    });

    console.log('📊 Tier Distribution:');
    Object.keys(tierCounts).forEach(tier => {
      console.log(`  T${tier}: ${tierCounts[parseInt(tier)]} chunks`);
    });

    console.log('\n📝 Sample Titles by Tier:');
    Object.keys(tierTitles).forEach(tier => {
      console.log(`\n  T${tier} Titles (first 5):`);
      tierTitles[parseInt(tier)].slice(0, 5).forEach((title, index) => {
        console.log(`    ${index + 1}. "${title}"`);
      });
    });

    // Check T2 chunks specifically for title vs content analysis
    const t2Chunks = chunks.filter(c => c.tier === 2);
    if (t2Chunks.length > 0) {
      console.log('\n🔍 T2 Chunk Analysis (Title vs Content):');
      t2Chunks.slice(0, 3).forEach((chunk, index) => {
        console.log(`\n  T2 Chunk ${index + 1}:`);
        console.log(`    Title: "${chunk.title}" (${chunk.title?.length || 0} chars)`);
        console.log(`    Content: "${chunk.content?.substring(0, 100)}..." (${chunk.content?.length || 0} chars)`);
        
        // Check if title looks like a summary (long) vs heading (short)
        const titleLength = chunk.title?.length || 0;
        const contentLength = chunk.content?.length || 0;
        
        if (titleLength > 50 && titleLength > contentLength * 0.5) {
          console.log(`    ⚠️  Title appears to be a summary (${titleLength} chars)`);
        } else {
          console.log(`    ✅ Title appears to be a heading (${titleLength} chars)`);
        }
      });
    }

    // Check for missing T3 chunks
    if (!tierCounts[3] || tierCounts[3] === 0) {
      console.log('\n❌ ISSUE: No T3 chunks found!');
      console.log('   T3 chunks should contain the actual content without AI summarization');
    } else {
      console.log(`\n✅ T3 chunks found: ${tierCounts[3]}`);
    }

    // Check recent processing operations
    console.log('\n📋 Recent Processing Operations:');
    const recentOps = await prisma.semanticOperation.findMany({
      where: {
        projectId: 'cmgctydc40000w50wzzoebhb0'
      },
      orderBy: { startedAt: 'desc' },
      take: 5
    });

    recentOps.forEach((op, index) => {
      console.log(`  ${index + 1}. ${op.operationType} - ${op.success ? 'success' : 'failed'} (${op.startedAt.toISOString()})`);
      if (op.chunksProcessed) {
        console.log(`     Processed ${op.chunksProcessed} chunks`);
      }
    });

  } catch (error) {
    console.error('❌ Error checking chunks:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkCurrentChunks();