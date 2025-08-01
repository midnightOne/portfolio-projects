/**
 * Debug the media component data flow
 */

// Simulate the data that should be passed to ClickableMediaUpload
const mockProjectData = {
  id: 'cmdrv53uc0006w5ygx159q995',
  title: 'E-commerce Platform',
  thumbnailImageId: 'cmdrzh6oa000sw51owi8vu56e',
  thumbnailImage: {
    id: 'cmdrzh6oa000sw51owi8vu56e',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
    altText: 'Payment processing interface',
    type: 'IMAGE',
    projectId: 'cmdrv53uc0006w5ygx159q995',
    description: null,
    width: 800,
    height: 600,
    fileSize: 1024000n,
    displayOrder: 0,
    createdAt: new Date('2023-01-01')
  }
};

console.log('🔍 Debugging media component data flow...\n');

console.log('1. Project data structure:');
console.log('   project?.thumbnailImage exists:', !!mockProjectData.thumbnailImage);
console.log('   project?.thumbnailImage || undefined:', mockProjectData.thumbnailImage || undefined);

console.log('\n2. Media item structure:');
if (mockProjectData.thumbnailImage) {
  const media = mockProjectData.thumbnailImage;
  console.log('   id:', media.id);
  console.log('   url:', media.url);
  console.log('   thumbnailUrl:', media.thumbnailUrl);
  console.log('   altText:', media.altText);
  console.log('   type:', media.type);
  
  console.log('\n3. Image source logic:');
  const imageSrc = media.thumbnailUrl || media.url;
  console.log('   Image src (thumbnailUrl || url):', imageSrc);
  
  console.log('\n4. Testing image accessibility:');
  fetch(imageSrc, { method: 'HEAD' })
    .then(response => {
      console.log('   ✅ Image accessible:', response.status, response.statusText);
      console.log('   Content-Type:', response.headers.get('content-type'));
    })
    .catch(error => {
      console.log('   ❌ Image not accessible:', error.message);
    });
}

console.log('\n5. Component props that would be passed:');
console.log('   currentMedia:', mockProjectData.thumbnailImage);
console.log('   projectId:', mockProjectData.id);

console.log('\n6. Checking for null/undefined issues:');
console.log('   currentMedia is null:', mockProjectData.thumbnailImage === null);
console.log('   currentMedia is undefined:', mockProjectData.thumbnailImage === undefined);
console.log('   currentMedia is falsy:', !mockProjectData.thumbnailImage);
console.log('   currentMedia exists (truthy):', !!mockProjectData.thumbnailImage);