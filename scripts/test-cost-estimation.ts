/**
 * Test Cost Estimation and Tracking Service
 * 
 * Tests all cost estimation and tracking functionality:
 * - Regeneration cost estimation
 * - Model cost comparison
 * - Cost projection
 * - Spending alerts
 * - Operation summary reports
 */

import { costEstimationService } from '../src/lib/content/CostEstimationService';
import { semanticBudgetManager } from '../src/lib/content/SemanticBudgetManager';
import { getBudgetAwareAI } from '../src/lib/content/BudgetAwareAIOperations';
import { prisma } from '../src/lib/prisma';

async function testCostEstimation() {
  console.log('🧪 Testing Cost Estimation and Tracking Service\n');

  try {
    // Test 1: Regeneration Cost Estimation
    console.log('📊 Test 1: Regeneration Cost Estimation');
    console.log('─'.repeat(60));

    const projects = await prisma.project.findMany({ take: 1 });
    if (projects.length === 0) {
      console.log('⚠️  No projects found. Skipping regeneration cost estimation.');
    } else {
      const projectId = projects[0].id;

      // Estimate for single project
      console.log('\n1a. Estimating cost for single project...');
      const projectEstimate = await costEstimationService.estimateRegenerationCost({
        projectId,
        scope: 'project',
        embeddingModel: 'text-embedding-3-small',
        summarizationModel: 'gpt-4o-mini'
      });

      console.log('✅ Project Regeneration Estimate:');
      console.log(`   Total Cost: $${projectEstimate.totalCost.toFixed(4)}`);
      console.log(`   Total Tokens: ${projectEstimate.totalTokens.toLocaleString()}`);
      console.log(`   Estimated Duration: ${projectEstimate.estimatedDuration}s`);
      console.log(`   Can Afford: ${projectEstimate.canAfford ? '✅' : '❌'}`);
      if (projectEstimate.shortfall) {
        console.log(`   Shortfall: $${projectEstimate.shortfall.toFixed(4)}`);
      }
      console.log('\n   Breakdown:');
      console.log(`   - Summarization: $${projectEstimate.breakdown.summarization.total.cost.toFixed(4)}`);
      console.log(`     • T1: ${projectEstimate.breakdown.summarization.t1.sections} sections, $${projectEstimate.breakdown.summarization.t1.cost.toFixed(4)}`);
      console.log(`     • T2: ${projectEstimate.breakdown.summarization.t2.sections} sections, $${projectEstimate.breakdown.summarization.t2.cost.toFixed(4)}`);
      console.log(`   - Embeddings: $${projectEstimate.breakdown.embedding.total.cost.toFixed(4)}`);
      console.log(`     • T1: ${projectEstimate.breakdown.embedding.t1.chunks} chunks, $${projectEstimate.breakdown.embedding.t1.cost.toFixed(4)}`);
      console.log(`     • T2: ${projectEstimate.breakdown.embedding.t2.chunks} chunks, $${projectEstimate.breakdown.embedding.t2.cost.toFixed(4)}`);
      console.log(`     • T3: ${projectEstimate.breakdown.embedding.t3.chunks} chunks, $${projectEstimate.breakdown.embedding.t3.cost.toFixed(4)}`);

      // Estimate for all projects
      console.log('\n1b. Estimating cost for all projects...');
      const allEstimate = await costEstimationService.estimateRegenerationCost({
        scope: 'all',
        embeddingModel: 'text-embedding-3-small',
        summarizationModel: 'gpt-4o-mini'
      });

      console.log('✅ All Projects Regeneration Estimate:');
      console.log(`   Total Cost: $${allEstimate.totalCost.toFixed(4)}`);
      console.log(`   Total Tokens: ${allEstimate.totalTokens.toLocaleString()}`);
      console.log(`   Can Afford: ${allEstimate.canAfford ? '✅' : '❌'}`);
    }

    // Test 2: Model Cost Comparison
    console.log('\n\n📊 Test 2: Model Cost Comparison');
    console.log('─'.repeat(60));

    const estimatedTokens = 100000; // 100K tokens
    console.log(`\nComparing embedding models for ${estimatedTokens.toLocaleString()} tokens:\n`);

    const modelComparison = await costEstimationService.compareEmbeddingModels({
      estimatedTokens,
      currentModel: 'text-embedding-3-small'
    });

    console.log('✅ Model Comparison Results:\n');
    modelComparison.forEach((model, index) => {
      console.log(`${index + 1}. ${model.model} ${model.recommended ? '⭐ (Recommended)' : ''}`);
      console.log(`   Cost: $${model.estimatedCostForOperation.toFixed(4)}`);
      console.log(`   Per 1K tokens: $${model.costPer1KTokens.toFixed(6)}`);
      console.log(`   Per 1M tokens: $${model.costPer1MTokens.toFixed(2)}`);
      console.log(`   Quality: ${model.qualityRating.toUpperCase()}`);
      console.log(`   Speed: ${model.speedRating.toUpperCase()}`);
      if (model.savingsVsDefault !== undefined) {
        const sign = model.savingsVsDefault > 0 ? '+' : '';
        console.log(`   Savings vs default: ${sign}$${model.savingsVsDefault.toFixed(4)} (${sign}${model.savingsPercent?.toFixed(1)}%)`);
      }
      console.log('');
    });

    // Test 3: Cost Projection
    console.log('\n📊 Test 3: Cost Projection');
    console.log('─'.repeat(60));

    console.log('\nProjecting costs based on historical data...');
    const projection = await costEstimationService.projectCosts({
      lookbackDays: 30
    });

    console.log('✅ Cost Projection Results:');
    console.log(`   Current Spending Rate: $${projection.currentSpendingRate.toFixed(4)}/day`);
    console.log(`   Projected Monthly Spend: $${projection.projectedMonthlySpend.toFixed(2)}`);
    console.log(`   Projected Quarterly Spend: $${projection.projectedQuarterlySpend.toFixed(2)}`);
    console.log(`   Days Until Budget Depletion: ${projection.daysUntilBudgetDepletion === 999 ? '∞' : projection.daysUntilBudgetDepletion}`);
    console.log(`   Operations Until Depletion: ${projection.operationsUntilBudgetDepletion === 999 ? '∞' : projection.operationsUntilBudgetDepletion}`);
    console.log(`   Confidence: ${projection.confidence.toUpperCase()}`);
    console.log(`   Based on: ${projection.basedOnDays} days of data`);
    if (projection.recommendedBudgetIncrease) {
      console.log(`   ⚠️  Recommended Budget Increase: $${projection.recommendedBudgetIncrease.toFixed(2)}`);
    }

    // Test 4: Spending Alerts
    console.log('\n\n📊 Test 4: Spending Alerts');
    console.log('─'.repeat(60));

    console.log('\nDetecting unusual spending patterns...');
    const alerts = await costEstimationService.detectSpendingAlerts();

    if (alerts.length === 0) {
      console.log('✅ No spending alerts detected. All spending patterns are normal.');
    } else {
      console.log(`⚠️  ${alerts.length} spending alert(s) detected:\n`);
      alerts.forEach((alert, index) => {
        const severityIcon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${index + 1}. ${severityIcon} ${alert.type.toUpperCase()}`);
        console.log(`   Severity: ${alert.severity.toUpperCase()}`);
        console.log(`   Message: ${alert.message}`);
        console.log(`   Current Value: ${alert.details.currentValue.toFixed(4)}`);
        console.log(`   Expected Value: ${alert.details.expectedValue.toFixed(4)}`);
        console.log(`   Deviation: ${alert.details.deviation.toFixed(1)}%`);
        if (alert.details.affectedProjects) {
          console.log(`   Affected Projects: ${alert.details.affectedProjects.length}`);
        }
        console.log(`   Timestamp: ${alert.timestamp.toISOString()}`);
        console.log('');
      });
    }

    // Test 5: Operation Summary Report
    console.log('\n📊 Test 5: Operation Summary Report');
    console.log('─'.repeat(60));

    // Get a recent operation
    const recentOperation = await prisma.semanticOperation.findFirst({
      where: { success: true },
      orderBy: { startedAt: 'desc' }
    });

    if (!recentOperation) {
      console.log('⚠️  No operations found. Skipping operation summary test.');
    } else {
      console.log(`\nGenerating summary for operation: ${recentOperation.id}`);
      const summary = await costEstimationService.generateOperationSummary(recentOperation.id);

      console.log('✅ Operation Summary Report:');
      console.log(`   Operation Type: ${summary.operationType}`);
      console.log(`   Project ID: ${summary.projectId || 'N/A'}`);
      console.log(`   Duration: ${summary.duration}ms`);
      console.log(`   Success: ${summary.success ? '✅' : '❌'}`);
      console.log('\n   Cost Breakdown:');
      console.log(`   - Embedding: $${summary.costBreakdown.embedding.cost.toFixed(4)} (${summary.costBreakdown.embedding.tokens} tokens, ${summary.costBreakdown.embedding.chunks} chunks)`);
      console.log(`   - Summarization: $${summary.costBreakdown.summarization.cost.toFixed(4)} (${summary.costBreakdown.summarization.tokens} tokens, ${summary.costBreakdown.summarization.chunks} chunks)`);
      console.log(`   - Total: $${summary.costBreakdown.total.cost.toFixed(4)} (${summary.costBreakdown.total.tokens} tokens)`);
      console.log('\n   Efficiency Metrics:');
      console.log(`   - Cost per Chunk: $${summary.efficiency.costPerChunk.toFixed(6)}`);
      console.log(`   - Tokens per Chunk: ${summary.efficiency.tokensPerChunk.toFixed(0)}`);
      console.log(`   - Chunks per Second: ${summary.efficiency.chunksPerSecond.toFixed(2)}`);
      console.log('\n   Budget Impact:');
      console.log(`   - Remaining Budget: $${summary.budgetImpact.remainingBudget.toFixed(2)}`);
      console.log(`   - Percent Used: ${(summary.budgetImpact.percentUsed * 100).toFixed(1)}%`);
      console.log(`   - Warning Level: ${summary.budgetImpact.warningLevel.toUpperCase()}`);
      console.log('\n   Comparison:');
      console.log(`   - vs Average Operation: ${summary.comparison.vsAverageOperation.costDifference >= 0 ? '+' : ''}$${summary.comparison.vsAverageOperation.costDifference.toFixed(4)} (${summary.comparison.vsAverageOperation.percentDifference >= 0 ? '+' : ''}${summary.comparison.vsAverageOperation.percentDifference.toFixed(1)}%)`);
      if (summary.comparison.vsProjectAverage) {
        console.log(`   - vs Project Average: ${summary.comparison.vsProjectAverage.costDifference >= 0 ? '+' : ''}$${summary.comparison.vsProjectAverage.costDifference.toFixed(4)} (${summary.comparison.vsProjectAverage.percentDifference >= 0 ? '+' : ''}${summary.comparison.vsProjectAverage.percentDifference.toFixed(1)}%)`);
      }
    }

    // Test 6: Budget Status
    console.log('\n\n📊 Test 6: Current Budget Status');
    console.log('─'.repeat(60));

    const budget = await semanticBudgetManager.getActiveBudget();
    console.log('✅ Current Budget:');
    console.log(`   Allocated: $${budget.allocatedFunds.toFixed(2)}`);
    console.log(`   Remaining: $${budget.remainingFunds.toFixed(2)}`);
    console.log(`   Total Spent: $${budget.totalSpent.toFixed(2)}`);
    console.log(`   Percent Used: ${(budget.percentUsed * 100).toFixed(1)}%`);
    console.log(`   Warning Level: ${budget.warningLevel.toUpperCase()}`);
    console.log(`   Embedding Costs: $${budget.embeddingCosts.toFixed(2)}`);
    console.log(`   Summarization Costs: $${budget.summarizationCosts.toFixed(2)}`);

    console.log('\n\n✅ All Cost Estimation Tests Completed Successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testCostEstimation()
  .then(() => {
    console.log('✅ Test suite completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
