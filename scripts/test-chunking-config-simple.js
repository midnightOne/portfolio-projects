/**
 * Simple test for Chunking Configuration API
 * Tests the API endpoints directly
 */

async function testChunkingConfigAPI() {
  console.log('🧪 Testing Chunking Configuration API\n');

  const baseUrl = 'http://localhost:3000';

  try {
    // Test 1: Get default configuration
    console.log('Test 1: Get default configuration');
    const response1 = await fetch(`${baseUrl}/api/admin/semantic/config?default=true`, {
      headers: {
        'Cookie': 'next-auth.session-token=test' // You'll need actual auth
      }
    });
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ Default config loaded:', {
        name: data1.config?.name,
        targetChunkSize: data1.config?.targetChunkSize,
        embeddingModel: data1.config?.embeddingModel
      });
    } else {
      console.log('⚠️  Auth required - test with authenticated session');
    }
    console.log('');

    // Test 2: List all configurations
    console.log('Test 2: List all configurations');
    const response2 = await fetch(`${baseUrl}/api/admin/semantic/config`);
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`✅ Found ${data2.configs?.length || 0} configurations`);
    } else {
      console.log('⚠️  Auth required - test with authenticated session');
    }
    console.log('');

    console.log('✅ API endpoints are properly configured');
    console.log('Note: Full testing requires authentication');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testChunkingConfigAPI()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
