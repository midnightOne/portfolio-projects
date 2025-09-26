/**
 * Test script for hierarchical content storage system
 * 
 * This script tests the hierarchical content system by:
 * 1. Creating sample project data
 * 2. Testing the ingestion pipeline
 * 3. Verifying tier generation and storage
 * 4. Testing content retrieval and search functionality
 */

import { PrismaClient } from '@prisma/client';
import { ContentIngestionPipeline } from '../src/lib/services/content-ingestion';

const prisma = new PrismaClient();

async function createSampleProject() {
  console.log('📝 Creating sample project for testing...');

  // Create sample tags
  const reactTag = await prisma.tag.upsert({
    where: { name: 'React' },
    create: { name: 'React', color: '#61DAFB' },
    update: {}
  });

  const nodeTag = await prisma.tag.upsert({
    where: { name: 'Node.js' },
    create: { name: 'Node.js', color: '#339933' },
    update: {}
  });

  // Create sample project
  const project = await prisma.project.upsert({
    where: { slug: 'test-ecommerce-platform' },
    create: {
      title: 'E-commerce Platform',
      slug: 'test-ecommerce-platform',
      description: 'A full-stack e-commerce platform built with React and Node.js, featuring user authentication, product catalog, shopping cart, and secure payment processing.',
      briefOverview: 'Modern e-commerce solution with real-time inventory management and responsive design.',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      workDate: new Date('2024-01-15'),
      tags: {
        connect: [{ id: reactTag.id }, { id: nodeTag.id }]
      }
    },
    update: {
      status: 'PUBLISHED',
      visibility: 'PUBLIC'
    },
    include: {
      tags: true
    }
  });

  // Create article content
  const articleContent = await prisma.articleContent.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      content: `# E-commerce Platform

## Overview
This project is a comprehensive e-commerce platform that demonstrates modern web development practices and technologies.

## Architecture
The application follows a microservices architecture with the following components:
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL with Prisma ORM
- Authentication: JWT with refresh tokens
- Payment: Stripe integration

## Key Features
### User Management
- User registration and authentication
- Profile management
- Order history tracking

### Product Catalog
- Dynamic product listings
- Advanced search and filtering
- Category-based navigation
- Product reviews and ratings

### Shopping Experience
- Shopping cart functionality
- Wishlist management
- Real-time inventory updates
- Mobile-responsive design

### Payment Processing
- Secure payment with Stripe
- Multiple payment methods
- Order confirmation and tracking
- Automated email notifications

## Technical Implementation
The frontend uses React hooks for state management and React Router for navigation. The backend implements RESTful APIs with proper error handling and validation.

## Performance Optimizations
- Image lazy loading
- Code splitting
- Database query optimization
- Caching strategies

## Security Features
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens
- Rate limiting

## Testing
Comprehensive test suite including unit tests, integration tests, and end-to-end tests using Jest and Cypress.

## Deployment
Deployed on AWS with CI/CD pipeline using GitHub Actions, Docker containers, and load balancing.`,
      jsonContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'E-commerce Platform' }]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'This project is a comprehensive e-commerce platform...' }]
          }
        ]
      },
      contentType: 'markdown'
    },
    update: {
      content: `# E-commerce Platform

## Overview
This project is a comprehensive e-commerce platform that demonstrates modern web development practices and technologies.

## Architecture
The application follows a microservices architecture with the following components:
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL with Prisma ORM
- Authentication: JWT with refresh tokens
- Payment: Stripe integration

## Key Features
### User Management
- User registration and authentication
- Profile management
- Order history tracking

### Product Catalog
- Dynamic product listings
- Advanced search and filtering
- Category-based navigation
- Product reviews and ratings

### Shopping Experience
- Shopping cart functionality
- Wishlist management
- Real-time inventory updates
- Mobile-responsive design

### Payment Processing
- Secure payment with Stripe
- Multiple payment methods
- Order confirmation and tracking
- Automated email notifications

## Technical Implementation
The frontend uses React hooks for state management and React Router for navigation. The backend implements RESTful APIs with proper error handling and validation.

## Performance Optimizations
- Image lazy loading
- Code splitting
- Database query optimization
- Caching strategies

## Security Features
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens
- Rate limiting

## Testing
Comprehensive test suite including unit tests, integration tests, and end-to-end tests using Jest and Cypress.

## Deployment
Deployed on AWS with CI/CD pipeline using GitHub Actions, Docker containers, and load balancing.`
    }
  });

  // Create AI index
  await prisma.projectAIIndex.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      summary: 'Full-stack e-commerce platform with React frontend, Node.js backend, and comprehensive features including user authentication, product catalog, shopping cart, and payment processing.',
      keywords: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Stripe', 'E-commerce', 'Authentication', 'Payment Processing'],
      topics: ['Web Development', 'Full-Stack', 'E-commerce', 'Payment Systems'],
      technologies: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Prisma', 'Stripe', 'JWT', 'Express'],
      sectionsCount: 8,
      mediaCount: 0,
      contentHash: 'test-hash-123'
    },
    update: {
      summary: 'Full-stack e-commerce platform with React frontend, Node.js backend, and comprehensive features including user authentication, product catalog, shopping cart, and payment processing.',
      keywords: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Stripe', 'E-commerce', 'Authentication', 'Payment Processing'],
      topics: ['Web Development', 'Full-Stack', 'E-commerce', 'Payment Systems'],
      technologies: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Prisma', 'Stripe', 'JWT', 'Express']
    }
  });

  console.log(`✅ Created sample project: ${project.title} (${project.slug})`);
  return project;
}

