/**
 * Assign thumbnails to projects for testing
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function assignThumbnails() {
  console.log('🖼️ Assigning thumbnails to projects...\n');

  // Get all projects without thumbnails
  const projects = await prisma.project.findMany({
    where: { thumbnailImageId: null },
    include: { mediaItems: true }
  });

  for (const project of projects) {
    if (project.mediaItems.length > 0) {
      // Assign the first image media item as thumbnail
      const firstImage = project.mediaItems.find(m => m.type === 'IMAGE');
      if (firstImage) {
        await prisma.project.update({
          where: { id: project.id },
          data: { thumbnailImageId: firstImage.id }
        });
        console.log(`✅ Assigned thumbnail to "${project.title}"`);
        console.log(`   - Media: ${firstImage.altText}`);
        console.log(`   - URL: ${firstImage.url}`);
        console.log('');
      }
    }
  }

  // Verify assignments
  console.log('📋 Final thumbnail assignments:');
  const updatedProjects = await prisma.project.findMany({
    include: { thumbnailImage: true }
  });

  updatedProjects.forEach(project => {
    console.log(`   ${project.title}: ${project.thumbnailImage ? '✅ HAS THUMBNAIL' : '❌ NO THUMBNAIL'}`);
    if (project.thumbnailImage) {
      console.log(`      URL: ${project.thumbnailImage.url}`);
    }
  });

  await prisma.$disconnect();
}

assignThumbnails().catch(console.error);