import { prisma } from '../src/lib/prisma';

async function checkData() {
  const chunksWithProjects = await prisma.contextChunk.findMany({ 
    where: {
      projectIndexId: { not: null }
    },
    select: { 
      id: true, 
      tier: true, 
      projectIndexId: true,
      title: true
    }, 
    take: 10 
  });
  console.log('Chunks with projectIndexId:', chunksWithProjects);
  
  if (chunksWithProjects.length > 0) {
    const projectId = chunksWithProjects[0].projectIndexId;
    console.log(`\nTesting with project: ${projectId}`);
    
    const allChunksForProject = await prisma.contextChunk.findMany({
      where: { projectIndexId: projectId },
      select: {
        id: true,
        tier: true,
        title: true,
        parentChunkId: true
      }
    });
    
    console.log(`Total chunks for project: ${allChunksForProject.length}`);
    console.log('Tier distribution:', allChunksForProject.reduce((acc, c) => {
      acc[c.tier] = (acc[c.tier] || 0) + 1;
      return acc;
    }, {} as Record<number, number>));
  }
  
  await prisma.$disconnect();
}

checkData();
