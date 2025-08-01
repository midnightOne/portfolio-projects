/**
 * Test the complete flow from database to component
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCompleteFlow() {
  console.log('🧪 Testing complete flow from database to component...\n');

  try {
    // 1. Get project data directly from database (simulating API)
    console.log('1. Fetching project from database...');
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

    console.log('✅ Project found:', project.title);
    console.log('   thumbnailImageId:', project.thumbnailImageId);
    console.log('   thumbnailImage exists:', !!project.thumbnailImage);

    // 2. Simulate API serialization (handling BigInt)
    console.log('\n2. Simulating API serialization...');
    const serializedProject = JSON.parse(JSON.stringify(project, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));

    console.log('✅ Serialization successful');
    console.log('   Serialized thumbnailImage exists:', !!serializedProject.thumbnailImage);
    console.log('   Serialized thumbnailImage URL:', serializedProject.thumbnailImage?.url);

    // 3. Simulate component props
    console.log('\n3. Simulating component props...');
    const componentProps = {
      currentMedia: serializedProject.thumbnailImage || undefined,
      projectId: serializedProject.id
    };

    console.log('   currentMedia exists:', !!componentProps.currentMedia);
    console.log('   currentMedia URL:', componentProps.currentMedia?.url);
    console.log('   currentMedia thumbnailUrl:', componentProps.currentMedia?.thumbnailUrl);

    // 4. Test image accessibility
    console.log('\n4. Testing image accessibility...');
    if (componentProps.currentMedia) {
      const imageUrl = componentProps.currentMedia.thumbnailUrl || componentProps.currentMedia.url;
      console.log('   Testing URL:', imageUrl);
      
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        console.log('   ✅ Image accessible:', response.status, response.statusText);
        console.log('   Content-Type:', response.headers.get('content-type'));
        console.log('   Content-Length:', response.headers.get('content-length'));
      } catch (error) {
        console.log('   ❌ Image not accessible:', error.message);
      }
    }

    // 5. Simulate media selection (what happens when user selects new media)
    console.log('\n5. Simulating media selection...');
    const otherMedia = serializedProject.mediaItems.find(m => 
      m.id !== serializedProject.thumbnailImageId && m.type === 'IMAGE'
    );

    if (otherMedia) {
      console.log('   Selected new media:', otherMedia.altText);
      console.log('   New media URL:', otherMedia.url);
      
      // Simulate the handleThumbnailSelect function
      console.log('   Simulating API update...');
      
      try {
        const updatedProject = await prisma.project.update({
          where: { id: project.id },
          data: { thumbnailImageId: otherMedia.id },
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

        console.log('   ✅ Database update successful');
        console.log('   New thumbnailImageId:', updatedProject.thumbnailImageId);
        console.log('   New thumbnailImage URL:', updatedProject.thumbnailImage?.url);

        // Test the new image URL
        const newImageUrl = updatedProject.thumbnailImage?.thumbnailUrl || updatedProject.thumbnailImage?.url;
        if (newImageUrl) {
          try {
            const response = await fetch(newImageUrl, { method: 'HEAD' });
            console.log('   ✅ New image accessible:', response.status, response.statusText);
          } catch (error) {
            console.log('   ❌ New image not accessible:', error.message);
          }
        }

        // Revert the change for next test
        await prisma.project.update({
          where: { id: project.id },
          data: { thumbnailImageId: project.thumbnailImageId }
        });
        console.log('   ✅ Reverted change for next test');

      } catch (error) {
        console.log('   ❌ Database update failed:', error.message);
      }
    }

    console.log('\n✅ Complete flow test finished successfully');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteFlow().catch(console.error);