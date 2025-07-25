import dotenv from 'dotenv';
import { resolve } from 'path';
import { prisma } from '@/lib/database';
import { getMediaProvider } from '@/lib/media';
import { createWriteStream, createReadStream, unlinkSync } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

interface MediaToMigrate {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  altText?: string | null;
  type: string;
  projectSlug: string;
}

async function downloadFile(url: string, filename: string): Promise<string> {
  try {
    console.log(`  📥 Downloading: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const tempDir = resolve(process.cwd(), 'temp-downloads');
    await mkdir(tempDir, { recursive: true });
    
    const filePath = resolve(tempDir, filename);
    const fileStream = createWriteStream(filePath);
    
    if (response.body) {
      await pipeline(response.body as any, fileStream);
    }
    
    console.log(`  ✅ Downloaded to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`  ❌ Download failed for ${url}:`, error);
    throw error;
  }
}

function getFileExtension(url: string): string {
  // Handle Unsplash URLs
  if (url.includes('unsplash.com')) {
    return '.jpg';
  }
  
  // Handle video URLs
  if (url.includes('.mp4')) return '.mp4';
  if (url.includes('.webm')) return '.webm';
  if (url.includes('.gif') || url.includes('giphy.com')) return '.gif';
  
  // Default to jpg for images
  return '.jpg';
}

function generateFilename(altText: string | null, type: string, projectSlug: string, index: number): string {
  const cleanAltText = altText?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'media';
  
  const extension = type === 'VIDEO' || type === 'WEBM' ? (type === 'WEBM' ? '.webm' : '.mp4') :
                   type === 'GIF' ? '.gif' : '.jpg';
  
  return `${projectSlug}-${cleanAltText}-${index}${extension}`;
}

async function uploadToCloudinary(filePath: string, options: {
  folder: string;
  publicId: string;
  altText?: string | null;
}): Promise<{ url: string; secureUrl: string; publicId: string }> {
  try {
    console.log(`  ☁️  Uploading to Cloudinary: ${options.publicId}`);
    
    const mediaProvider = getMediaProvider();
    
    // Read file and create upload options
    const uploadOptions = {
      folder: options.folder,
      publicId: options.publicId,
      tags: ['portfolio-migration', 'test-data']
    };

    const result = await mediaProvider.uploadFromPath(filePath, uploadOptions);
    
    console.log(`  ✅ Uploaded to Cloudinary: ${result.secureUrl}`);
    return {
      url: result.url,
      secureUrl: result.secureUrl,
      publicId: result.publicId
    };
  } catch (error) {
    console.error(`  ❌ Cloudinary upload failed:`, error);
    throw error;
  }
}

async function updateMediaItem(id: string, cloudinaryUrl: string, thumbnailUrl?: string) {
  try {
    await prisma.mediaItem.update({
      where: { id },
      data: {
        url: cloudinaryUrl,
        ...(thumbnailUrl && { thumbnailUrl })
      }
    });
    console.log(`  ✅ Updated database record: ${id}`);
  } catch (error) {
    console.error(`  ❌ Database update failed for ${id}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Media Migration to Cloudinary\n');

  try {
    // Check media provider configuration
    const mediaProvider = getMediaProvider();
    console.log(`📤 Using provider: ${mediaProvider.name}\n`);

    // Get all media items that need migration (external URLs)
    const mediaItems = await prisma.mediaItem.findMany({
      where: {
        OR: [
          { url: { startsWith: 'https://images.unsplash.com' } },
          { url: { startsWith: 'https://sample-videos.com' } },
          { url: { startsWith: 'https://i.giphy.com' } },
          { url: { startsWith: 'https://interactive-examples.mdn.mozilla.net' } }
        ]
      },
      include: {
        project: {
          select: { slug: true }
        }
      }
    });

    console.log(`📋 Found ${mediaItems.length} media items to migrate:\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];
      console.log(`\n🔄 Processing ${i + 1}/${mediaItems.length}: ${item.altText || 'Untitled'}`);
      console.log(`   Project: ${item.project?.slug || 'Unknown'}`);
      console.log(`   Type: ${item.type}`);
      console.log(`   Current URL: ${item.url}`);

      if (!item.project) {
        console.log(`  ⚠️  Skipping item without project association`);
        continue;
      }

      try {
        // Generate filename and folder structure
        const filename = generateFilename(item.altText, item.type, item.project.slug, i + 1);
        const extension = getFileExtension(item.url);
        const downloadFilename = `${Date.now()}-${filename}`;

        // Download the file
        const filePath = await downloadFile(item.url, downloadFilename);

        // Upload to Cloudinary
        const cloudinaryResult = await uploadToCloudinary(filePath, {
          folder: `portfolio-projects/${item.project.slug}`,
          publicId: filename.replace(/\.[^/.]+$/, ''), // Remove extension for publicId
          altText: item.altText
        });

        // Generate thumbnail URL if this is an image
        let thumbnailUrl = cloudinaryResult.secureUrl;
        if (item.type === 'IMAGE') {
          // Use Cloudinary transformations for thumbnails
          thumbnailUrl = cloudinaryResult.secureUrl.replace('/upload/', '/upload/w_400,h_300,c_fill/');
        }

        // Update database
        await updateMediaItem(item.id, cloudinaryResult.secureUrl, thumbnailUrl);

        // Clean up temporary file
        unlinkSync(filePath);
        console.log(`  🗑️  Cleaned up temporary file`);

        successCount++;
        console.log(`  ✅ Migration completed successfully`);

      } catch (error) {
        console.error(`  ❌ Migration failed:`, error);
        errorCount++;
      }
    }

    console.log(`\n🎉 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📊 Success Rate: ${((successCount / mediaItems.length) * 100).toFixed(1)}%`);

    if (successCount > 0) {
      console.log(`\n🔗 Your media is now served from Cloudinary!`);
      console.log(`   Visit your portfolio to see the migrated media.`);
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to clean up temp directory
async function cleanup() {
  try {
    const { rmSync } = await import('fs');
    const tempDir = resolve(process.cwd(), 'temp-downloads');
    rmSync(tempDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up temporary files');
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted');
  await cleanup();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('exit', async () => {
  await cleanup();
});

if (require.main === module) {
  main().catch(console.error);
} 