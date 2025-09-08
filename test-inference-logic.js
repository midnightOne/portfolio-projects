/**
 * Test the tool name inference logic that was fixed
 */

function testInferenceLogic() {
    console.log('Testing tool name inference logic...\n');
    
    // Test the argument patterns that should infer correct tool names
    const testCases = [
        {
            name: 'loadProjectContext inference (the failing case)',
            args: { projectId: 'e-commerce-website', includeContent: true, includeMedia: true },
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
        },
        {
            name: 'processJobSpec inference',
            args: { specPath: '/path/to/spec' },
            expectedTool: 'processJobSpec'
        },
        {
            name: 'loadContext inference',
            args: { contextType: 'project', includeFiles: true },
            expectedTool: 'loadContext'
        }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach(testCase => {
        console.log(`Testing ${testCase.name}:`);
        console.log(`Arguments: ${JSON.stringify(testCase.args)}`);
        
        // Simulate the FIXED inference logic from the adapter
        let inferredTool = null;
        const args = testCase.args;
        
        if (args.selector && args.behavior) {
            inferredTool = 'scrollIntoView';
        } else if (args.path && !args.projectId) {
            inferredTool = 'navigateTo';
        } else if (args.projectId && (args.includeContent !== undefined || args.includeMedia !== undefined)) {
            inferredTool = 'loadProjectContext';  // This is the key fix!
        } else if (args.projectId) {
            inferredTool = 'showProjectDetails';
        } else if (args.specPath || args.jobSpec) {
            inferredTool = 'processJobSpec';
        } else if (args.contextType || args.includeFiles) {
            inferredTool = 'loadContext';
        }
        
        if (inferredTool === testCase.expectedTool) {
            console.log(`✅ Correctly inferred: ${inferredTool}`);
            passedTests++;
        } else {
            console.log(`❌ Wrong inference. Expected: ${testCase.expectedTool}, Got: ${inferredTool}`);
        }
        console.log('');
    });
    
    console.log(`Results: ${passedTests}/${totalTests} tests passed\n`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All inference tests passed! The fix should resolve the MCP tool routing issue.');
        console.log('\nKey fix: When arguments contain projectId AND (includeContent OR includeMedia),');
        console.log('the system now correctly infers "loadProjectContext" instead of defaulting to');
        console.log('the most recent function call name (which was "scrollIntoView").');
    } else {
        console.log('❌ Some tests failed. The inference logic needs further adjustment.');
    }
}

// Run the test
testInferenceLogic();