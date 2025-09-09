/**
 * Test the MCP API endpoint directly
 */

async function testMcpApiEndpoint() {
    console.log('Testing MCP API endpoint...\n');
    
    try {
        // Test 1: Get available tools
        console.log('1. Testing GET /api/ai/tools/execute (available tools)...');
        const toolsResponse = await fetch('http://localhost:3002/api/ai/tools/execute', {
            method: 'GET'
        });
        
        if (toolsResponse.ok) {
            const toolsResult = await toolsResponse.json();
            console.log('✅ Available tools retrieved successfully');
            console.log('Tools:', toolsResult.tools?.map(t => t.name) || []);
            console.log('Count:', toolsResult.count);
        } else {
            console.log('❌ Failed to get available tools:', toolsResponse.status);
            const error = await toolsResponse.text();
            console.log('Error:', error);
        }
        
        console.log('\n2. Testing POST /api/ai/tools/execute (loadProjectContext)...');
        
        // Test 2: Execute loadProjectContext tool
        const executeResponse = await fetch('http://localhost:3002/api/ai/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                toolName: 'loadProjectContext', 
                parameters: { 
                    projectId: 'e-commerce-website',
                    includeContent: true,
                    includeMedia: true
                }
            })
        });
        
        if (executeResponse.ok) {
            const executeResult = await executeResponse.json();
            console.log('✅ MCP tool execution successful');
            console.log('Success:', executeResult.success);
            console.log('Data keys:', Object.keys(executeResult.data || {}));
            console.log('Execution time:', executeResult.metadata?.executionTime + 'ms');
        } else {
            console.log('❌ MCP tool execution failed:', executeResponse.status);
            const error = await executeResponse.text();
            console.log('Error:', error);
        }
        
        console.log('\n3. Testing with wrong tool name...');
        
        // Test 3: Test with invalid tool name
        const invalidResponse = await fetch('http://localhost:3002/api/ai/tools/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                toolName: 'nonExistentTool', 
                parameters: {}
            })
        });
        
        if (invalidResponse.ok) {
            const invalidResult = await invalidResponse.json();
            console.log('Response for invalid tool:', invalidResult);
        } else {
            console.log('Invalid tool request status:', invalidResponse.status);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testMcpApiEndpoint();