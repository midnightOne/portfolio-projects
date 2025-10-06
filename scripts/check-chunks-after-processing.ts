/**
 * Check if chunks were actually created in the database
 */

import { prisma } from '../src/lib/database/connection';

async function checkChunks() {
  const projectId = 'cmgctydc40000w50wzzoebhb0';
  
  console.log(`\nChecking chunks for project: ${projectId}\n`);
  
  // Get all chunks for this project
  const chunks = await prisma.contextChunk.findMany({
    where: { projectIndexId: projectId },
    orderBy: [
      { tier: 'asc' },
      { createdAt: 'asc' }
    ],
    select: {
      id: true,
      chunkId: true,
      tier: true,
      title: true,
      content: true,
      tokenCount: true,
      parentChunkId: true,
      sectionGroup: true,
      createdAt: true,
      metadata: true
    }
  });
  
  console.log(`Total chunks found: ${chunks.length}\n`);
  
  // Group by tier
  const byTier = chunks.reduce((acc, chunk) => {
    acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  console.log('Chunks by tier:');
  Object.entries(byTier).forEach(([tier, count]) => {
    console.log(`  T${tier}: ${count} chunks`);
  });
  
  console.log('\nRecent chunks (last 10):');
  chunks.slice(-10).forEach(chunk => {
    console.log(`  [T${chunk.tier}] ${chunk.chunkId}`);
    console.log(`    Title: ${chunk.title || 'N/A'}`);
    console.log(`    Content: ${chunk.content.substring(0, 100)}...`);
    console.log(`    Created: ${chunk.createdAt.toISOString()}`);
    console.log(`    Parent: ${chunk.parentChunkId || 'None'}`);
    console.log(`    Section: ${chunk.sectionGroup || 'None'}`);
    console.log('');
  });
  
  // Check if there are any chunks created in the last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentChunks = chunks.filter(c => c.createdAt > fiveMinutesAgo);
  
  console.log(`\nChunks created in last 5 minutes: ${recentChunks.length}`);
  if (recentChunks.length > 0) {
    console.log('Recent chunk details:');
    recentChunks.forEach(chunk => {
      console.log(`  [T${chunk.tier}] ${chunk.chunkId} - ${chunk.title || 'No title'}`);
    });
  }
  
  await prisma.$disconnect();
}

checkChunks().catch(console.error);
