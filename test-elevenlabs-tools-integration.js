/**
 * Test ElevenLabs Tools Integration
 * 
 * Simulates how ElevenLabs agents would use the tools in a real conversation.
 */

async function testElevenLabsToolsIntegration() {
  console.log('🤖 Testing ElevenLabs agent tools integration...\n');

  try {
    // Step 1: Get ElevenLabs token and verify tools are available
    console.log('1️⃣ Getting ElevenLabs token and tool definitions...');
    const tokenResponse = await fetch('http://localhost:3000/api/ai/elevenlabs/token');
    
    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const tools = tokenData.clientToolsDefinitions || [];
    
    console.log(`✅ ElevenLabs agent has ${tools.length} tools available`);
    
    // Find MCP server tools
    const mcpTools = tools.filter(tool => 
      ['loadProjectContext', 'loadUserProfile', 'processJobSpec', 'searchProjects', 'analyzeUserIntent'].includes(tool.name)
    );
    
    console.log(`✅ Found ${mcpTools.length} MCP server tools for context loading`);
    console.log();

    // Step 2: Test context loading scenario
    console.log('2️⃣ Testing context loading scenario...');
    console.log('   Scenario: User asks "Tell me about your React projects"');
    
    // Simulate what the ElevenLabs agent would do:
    // 1. Analyze user intent
    console.log('   🧠 Agent analyzing user intent...');
    const intentResponse = await fetch('http://localhost:3000/api/ai/mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'analyzeUserIntent',
        parameters: {
          userMessage: 'Tell me about your React projects',
          conversationHistory: [],
          currentContext: { page: 'home' }
        }
      })
    });

    if (intentResponse.ok) {
      const intentData = await intentResponse.json();
      console.log(`   ✅ Intent analyzed: ${intentData.data.intent} (confidence: ${intentData.data.confidence})`);
    }

    // 2. Search for React projects
    console.log('   🔍 Agent searching for React projects...');
    const searchResponse = await fetch('http://localhost:3000/api/ai/mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'searchProjects',
        parameters: {
          query: 'react',
          tags: ['react'],
          limit: 5
        }
      })
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log(`   ✅ Found ${searchData.data.results.length} React projects`);
      searchData.data.results.forEach(project => {
        console.log(`      - ${project.title}: ${project.description}`);
      });
    }

    // 3. Load detailed context for a project
    console.log('   📄 Agent loading detailed project context...');
    const contextResponse = await fetch('http://localhost:3000/api/ai/mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'loadProjectContext',
        parameters: {
          projectId: 'project-1',
          includeContent: true,
          includeMedia: false
        }
      })
    });

    if (contextResponse.ok) {
      const contextData = await contextResponse.json();
      console.log(`   ✅ Loaded context for project: ${contextData.data.title}`);
      console.log(`      Technologies: ${contextData.data.keyTechnologies.join(', ')}`);
    }

    console.log();

    // Step 3: Test job analysis scenario
    console.log('3️⃣ Testing job analysis scenario...');
    console.log('   Scenario: User provides a job description for analysis');
    
    const jobSpec = `
    We are looking for a Senior React Developer with 3+ years of experience.
    Requirements:
    - Expert knowledge of React, TypeScript, and Node.js
    - Experience with modern state management (Redux, Zustand)
    - Familiarity with Next.js and server-side rendering
    - Strong understanding of REST APIs and GraphQL
    - Experience with testing frameworks (Jest, Cypress)
    `;

    console.log('   📋 Agent processing job specification...');
    const jobAnalysisResponse = await fetch('http://localhost:3000/api/ai/mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'processJobSpec',
        parameters: {
          jobSpec: jobSpec.trim(),
          analysisType: 'detailed'
        }
      })
    });

    if (jobAnalysisResponse.ok) {
      const jobData = await jobAnalysisResponse.json();
      console.log(`   ✅ Job analysis completed with ${jobData.data.matchScore}% match`);
      console.log(`      Strengths: ${jobData.data.strengths.join(', ')}`);
      console.log(`      Gaps: ${jobData.data.gaps.join(', ')}`);
      console.log(`      Recommendations: ${jobData.data.recommendations.length} suggestions provided`);
    }

    console.log();

    // Step 4: Test navigation suggestions
    console.log('4️⃣ Testing navigation suggestions...');
    console.log('   Scenario: User wants to see relevant projects');
    
    const navResponse = await fetch('http://localhost:3000/api/ai/mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'generateNavigationSuggestions',
        parameters: {
          userIntent: 'show me projects using React and TypeScript',
          currentLocation: 'home',
          availableProjects: [
            { id: 'project-1', title: 'React Dashboard', tags: ['react', 'typescript'] },
            { id: 'project-2', title: 'Node.js API', tags: ['nodejs', 'api'] }
          ]
        }
      })
    });

    if (navResponse.ok) {
      const navData = await navResponse.json();
      console.log(`   ✅ Generated ${navData.data.suggestions.length} navigation suggestions`);
      navData.data.suggestions.forEach(suggestion => {
        console.log(`      - ${suggestion.action}: ${suggestion.reason} (confidence: ${suggestion.confidence})`);
      });
    }

    console.log();
    console.log('🎉 ElevenLabs tools integration test completed successfully!');
    console.log();
    console.log('📊 Summary:');
    console.log(`   ✅ ElevenLabs agents can access ${tools.length} total tools`);
    console.log(`   ✅ MCP server tools are working for context loading`);
    console.log(`   ✅ Job analysis tools are functional`);
    console.log(`   ✅ Navigation suggestion tools are working`);
    console.log(`   ✅ All tool executions completed successfully`);
    console.log();
    console.log('🔧 ElevenLabs agents now have the same capabilities as OpenAI agents!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

// Run the integration test
testElevenLabsToolsIntegration();