#!/usr/bin/env tsx

/**
 * Test Smart Content Generation with Incremental Processing
 * 
 * This script tests the new heading-based hierarchical content system
 * with intelligent change detection and cost optimization.
 */

import { PrismaClient } from '@prisma/client';
import { SmartContentGenerator } from '../src/lib/content/SmartContentGenerator';
import { ProjectIndexer } from '../src/lib/services/project-indexer';

const prisma = new PrismaClient();

async function createTestProject() {
  console.log('📝 Creating test project with structured headings...');

  const project = await prisma.project.upsert({
    where: { slug: 'smart-content-test' },
    create: {
      title: 'Smart Content Generation Test',
      slug: 'smart-content-test',
      description: 'Testing smart hierarchical content generation with heading-based structure.',
      briefOverview: 'Demonstrates automatic tier mapping based on document structure.',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      workDate: new Date('2024-03-01')
    },
    update: {
      status: 'PUBLISHED',
      visibility: 'PUBLIC'
    }
  });

  // Create structured article content with clear heading hierarchy
  await prisma.articleContent.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      content: `# Smart Content Generation System

## Overview
This project demonstrates intelligent content processing with automatic tier generation based on document structure.

## Architecture
The system uses a multi-tier approach to organize content hierarchically.

### Frontend Components
The frontend includes several key components for content management.

### Backend Services
The backend provides APIs for content processing and retrieval.

## Implementation Details
This section covers the technical implementation approach.

### Database Design
The database schema supports hierarchical content relationships.

### API Endpoints
RESTful APIs provide access to content management features.

## Performance Optimization
Various techniques are used to optimize content processing performance.

### Caching Strategy
Intelligent caching reduces processing overhead and API costs.

### Incremental Updates
Only changed content sections are reprocessed to minimize costs.

## Results and Metrics
The system achieves significant performance improvements and cost savings.`,
      jsonContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Smart Content Generation System' }]
          }
        ]
      },
      contentType: 'markdown'
    },
    update: {
      content: `# Smart Content Generation System

## Overview
This project demonstrates intelligent content processing with automatic tier generation based on document structure.

## Architecture
The system uses a multi-tier approach to organize content hierarchically.

### Frontend Components
The frontend includes several key components for content management.

### Backend Services
The backend provides APIs for content processing and retrieval.

## Implementation Details
This section covers the technical implementation approach.

### Database Design
The database schema supports hierarchical content relationships.

### API Endpoints
RESTful APIs provide access to content management features.

## Performance Optimization
Various techniques are used to optimize content processing performance.

### Caching Strategy
Intelligent caching reduces processing overhead and API costs.

### Incremental Updates
Only changed content sections are reprocessed to minimize costs.

## Results and Metrics
The system achieves significant performance improvements and cost savings.`
    }
  });

  console.log(`✅ Created test project: ${project.title} (${project.slug})`);
  return project;
}

