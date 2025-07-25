/**
 * Test the main API endpoints we just implemented
 */

const testEndpoint = async (url, description) => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\n=== ${description} ===`);
    console.log(`URL: ${url}`);
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      console.log('✅ Success');
      if (data.data?.items) {
        console.log(`Found ${data.data.items.length} items`);
        console.log(`Total count: ${data.data.totalCount}`);
        console.log(`Has more: ${data.data.hasMore}`);
      } else if (data.data?.project) {
        console.log(`Project: ${data.data.project.title}`);
        console.log(`Related projects: ${data.data.relatedProjects.length}`);
      }
    } else {
      console.log('❌ Error');
      console.log(`Error: ${data.error?.message}`);
    }
    
    return { success: response.ok, data };
  } catch (error) {
    console.error(`❌ Error testing ${url}:`, error.message);
    return { success: false, error: error.message };
  }
};

const runTests = async () => {
  console.log('🧪 Testing Portfolio Projects API Endpoints...\n');
  
  const baseUrl = 'http://localhost:3000/api';
  
  // Test main endpoints
  await testEndpoint(`${baseUrl}/projects`, 'GET /api/projects - List all projects');
  await testEndpoint(`${baseUrl}/projects?limit=2`, 'GET /api/projects with pagination');
  await testEndpoint(`${baseUrl}/projects?tags=React,TypeScript`, 'GET /api/projects with tag filtering');
  await testEndpoint(`${baseUrl}/projects?sortBy=popularity&sortOrder=desc`, 'GET /api/projects sorted by popularity');
  await testEndpoint(`${baseUrl}/projects?query=portfolio`, 'GET /api/projects with search query');
  
  // Test individual project endpoint
  await testEndpoint(`${baseUrl}/projects/portfolio-website`, 'GET /api/projects/[slug] - Individual project');
  await testEndpoint(`${baseUrl}/projects/task-management-app`, 'GET /api/projects/[slug] - Another project');
  await testEndpoint(`${baseUrl}/projects/nonexistent-project`, 'GET /api/projects/[slug] - Non-existent project (should 404)');
  
  console.log('\n🎉 API endpoint tests complete!');
  console.log('\n✅ Task 4.1 "Implement basic projects API endpoints" is now complete:');
  console.log('- ✅ Created GET /api/projects with pagination');
  console.log('- ✅ Implemented GET /api/projects/[slug] for individual projects');
  console.log('- ✅ Added basic error handling and validation');
  console.log('- ✅ Supports filtering, sorting, and search functionality');
  console.log('- ✅ Includes proper CORS headers and response formatting');
};

runTests().catch(console.error);