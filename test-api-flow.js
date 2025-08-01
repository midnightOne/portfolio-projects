/**
 * Test the API flow that the unified project editor uses
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPIFlow() {
  console.log('🧪 Testing API flow...\n');

  // Get a project with a thumbnail (simulating what the API returns)
  const project = await prisma.project.findFirst({
    where: { 
      thumbnailImageId: { not: null }
    },
    include: {
      tags: true,
      mediaItems: true,
      articleContent: true,
      externalLinks: true,
      downloadableFiles: true,
      interactiveExamples: true,
      carousels: { include: { images: { include: { mediaItem: true } } } },
      thumbnailImage: true,
      metadataImage: true
    }
  });

  if (!project) {
    console.log('❌ No project with thumbnail found');
    return;
  }

  console.log('1. Project data from API:');
  console.log(`   Title: ${project.title}`);
  console.log(`   ID: ${project.id}`);
  console.log(`   thumbnailImageId: ${project.thumbnailImageId}`);
  console.log(`   thumbnailImage exists: ${!!project.thumbnailImage}`);
  
  if (project.thumbnailImage) {
    console.log('   thumbnailImage details:');
    console.log(`     - id: ${project.thumbnailImage.id}`);
    console.log(`     - url: ${project.thumbnailImage.url}`);
    console.log(`     - thumbnailUrl: ${project.thumbnailImage.thumbnailUrl}`);
    console.log(`     - altText: ${project.thumbnailImage.altText}`);
    console.log(`     - type: ${project.thumbnailImage.type}`);
  }

  console.log('\n2. Testing image URL accessibility:');
  
  if (project.thumbnailImage) {
    const imageUrl = project.thumbnailImage.thumbnailUrl || project.thumbnailImage.url;
    console.log(`   Testing URL: ${imageUrl}`);
    
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      console.log(`   ✅ URL accessible: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers.get('content-type')}`);
      console.log(`   Content-Length: ${response.headers.get('content-length')}`);
    } catch (error) {
      console.log(`   ❌ URL not accessible: ${error.message}`);
    }
  }

  console.log('\n3. Testing media selection (simulating modal selection):');
  
  // Get another media item from the same project
  const otherMediaItem = project.mediaItems.find(m => m.id !== project.thumbnailImageId && m.type === 'IMAGE');
  
  if (otherMediaItem) {
    console.log(`   Selecting new media: ${otherMediaItem.altText}`);
    console.log(`   New media URL: ${otherMediaItem.url}`);
    
    // Simulate the API call that unified-project-editor makes
    try {
      const updatedProject = await prisma.project.update({
        where: { id: project.id },
        data: { thumbnailImageId: otherMediaItem.id },
        include: {
          tags: true,
          mediaItems: true,
          articleContent: true,
          externalLinks: true,
          downloadableFiles: true,
          interactiveExamples: true,
          carousels: { include: { images: { include: { mediaItem: true } } } },
          thumbnailImage: true,
          metadataImage: true
        }
      });
      
      console.log('   ✅ Project updated successfully');
      console.log(`   New thumbnailImageId: ${updatedProject.thumbnailImageId}`);
      console.log(`   New thumbnail URL: ${updatedProject.thumbnailImage?.url}`);
      
      // Test the new URL
      const newImageUrl = updatedProject.thumbnailImage?.thumbnailUrl || updatedProject.thumbnailImage?.url;
      if (newImageUrl) {
        try {
          const response = await fetch(newImageUrl, { method: 'HEAD' });
          console.log(`   ✅ New URL accessible: ${response.status} ${response.statusText}`);
        } catch (error) {
          console.log(`   ❌ New URL not accessible: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Update failed: ${error.message}`);
    }
  } else {
    console.log('   No other media items available for testing');
  }

  await prisma.$disconnect();
}

testAPIFlow().catch(console.error);