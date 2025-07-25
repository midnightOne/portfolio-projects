import dotenv from 'dotenv';
import { resolve } from 'path';
import { prisma } from '@/lib/database';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('🔍 Verifying Media Migration Results\n');

  try {
    // Get all media items 
    const mediaItems = await prisma.mediaItem.findMany({
      include: {
        project: {
          select: { 
            slug: true,
            title: true 
          }
        }
      },
      orderBy: [
        { project: { slug: 'asc' } },
        { displayOrder: 'asc' }
      ]
    });

    const cloudinaryItems = mediaItems.filter(item => 
      item.url.includes('cloudinary.com')
    );
    
    const externalItems = mediaItems.filter(item => 
      !item.url.includes('cloudinary.com')
    );

    console.log(`📊 Migration Summary:`);
    console.log(`   Total Media Items: ${mediaItems.length}`);
    console.log(`   ✅ Migrated to Cloudinary: ${cloudinaryItems.length}`);
    console.log(`   ⚠️  Still External: ${externalItems.length}`);
    console.log(`   🎯 Success Rate: ${((cloudinaryItems.length / mediaItems.length) * 100).toFixed(1)}%\n`);

    if (externalItems.length > 0) {
      console.log(`❌ Items still using external URLs:`);
      externalItems.forEach(item => {
        console.log(`   • ${item.project?.title}: ${item.altText || 'Untitled'}`);
        console.log(`     URL: ${item.url.substring(0, 80)}...`);
      });
      console.log('');
    }

    console.log(`✅ Successfully migrated items by project:\n`);
    
    // Group by project
    const projectGroups = cloudinaryItems.reduce((acc, item) => {
      const projectSlug = item.project?.slug || 'unknown';
      if (!acc[projectSlug]) {
        acc[projectSlug] = [];
      }
      acc[projectSlug].push(item);
      return acc;
    }, {} as Record<string, typeof cloudinaryItems>);

    Object.entries(projectGroups).forEach(([slug, items]) => {
      const project = items[0]?.project;
      console.log(`📁 ${project?.title || slug} (${items.length} items):`);
      items.forEach(item => {
        console.log(`   • ${item.altText || 'Untitled'} (${item.type})`);
        console.log(`     🔗 ${item.url}`);
      });
      console.log('');
    });

    console.log(`🌟 Your portfolio is now powered by Cloudinary!`);
    console.log(`   Visit: http://localhost:3000 to see your optimized media`);
    console.log(`   Features: Auto-optimization, CDN delivery, transformations`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
} 