async function testSmartContentGeneration() {
  console.log('🧪 Testing smart content generation...');

  const smartGenerator = new SmartContentGenerator();
  
  // Get test project
  const project = await prisma.project.findUnique({
    where: { slug: 'smart-content-test' },
    include: {
      articleContent: true,
      tags: true,
      aiIndex: true
    }
  });

  if (!project) {
    throw new Error('Test project not found');
  }

  // First generation (everything should be new)
  console.log('🚀 First generation (all new content)...');
  const firstResult = await smartGenerator.generateHierarchicalContent(project);
  
  console.log('📊 First Generation Results:');
  console.log(`   - Total tiers: ${firstResult.tiers.length}`);
  console.log(`   - Processing time: ${firstResult.processingStats.processingTime}ms`);
  console.log(`   - Sections regenerated: ${firstResult.processingStats.regeneratedSections}`);
  console.log(`   - Sections reused: ${firstResult.processingStats.reusedSections}`);

  // Show tier breakdown
  const tierBreakdown = firstResult.tiers.reduce((acc, tier) => {
    acc[tier.tier] = (acc[tier.tier] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  console.log('   - Tier breakdown:');
  Object.entries(tierBreakdown).forEach(([tier, count]) => {
    console.log(`     T${tier}: ${count} chunks`);
  });

  // Store the generated content
  await storeGeneratedContent(project, firstResult.tiers);

  // Second generation (should reuse most content)
  console.log('\n🔄 Second generation (should reuse existing content)...');
  const secondResult = await smartGenerator.generateHierarchicalContent(project);
  
  console.log('📊 Second Generation Results (Cost Optimization):');
  console.log(`   - Sections skipped: ${secondResult.costSavings.sectionsSkipped}`);
  console.log(`   - Tokens skipped: ${secondResult.costSavings.tokensSkipped}`);
  console.log(`   - Cost saved: $${secondResult.costSavings.estimatedCostSaved.toFixed(4)}`);
  console.log(`   - Processing time: ${secondResult.processingStats.processingTime}ms`);
  console.log(`   - Efficiency: ${Math.round((secondResult.processingStats.reusedSections / secondResult.processingStats.totalSections) * 100)}% reused`);

  return { firstResult, secondResult };
}

async function storeGeneratedContent(project: any, tiers: any[]) {
  console.log('💾 Storing generated content...');

  // Create content entity
  const entity = await prisma.contentEntity.upsert({
    where: {
      entityType_slug: {
        entityType: 'PROJECT',
        slug: project.slug
      }
    },
    create: {
      entityType: 'PROJECT',
      slug: project.slug,
      title: project.title,
      description: project.description,
      tags: [],
      technologies: []
    },
    update: {
      title: project.title,
      description: project.description
    }
  });

  // Store chunks in two passes to handle parent-child relationships
  const chunkIdMap = new Map<string, string>(); // chunkId -> database ID
  
  // First pass: Create all chunks without parent relationships
  for (const tier of tiers) {
    const chunk = await prisma.contextChunk.upsert({
      where: {
        entityId_tier_chunkId: {
          entityId: entity.id,
          tier: tier.tier,
          chunkId: tier.chunkId
        }
      },
      create: {
        entityId: entity.id,
        tier: tier.tier,
        chunkId: tier.chunkId,
        title: tier.title,
        content: tier.content,
        tokenCount: tier.tokenCount,
        metadata: tier.metadata,
        sectionGroup: tier.metadata.sectionGroup || null,
        //derivationPath: tier.metadata.derivationPath || null
      },
      update: {
        title: tier.title,
        content: tier.content,
        tokenCount: tier.tokenCount,
        metadata: tier.metadata,
        sectionGroup: tier.metadata.sectionGroup || null,
        //derivationPath: tier.metadata.derivationPath || null
      }
    });
    
    chunkIdMap.set(tier.chunkId, chunk.id);
  }
  
  // Second pass: Update parent and root relationships
  for (const tier of tiers) {
    const parentChunkRef = tier.metadata.parentChunkId;
    const rootChunkRef = tier.metadata.rootChunkId;
    
    if (parentChunkRef || rootChunkRef) {
      await prisma.contextChunk.update({
        where: {
          entityId_tier_chunkId: {
            entityId: entity.id,
            tier: tier.tier,
            chunkId: tier.chunkId
          }
        },
        data: {
          parentChunkId: parentChunkRef ? chunkIdMap.get(parentChunkRef) || null : null,
          rootChunkId: rootChunkRef ? chunkIdMap.get(rootChunkRef) || null : null
        }
      });
    }
  }

  console.log(`✅ Stored ${tiers.length} content chunks`);
}

async function testHierarchicalRelationships() {
  console.log('🔗 Testing hierarchical relationships...');

  const chunks = await prisma.contextChunk.findMany({
    where: {
      entity: {
        slug: 'smart-content-test'
      }
    },
    orderBy: [
      { tier: 'asc' },
      { chunkId: 'asc' }
    ]
  });

  console.log('📋 Hierarchical Structure:');
  
  // Group by tier
  const tierGroups = chunks.reduce((acc, chunk) => {
    if (!acc[chunk.tier]) acc[chunk.tier] = [];
    acc[chunk.tier].push(chunk);
    return acc;
  }, {} as Record<number, any[]>);

  Object.entries(tierGroups).forEach(([tier, tierChunks]) => {
    console.log(`\n  T${tier} (${tierChunks.length} chunks):`);
    
    tierChunks.forEach(chunk => {
      const metadata = chunk.metadata as any;
      console.log(`    - ${chunk.chunkId} (${chunk.title})`);
      console.log(`      Parent: ${chunk.parentChunkId || 'none'}`);
      console.log(`      Section Group: ${chunk.sectionGroup || 'none'}`);
      //console.log(`      Derivation: ${chunk.derivationPath || 'none'}`);
      console.log(`      Node Type: ${metadata?.nodeType || 'unknown'}`);
      console.log(`      Anchor: ${metadata?.anchorId || 'none'}`);
    });
  });

  // Test relationship queries
  console.log('\n🔍 Testing relationship queries...');
  
  const t2Chunks = chunks.filter(c => c.tier === 2);
  for (const t2Chunk of t2Chunks.slice(0, 2)) { // Test first 2
    const children = chunks.filter(c => c.parentChunkId === t2Chunk.id);
    console.log(`\n  T2 "${t2Chunk.title}" has ${children.length} children:`);
    children.forEach(child => {
      console.log(`    - T${child.tier}: ${child.title} (${child.chunkId})`);
    });
  }
}

async function testIncrementalProcessing() {
  console.log('⚡ Testing incremental processing...');

  // Modify the project content slightly
  const project = await prisma.project.findUnique({
    where: { slug: 'smart-content-test' },
    include: { articleContent: true }
  });

  if (!project?.articleContent) {
    throw new Error('Project or article content not found');
  }

  // Add a new section to test incremental processing
  const modifiedContent = project.articleContent.content + `

## New Section Added
This is a new section added to test incremental processing and change detection.

### New Subsection
This subsection should be detected as a new T3 chunk.`;

  await prisma.articleContent.update({
    where: { id: project.articleContent.id },
    data: { content: modifiedContent }
  });

  // Test incremental generation
  const smartGenerator = new SmartContentGenerator();
  const result = await smartGenerator.generateHierarchicalContent(project);

  console.log('📊 Incremental Processing Results:');
  console.log(`   - Sections skipped: ${result.costSavings.sectionsSkipped}`);
  console.log(`   - Tokens skipped: ${result.costSavings.tokensSkipped}`);
  console.log(`   - Cost saved: $${result.costSavings.estimatedCostSaved.toFixed(4)}`);
  console.log(`   - New sections detected: ${result.processingStats.regeneratedSections}`);
  console.log(`   - Efficiency: ${Math.round((result.processingStats.reusedSections / result.processingStats.totalSections) * 100)}% reused`);

  return result;
}

async function main() {
  console.log('🚀 Testing Smart Content Generation System...');

  try {
    // Clean up existing test data
    await prisma.contextChunk.deleteMany({
      where: {
        entity: {
          slug: 'smart-content-test'
        }
      }
    });
    await prisma.contentEntity.deleteMany({
      where: { slug: 'smart-content-test' }
    });

    // Create test project
    await createTestProject();

    // Test smart content generation
    await testSmartContentGeneration();

    // Test hierarchical relationships
    await testHierarchicalRelationships();

    // Test incremental processing
    await testIncrementalProcessing();

    console.log('\n✨ Smart content generation tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}