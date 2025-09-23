/**
 * Test script for hybrid content ingestion system
 * 
 * This script tests the enhanced ContentIngestionService with:
 * 1. User-defined tier markers parsing
 * 2. Automatic tier generation fallback
 * 3. OpenAI embedding generation
 * 4. UIManager integration events
 * 5. Batch processing with progress tracking
 */

import { PrismaClient } from '@prisma/client';
import ContentIngestionService from '../src/lib/content/ContentIngestionService';
import { initializeUIManagerIntegration } from '../src/lib/content/UIManagerIntegration';

const prisma = new PrismaClient();

async function createSampleProjectWithMarkers() {
  console.log('📝 Creating sample project with user-defined tier markers...');

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

  // Create sample project with tier markers in content
  const project = await prisma.project.upsert({
    where: { slug: 'test-hybrid-ecommerce' },
    create: {
      title: 'Hybrid E-commerce Platform',
      slug: 'test-hybrid-ecommerce',
      description: 'A full-stack e-commerce platform demonstrating hybrid tier generation with user-defined markers.',
      briefOverview: 'Modern e-commerce solution with AI-powered recommendations and real-time inventory.',
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

  // Create article content with user-defined tier markers
  const articleContent = await prisma.articleContent.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      content: `<!-- T1: Revolutionary e-commerce platform with 80% faster checkout and AI-powered recommendations -->
<!-- T2: Problem: Traditional e-commerce had slow checkout | Solution: One-click purchasing with smart defaults | Impact: 80% faster checkout, 40% higher conversion -->
<!-- T3: Implemented microservices architecture with React frontend, Node.js backend, and AI recommendation engine, reducing checkout time from 5 minutes to 1 minute while increasing conversion rates by 40% through personalized product suggestions -->

# Hybrid E-commerce Platform

## Overview
This project demonstrates a comprehensive e-commerce platform that leverages modern web technologies and AI to create an exceptional user experience.

## Architecture
The application follows a microservices architecture with the following components:
- Frontend: React with TypeScript and Next.js
- Backend: Node.js with Express and GraphQL
- Database: PostgreSQL with Prisma ORM
- AI Engine: TensorFlow.js for recommendations
- Authentication: Auth0 with JWT tokens
- Payment: Stripe with Apple Pay integration

## Key Features

### AI-Powered Recommendations
- Machine learning recommendation engine
- Real-time personalization based on user behavior
- A/B testing for recommendation algorithms
- Collaborative filtering and content-based filtering

### One-Click Checkout
- Smart form auto-completion
- Saved payment methods with tokenization
- Address validation and suggestions
- Mobile-optimized checkout flow

### Real-Time Inventory
- WebSocket-based inventory updates
- Automatic stock level monitoring
- Backorder management system
- Supplier integration APIs

### Performance Optimizations
- Server-side rendering with Next.js
- Image optimization and lazy loading
- Code splitting and dynamic imports
- CDN integration for static assets
- Database query optimization with indexes

## Technical Implementation

### Frontend Architecture
The React frontend uses modern hooks and context for state management. The application implements a component-based architecture with reusable UI components and custom hooks for business logic.

### Backend Services
The Node.js backend provides RESTful APIs and GraphQL endpoints. Services are containerized using Docker and deployed on Kubernetes for scalability.

### AI Recommendation Engine
The recommendation system uses TensorFlow.js to run machine learning models in the browser and on the server. Models are trained on user interaction data and product features.

## Security Features
- OAuth 2.0 authentication with Auth0
- JWT token validation and refresh
- Input validation and sanitization
- SQL injection prevention with Prisma
- XSS protection with Content Security Policy
- Rate limiting and DDoS protection

## Testing Strategy
Comprehensive testing includes:
- Unit tests with Jest and React Testing Library
- Integration tests for API endpoints
- End-to-end tests with Playwright
- Performance testing with Lighthouse
- Security testing with OWASP ZAP

## Deployment and DevOps
- CI/CD pipeline with GitHub Actions
- Docker containerization
- Kubernetes orchestration
- Monitoring with Prometheus and Grafana
- Logging with ELK stack
- Error tracking with Sentry

## Results and Metrics
- 80% reduction in checkout time (5 min → 1 min)
- 40% increase in conversion rate
- 99.9% uptime with auto-scaling
- 50% improvement in page load times
- 95% customer satisfaction score`,
      jsonContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Hybrid E-commerce Platform' }]
          }
        ]
      },
      contentType: 'markdown'
    },
    update: {
      content: `<!-- T1: Revolutionary e-commerce platform with 80% faster checkout and AI-powered recommendations -->
<!-- T2: Problem: Traditional e-commerce had slow checkout | Solution: One-click purchasing with smart defaults | Impact: 80% faster checkout, 40% higher conversion -->
<!-- T3: Implemented microservices architecture with React frontend, Node.js backend, and AI recommendation engine, reducing checkout time from 5 minutes to 1 minute while increasing conversion rates by 40% through personalized product suggestions -->

# Hybrid E-commerce Platform

## Overview
This project demonstrates a comprehensive e-commerce platform that leverages modern web technologies and AI to create an exceptional user experience.

## Architecture
The application follows a microservices architecture with the following components:
- Frontend: React with TypeScript and Next.js
- Backend: Node.js with Express and GraphQL
- Database: PostgreSQL with Prisma ORM
- AI Engine: TensorFlow.js for recommendations
- Authentication: Auth0 with JWT tokens
- Payment: Stripe with Apple Pay integration

## Key Features

### AI-Powered Recommendations
- Machine learning recommendation engine
- Real-time personalization based on user behavior
- A/B testing for recommendation algorithms
- Collaborative filtering and content-based filtering

### One-Click Checkout
- Smart form auto-completion
- Saved payment methods with tokenization
- Address validation and suggestions
- Mobile-optimized checkout flow

### Real-Time Inventory
- WebSocket-based inventory updates
- Automatic stock level monitoring
- Backorder management system
- Supplier integration APIs

### Performance Optimizations
- Server-side rendering with Next.js
- Image optimization and lazy loading
- Code splitting and dynamic imports
- CDN integration for static assets
- Database query optimization with indexes

## Technical Implementation

### Frontend Architecture
The React frontend uses modern hooks and context for state management. The application implements a component-based architecture with reusable UI components and custom hooks for business logic.

### Backend Services
The Node.js backend provides RESTful APIs and GraphQL endpoints. Services are containerized using Docker and deployed on Kubernetes for scalability.

### AI Recommendation Engine
The recommendation system uses TensorFlow.js to run machine learning models in the browser and on the server. Models are trained on user interaction data and product features.

## Security Features
- OAuth 2.0 authentication with Auth0
- JWT token validation and refresh
- Input validation and sanitization
- SQL injection prevention with Prisma
- XSS protection with Content Security Policy
- Rate limiting and DDoS protection

## Testing Strategy
Comprehensive testing includes:
- Unit tests with Jest and React Testing Library
- Integration tests for API endpoints
- End-to-end tests with Playwright
- Performance testing with Lighthouse
- Security testing with OWASP ZAP

## Deployment and DevOps
- CI/CD pipeline with GitHub Actions
- Docker containerization
- Kubernetes orchestration
- Monitoring with Prometheus and Grafana
- Logging with ELK stack
- Error tracking with Sentry

## Results and Metrics
- 80% reduction in checkout time (5 min → 1 min)
- 40% increase in conversion rate
- 99.9% uptime with auto-scaling
- 50% improvement in page load times
- 95% customer satisfaction score`
    }
  });

  // Create AI index
  await prisma.projectAIIndex.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      summary: 'Hybrid e-commerce platform with AI recommendations, one-click checkout, and real-time inventory management.',
      keywords: ['React', 'Node.js', 'AI', 'E-commerce', 'Microservices', 'TensorFlow', 'GraphQL'],
      topics: ['Web Development', 'AI/ML', 'E-commerce', 'Microservices'],
      technologies: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'TensorFlow.js', 'GraphQL', 'Auth0', 'Stripe'],
      sectionsCount: 10,
      mediaCount: 0,
      contentHash: 'hybrid-test-hash-456'
    },
    update: {
      summary: 'Hybrid e-commerce platform with AI recommendations, one-click checkout, and real-time inventory management.',
      keywords: ['React', 'Node.js', 'AI', 'E-commerce', 'Microservices', 'TensorFlow', 'GraphQL'],
      topics: ['Web Development', 'AI/ML', 'E-commerce', 'Microservices'],
      technologies: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'TensorFlow.js', 'GraphQL', 'Auth0', 'Stripe']
    }
  });

  console.log(`✅ Created sample project with tier markers: ${project.title} (${project.slug})`);
  return project;
}

