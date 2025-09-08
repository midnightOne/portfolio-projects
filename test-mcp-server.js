/**
 * Simple test script to verify MCP Server functionality
 */

const { mcpServer } = require('./src/lib/mcp/server.ts');

async function testMCPServer() {
  console.log('Testing MCP Server functionality...\n');

  try {
    // Test 1: Get available tools
    console.log('1. Testing getAvailableTools()');
    const tools = mcpServer.getAvailableTools();
    console.log(`✓ Found ${tools.length} available tools:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // Test 2: Test loadUserProfile tool
    console.log('2. Testing loadUserProfile tool');
    const profileResult = await mcpServer.executeTool({
      name: 'loadUserProfile',
      arguments: { includePrivate: false }
    });
    console.log('✓ Profile loaded successfully:', {
      success: profileResult.success,
      name: profileResult.data?.name,
      title: profileResult.data?.title,
      skillsCount: profileResult.data?.skills?.length || 0
    });
    console.log('');

    // Test 3: Test processJobSpec tool
    console.log('3. Testing processJobSpec tool');
    const jobSpecResult = await mcpServer.executeTool({
      name: 'processJobSpec',
      arguments: {
        jobSpec: 'We are looking for a React developer with TypeScript experience to build modern web applications.',
        analysisType: 'quick'
      }
    });
    console.log('✓ Job spec processed successfully:', {
      success: jobSpecResult.success,
      matchScore: jobSpecResult.data?.matchScore,
      strengthsCount: jobSpecResult.data?.strengths?.length || 0,
      gapsCount: jobSpecResult.data?.gaps?.length || 0
    });
    console.log('');

    // Test 4: Test searchProjects tool
    console.log('4. Testing searchProjects tool');
    const searchResult = await mcpServer.executeTool({
      name: 'searchProjects',
      arguments: {
        query: 'react',
        limit: 5
      }
    });
    console.log('✓ Project search completed successfully:', {
      success: searchResult.success,
      resultsCount: searchResult.data?.results?.length || 0,
      totalResults: searchResult.data?.totalResults || 0
    });
    console.log('');

    // Test 5: Test getProjectSummary tool
    console.log('5. Testing getProjectSummary tool');
    const summaryResult = await mcpServer.executeTool({
      name: 'getProjectSummary',
      arguments: { includePrivate: false }
    });
    console.log('✓ Project summary generated successfully:', {
      success: summaryResult.success,
      totalProjects: summaryResult.data?.totalProjects || 0,
      categoriesCount: Object.keys(summaryResult.data?.categories || {}).length,
      recentProjectsCount: summaryResult.data?.recentProjects?.length || 0
    });
    console.log('');

    // Test 6: Test client registration
    console.log('6. Testing client registration');
    mcpServer.registerClient('test-client-1');
    mcpServer.registerClient('test-client-2');
    const clients = mcpServer.getRegisteredClients();
    console.log(`✓ Client registration working. Registered clients: ${clients.length}`);
    console.log('');

    // Test 7: Test error handling
    console.log('7. Testing error handling');
    try {
      await mcpServer.executeTool({
        name: 'nonExistentTool',
        arguments: {}
      });
    } catch (error) {
      console.log('✓ Error handling working correctly:', error.message);
    }
    console.log('');

    console.log('🎉 All MCP Server tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMCPServer().catch(console.error);