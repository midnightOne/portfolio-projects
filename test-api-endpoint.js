/**
 * Test the actual API endpoint that the frontend calls
 */

async function testAPIEndpoint() {
  console.log('🧪 Testing API endpoint...\n');

  // Test the project API endpoint
  const projectId = 'cmdrv53uc0006w5ygx159q995'; // From our previous test
  const apiUrl = `http://localhost:3000/api/admin/projects/${projectId}`;
  
  console.log(`Testing: ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
        // Note: In real app, this would need authentication
      }
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ API Response received');
    console.log('Project ID:', data.id);
    console.log('Project Title:', data.title);
    console.log('thumbnailImageId:', data.thumbnailImageId);
    console.log('thumbnailImage exists:', !!data.thumbnailImage);
    
    if (data.thumbnailImage) {
      console.log('\nThumbnail Image Details:');
      console.log('  id:', data.thumbnailImage.id);
      console.log('  url:', data.thumbnailImage.url);
      console.log('  thumbnailUrl:', data.thumbnailImage.thumbnailUrl);
      console.log('  altText:', data.thumbnailImage.altText);
      console.log('  type:', data.thumbnailImage.type);
      console.log('  fileSize type:', typeof data.thumbnailImage.fileSize);
      console.log('  createdAt type:', typeof data.thumbnailImage.createdAt);
    }
    
    console.log('\nTesting thumbnail update...');
    
    // Test updating the thumbnail
    const updateResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        thumbnailImageId: data.thumbnailImageId // Keep same ID for now
      })
    });
    
    if (!updateResponse.ok) {
      console.log(`❌ Update Error: ${updateResponse.status} ${updateResponse.statusText}`);
      const errorText = await updateResponse.text();
      console.log('Update error details:', errorText);
      return;
    }
    
    const updatedData = await updateResponse.json();
    console.log('✅ Update successful');
    console.log('Updated thumbnailImageId:', updatedData.thumbnailImageId);
    console.log('Updated thumbnailImage exists:', !!updatedData.thumbnailImage);
    
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
}

testAPIEndpoint().catch(console.error);