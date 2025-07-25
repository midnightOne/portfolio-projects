/**
 * Simple test script for API endpoints
 */

const testEndpoint = async (url) => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\n=== Testing ${url} ===`);
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    return { success: response.ok, data };
  } catch (error) {
    console.error(`Error testing ${url}:`, error.message);
    return { success: false, error: error.message };
  }
};

const runTests = async () => {
  console.log('Testing Portfolio Projects API Endpoints...\n');
  
  const baseUrl = 'http://localhost:3000/api';
  
  // Test endpoints
  await testEndpoint(`${baseUrl}/projects/test`);
  await testEndpoint(`${baseUrl}/projects`);
  await testEndpoint(`${baseUrl}/projects?limit=5`);
  await testEndpoint(`${baseUrl}/projects?tags=React,TypeScript`);
  await testEndpoint(`${baseUrl}/projects?sortBy=date&sortOrder=desc`);
  
  // Test individual project (this will likely return 404 since we don't have data)
  await testEndpoint(`${baseUrl}/projects/sample-project`);
  
  console.log('\n=== Tests Complete ===');
};

runTests().catch(console.error);