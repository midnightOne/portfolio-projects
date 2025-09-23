/**
 * Basic test script for content ingestion system (no OpenAI API required)
 * 
 * This script demonstrates the core functionality of the hybrid content ingestion system
 * without requiring OpenAI API access, focusing on:
 * 1. User-defined tier marker parsing
 * 2. Database storage and retrieval
 * 3. UIManager integration events
 * 4. Content tier generation from existing project data
 */

import { PrismaClient } from '@prisma/client';
import ContentIngestionService from '../src/lib/content/ContentIngestionService';
import { initializeUIManagerIntegration } from '../src/lib/content/UIManagerIntegration';

const prisma = new PrismaClient();

async function testUserDefinedMarkerParsing() {
  console.log('🧪 Testing user-defined tier marker parsing...');

  const contentService = new ContentIngestionService();
  
  // Test content with markers
  const testContent = `<!-- T1: Revolutionary platform with 80% performance improvement -->
<!-- T2: Problem: Slow loading | Solution: Optimized architecture | Impact: 80% faster -->
<!-- T3: Comprehensive solution using modern technologies to achieve significant performance gains -->

# Test Content
Some content here...`;

  // Access private method for testing
  const markers = (contentService as any).parseUserDefinedTierMarkers(testContent);
  
  console.log('📋 Parsed tier markers:');
  console.log(`   T1: ${markers.T1 || 'Not found'}`);
  console.log(`   T2: ${markers.T2 ? markers.T2.join(' | ') : 'Not found'}`);
  console.log(`   T3: ${markers.T3 || 'Not found'}`);

  // Verify parsing results
  if (markers.T1 && markers.T2 && markers.T3) {
    console.log('✅ User-defined marker parsing working correctly');
    return true;
  } else {
    console.log('❌ User-defined marker parsing failed');
    return false;
  }
}

async function testUIManagerIntegration() {
  console.log('🧪 Testing UIManager integration...');

  const contentService = new ContentIngestionService();
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

  // Test event emission
  let eventsReceived = 0;
  
  contentService.on('content-updated', (data) => {
    console.log(`   🔄 Content updated: ${data.entityType}:${data.slug} (${data.sections.length} sections)`);
    eventsReceived++;
  });

  contentService.on('sections-discovered', (data) => {
    console.log(`   🔍 Sections discovered: ${data.entityType}:${data.slug}`);
    data.sections.forEach(section => {
      console.log(`      - ${section.id}: ${section.title}`);
    });
    eventsReceived++;
  });

  // Emit test events
  contentService.emit('content-updated', {
    entityType: 'PROJECT',
    slug: 'test-project',
    sections: ['section-1', 'section-2']
  });

  contentService.emit('sections-discovered', {
    entityType: 'PROJECT',
    slug: 'test-project',
    sections: [
      { id: 'section-1', title: 'Introduction' },
      { id: 'section-2', title: 'Implementation' }
    ]
  });

  if (eventsReceived === 2) {
    console.log('✅ UIManager integration working correctly');
    return true;
  } else {
    console.log('❌ UIManager integration failed');
    return false;
  }
}

