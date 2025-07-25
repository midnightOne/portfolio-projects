import dotenv from 'dotenv';
import { resolve } from 'path';
import { prisma } from '@/lib/database';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('🖼️  Cloudinary Image Display Demo\n');

  try {
    // Get some sample migrated media items
    const sampleMedia = await prisma.mediaItem.findMany({
      where: {
        url: {
          contains: 'cloudinary.com'
        },
        type: 'IMAGE'
      },
      include: {
        project: {
          select: { 
            slug: true,
            title: true 
          }
        }
      },
      take: 3
    });

    if (sampleMedia.length === 0) {
      console.log('❌ No Cloudinary images found');
      return;
    }

    console.log('📸 Sample Cloudinary Images for Component Usage:\n');

    sampleMedia.forEach((item, index) => {
      // Extract publicId from Cloudinary URL
      const urlParts = item.url.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      if (uploadIndex === -1) {
        console.log(`❌ Invalid Cloudinary URL: ${item.url}`);
        return;
      }
      
      // publicId is everything after version (v1234567890/)
      const pathAfterUpload = urlParts.slice(uploadIndex + 1);
      const versionIndex = pathAfterUpload.findIndex(part => part.startsWith('v'));
      const publicId = pathAfterUpload.slice(versionIndex + 1).join('/').replace(/\.[^/.]+$/, '');

      console.log(`${index + 1}. ${item.altText} (${item.project?.title})`);
      console.log(`   Original URL: ${item.url}`);
      console.log(`   Public ID: ${publicId}`);
      console.log(`   
   React Component Usage:
   
   import { CloudinaryImage } from '@/components/media/cloudinary-image';
   
   <CloudinaryImage 
     publicId="${publicId}"
     alt="${item.altText || 'Project image'}"
     width={800}
     height={600}
     crop={{ type: 'fill', gravity: 'auto' }}
     quality="auto"
     format="auto"
     className="rounded-lg shadow-md"
   />
   
   // Or use specialized components:
   
   <ProjectThumbnail 
     publicId="${publicId}"
     alt="${item.altText || 'Project image'}"
     className="w-full h-48"
   />
   
   <ProjectDetailImage 
     publicId="${publicId}"
     alt="${item.altText || 'Project image'}"
     className="w-full max-w-4xl"
   />
   `);
      console.log('\n' + '='.repeat(80) + '\n');
    });

    console.log('🎨 Available Cloudinary Transformations:');
    console.log(`
   // Automatic optimization
   quality="auto" format="auto"
   
   // Responsive sizing
   width={800} height={600}
   crop={{ type: 'fill', gravity: 'auto' }}
   
   // Advanced cropping
   crop={{ type: 'thumb', gravity: 'face' }}
   crop={{ type: 'fit' }}
   crop={{ type: 'scale' }}
   
   // Effects and filters
   effect="blur:300"
   effect="grayscale"
   effect="sepia"
   
   // Quality control
   quality="auto:best"
   quality="auto:good" 
   quality="auto:eco"
   
   // Format optimization
   format="auto"  // Automatically chooses WebP, AVIF, etc.
   format="webp"
   format="jpg"
   `);

    console.log('🔗 Benefits of Cloudinary Integration:');
    console.log(`
   ✅ Automatic image optimization (WebP, AVIF when supported)
   ✅ Real-time transformations via URL parameters
   ✅ Global CDN delivery for faster loading
   ✅ Responsive image generation
   ✅ SEO-friendly alt text and metadata
   ✅ Lazy loading with Next.js Image component
   ✅ Quality and format optimization
   ✅ Advanced cropping and effects
   `);

    console.log('🌐 View your portfolio at: http://localhost:3000');
    console.log('   All images are now served from Cloudinary with automatic optimization!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
} 