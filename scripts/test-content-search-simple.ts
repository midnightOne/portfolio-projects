/**
 * Simple Content Search Test
 */

import ContentSearchService from '../src/lib/content/ContentSearchService';

async function testSearch() {
  console.log('🔍 Testing ContentSearchService...');
  
  const service = new ContentSearchService();
  
  try {
    // Test basic search
    console.log('\n1. Testing basic search...');
    const result1 = await service.searchContent({
      query: 'portfolio',
      k: 3,
      maxTier: 2
    });
    console.log(`✅ Basic search: ${result1.items.length} results found`);
    console.log('Search metadata:', result1.searchMetadata);
    
    // Test search stats
    console.log('\n2. Testing search stats...');
    const stats = await service.getSearchStats();
    console.log('✅ Search stats:', stats);
    
    // Test content retrieval if we have results
    if (result1.items.length > 0) {
      console.log('\n3. Testing content retrieval...');
      const contentIds = result1.items.slice(0, 2).map(item => item.id);
      const contentResult = await service.getContent({
        ids: contentIds,
        maxTokens: 500
      });
      console.log(`✅ Content retrieval: ${contentResult.items.length} items, ${contentResult.totalTokens} tokens`);
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSearch().catch(console.error);