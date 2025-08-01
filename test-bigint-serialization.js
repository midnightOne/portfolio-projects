/**
 * Test if BigInt serialization is causing issues
 */

const mockMediaItem = {
  id: 'cmdrzh6oa000sw51owi8vu56e',
  url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
  thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
  altText: 'Payment processing interface',
  type: 'IMAGE',
  projectId: 'cmdrv53uc0006w5ygx159q995',
  description: null,
  width: 800,
  height: 600,
  fileSize: 1024000n, // BigInt
  displayOrder: 0,
  createdAt: new Date('2023-01-01')
};

console.log('🧪 Testing BigInt serialization...\n');

console.log('1. Original object:');
console.log('   fileSize:', mockMediaItem.fileSize);
console.log('   fileSize type:', typeof mockMediaItem.fileSize);

console.log('\n2. JSON.stringify test:');
try {
  const jsonString = JSON.stringify(mockMediaItem);
  console.log('   ❌ JSON.stringify succeeded (unexpected)');
  console.log('   Result:', jsonString);
} catch (error) {
  console.log('   ✅ JSON.stringify failed as expected:', error.message);
}

console.log('\n3. JSON.stringify with BigInt replacer:');
try {
  const jsonString = JSON.stringify(mockMediaItem, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
  console.log('   ✅ JSON.stringify with replacer succeeded');
  console.log('   Result length:', jsonString.length);
  
  const parsed = JSON.parse(jsonString);
  console.log('   Parsed fileSize:', parsed.fileSize);
  console.log('   Parsed fileSize type:', typeof parsed.fileSize);
} catch (error) {
  console.log('   ❌ JSON.stringify with replacer failed:', error.message);
}

console.log('\n4. Simulating API response:');
const apiResponse = {
  ...mockMediaItem,
  fileSize: mockMediaItem.fileSize.toString(), // Convert BigInt to string
  createdAt: mockMediaItem.createdAt.toISOString() // Convert Date to string
};

console.log('   API response fileSize:', apiResponse.fileSize);
console.log('   API response fileSize type:', typeof apiResponse.fileSize);

console.log('\n5. Component prop simulation:');
const componentProps = {
  currentMedia: apiResponse
};

console.log('   Component would receive:');
console.log('   - currentMedia exists:', !!componentProps.currentMedia);
console.log('   - url:', componentProps.currentMedia.url);
console.log('   - thumbnailUrl:', componentProps.currentMedia.thumbnailUrl);
console.log('   - fileSize:', componentProps.currentMedia.fileSize);
console.log('   - fileSize type:', typeof componentProps.currentMedia.fileSize);