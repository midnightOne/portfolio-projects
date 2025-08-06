/**
 * Migration script to convert existing plain text articles to Novel JSON format
 */

import { PrismaClient } from '@prisma/client';
import { convertTextToNovelJSON } from '../src/lib/utils/novel-content-converter';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting migration of articles to Novel format...');

  try {
    // Get all articles that don't have JSON content yet
    const articles = await prisma.articleContent.findMany({
      where: {
        OR: [
          { jsonContent: { equals: null } },
          { contentType: { equals: 'text' } }
        ]
      },
      include: {
        project: {
          select: {
            title: true
          }
        }
      }
    });

    console.log(`📄 Found ${articles.length} articles to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const article of articles) {
      try {
        console.log(`📝 Converting article for project: ${article.project.title}`);
        
        // Convert plain text to Novel JSON
        const novelContent = convertTextToNovelJSON(article.content);
        
        // Update the article with JSON content
        await prisma.articleContent.update({
          where: { id: article.id },
          data: {
            jsonContent: novelContent,
            contentType: 'json'
          }
        });

        migratedCount++;
        console.log(`✅ Successfully converted article for: ${article.project.title}`);
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error converting article for ${article.project.title}:`, error);
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successfully migrated: ${migratedCount} articles`);
    console.log(`❌ Errors: ${errorCount} articles`);
    console.log(`📄 Total processed: ${articles.length} articles`);

    if (migratedCount > 0) {
      console.log(`\n🎉 Migration completed successfully!`);
      console.log(`All articles are now available in Novel JSON format.`);
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});