import { prisma } from '../src/lib/prisma';

async function checkData() {
  const projects = await prisma.project.findMany({ 
    select: { id: true, title: true }, 
    take: 5 
  });
  console.log('Projects:', projects);
  
  const chunks = await prisma.contextChunk.findMany({ 
    select: { id: true, tier: true, projectIndexId: true }, 
    take: 10 
  });
  console.log('Chunks:', chunks);
  
  await prisma.$disconnect();
}

checkData();
