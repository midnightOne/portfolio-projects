/**
 * Test the exact UI flow to identify where it's breaking
 */

async function testUIFlow() {
  console.log('🧪 Testing UI flow...\n');

  const projectId = 'cmdrv53uc0006w5ygx159q995'; // Known project with thumbnail
  
  try {
    // 1. Test the project fetch (what unified-project-editor does)
    console.log('1. Testing project fetch...');
    const projectResponse = await fetch(`http://localhost:3000/api/admin/projects/${projectId}`);
    
    if (!projectResponse.ok) {
      console.log(`❌ Project fetch failed: ${projectResponse.status} ${projectResponse.statusText}`);
      return;
    }
    
    const projectData = await projectResponse.json();
    console.log('✅ Project fetched successfully');
    console.log('   thumbnailImageId:', projectData.thumbnailImageId);
    console.log('   thumbnailImage exists:', !!projectData.thumbnailImage);
    console.log('   thumbnailImage URL:', projectData.thumbnailImage?.url);

    // 2. Test the media fetch (what media-selection-modal does)
    console.log('\n2. Testing media fetch...');
    const mediaResponse = await fetch(`http://localhost:3000/api/admin/projects/${projectId}/media`);
    
    if (!mediaResponse.ok) {
      console.log(`❌ Media fetch failed: ${mediaResponse.status} ${mediaResponse.statusText}`);
      const errorText = await mediaResponse.text();
      console.log('Error details:', errorText);
      return;
    }
    
    const mediaData = await mediaResponse.json();
    console.log('✅ Media fetched successfully');
    console.log('   Media count:', mediaData.mediaItems?.length || 0);
    console.log('   First media URL:', mediaData.mediaItems?.[0]?.url);

    // 3. Test image accessibility
    console.log('\n3. Testing image accessibility...');
    if (projectData.thumbnailImage) {
      const imageUrl = projectData.thumbnailImage.thumbnailUrl || projectData.thumbnailImage.url;
      try {
        const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
        console.log('✅ Thumbnail image accessible:', imageResponse.status);
      } catch (error) {
        console.log('❌ Thumbnail image not accessible:', error.message);
      }
    }

    // 4. Test media upload (simulate file upload)
    console.log('\n4. Testing media upload...');
    
    // Create a simple test file (we can't actually create a File object in Node.js, so we'll skip this)
    console.log('   (Skipping file upload test - requires browser environment)');

    console.log('\n✅ UI flow test completed');

  } catch (error) {
    console.log('❌ UI flow test failed:', error.message);
  }
}

// Only run if server is available
fetch('http://localhost:3000/api/health')
  .then(() => {
    console.log('✅ Server is running, starting UI flow test...\n');
    testUIFlow();
  })
  .catch(() => {
    console.log('❌ Server is not running. Please start the development server with: npm run dev');
  });