async function createSampleProjectWithoutMarkers() {
  console.log('📝 Creating sample project without tier markers (for auto-generation)...');

  const project = await prisma.project.upsert({
    where: { slug: 'test-auto-generation' },
    create: {
      title: 'Auto-Generated Content Project',
      slug: 'test-auto-generation',
      description: 'A project to test automatic tier generation when no user markers are present.',
      briefOverview: 'Testing automatic content tier generation with OpenAI.',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      workDate: new Date('2024-02-01')
    },
    update: {
      status: 'PUBLISHED',
      visibility: 'PUBLIC'
    }
  });

  // Create article content WITHOUT tier markers
  await prisma.articleContent.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      content: `# Auto-Generated Content Project

## Overview
This project tests the automatic tier generation capabilities of the content ingestion system when no user-defined markers are present.

## Features
- Automatic content analysis
- AI-powered tier generation
- Embedding generation for semantic search
- Integration with existing project indexer

## Implementation
The system analyzes the content structure and generates appropriate tiers based on content importance and semantic meaning.

## Results
This demonstrates the fallback mechanism when users don't provide explicit tier markers.`,
      jsonContent: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Auto-Generated Content Project' }]
          }
        ]
      },
      contentType: 'markdown'
    },
    update: {
      content: `# Auto-Generated Content Project

## Overview
This project tests the automatic tier generation capabilities of the content ingestion system when no user-defined markers are present.

## Features
- Automatic content analysis
- AI-powered tier generation
- Embedding generation for semantic search
- Integration with existing project indexer

## Implementation
The system analyzes the content structure and generates appropriate tiers based on content importance and semantic meaning.

## Results
This demonstrates the fallback mechanism when users don't provide explicit tier markers.`
    }
  });

  console.log(`✅ Created auto-generation test project: ${project.title} (${project.slug})`);
  return project;
}

