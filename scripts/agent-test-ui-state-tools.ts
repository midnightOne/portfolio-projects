#!/usr/bin/env tsx

/**
 * Agent Test Script for UI State-aware Content Tools
 * 
 * This script simulates how an AI agent would use the UI state-aware
 * content search and get tools in real scenarios.
 */

import { UIState } from '../src/lib/ai/tools/types';

interface AgentTestScenario {
  name: string;
  description: string;
  userContext: string;
  uiState: UIState;
  agentQuery: string;
  expectedBehavior: string;
}

class AgentUIStateToolsTester {
  private baseUrl = 'http://localhost:3000';
  private scenarios: AgentTestScenario[] = [
    {
      name: 'Project-Focused Search',
      description: 'User is viewing e-commerce project and asks about shopping cart',
      userContext: 'User is on /projects?project=e-commerce-platform viewing shopping cart section',
      uiState: {
        breadcrumbPath: 'home.projects.e-commerce-platform.shopping-cart',
        currentRoute: 'projects',
        currentProject: 'e-commerce-platform',
        visibleAnchors: ['shopping-cart', 'payment-integration'],
        activeFilters: {
          tags: ['ecommerce', 'backend'],
          techStack: ['Node.js', 'React']
        },
        lastUserAction: {
          type: 'scroll',
          timestamp: Date.now()
        }
      },
      agentQuery: 'shopping cart implementation details',
      expectedBehavior: 'Should prioritize e-commerce project content and boost shopping cart related results'
    },
    {
      name: 'Home Page General Search',
      description: 'User is on home page asking about skills',
      userContext: 'User is on home page viewing skills section',
      uiState: {
        breadcrumbPath: 'home.skills',
        currentRoute: 'home',
        visibleAnchors: ['skills', 'technologies', 'experience'],
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      },
      agentQuery: 'React and TypeScript experience',
      expectedBehavior: 'Should prioritize general portfolio content and skills-related information'
    },
    {
      name: 'Filtered Search Context',
      description: 'User has active filters and searches for related content',
      userContext: 'User has filtered projects by "AI" and "Python" tags',
      uiState: {
        breadcrumbPath: 'home.projects',
        currentRoute: 'projects',
        activeFilters: {
          tags: ['ai', 'machine-learning'],
          techStack: ['Python', 'TensorFlow']
        },
        visibleAnchors: ['project-grid'],
        lastUserAction: {
          type: 'filter',
          timestamp: Date.now()
        }
      },
      agentQuery: 'machine learning projects',
      expectedBehavior: 'Should enhance search with active AI/ML filters and boost Python/TensorFlow content'
    },
    {
      name: 'Modal Context Navigation',
      description: 'User has project modal open and asks for specific details',
      userContext: 'User has task management project modal open viewing features tab',
      uiState: {
        breadcrumbPath: 'home.projects.task-management-app.features',
        currentRoute: 'projects',
        currentProject: 'task-management-app',
        currentModal: 'project-modal-task-management-app',
        visibleAnchors: ['features', 'user-interface', 'task-creation'],
        lastUserAction: {
          type: 'navigate',
          timestamp: Date.now()
        }
      },
      agentQuery: 'task creation and management features',
      expectedBehavior: 'Should focus on task management project and generate navigation targets for modal context'
    }
  ];

  async runAgentTests(): Promise<void> {
    console.log('🤖 Starting Agent UI State Tools Tests\n');

    // Check if server is running
    const serverRunning = await this.checkServerHealth();
    if (!serverRunning) {
      console.log('❌ Server not running. Please start the development server first:');
      console.log('   npm run dev\n');
      return;
    }

    console.log('🌐 Server is running. Testing agent scenarios...\n');

    for (let i = 0; i < this.scenarios.length; i++) {
      const scenario = this.scenarios[i];
      console.log(`📋 Scenario ${i + 1}: ${scenario.name}`);
      console.log(`   Context: ${scenario.userContext}`);
      console.log(`   Query: "${scenario.agentQuery}"`);
      console.log(`   Expected: ${scenario.expectedBehavior}\n`);

      await this.testScenario(scenario);
      console.log('─'.repeat(80) + '\n');
    }

    console.log('🎯 **How to test with a real AI agent:**\n');
    this.printAgentInstructions();
  }

