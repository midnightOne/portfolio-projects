#!/usr/bin/env tsx

/**
 * Test script for F-I-D Context Manager
 * 
 * Tests the Frame/Index/Details pattern implementation with:
 * - Context budget management
 * - Route-based context swapping
 * - UIManager integration
 * - Token usage tracking
 */

import { contextFrameManager, ContextSwapConfig } from '../src/lib/ai/ContextFrameManager';
import { UIManager } from '../src/lib/navigation/UIManager';

async function testFIDContextManager() {
  console.log('🧪 Testing F-I-D Context Manager Implementation\n');

  try {
    // Test 1: Basic Frame Context Loading
    console.log('📋 Test 1: Frame Context Loading');
    const frameContext = await contextFrameManager.getFrameContext();
    console.log('✅ Frame context loaded:', {
      tokenCount: frameContext.tokenCount,
      hasSystemRules: !!frameContext.systemRules,
      hasVoiceSettings: !!frameContext.voiceSettings,
      hasRoutingPrimer: !!frameContext.routingPrimer
    });

    // Test 2: Index Context Loading for Different Routes
    console.log('\n📊 Test 2: Index Context Loading');
    
    const homeConfig: ContextSwapConfig = {
      route: 'home',
      userIntent: 'Learn about the portfolio owner'
    };
    
    const homeIndex = await contextFrameManager.getIndexContext(homeConfig);
    console.log('✅ Home index context:', {
      route: homeIndex.route,
      projectCount: homeIndex.projectSummaries.length,
      tokenCount: homeIndex.tokenCount,
      availableTransitions: homeIndex.availableTransitions.length
    });

    const projectsConfig: ContextSwapConfig = {
      route: 'projects',
      projectId: 'portfolio-website',
      userIntent: 'Show me technical details'
    };
    
    const projectsIndex = await contextFrameManager.getIndexContext(projectsConfig);
    console.log('✅ Projects index context:', {
      route: projectsIndex.route,
      projectCount: projectsIndex.projectSummaries.length,
      tokenCount: projectsIndex.tokenCount,
      availableTransitions: projectsIndex.availableTransitions.length
    });

    // Test 3: Details Context Loading with User Intent
    console.log('\n🔍 Test 3: Details Context Loading');
    
    const detailsContext = await contextFrameManager.getDetailsContext(projectsConfig, {
      remainingBudget: 1000
    });
    console.log('✅ Details context loaded:', {
      contentChunks: detailsContext.contentChunks.length,
      searchResults: detailsContext.searchResults.length,
      tokenCount: detailsContext.tokenCount,
      truncated: detailsContext.truncated
    });

    // Test 4: Complete F-I-D Context
    console.log('\n🎯 Test 4: Complete F-I-D Context');
    
    const completeContext = await contextFrameManager.getCompleteContext(projectsConfig);
    console.log('✅ Complete F-I-D context:', {
      frameTokens: completeContext.frame.tokenCount,
      indexTokens: completeContext.index.tokenCount,
      detailsTokens: completeContext.details.tokenCount,
      totalTokens: completeContext.totalTokens,
      budgetExceeded: completeContext.budgetExceeded
    });

    // Test 5: Context Budget Management
    console.log('\n💰 Test 5: Context Budget Management');
    
    // Configure a tight budget
    contextFrameManager.configureContextBudget({
      frameMaxTokens: 200,
      indexMaxTokens: 300,
      detailsMaxTokens: 500,
      totalMaxTokens: 1000
    });

    const budgetTestContext = await contextFrameManager.getCompleteContext({
      route: 'projects',
      userIntent: 'Show me everything about all projects with full technical details and comprehensive analysis'
    });

    console.log('✅ Budget-constrained context:', {
      frameTokens: budgetTestContext.frame.tokenCount,
      indexTokens: budgetTestContext.index.tokenCount,
      detailsTokens: budgetTestContext.details.tokenCount,
      totalTokens: budgetTestContext.totalTokens,
      budgetExceeded: budgetTestContext.budgetExceeded,
      detailsTruncated: budgetTestContext.details.truncated
    });

    // Test 6: UIManager Integration
    console.log('\n🧭 Test 6: UIManager Integration');
    
    const uiManager = UIManager.getInstance();
    const uiDescription = await uiManager.describe();
    
    console.log('✅ UIManager with F-I-D context:', {
      epoch: uiDescription.epoch,
      route: uiDescription.route,
      sectionsCount: uiDescription.sections.length,
      transitionsCount: uiDescription.transitions.length,
      hasFIDContext: !!uiDescription.fidContext,
      fidFocus: uiDescription.fidContext?.focus || [],
      fidInterest: uiDescription.fidContext?.interest || [],
      fidDomain: uiDescription.fidContext?.domain || [],
      contextStats: uiDescription.fidContext?.contextStats
    });

    // Test 7: Context Statistics
    console.log('\n📈 Test 7: Context Statistics');
    
    const contextStats = contextFrameManager.getContextStats();
    console.log('✅ Context statistics:', {
      frameTokens: contextStats.frameTokens,
      indexTokens: contextStats.indexTokens,
      detailsTokens: contextStats.detailsTokens,
      totalTokens: contextStats.totalTokens,
      budgetUtilization: Math.round(contextStats.budgetUtilization * 100) + '%',
      cacheStats: contextStats.cacheStats
    });

    // Test 8: Context Swapping Performance
    console.log('\n⚡ Test 8: Context Swapping Performance');
    
    const swapConfigs = [
      { route: 'home' },
      { route: 'projects' },
      { route: 'about' },
      { route: 'projects', projectId: 'portfolio-website' },
      { route: 'projects', projectId: 'task-management-app' }
    ];

    const swapStartTime = Date.now();
    const swapResults = await Promise.all(
      swapConfigs.map(async (config, index) => {
        const start = Date.now();
        const context = await contextFrameManager.getCompleteContext(config);
        return {
          config,
          loadTime: Date.now() - start,
          totalTokens: context.totalTokens,
          budgetExceeded: context.budgetExceeded
        };
      })
    );
    const totalSwapTime = Date.now() - swapStartTime;

    console.log('✅ Context swapping performance:', {
      totalConfigs: swapConfigs.length,
      totalTime: totalSwapTime + 'ms',
      averageTime: Math.round(totalSwapTime / swapConfigs.length) + 'ms',
      results: swapResults.map(r => ({
        route: r.config.route,
        project: r.config.projectId,
        loadTime: r.loadTime + 'ms',
        tokens: r.totalTokens,
        budgetOK: !r.budgetExceeded
      }))
    });

    console.log('\n🎉 All F-I-D Context Manager tests completed successfully!');

  } catch (error) {
    console.error('❌ F-I-D Context Manager test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testFIDContextManager().catch(console.error);
}

export { testFIDContextManager };