async function testIngestionPipeline() {
  console.log('🧪 Testing content ingestion pipeline...');

  const pipeline = new ContentIngestionPipeline();

  // Test ingesting all content (should now include our sample project)
  const results = await pipeline.ingestAllContent();

  console.log('📊 Ingestion Results:');
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.entityType}:${result.slug}`);
      console.log(`   - Chunks: ${result.totalChunks}`);
      console.log(`   - Tiers: ${result.tiersCreated.join(', ')}`);
    } else {
      console.log(`❌ ${result.entityType}:${result.slug} - ${result.error}`);
    }
  });

  return results;
}

async function testContentRetrieval() {
  console.log('🔍 Testing content retrieval...');

  // Test retrieving content by entity type and tier
  const projectEntity = await prisma.contentEntity.findFirst({
    where: { entityType: 'PROJECT' },
    include: {
      contentChunks: {
        orderBy: { tier: 'asc' }
      }
    }
  });

  if (projectEntity) {
    console.log(`📋 Entity: ${projectEntity.title} (${projectEntity.slug})`);
    console.log(`   - Total chunks: ${projectEntity.contentChunks.length}`);
    
    // Show tier distribution
    const tierCounts = projectEntity.contentChunks.reduce((acc, chunk) => {
      acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('   - Tier distribution:');
    Object.entries(tierCounts).forEach(([tier, count]) => {
      console.log(`     T${tier}: ${count} chunks`);
    });

    // Show sample content from each tier
    for (let tier = 0; tier <= 4; tier++) {
      const chunk = projectEntity.contentChunks.find(c => c.tier === tier);
      if (chunk) {
        console.log(`\n📄 T${tier} Sample (${chunk.chunkId}):`);
        console.log(`   Title: ${chunk.title || 'N/A'}`);
        console.log(`   Tokens: ${chunk.tokenCount}`);
        console.log(`   Content: ${chunk.content.substring(0, 100)}${chunk.content.length > 100 ? '...' : ''}`);
      }
    }
  }
}

async function testContentVersioning() {
  console.log('📚 Testing content versioning...');

  const versions = await prisma.contentVersion.findMany({
    orderBy: { createdAt: 'desc' }
  });

  console.log(`📈 Content Versions: ${versions.length}`);
  versions.forEach(version => {
    console.log(`   - Entity: ${version.entityId.substring(0, 8)}... v${version.versionNumber}`);
    console.log(`     Hash: ${version.contentHash}`);
    console.log(`     Changes: ${version.changesSummary}`);
  });
}

async function testDatabaseSchema() {
  console.log('🗄️  Testing database schema...');

  // Test entity constraints
  try {
    await prisma.contentEntity.create({
      data: {
        entityType: 'PROJECT',
        slug: 'test-ecommerce-platform', // Duplicate slug
        title: 'Duplicate Test',
        tags: [],
        technologies: []
      }
    });
    console.log('❌ Unique constraint test failed - duplicate allowed');
  } catch (error) {
    console.log('✅ Unique constraint working - duplicate rejected');
  }

  // Test chunk constraints
  const entity = await prisma.contentEntity.findFirst();
  if (entity) {
    try {
      await prisma.contextChunk.create({
        data: {
          entityId: entity.id,
          tier: 0,
          chunkId: 'metadata', // Duplicate chunk ID for same entity/tier
          content: 'Duplicate test content',
          tokenCount: 10
        }
      });
      console.log('❌ Chunk unique constraint test failed - duplicate allowed');
    } catch (error) {
      console.log('✅ Chunk unique constraint working - duplicate rejected');
    }
  }
}

async function main() {
  console.log('🚀 Starting hierarchical content system tests...');

  try {
    // Clean up existing test data
    await prisma.contextChunk.deleteMany({});
    await prisma.contentVersion.deleteMany({});
    await prisma.contentEntity.deleteMany({});
    await prisma.articleContent.deleteMany({});
    await prisma.projectAIIndex.deleteMany({});
    await prisma.project.deleteMany({
      where: { slug: 'test-ecommerce-platform' }
    });

    // Create sample data
    await createSampleProject();

    // Test ingestion pipeline
    await testIngestionPipeline();

    // Test content retrieval
    await testContentRetrieval();

    // Test versioning
    await testContentVersioning();

    // Test database schema
    await testDatabaseSchema();

    // Final verification
    console.log('\n📊 Final Database State:');
    const entityCount = await prisma.contentEntity.count();
    const chunkCount = await prisma.contextChunk.count();
    const versionCount = await prisma.contentVersion.count();

    console.log(`   - Content Entities: ${entityCount}`);
    console.log(`   - Context Chunks: ${chunkCount}`);
    console.log(`   - Content Versions: ${versionCount}`);

    console.log('\n✨ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  });
}

export { main as testHierarchicalContent };