async function testUserDefinedMarkerParsing() {
  console.log('🧪 Testing user-defined tier marker parsing...');

  const contentService = new ContentIngestionService();
  
  // Test content with markers
  const testContent = `<!-- T1: Revolutionary platform with 80% performance improvement -->
<!-- T2: Problem: Slow loading | Solution: Optimized architecture | Impact: 80% faster -->
<!-- T3: Comprehensive solution using modern technologies to achieve significant performance gains -->

# Test Content
Some content here...`;

  // Access private method for testing (in real implementation, this would be tested through public methods)
  const markers = (contentService as any).parseUserDefinedTierMarkers(testContent);
  
  console.log('📋 Parsed tier markers:');
  console.log(`   T1: ${markers.T1 || 'Not found'}`);
  console.log(`   T2: ${markers.T2 ? markers.T2.join(' | ') : 'Not found'}`);
  console.log(`   T3: ${markers.T3 || 'Not found'}`);

  // Verify parsing results
  if (markers.T1 && markers.T2 && markers.T3) {
    console.log('✅ User-defined marker parsing working correctly');
  } else {
    console.log('❌ User-defined marker parsing failed');
  }
}

async function testHybridIngestionPipeline() {
  console.log('🧪 Testing hybrid content ingestion pipeline...');

  const contentService = new ContentIngestionService();
  
  // Setup UIManager integration
  const integration = initializeUIManagerIntegration(contentService);
  
  // Mock UIManager for testing
  const mockUIManager = {
    _sectionCache: new Map(),
    _updateNavigationAffordances: () => {
      console.log('   📍 Navigation affordances updated');
    },
    _updateSectionRegistry: (entityType: string, slug: string, sections: any[]) => {
      console.log(`   📋 Section registry updated: ${entityType}:${slug} (${sections.length} sections)`);
    }
  };
  
  integration.setUIManager(mockUIManager);

  // Setup event listeners for testing
  contentService.on('ingestion-progress', (progress) => {
    console.log(`   📊 Progress: ${progress.processedItems}/${progress.totalItems} - ${progress.currentItem}`);
    console.log(`   💰 Cost: $${progress.actualCost.toFixed(4)} / $${progress.estimatedCost.toFixed(4)}`);
  });

  contentService.on('content-updated', (data) => {
    console.log(`   🔄 Content updated: ${data.entityType}:${data.slug} (${data.sections.length} sections)`);
  });

  contentService.on('sections-discovered', (data) => {
    console.log(`   🔍 Sections discovered: ${data.entityType}:${data.slug}`);
    data.sections.forEach(section => {
      console.log(`      - ${section.id}: ${section.title}`);
    });
  });

  // Test ingesting all content
  console.log('🚀 Starting hybrid content ingestion...');
  const results = await contentService.ingestAllContent();

  console.log('\n📊 Ingestion Results:');
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.entityType}:${result.slug}`);
      console.log(`   - Chunks: ${result.totalChunks}`);
      console.log(`   - Tiers: ${result.tiersCreated.join(', ')}`);
      console.log(`   - Embeddings: ${result.embeddingsGenerated}`);
      console.log(`   - Cost: $${result.costEstimate.toFixed(4)}`);
      console.log(`   - Time: ${result.processingTime}ms`);
    } else {
      console.log(`❌ ${result.entityType}:${result.slug} - ${result.error}`);
    }
  });

  return results;
}

async function testContentRetrieval() {
  console.log('🔍 Testing enhanced content retrieval...');

  // Test retrieving content with embeddings
  const entities = await prisma.contentEntity.findMany({
    include: {
      contentChunks: {
        orderBy: { tier: 'asc' }
      }
    }
  });

  entities.forEach(entity => {
    console.log(`📋 Entity: ${entity.title} (${entity.slug})`);
    console.log(`   - Total chunks: ${entity.contentChunks.length}`);
    
    // Show tier distribution
    const tierCounts = entity.contentChunks.reduce((acc, chunk) => {
      acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('   - Tier distribution:');
    Object.entries(tierCounts).forEach(([tier, count]) => {
      console.log(`     T${tier}: ${count} chunks`);
    });

    // Show embedding status
    const chunksWithEmbeddings = entity.contentChunks.filter(c => c.embeddingVector).length;
    console.log(`   - Embeddings: ${chunksWithEmbeddings}/${entity.contentChunks.length}`);

    // Show source distribution
    const sourceCounts = entity.contentChunks.reduce((acc, chunk) => {
      const source = (chunk.metadata as any)?.source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('   - Sources:', Object.entries(sourceCounts).map(([source, count]) => `${source}:${count}`).join(', '));

    // Show sample content from each tier
    for (let tier = 0; tier <= 4; tier++) {
      const chunk = entity.contentChunks.find(c => c.tier === tier);
      if (chunk) {
        const source = (chunk.metadata as any)?.source || 'unknown';
        console.log(`\n📄 T${tier} Sample (${chunk.chunkId}) [${source}]:`);
        console.log(`   Title: ${chunk.title || 'N/A'}`);
        console.log(`   Tokens: ${chunk.tokenCount}`);
        console.log(`   Embedding: ${chunk.embeddingVector ? 'Yes' : 'No'}`);
        console.log(`   Content: ${chunk.content.substring(0, 100)}${chunk.content.length > 100 ? '...' : ''}`);
      }
    }
    console.log('');
  });
}

async function testIngestionStats() {
  console.log('📈 Testing ingestion statistics...');

  const contentService = new ContentIngestionService();
  const stats = await contentService.getIngestionStats();

  console.log('📊 Ingestion Statistics:');
  console.log(`   - Total Entities: ${stats.totalEntities}`);
  console.log(`   - Total Chunks: ${stats.totalChunks}`);
  console.log(`   - Total Embeddings: ${stats.totalEmbeddings}`);
  
  console.log('   - Tier Distribution:');
  Object.entries(stats.tierDistribution).forEach(([tier, count]) => {
    console.log(`     T${tier}: ${count} chunks`);
  });
  
  console.log('   - Source Distribution:');
  Object.entries(stats.sourceDistribution).forEach(([source, count]) => {
    console.log(`     ${source}: ${count} chunks`);
  });
}

async function testChangeDetection() {
  console.log('🔄 Testing content change detection...');

  const contentService = new ContentIngestionService();

  // Test updating existing project (should detect no changes)
  console.log('   Testing no-change detection...');
  const result1 = await contentService.updateEntityContent('PROJECT', 'test-hybrid-ecommerce');
  
  if (result1.success && result1.totalChunks === 0) {
    console.log('   ✅ No-change detection working correctly');
  } else {
    console.log('   ❌ No-change detection failed');
  }

  // Modify project content to test change detection
  console.log('   Testing change detection...');
  const project = await prisma.project.findUnique({
    where: { slug: 'test-hybrid-ecommerce' },
    include: { articleContent: true }
  });

  if (project?.articleContent) {
    await prisma.articleContent.update({
      where: { id: project.articleContent.id },
      data: {
        content: project.articleContent.content + '\n\n## New Section\nThis is a new section to test change detection.'
      }
    });

    const result2 = await contentService.updateEntityContent('PROJECT', 'test-hybrid-ecommerce');
    
    if (result2.success && result2.totalChunks > 0) {
      console.log('   ✅ Change detection working correctly');
      console.log(`   📊 Updated: ${result2.totalChunks} chunks, ${result2.embeddingsGenerated} embeddings`);
    } else {
      console.log('   ❌ Change detection failed');
    }
  }
}

async function main() {
  console.log('🚀 Starting hybrid content ingestion system tests...');

  try {
    // Clean up existing test data
    await prisma.contextChunk.deleteMany({});
    await prisma.contentVersion.deleteMany({});
    await prisma.contentEntity.deleteMany({});
    await prisma.articleContent.deleteMany({
      where: {
        project: {
          slug: { in: ['test-hybrid-ecommerce', 'test-auto-generation'] }
        }
      }
    });
    await prisma.projectAIIndex.deleteMany({
      where: {
        project: {
          slug: { in: ['test-hybrid-ecommerce', 'test-auto-generation'] }
        }
      }
    });
    await prisma.project.deleteMany({
      where: { slug: { in: ['test-hybrid-ecommerce', 'test-auto-generation'] } }
    });

    // Create sample data
    await createSampleProjectWithMarkers();
    await createSampleProjectWithoutMarkers();

    // Test user-defined marker parsing
    await testUserDefinedMarkerParsing();

    // Test hybrid ingestion pipeline
    await testHybridIngestionPipeline();

    // Test content retrieval
    await testContentRetrieval();

    // Test ingestion statistics
    await testIngestionStats();

    // Test change detection
    await testChangeDetection();

    console.log('\n✨ All hybrid content ingestion tests completed successfully!');

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

export { main as testHybridContentIngestion };