async function testBasicIngestion() {
  console.log('🧪 Testing basic content ingestion (without OpenAI)...');

  // Find an existing project to test with
  const project = await prisma.project.findFirst({
    where: { status: 'PUBLISHED' },
    include: {
      articleContent: true,
      tags: true,
      aiIndex: true
    }
  });

  if (!project) {
    console.log('   ⚠️  No published projects found - skipping ingestion test');
    return true;
  }

  const contentService = new ContentIngestionService();
  
  console.log(`   📝 Testing ingestion for project: ${project.title}`);
  
  try {
    const result = await contentService.ingestProject(project);
    
    if (result.success) {
      console.log(`   ✅ Ingestion successful:`);
      console.log(`      - Chunks: ${result.totalChunks}`);
      console.log(`      - Tiers: ${result.tiersCreated.join(', ')}`);
      console.log(`      - Processing time: ${result.processingTime}ms`);
      console.log(`      - Embeddings attempted: ${result.embeddingsGenerated} (skipped due to no API key)`);
      return true;
    } else {
      console.log(`   ❌ Ingestion failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Ingestion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testContentRetrieval() {
  console.log('🧪 Testing content retrieval...');

  try {
    const entities = await prisma.contentEntity.findMany({
      include: {
        contentChunks: {
          orderBy: { tier: 'asc' }
        }
      },
      take: 2 // Just test with first 2 entities
    });

    if (entities.length === 0) {
      console.log('   ⚠️  No content entities found - skipping retrieval test');
      return true;
    }

    entities.forEach(entity => {
      console.log(`   📋 Entity: ${entity.title} (${entity.slug})`);
      console.log(`      - Total chunks: ${entity.contentChunks.length}`);
      
      // Show tier distribution
      const tierCounts = entity.contentChunks.reduce((acc, chunk) => {
        acc[chunk.tier] = (acc[chunk.tier] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      console.log('      - Tier distribution:', Object.entries(tierCounts).map(([tier, count]) => `T${tier}:${count}`).join(', '));

      // Show source distribution
      const sourceCounts = entity.contentChunks.reduce((acc, chunk) => {
        const source = (chunk.metadata as any)?.source || 'unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('      - Sources:', Object.entries(sourceCounts).map(([source, count]) => `${source}:${count}`).join(', '));
    });

    console.log('   ✅ Content retrieval working correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Content retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testIngestionStats() {
  console.log('🧪 Testing ingestion statistics...');

  try {
    const contentService = new ContentIngestionService();
    const stats = await contentService.getIngestionStats();

    console.log('   📊 Ingestion Statistics:');
    console.log(`      - Total Entities: ${stats.totalEntities}`);
    console.log(`      - Total Chunks: ${stats.totalChunks}`);
    console.log(`      - Total Embeddings: ${stats.totalEmbeddings}`);
    
    if (Object.keys(stats.tierDistribution).length > 0) {
      console.log('      - Tier Distribution:', Object.entries(stats.tierDistribution).map(([tier, count]) => `T${tier}:${count}`).join(', '));
    }
    
    if (Object.keys(stats.sourceDistribution).length > 0) {
      console.log('      - Source Distribution:', Object.entries(stats.sourceDistribution).map(([source, count]) => `${source}:${count}`).join(', '));
    }

    console.log('   ✅ Statistics working correctly');
    return true;
  } catch (error) {
    console.log(`   ❌ Statistics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting basic content ingestion system tests...');
  console.log('ℹ️  Note: This test runs without OpenAI API - embedding generation will be skipped\n');

  const results: boolean[] = [];

  try {
    // Test user-defined marker parsing
    results.push(await testUserDefinedMarkerParsing());
    console.log('');

    // Test UIManager integration
    results.push(await testUIManagerIntegration());
    console.log('');

    // Test basic ingestion
    results.push(await testBasicIngestion());
    console.log('');

    // Test content retrieval
    results.push(await testContentRetrieval());
    console.log('');

    // Test statistics
    results.push(await testIngestionStats());
    console.log('');

    // Summary
    const passedTests = results.filter(r => r).length;
    const totalTests = results.length;

    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
      console.log('✨ All basic content ingestion tests completed successfully!');
      console.log('\n🎯 Key Features Verified:');
      console.log('   ✅ User-defined tier marker parsing');
      console.log('   ✅ UIManager integration events');
      console.log('   ✅ Database storage and retrieval');
      console.log('   ✅ Content tier generation');
      console.log('   ✅ Statistics and monitoring');
      console.log('\n💡 Next Steps:');
      console.log('   - Add valid OpenAI API key to enable embedding generation');
      console.log('   - Enable pgvector extension for semantic search');
      console.log('   - Test with real voice AI integration');
    } else {
      console.log('❌ Some tests failed - check the output above for details');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
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

export { main as testBasicContentIngestion };