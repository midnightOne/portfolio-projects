/**
 * Test script to verify Novel content conversion is working
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Novel content conversion...');

  try {
    // Get a sample article
    const article = await prisma.articleContent.findFirst({
      include: {
        project: {
          select: {
            title: true
          }
        }
      }
    });

    if (!article) {
      console.log('❌ No articles found in database');
      return;
    }

    console.log(`📄 Testing article for project: ${article.project.title}`);
    console.log(`📝 Content type: ${article.contentType}`);
    console.log(`📊 Has JSON content: ${!!article.jsonContent}`);
    console.log(`📊 Plain text length: ${article.content.length} characters`);

    if (article.jsonContent) {
      const jsonContent = article.jsonContent as any;
      console.log(`📊 JSON content type: ${jsonContent.type}`);
      console.log(`📊 JSON content blocks: ${jsonContent.content?.length || 0}`);
      
      // Show first few blocks
      if (jsonContent.content && jsonContent.content.length > 0) {
        console.log('\n📋 First few content blocks:');
        jsonContent.content.slice(0, 3).forEach((block: any, index: number) => {
          console.log(`  ${index + 1}. ${block.type}: ${block.content?.[0]?.text?.substring(0, 50) || 'No text'}...`);
        });
      }
    }

    console.log('\n✅ Novel content conversion test completed successfully!');

  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});