  private async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async testScenario(scenario: AgentTestScenario): Promise<void> {
    try {
      // Test content search with UI state
      const searchResponse = await this.callContentSearch(scenario.uiState, scenario.agentQuery);
      
      if (searchResponse.success) {
        console.log('✅ Content Search Results:');
        console.log(`   - Found ${searchResponse.data?.items?.length || 0} results`);
        console.log(`   - UI State Enhanced: ${searchResponse.data?.searchMetadata?.uiStateEnhanced ? 'Yes' : 'No'}`);
        console.log(`   - Context: ${JSON.stringify(searchResponse.data?.searchMetadata?.uiContext || {})}`);
        
        if (searchResponse.data?.items?.length > 0) {
          const topResult = searchResponse.data.items[0];
          console.log(`   - Top Result: "${topResult.title}" (score: ${topResult.score?.toFixed(2)})`);
          console.log(`   - Navigation Target: ${JSON.stringify(topResult.navTarget || {})}`);
          
          // Test content get with the top result
          if (topResult.id) {
            const getResponse = await this.callContentGet(scenario.uiState, [topResult.id]);
            if (getResponse.success) {
              console.log('✅ Content Get Results:');
              console.log(`   - Retrieved ${getResponse.data?.items?.length || 0} items`);
              console.log(`   - UI Context: ${JSON.stringify(getResponse.data?.uiStateContext || {})}`);
              console.log(`   - Navigation Target Generated: ${getResponse.data?.items?.[0]?.navTarget ? 'Yes' : 'No'}`);
            }
          }
        }
      } else {
        console.log('❌ Content Search Failed:', searchResponse.error);
      }
    } catch (error) {
      console.log('❌ Scenario Test Failed:', error);
    }
  }

  private async callContentSearch(uiState: UIState, query: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'content_search',
        parameters: {
          query,
          uiState,
          k: 5,
          maxTier: 3
        },
        sessionId: 'agent-test',
        uiState
      })
    });

    return await response.json();
  }

  private async callContentGet(uiState: UIState, ids: string[]): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/ai/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'content_get',
        parameters: {
          ids,
          uiState,
          maxTokens: 500
        },
        sessionId: 'agent-test',
        uiState
      })
    });

    return await response.json();
  }

  private printAgentInstructions(): void {
    console.log('**1. Setup Your AI Agent:**');
    console.log('   - Configure agent to use the unified tools API endpoint');
    console.log('   - Ensure agent can construct UIState objects from user context');
    console.log('   - Add tools: content_search and content_get\n');

    console.log('**2. Test Questions to Ask Your Agent:**\n');

    console.log('   **Context-Aware Search:**');
    console.log('   "I\'m looking at the e-commerce project\'s shopping cart section.');
    console.log('    Can you find more details about the payment integration?"');
    console.log('   → Agent should use project context to prioritize relevant results\n');

    console.log('   **Navigation Assistance:**');
    console.log('   "I\'m on the home page. Show me React projects and tell me how to navigate there."');
    console.log('   → Agent should provide navigation targets compatible with current UI state\n');

    console.log('   **Filter-Enhanced Search:**');
    console.log('   "I have AI and Python filters active. Find machine learning projects."');
    console.log('   → Agent should enhance search with active filters\n');

    console.log('   **Modal Context:**');
    console.log('   "I have the task management project modal open. Get more technical details."');
    console.log('   → Agent should generate navigation targets for modal context\n');

    console.log('**3. Expected Agent Behavior:**');
    console.log('   ✅ Agent constructs proper UIState from user context');
    console.log('   ✅ Search results are ranked based on current context');
    console.log('   ✅ Navigation targets are compatible with current UI state');
    console.log('   ✅ Active filters enhance search relevance');
    console.log('   ✅ Error handling preserves UI context\n');

    console.log('**4. Sample Agent Implementation:**');
    console.log('```typescript');
    console.log('// Agent should construct UI state like this:');
    console.log('const uiState: UIState = {');
    console.log('  breadcrumbPath: getCurrentBreadcrumbPath(),');
    console.log('  currentRoute: getCurrentRoute(),');
    console.log('  currentProject: getCurrentProject(),');
    console.log('  visibleAnchors: getVisibleAnchors(),');
    console.log('  activeFilters: getActiveFilters(),');
    console.log('  lastUserAction: getLastUserAction()');
    console.log('};');
    console.log('');
    console.log('// Then call tools with UI state:');
    console.log('await callTool("content_search", {');
    console.log('  query: userQuery,');
    console.log('  uiState,');
    console.log('  k: 5');
    console.log('});');
    console.log('```\n');

    console.log('**5. Validation Checklist:**');
    console.log('   □ Agent receives UI state-enhanced search results');
    console.log('   □ Results include proper navigation targets');
    console.log('   □ Context-aware ranking is applied');
    console.log('   □ Caching improves performance on repeated queries');
    console.log('   □ Error handling includes UI context information\n');
  }
}

async function main() {
  const tester = new AgentUIStateToolsTester();
  await tester.runAgentTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { AgentUIStateToolsTester };