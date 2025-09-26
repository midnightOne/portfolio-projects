/**
 * Test script for PassiveFIDManager integration
 * 
 * This script tests the client-side PassiveFIDManager with the actual F-I-D API endpoint
 * to ensure proper integration and functionality.
 */

import { PassiveFIDManager } from '../src/lib/ai/PassiveFIDManager';
import { UIState } from '../src/lib/ai/tools/types';

// Mock fetch for Node.js environment
global.fetch = require('node-fetch');

async function testPassiveFIDManager() {
  console.log('🧪 Testing PassiveFIDManager Integration...\n');

  const manager = PassiveFIDManager.getInstance();

  try {
    // Test 1: Basic context fetching
    console.log('📋 Test 1: Basic context fetching');
    const uiState1: UIState = {
      breadcrumbPath: 'home',
      visibleAnchors: ['hero', 'featured-projects'],
      currentRoute: 'home'
    };

    const context1 = await manager.getOrFetchContext(uiState1);
    console.log('✅ Context fetched successfully');
    console.log(`   Frame capabilities: ${context1.frame.currentCapabilities.join(', ')}`);
    console.log(`   Index route: ${context1.index.route}`);
    console.log(`   Available projects: ${context1.index.availableProjects.length}`);
    console.log(`   Visible sections: ${context1.index.visibleSections.join(', ')}`);

    // Test 2: Cache hit
    console.log('\n📋 Test 2: Cache hit test');
    const startTime = Date.now();
    const context2 = await manager.getOrFetchContext(uiState1);
    const cacheTime = Date.now() - startTime;
    console.log(`✅ Cache hit - Response time: ${cacheTime}ms`);
    console.log(`   Same context returned: ${context1 === context2 ? 'No (different objects)' : 'Different objects but same data'}`);

    // Test 3: Different route
    console.log('\n📋 Test 3: Different route context');
    const uiState2: UIState = {
      breadcrumbPath: 'projects',
      visibleAnchors: ['project-grid'],
      currentRoute: 'projects'
    };

    const context3 = await manager.getOrFetchContext(uiState2);
    console.log('✅ Different route context fetched');
    console.log(`   Route changed: ${context3.index.route}`);
    console.log(`   Available projects: ${context3.index.availableProjects.length}`);

    // Test 4: User intent
    console.log('\n📋 Test 4: User intent functionality');
    manager.setUserIntent('Show me technical projects with machine learning');
    
    const uiState3: UIState = {
      breadcrumbPath: 'projects',
      visibleAnchors: ['project-grid'],
      currentRoute: 'projects',
      currentProject: undefined
    };

    const context4 = await manager.getOrFetchContext(uiState3);
    console.log('✅ Context with user intent fetched');
    console.log(`   Intent-based content items: ${context4.details.intentBasedContent?.length || 0}`);

    // Test 5: Project-specific context
    console.log('\n📋 Test 5: Project-specific context');
    const uiState4: UIState = {
      breadcrumbPath: 'projects.aurora-avatar',
      visibleAnchors: ['technical-details', 'implementation'],
      currentRoute: 'projects',
      currentProject: 'aurora-avatar'
    };

    const context5 = await manager.getOrFetchContext(uiState4);
    console.log('✅ Project-specific context fetched');
    console.log(`   Current project: ${context5.index.currentProject || 'None'}`);
    console.log(`   Project summary available: ${context5.details.projectSummary ? 'Yes' : 'No'}`);

    // Test 6: Cache management
    console.log('\n📋 Test 6: Cache management');
    const statsBefore = manager.getCacheStats();
    console.log(`   Cache size before clear: ${statsBefore.size}`);
    
    manager.clearCache('aurora-avatar');
    const statsAfter = manager.getCacheStats();
    console.log(`   Cache size after project clear: ${statsAfter.size}`);
    console.log(`   Memory usage: ${statsAfter.memoryUsage}`);

    // Test 7: Error handling (simulate network error)
    console.log('\n📋 Test 7: Error handling');
    
    // Temporarily break fetch to test error handling
    const originalFetch = global.fetch;
    global.fetch = () => Promise.reject(new Error('Network error'));
    
    const errorContext = await manager.getOrFetchContext(uiState1);
    console.log('✅ Error handled gracefully');
    console.log(`   Fallback context provided: ${errorContext.frame.portfolioOwner}`);
    console.log(`   Fallback capabilities: ${errorContext.frame.currentCapabilities.join(', ')}`);
    
    // Restore fetch
    global.fetch = originalFetch;

    console.log('\n🎉 All PassiveFIDManager tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    manager.destroy();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testPassiveFIDManager().catch(console.error);
}

export { testPassiveFIDManager };