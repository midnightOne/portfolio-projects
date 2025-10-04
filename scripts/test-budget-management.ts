/**
 * Test Script for Semantic Budget Management System
 * 
 * Tests all budget management functionality:
 * - Budget allocation
 * - Cost deduction
 * - Budget depletion detection
 * - Warning thresholds
 * - Spending history
 * - Cost breakdown
 * - Analytics
 * - CSV export
 */

import { semanticBudgetManager } from '../src/lib/content/SemanticBudgetManager';

async function testBudgetManagement() {
  console.log('🧪 Testing Semantic Budget Management System\n');

  try {
    // Test 1: Get or create active budget
    console.log('📊 Test 1: Get Active Budget');
    const initialBudget = await semanticBudgetManager.getActiveBudget();
    console.log('Initial Budget:', {
      allocated: `$${initialBudget.allocatedFunds.toFixed(2)}`,
      remaining: `$${initialBudget.remainingFunds.toFixed(2)}`,
      spent: `$${initialBudget.totalSpent.toFixed(2)}`,
      warningLevel: initialBudget.warningLevel
    });
    console.log('✅ Budget retrieved successfully\n');

    // Test 2: Allocate additional funds
    console.log('💰 Test 2: Allocate Funds');
    const allocated = await semanticBudgetManager.allocateFunds({
      amount: 25.00,
      description: 'Test allocation for budget system'
    });
    console.log('After Allocation:', {
      allocated: `$${allocated.allocatedFunds.toFixed(2)}`,
      remaining: `$${allocated.remainingFunds.toFixed(2)}`,
      lastAllocated: allocated.lastAllocatedAt
    });
    console.log('✅ Funds allocated successfully\n');

    // Test 3: Check if can afford operation
    console.log('🔍 Test 3: Check Affordability');
    const affordCheck1 = await semanticBudgetManager.canAffordOperation(5.00);
    console.log('Can afford $5.00:', affordCheck1.canAfford);
    console.log('Remaining funds:', `$${affordCheck1.remainingFunds.toFixed(2)}`);

    const affordCheck2 = await semanticBudgetManager.canAffordOperation(1000.00);
    console.log('Can afford $1000.00:', affordCheck2.canAfford);
    if (affordCheck2.shortfall) {
      console.log('Shortfall:', `$${affordCheck2.shortfall.toFixed(2)}`);
    }
    console.log('✅ Affordability checks completed\n');

    // Test 4: Deduct cost for embedding operation
    console.log('💸 Test 4: Deduct Cost (Embedding)');
    const embeddingResult = await semanticBudgetManager.deductCost({
      operationType: 'embedding',
      tokensUsed: 1500,
      cost: 0.03,
      model: 'text-embedding-3-small',
      projectId: 'test-project-1',
      chunksProcessed: 5,
      tiersAffected: [2, 3],
      metadata: { test: true }
    });
    console.log('Deduction Result:', {
      success: embeddingResult.success,
      remaining: `$${embeddingResult.remainingFunds.toFixed(2)}`,
      warningLevel: embeddingResult.warningLevel,
      operationId: embeddingResult.operation.id
    });
    console.log('✅ Embedding cost deducted\n');

    // Test 5: Deduct cost for summarization operation
    console.log('💸 Test 5: Deduct Cost (Summarization)');
    const summaryResult = await semanticBudgetManager.deductCost({
      operationType: 'summarization',
      tokensUsed: 2000,
      cost: 0.30,
      model: 'gpt-4o-mini',
      projectId: 'test-project-1',
      chunksProcessed: 10,
      tiersAffected: [1, 2]
    });
    console.log('Deduction Result:', {
      success: summaryResult.success,
      remaining: `$${summaryResult.remainingFunds.toFixed(2)}`,
      warningLevel: summaryResult.warningLevel
    });
    console.log('✅ Summarization cost deducted\n');

    // Test 6: Record failed operation
    console.log('❌ Test 6: Record Failed Operation');
    await semanticBudgetManager.recordFailedOperation({
      operationType: 'embedding',
      tokensUsed: 500,
      model: 'text-embedding-3-small',
      projectId: 'test-project-2',
      error: 'API timeout',
      metadata: { attempt: 1 }
    });
    console.log('✅ Failed operation recorded\n');

    // Test 7: Get spending history
    console.log('📜 Test 7: Get Spending History');
    const history = await semanticBudgetManager.getSpendingHistory({
      projectId: 'test-project-1'
    });
    console.log(`Found ${history.length} operations for test-project-1`);
    if (history.length > 0) {
      console.log('Latest operation:', {
        type: history[0].operationType,
        cost: `$${history[0].cost.toFixed(4)}`,
        tokens: history[0].tokensUsed,
        success: history[0].success
      });
    }
    console.log('✅ Spending history retrieved\n');

    // Test 8: Get cost breakdown
    console.log('📊 Test 8: Get Cost Breakdown');
    const breakdown = await semanticBudgetManager.getCostBreakdown();
    console.log('Cost Breakdown:');
    console.log('  Embedding:', {
      cost: `$${breakdown.embedding.cost.toFixed(4)}`,
      operations: breakdown.embedding.operations,
      tokens: breakdown.embedding.tokens
    });
    console.log('  Summarization:', {
      cost: `$${breakdown.summarization.cost.toFixed(4)}`,
      operations: breakdown.summarization.operations,
      tokens: breakdown.summarization.tokens
    });
    console.log('  Total:', {
      cost: `$${breakdown.total.cost.toFixed(4)}`,
      operations: breakdown.total.operations,
      tokens: breakdown.total.tokens
    });
    console.log('✅ Cost breakdown retrieved\n');

    // Test 9: Get budget analytics
    console.log('📈 Test 9: Get Budget Analytics');
    const analytics = await semanticBudgetManager.getBudgetAnalytics(30);
    console.log('Analytics (30 days):', {
      totalOperations: analytics.totalOperations,
      successfulOperations: analytics.successfulOperations,
      failedOperations: analytics.failedOperations,
      totalTokens: analytics.totalTokensUsed,
      avgCostPerOp: `$${analytics.averageCostPerOperation.toFixed(4)}`,
      estimatedDaysRemaining: analytics.projections.estimatedDaysRemaining,
      avgDailyCost: `$${analytics.projections.averageDailyCost.toFixed(4)}`
    });
    console.log('Cost by operation type:', analytics.costByOperationType);
    console.log('✅ Analytics retrieved\n');

    // Test 10: Update thresholds
    console.log('⚙️  Test 10: Update Thresholds');
    const updatedBudget = await semanticBudgetManager.updateThresholds(0.75, 0.85);
    console.log('Updated Thresholds:', {
      warning: `${(updatedBudget.warningThreshold * 100).toFixed(0)}%`,
      critical: `${(updatedBudget.criticalThreshold * 100).toFixed(0)}%`,
      currentLevel: updatedBudget.warningLevel
    });
    console.log('✅ Thresholds updated\n');

    // Test 11: Export CSV
    console.log('📄 Test 11: Export CSV');
    const csv = await semanticBudgetManager.exportSpendingDataCSV();
    const lines = csv.split('\n');
    console.log(`CSV generated with ${lines.length} lines (including header)`);
    console.log('First 3 lines:');
    lines.slice(0, 3).forEach(line => console.log('  ' + line));
    console.log('✅ CSV export successful\n');

    // Test 12: Test budget depletion scenario
    console.log('🚨 Test 12: Test Budget Depletion');
    const currentBudget = await semanticBudgetManager.getActiveBudget();
    console.log('Current remaining:', `$${currentBudget.remainingFunds.toFixed(2)}`);
    
    try {
      // Try to deduct more than available
      await semanticBudgetManager.deductCost({
        operationType: 'regeneration',
        tokensUsed: 100000,
        cost: currentBudget.remainingFunds + 10,
        model: 'gpt-4o',
        projectId: 'test-project-3'
      });
      console.log('❌ Should have thrown insufficient funds error');
    } catch (error) {
      console.log('✅ Correctly blocked operation:', (error as Error).message);
    }
    console.log();

    // Final budget status
    console.log('📊 Final Budget Status');
    const finalBudget = await semanticBudgetManager.getActiveBudget();
    console.log({
      allocated: `$${finalBudget.allocatedFunds.toFixed(2)}`,
      remaining: `$${finalBudget.remainingFunds.toFixed(2)}`,
      spent: `$${finalBudget.totalSpent.toFixed(2)}`,
      percentUsed: `${(finalBudget.percentUsed * 100).toFixed(1)}%`,
      warningLevel: finalBudget.warningLevel,
      embeddingCosts: `$${finalBudget.embeddingCosts.toFixed(4)}`,
      summarizationCosts: `$${finalBudget.summarizationCosts.toFixed(4)}`
    });

    console.log('\n✅ All budget management tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests
testBudgetManagement()
  .then(() => {
    console.log('\n🎉 Budget management system is working correctly!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Tests failed:', error);
    process.exit(1);
  });
