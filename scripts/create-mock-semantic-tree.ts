/**
 * Create mock semantic tree data for testing
 */

import { prisma } from '../src/lib/prisma';

async function createMockTree() {
  try {
    console.log('🌱 Creating mock semantic tree data...\n');

    // Get first project
    const project = await prisma.project.findFirst({
      select: { id: true, title: true }
    });

    if (!project) {
      console.log('❌ No projects found');
      return;
    }

    console.log(`📁 Using project: ${project.title} (${project.id})`);

    // Create entity
    const entity = await prisma.contentEntity.create({
      data: {
        entityType: 'PROJECT',
        slug: project.id,
        title: project.title,
        tags: ['test', 'mock'],
        technologies: ['TypeScript', 'React']
      }
    });

    console.log(`✅ Created entity: ${entity.id}`);

    // Create T0 (Project Metadata)
    const t0 = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 0,
        chunkId: 't0-metadata',
        title: 'Project Metadata',
        content: JSON.stringify({
          title: project.title,
          tags: ['test', 'mock'],
          technologies: ['TypeScript', 'React']
        }),
        tokenCount: 50,
        importance: 1.0,
        generationMode: 'system',
        modifiedBy: 'system',
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'text-embedding-3-small'
      }
    });

    console.log(`✅ Created T0: ${t0.id}`);

    // Create T1 (Project Summary)
    const t1 = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 1,
        chunkId: 't1-summary',
        title: 'Project Summary',
        content: 'This is a comprehensive project that demonstrates modern web development practices using TypeScript and React.',
        tokenCount: 150,
        importance: 0.9,
        generationMode: 'ai',
        modifiedBy: 'ai',
        parentChunkId: t0.id,
        rootChunkId: t0.id,
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'text-embedding-3-small'
      }
    });

    console.log(`✅ Created T1: ${t1.id}`);

    // Create T2 (Heading Summaries)
    const t2_intro = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 2,
        chunkId: 't2-intro',
        title: 'Introduction',
        content: 'The introduction section provides an overview of the project goals and objectives.',
        tokenCount: 100,
        importance: 0.8,
        generationMode: 'ai',
        modifiedBy: 'ai',
        parentChunkId: t1.id,
        rootChunkId: t0.id,
        sectionGroup: 'h1-introduction',
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'text-embedding-3-small'
      }
    });

    const t2_tech = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 2,
        chunkId: 't2-tech',
        title: 'Technical Implementation',
        content: 'This section covers the technical architecture and implementation details.',
        tokenCount: 120,
        importance: 0.85,
        generationMode: 'ai',
        modifiedBy: 'ai',
        parentChunkId: t1.id,
        rootChunkId: t0.id,
        sectionGroup: 'h1-technical',
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'text-embedding-3-small'
      }
    });

    const t2_results = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 2,
        chunkId: 't2-results',
        title: 'Results and Outcomes',
        content: 'The results section demonstrates the impact and success metrics of the project.',
        tokenCount: 110,
        importance: 0.75,
        generationMode: 'ai',
        modifiedBy: 'ai',
        parentChunkId: t1.id,
        rootChunkId: t0.id,
        sectionGroup: 'h1-results',
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'text-embedding-3-small'
      }
    });

    console.log(`✅ Created T2 chunks: ${t2_intro.id}, ${t2_tech.id}, ${t2_results.id}`);

    // Create T3 (Raw Content Chunks)
    const t3_intro_1 = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 3,
        chunkId: 't3-intro-1',
        title: 'Introduction - Part 1',
        content: 'This project began as an exploration of modern web development practices. The goal was to create a scalable, maintainable application that could serve as a reference implementation.',
        tokenCount: 200,
        importance: 0.7,
        generationMode: 'hybrid',
        modifiedBy: 'system',
        parentChunkId: t2_intro.id,
        rootChunkId: t0.id,
        sectionGroup: 'h1-introduction',
        sectionBounded: true,
        chunkIndexInSection: 0,
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'text-embedding-3-small'
      }
    });

    const t3_intro_2 = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 3,
        chunkId: 't3-intro-2',
        title: 'Introduction - Part 2',
        content: 'The project leverages cutting-edge technologies and follows industry best practices. It demonstrates patterns for state management, component composition, and performance optimization.',
        tokenCount: 180,
        importance: 0.65,
        generationMode: 'hybrid',
        modifiedBy: 'system',
        parentChunkId: t2_intro.id,
        rootChunkId: t0.id,
        sectionGroup: 'h1-introduction',
        sectionBounded: true,
        chunkIndexInSection: 1,
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'text-embedding-3-small'
      }
    });

    const t3_tech_1 = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 3,
        chunkId: 't3-tech-1',
        title: 'Technical Implementation - Architecture',
        content: 'The architecture follows a modular design with clear separation of concerns. The frontend uses React with TypeScript for type safety, while the backend leverages Node.js and Express.',
        tokenCount: 220,
        importance: 0.8,
        generationMode: 'hybrid',
        modifiedBy: 'system',
        parentChunkId: t2_tech.id,
        rootChunkId: t0.id,
        sectionGroup: 'h1-technical',
        sectionBounded: true,
        chunkIndexInSection: 0,
        embeddingGeneratedAt: new Date(),
        embeddingModel: 'text-embedding-3-small',
        manuallyEdited: true // Mark as manually edited
      }
    });

    const t3_results_1 = await prisma.contextChunk.create({
      data: {
        entityId: entity.id,
        projectIndexId: project.id,
        tier: 3,
        chunkId: 't3-results-1',
        title: 'Results - Performance Metrics',
        content: 'The project achieved significant performance improvements, with page load times reduced by 40% and bundle sizes optimized through code splitting and lazy loading.',
        tokenCount: 190,
        importance: 0.7,
        generationMode: 'hybrid',
        modifiedBy: 'system',
        parentChunkId: t2_results.id,
        rootChunkId: t0.id,
        sectionGroup: 'h1-results',
        sectionBounded: true,
        chunkIndexInSection: 0
        // No embedding for this one to test missing embedding indicator
      }
    });

    console.log(`✅ Created T3 chunks: ${t3_intro_1.id}, ${t3_intro_2.id}, ${t3_tech_1.id}, ${t3_results_1.id}`);

    console.log('\n📊 Mock Tree Summary:');
    console.log(`   T0: 1 chunk (Project Metadata)`);
    console.log(`   T1: 1 chunk (Project Summary)`);
    console.log(`   T2: 3 chunks (Heading Summaries)`);
    console.log(`   T3: 4 chunks (Raw Content)`);
    console.log(`   Total: 9 chunks`);

    console.log('\n✅ Mock semantic tree created successfully!');
    console.log(`\n🌐 View at: http://localhost:3000/admin/semantic/projects/${project.id}`);

  } catch (error) {
    console.error('❌ Error creating mock tree:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createMockTree();
