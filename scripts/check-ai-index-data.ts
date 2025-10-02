import { prisma } from '../src/lib/database/connection';

async function checkAIIndexData() {
  console.log('🔍 Checking AI Index data...');
  
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        aiIndex: {
          select: {
            summary: true,
            keywords: true,
            topics: true,
            technologies: true,
            sectionsCount: true,
            mediaCount: true,
            contentTiers: true
          }
        }
      },
      take: 5
    });
    
    console.log('📊 Projects with AI Index data:');
    projects.forEach(project => {
      console.log(`\n📋 ${project.title} (${project.slug})`);
      if (project.aiIndex) {
        console.log(`  Summary: ${project.aiIndex.summary?.substring(0, 100)}...`);
        console.log(`  Keywords: ${JSON.stringify(project.aiIndex.keywords)}`);
        console.log(`  Topics: ${JSON.stringify(project.aiIndex.topics)}`);
        console.log(`  Technologies: ${JSON.stringify(project.aiIndex.technologies)}`);
        console.log(`  Sections: ${project.aiIndex.sectionsCount}`);
        console.log(`  Media: ${project.aiIndex.mediaCount}`);
        console.log(`  Content Tiers: ${project.aiIndex.contentTiers ? 'Available' : 'None'}`);
      } else {
        console.log('  ❌ No AI Index data');
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAIIndexData();