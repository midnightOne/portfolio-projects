import { prisma } from '../src/lib/database/connection';

async function checkContentStructure() {
  console.log('🔍 Checking content structure data...');
  
  try {
    // Check ArticleContent for structure
    const articleContent = await prisma.articleContent.findFirst({
      where: {
        project: {
          slug: 'e-commerce-platform'
        }
      },
      select: {
        id: true,
        contentType: true,
        jsonContent: true,
        project: {
          select: {
            title: true,
            slug: true
          }
        }
      }
    });
    
    console.log('📄 Article Content:');
    if (articleContent) {
      console.log(`  Project: ${articleContent.project.title}`);
      console.log(`  Content Type: ${articleContent.contentType}`);
      console.log(`  Has JSON Content: ${!!articleContent.jsonContent}`);
      
      if (articleContent.jsonContent) {
        const jsonContent = articleContent.jsonContent as any;
        console.log(`  JSON Content keys: ${Object.keys(jsonContent)}`);
        
        // Check if it has structure we can use
        if (jsonContent.content) {
          console.log(`  Content blocks: ${Array.isArray(jsonContent.content) ? jsonContent.content.length : 'Not array'}`);
          
          if (Array.isArray(jsonContent.content)) {
            const headings = jsonContent.content.filter((block: any) => 
              block.type === 'heading' || (block.type === 'element' && block.tagName?.startsWith('h'))
            );
            console.log(`  Headings found: ${headings.length}`);
            
            const contentTypes = [...new Set(jsonContent.content.map((block: any) => block.type))];
            console.log(`  Content types: ${contentTypes.join(', ')}`);
          }
        }
      }
    } else {
      console.log('  ❌ No article content found');
    }
    
    // Check if we have any projects with contentTiers
    const projectsWithTiers = await prisma.projectAIIndex.findMany({
      where: {
        contentTiers: {
          not: null
        }
      },
      select: {
        projectId: true,
        contentTiers: true,
        project: {
          select: {
            title: true
          }
        }
      },
      take: 2
    });
    
    console.log('\n📊 Projects with Content Tiers:');
    if (projectsWithTiers.length > 0) {
      projectsWithTiers.forEach(project => {
        console.log(`  ${project.project.title}: ${JSON.stringify(project.contentTiers)}`);
      });
    } else {
      console.log('  ❌ No projects with content tiers found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkContentStructure();