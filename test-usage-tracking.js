/**
 * Simple test for usage tracking functionality
 */

// Test the reflink manager usage tracking
const { reflinkManager } = require('./src/lib/services/ai/reflink-manager.ts');

async function testUsageTracking() {
  try {
    console.log('Testing usage tracking...');
    
    // Get a test reflink
    const reflinks = await reflinkManager.listReflinks({ limit: 1 });
    if (reflinks.reflinks.length === 0) {
      console.log('No reflinks found for testing');
      return;
    }
    
    const testReflink = reflinks.reflinks[0];
    console.log(`Using reflink: ${testReflink.code}`);
    
    // Test usage tracking
    const usageEvent = {
      type: 'llm_request',
      tokens: 150,
      cost: 0.003,
      modelUsed: 'gpt-4',
      endpoint: '/api/chat',
      metadata: { test: true }
    };
    
    await reflinkManager.trackUsage(testReflink.id, usageEvent);
    console.log('✅ Usage tracked successfully');
    
    // Check budget status
    const budgetStatus = await reflinkManager.getRemainingBudget(testReflink.id);
    console.log('Budget Status:', budgetStatus);
    
    // Get analytics
    const analytics = await reflinkManager.getReflinkAnalytics(testReflink.id, 7);
    console.log('Analytics:', {
      totalCost: analytics.totalCost,
      totalRequests: analytics.totalRequests,
      costBreakdown: analytics.costBreakdown
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testUsageTracking();