/**
 * Debug script to investigate media upload issues
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugMediaIssue() {
  console.log('🔍 Debugging media upload issue...\n');

  // 1. Check if projects exist and their thumbnail status
  console.log('1. Checking projects and their thumbnails:');
  const projects = await prisma.project.findMany({
    include: {
      thumbnailImage: true,
      mediaItems: true
    }
  });

  projects.forEach(project => {
    console.log(`   Project: ${project.title}`);
    console.log(`   - ID: ${project.id}`);
    console.log(`   - thumbnailImageId: ${project.thumbnailImageId}`);
    console.log(`   - thumbnailImage: ${project.thumbnailImage ? 'EXISTS' : 'NULL'}`);
    console.log(`   - mediaItems count: ${project.mediaItems.length}`);
    if (project.thumbnailImage) {
      console.log(`   - thumbnail URL: ${project.thumbnailImage.url}`);
    }
    console.log('');
  });

  // 2. Check media items
  console.log('2. Checking media items:');
  const mediaItems = await prisma.mediaItem.findMany({
    take: 5
  });

  mediaItems.forEach(item => {
    console.log(`   Media: ${item.altText}`);
    console.log(`   - ID: ${item.id}`);
    console.log(`   - URL: ${item.url}`);
    console.log(`   - thumbnailUrl: ${item.thumbnailUrl}`);
    console.log(`   - projectId: ${item.projectId}`);
    console.log('');
  });

  // 3. Let's assign a thumbnail to the first project for testing
  if (projects.length > 0 && mediaItems.length > 0) {
    const firstProject = projects[0];
    const firstMediaItem = mediaItems.find(m => m.projectId === firstProject.id);
    
    if (firstMediaItem) {
      console.log('3. Assigning thumbnail to first project...');
      const updatedProject = await prisma.project.update({
        where: { id: firstProject.id },
        data: { thumbnailImageId: firstMediaItem.id },
        include: { thumbnailImage: true }
      });
      
      console.log(`   ✅ Assigned thumbnail to project: ${updatedProject.title}`);
      console.log(`   - thumbnailImageId: ${updatedProject.thumbnailImageId}`);
      console.log(`   - thumbnail URL: ${updatedProject.thumbnailImage?.url}`);
    }
  }

  await prisma.$disconnect();
}

debugMediaIssue().catch(console.error);