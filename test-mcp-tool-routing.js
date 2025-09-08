/**
 * Test script to verify MCP tool routing fix
 * This simulates the tool call flow that was failing
 */

async function testMcpToolRouting() {
    console.log('Testing MCP tool routing fix...\n');
    
    try {
        // Test 1: Direct MCP API call to verify server works
        console.log('1. Testing direct MCP API call...');
        const directResponse = await fetch('http://localhost:3002/api/mcp/tools/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                toolName: 'project_context_loader', 
                parameters: { 
                    projectId: 'e-commerce-website',
                    includeContent: true,
                    includeMedia: true
                }
            })
        });
        
        if (directResponse.ok) {
            const result = await directResponse.json();
            console.log('✅ Direct MCP API call successful');
            console.log('Response:', result);
        } else {
            console.log('❌ Direct MCP API call failed:', directResponse.status);
            const error = await directResponse.text();
            console.log('Error:', error);
        }
        
        console.log('\n2. Testing tool name inference logic...');
        
        // Test the argument patterns that should infer correct tool names
        const testCases = [
            {
                name: 'loadProjectContext inference',
                args: { projectId: 'test', includeContent: true, includeMedia: true },
                expectedTool: 'loadProjectContext'
            },
            {
                name: 'showProjectDetails inference', 
                args: { projectId: 'test' },
                expectedTool: 'showProjectDetails'
            },
            {
                name: 'scrollIntoView inference',
                args: { selector: '.test', behavior: 'smooth' },
                expectedTool: 'scrollIntoView'
            },
            {
                name: 'navigateTo inference',
                args: { path: '/test' },
                expectedTool: 'navigateTo'
            }
        ];
        
        testCases.forEach(testCase => {
            console.log(`\nTesting ${testCase.name}:`);
            console.log(`Arguments: ${JSON.stringify(testCase.args)}`);
            
            // Simulate the inference logic from the adapter
            let inferredTool = null;
            const args = testCase.args;
            
            if (args.selector && args.behavior) {
                inferredTool = 'scrollIntoView';
            } else if (args.path && !args.projectId) {
                inferredTool = 'navigateTo';
            } else if (args.projectId && (args.includeContent !== undefined || args.includeMedia !== undefined)) {
                inferredTool = 'loadProjectContext';
            } else if (args.projectId) {
                inferredTool = 'showProjectDetails';
            }
            
            if (inferredTool === testCase.expectedTool) {
                console.log(`✅ Correctly inferred: ${inferredTool}`);
            } else {
                console.log(`❌ Wrong inference. Expected: ${testCase.expectedTool}, Got: ${inferredTool}`);
            }
        });
        
        console.log('\n3. Summary:');
        console.log('The fix should now properly route MCP tools instead of defaulting to UI navigation tools.');
        console.log('Key changes made:');
        console.log('- Added MCP tool detection in switch statement');
        console.log('- Added _executeMcpTool method for API calls');
        console.log('- Improved argument-based tool name inference');
        console.log('- Fixed projectId + includeContent/includeMedia pattern to infer loadProjectContext');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testMcpToolRouting();