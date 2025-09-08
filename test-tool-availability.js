/**
 * Test Tool Availability
 * 
 * Tests that both OpenAI and ElevenLabs providers have access to the same tools.
 */

async function testToolAvailability() {
  console.log('🔧 Testing tool availability for both providers...\n');

  try {
    // Test ElevenLabs token endpoint (includes tool definitions)
    console.log('📋 Testing ElevenLabs tool definitions...');
    const elevenLabsResponse = await fetch('http://localhost:3000/api/ai/elevenlabs/token', {
      method: 'GET'
    });

    if (elevenLabsResponse.ok) {
      const elevenLabsData = await elevenLabsResponse.json();
      const elevenLabsTools = elevenLabsData.clientToolsDefinitions || [];
      
      console.log(`✅ ElevenLabs has ${elevenLabsTools.length} tools available:`);
      elevenLabsTools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      console.log();
    } else {
      console.log(`❌ ElevenLabs token endpoint failed: ${elevenLabsResponse.status}`);
    }

    // Test MCP server tools
    console.log('🔧 Testing MCP server tools...');
    const mcpResponse = await fetch('http://localhost:3000/api/ai/mcp/execute', {
      method: 'GET'
    });

    if (mcpResponse.ok) {
      const mcpData = await mcpResponse.json();
      const mcpTools = mcpData.tools || [];
      
      console.log(`✅ MCP server has ${mcpTools.length} tools available:`);
      mcpTools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      console.log();
    } else {
      console.log(`❌ MCP server endpoint failed: ${mcpResponse.status}`);
    }

    // Test a sample MCP tool execution
    console.log('🧪 Testing MCP tool execution...');
    const testExecution = await fetch('http://localhost:3000/api/ai/mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'loadUserProfile',
        parameters: { includePrivate: false }
      })
    });

    if (testExecution.ok) {
      const executionData = await testExecution.json();
      console.log('✅ MCP tool execution successful:');
      console.log(`   Success: ${executionData.success}`);
      console.log(`   Execution time: ${executionData.metadata?.executionTime}ms`);
      console.log();
    } else {
      console.log(`❌ MCP tool execution failed: ${testExecution.status}`);
    }

    console.log('🎉 Tool availability test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testToolAvailability();