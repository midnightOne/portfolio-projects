#!/usr/bin/env tsx
/**
 * Test actual file upload to Cloudinary
 * Creates a test image and uploads it using the media provider
 */

// Load environment variables
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { getMediaProvider } from '../src/lib/media';
import { createCanvas } from 'canvas';

async function createTestImage(): Promise<Buffer> {
  // Create a simple test image using canvas
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  
  // Create a colorful test pattern
  ctx.fillStyle = '#4338CA'; // Indigo background
  ctx.fillRect(0, 0, 200, 200);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Portfolio', 100, 80);
  ctx.fillText('Test Image', 100, 110);
  
  const now = new Date();
  ctx.font = '12px Arial';
  ctx.fillText(now.toLocaleString(), 100, 140);
  
  // Add some decorative elements
  ctx.fillStyle = '#F59E0B'; // Amber accent
  ctx.beginPath();
  ctx.arc(100, 160, 15, 0, 2 * Math.PI);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

async function testCloudinaryUpload() {
  console.log('🧪 Testing Cloudinary Upload\n');

  try {
    // Create test image
    console.log('1. Creating test image...');
    const imageBuffer = await createTestImage();
    console.log(`   ✅ Test image created (${imageBuffer.length} bytes)`);

    // Get media provider
    console.log('2. Getting media provider...');
    const mediaProvider = getMediaProvider();
    console.log(`   ✅ Using provider: ${mediaProvider.name}`);

    // Upload the image
    console.log('3. Uploading to Cloudinary...');
    const uploadResult = await mediaProvider.upload(imageBuffer, {
      folder: 'portfolio-test',
      tags: ['test', 'portfolio', 'automated'],
      publicId: `test-image-${Date.now()}`
    });

    console.log('   ✅ Upload successful!');
    console.log('   📊 Upload Results:');
    console.log(`      Public ID: ${uploadResult.publicId}`);
    console.log(`      URL: ${uploadResult.url}`);
    console.log(`      Secure URL: ${uploadResult.secureUrl}`);
    console.log(`      Format: ${uploadResult.format}`);
    console.log(`      Size: ${uploadResult.width}x${uploadResult.height}`);
    console.log(`      File Size: ${uploadResult.bytes} bytes`);
    console.log(`      Resource Type: ${uploadResult.resourceType}`);

    // Test URL transformation
    console.log('4. Testing URL transformations...');
    const transformedUrl = mediaProvider.transform(uploadResult.url, [
      { width: 100, height: 100, crop: 'fill' },
      { quality: 'auto', format: 'auto' }
    ]);
    console.log(`   ✅ Transformed URL: ${transformedUrl}`);

    // Test getUrl method
    const directUrl = mediaProvider.getUrl(uploadResult.publicId, {
      transformation: [{ width: 150, height: 150, crop: 'fit' }]
    });
    console.log(`   ✅ Direct URL: ${directUrl}`);

    console.log('\n🎉 Upload test completed successfully!');
    console.log('\n📝 You can view your uploaded image at:');
    console.log(`   Original: ${uploadResult.secureUrl}`);
    console.log(`   Thumbnail: ${directUrl}`);

    // Clean up - delete the test image
    console.log('\n5. Cleaning up test image...');
    const deleteResult = await mediaProvider.delete(uploadResult.publicId);
    console.log(`   ✅ Cleanup: ${deleteResult.result}`);

  } catch (error) {
    console.error('❌ Upload test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      
      // Provide helpful debugging information
      if (error.message.includes('Invalid API Key')) {
        console.log('\n💡 Troubleshooting: Check your CLOUDINARY_API_KEY');
      } else if (error.message.includes('Invalid API Secret')) {
        console.log('\n💡 Troubleshooting: Check your CLOUDINARY_API_SECRET');
      } else if (error.message.includes('Cloud name')) {
        console.log('\n💡 Troubleshooting: Check your CLOUDINARY_CLOUD_NAME');
      }
    }
  }
}

// Run the test
testCloudinaryUpload().catch(console.error); 