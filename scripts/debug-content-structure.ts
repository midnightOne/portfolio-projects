import { prisma } from '../src/lib/database/connection';

async function debugContentStructure() {
  console.log('🔍 Debugging content structure for e-commerce-platform...');
  
  try {
    const projectId = 'e-commerce-platform';
    
    // Check if project exists
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { slug: projectId },
          { id: projectId }
        ]
      },
      select: {
        id: true,
        slug: true,
        title: true
      }
    });
    
    console.log('📋 Project found:', project);
    
    if (!project) {
      console.log('❌ Project not found');
      return;
    }
    
    // Check AI Index
    const aiIndex = await prisma.projectAIIndex.findUnique({
      where: { projectId: project.id },
      select: {
        sectionsCount: true,
        mediaCount: true,
        keywords: true,
        topics: true,
        technologies: true,
        summary: true
      }
    });
    
    console.log('🤖 AI Index:', aiIndex);
    
    // Check Article Content
    const articleContent = await prisma.articleContent.findFirst({
      where: { projectId: project.id },
      select: {
        id: true,
        jsonContent: true,
        contentType: true
      }
    });
    
    console.log('📄 Article Content found:', !!articleContent);
    console.log('📄 Content Type:', articleContent?.contentType);
    
    if (articleContent?.jsonContent) {
      const jsonContent = articleContent.jsonContent as any;
      console.log('📄 JSON Content structure:', {
        hasContent: !!jsonContent.content,
        contentLength: Array.isArray(jsonContent.content) ? jsonContent.content.length : 'Not array',
        contentKeys: Object.keys(jsonContent)
      });
      
      if (Array.isArray(jsonContent.content)) {
        const headings = jsonContent.content.filter((block: any) => block.type === 'heading');
        console.log('📄 Headings found:', headings.length);
        console.log('📄 First few headings:', headings.slice(0, 3).map((h: any) => ({
          type: h.type,
          level: h.attrs?.level,
          content: h.content
        })));
        
        const contentTypes = [...new Set(jsonContent.content.map((block: any) => block.type))];
        console.log('📄 Content types:', contentTypes);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugContentStructure();