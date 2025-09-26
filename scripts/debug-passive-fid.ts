/**
 * Debug PassiveFIDManager to see why it's not working properly
 */

import fetch from 'node-fetch';
(global as any).fetch = fetch;
(global as any).window = undefined;

import { PassiveFIDManager } from '../src/lib/ai/PassiveFIDManager';
import { UIState } from '../src/lib/ai/tools/types';

async function debugPassiveFID() {
  console.log('🐛 Debugging PassiveFIDManager...\n');

  // Test direct API call first
  console.log('📋 Step 1: Direct API call');
  try {
    const directResponse = await fetch('http://localhost:3000/api/ai/context/fid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'projects',
        projectId: 'e-commerce-platform',
        userIntent: null,
        lastActions: ['technical-details'],
        contextType: 'complete'
      })
    });

    console.log(`   Status: ${directResponse.status}`);
    const directData = await directResponse.json();
    console.log(`   Success: ${directData.success}`);
    console.log(`   Projects available: ${directData.data?.index?.projectSummaries?.length || 0}`);
    console.log(`   First project: ${directData.data?.index?.projectSummaries?.[0]?.title || 'None'}`);
  } catch (error) {
    console.error('   Direct API call failed:', error);
  }

  // Test PassiveFIDManager
  console.log('\n📋 Step 2: PassiveFIDManager call');
  
  const manager = new (class extends PassiveFIDManager {
    constructor() {
      super();
    }

    // Override fetchFromServer to add debugging
    async fetchFromServer(uiState: UIState) {
      console.log('   🔄 fetchFromServer called with:', JSON.stringify(uiState, null, 2));
      
      try {
        const result = await super['fetchFromServer'](uiState);
        console.log('   ✅ fetchFromServer succeeded');
        console.log('   📊 Result summary:');
        console.log(`      Frame owner: ${result.frame.portfolioOwner}`);
        console.log(`      Index projects: ${result.index.availableProjects.length}`);
        console.log(`      Details content: ${result.details.intentBasedContent?.length || 0}`);
        return result;
      } catch (error) {
        console.log('   ❌ fetchFromServer failed:', error);
        throw error;
      }
    }

    // Override convertServerResponseToFIDContext to add debugging
    convertServerResponseToFIDContext(serverData: any, uiState: UIState) {
      console.log('   🔄 convertServerResponseToFIDContext called');
      console.log('   📥 Server data keys:', Object.keys(serverData));
      console.log('   📥 Frame data:', serverData.frame ? 'Present' : 'Missing');
      console.log('   📥 Index data:', serverData.index ? 'Present' : 'Missing');
      console.log('   📥 Details data:', serverData.details ? 'Present' : 'Missing');
      
      if (serverData.index?.projectSummaries) {
        console.log(`   📥 Server project summaries: ${serverData.index.projectSummaries.length}`);
      }
      
      const result = super['convertServerResponseToFIDContext'](serverData, uiState);
      
      console.log('   📤 Converted result:');
      console.log(`      Frame owner: ${result.frame.portfolioOwner}`);
      console.log(`      Index projects: ${result.index.availableProjects.length}`);
      console.log(`      Details content: ${result.details.intentBasedContent?.length || 0}`);
      
      return result;
    }
  })();

  try {
    const uiState: UIState = {
      breadcrumbPath: 'projects.e-commerce-platform',
      visibleAnchors: ['technical-details'],
      currentRoute: 'projects',
      currentProject: 'e-commerce-platform'
    };

    console.log('   🎯 Calling getOrFetchContext with:', JSON.stringify(uiState, null, 2));
    
    const context = await manager.getOrFetchContext(uiState);
    
    console.log('\n📊 Final Result:');
    console.log(`   Frame owner: ${context.frame.portfolioOwner}`);
    console.log(`   Frame capabilities: ${context.frame.currentCapabilities.join(', ')}`);
    console.log(`   Index route: ${context.index.route}`);
    console.log(`   Index projects: ${context.index.availableProjects.length}`);
    console.log(`   Index current project: ${context.index.currentProject}`);
    console.log(`   Details project summary: ${context.details.projectSummary ? 'Available' : 'None'}`);
    console.log(`   Details intent content: ${context.details.intentBasedContent?.length || 0}`);

    if (context.index.availableProjects.length > 0) {
      console.log('\n📋 Available Projects:');
      context.index.availableProjects.slice(0, 3).forEach((project, idx) => {
        console.log(`   ${idx + 1}. ${project.title} (${project.slug})`);
      });
    }

  } catch (error) {
    console.error('❌ PassiveFIDManager test failed:', error);
  } finally {
    manager.destroy();
  }
}

debugPassiveFID().catch(console.error);