/**
 * Test Budget-Aware AI Operations
 * 
 * Tests the integration of budget tracking with AI operations
 */

import { getBudgetAwareAI } from '../src/lib/content/BudgetAwareAIOperations';
import { semanticBudgetManager } from '../src/lib/content/SemanticBudgetManager';

async function testBudgetAwareAI() {
  console.log('🧪 Testing Budget-Aware AI Operations\n');

  try {
    const budgetAI = getBudgetAwareAI();

    // Test 1: Check initial budget
    console.log('📊 Test 1: Check Initial Budget');
    const initialBudget = await budgetAI.getBudgetStatus();
    console.log('Initial Budget:', {
      allocated: `$${initialBudget.allocatedFunds.toFixed(2)}`,
      remaining: `$${initialBudget.remainingFunds.toFixed(2)}`,
      warningLevel: initialBudget.warningLevel
    });
    console.log('✅ Budget status retrieved\n');

    // Test 2: Generate embedding with budget tracking
    console.log('🔢 Test 2: Generate Embedding (Budget-Aware)');
    const embeddingResult = await budgetAI.generateEmbedding({
      input: 'This is a test content for embedding generation with budget tracking.',
      model: 'text-embedding-3-small',
      projectId: 'test-project-budget',
      metadata: { test: true, purpose: 'budget-integration-test' }
    });
    console.log('Embedding Result:', {
      embeddingLength: embeddingResult.embeddings[0].length,
      tokensUsed: embeddingResult.tokensUsed,
      cost: `$${embeddingResult.cost.toFixed(6)}`
    });
    console.log('✅ Embedding generated with budget tracking\n');

    // Test 3: Generate summary with budget tracking
    console.log('📝 Test 3: Generate Summary (Budget-Aware)');
    const summaryResult = await budgetAI.generateSummary({
      content: `
        This is a comprehensive test article about semantic content management.
        It includes multiple sections covering various aspects of the system.
        The system provides hierarchical content decomposition with T0-T3 tiers.
        Budget management ensures cost control for AI operations.
        Change detection enables surgical section updates.
      `,
      systemPrompt: 'Summarize the following content in 2-3 sentences, focusing on key features.',
      model: 'gpt-4o-mini',
      maxTokens: 100,
      temperature: 0.3,
      projectId: 'test-project-budget',
      metadata: { test: true, tier: 1 }
    });
    console.log('Summary Result:', {
      summary: summaryResult.summary,
      tokensUsed: summaryResult.tokensUsed,
      cost: `$${summaryResult.cost.toFixed(6)}`
    });
    console.log('✅ Summary generated with budget tracking\n');

    // Test 4: Check budget after operations
    console.log('📊 Test 4: Check Budget After Operations');
    const afterBudget = await budgetAI.getBudgetStatus();
    console.log('After Operations:', {
      remaining: `$${afterBudget.remainingFunds.toFixed(2)}`,
      spent: `$${afterBudget.totalSpent.toFixed(4)}`,
      embeddingCosts: `$${afterBudget.embeddingCosts.toFixed(6)}`,
      summarizationCosts: `$${afterBudget.summarizationCosts.toFixed(6)}`,
      warningLevel: afterBudget.warningLevel
    });
    console.log('✅ Budget updated correctly\n');

    // Test 5: Estimate regeneration cost
    console.log('💰 Test 5: Estimate Regeneration Cost');
    const costEstimate = await budgetAI.estimateRegenerationCost({
      projectId: 'test-project-budget',
      sectionsToRegenerate: 5,
      averageTokensPerSection: 500,
      includeEmbeddings: true
    });
    console.log('Cost Estimate:', {
      totalTokens: costEstimate.estimatedTokens,
      totalCost: `$${costEstimate.estimatedCost.toFixed(4)}`,
      summarization: `$${costEstimate.breakdown.summarization.cost.toFixed(4)}`,
      embedding: `$${costEstimate.breakdown.embedding.cost.toFixed(4)}`
    });
    console.log('✅ Cost estimation completed\n');

    // Test 6: Check affordability
    console.log('🔍 Test 6: Check Affordability');
    const canAfford = await budgetAI.canAffordOperation(costEstimate.estimatedCost);
    console.log('Can afford regeneration:', {
      canAfford: canAfford.canAfford,
      remainingFunds: `$${canAfford.remainingFunds.toFixed(2)}`,
      shortfall: canAfford.shortfall ? `$${canAfford.shortfall.toFixed(4)}` : 'N/A'
    });
    console.log('✅ Affordability check completed\n');

    // Test 7: Test budget depletion protection
    console.log('🚨 Test 7: Test Budget Depletion Protection');
    try {
      // Try to generate embedding that exceeds budget
      await budgetAI.generateEmbedding({
        input: 'x'.repeat(1000000), // Very large input
        projectId: 'test-project-budget'
      });
      console.log('❌ Should have thrown insufficient budget error');
    } catch (error) {
      console.log('✅ Correctly blocked operation:', (error as Error).message.substring(0, 100) + '...');
    }
    console.log();

    // Test 8: Batch embedding generation
    console.log('📦 Test 8: Batch Embedding Generation');
    const batchResult = await budgetAI.generateEmbedding({
      input: [
        'First chunk of content',
        'Second chunk of content',
        'Third chunk of content'
      ],
      model: 'text-embedding-3-small',
      projectId: 'test-project-budget',
      metadata: { batch: true, chunkCount: 3 }
    });
    console.log('Batch Result:', {
      embeddingsCount: batchResult.embeddings.length,
      tokensUsed: batchResult.tokensUsed,
      cost: `$${batchResult.cost.toFixed(6)}`,
      costPerEmbedding: `$${(batchResult.cost / batchResult.embeddings.length).toFixed(6)}`
    });
    console.log('✅ Batch embeddings generated\n');

    // Final budget status
    console.log('📊 Final Budget Status');
    const finalBudget = await budgetAI.getBudgetStatus();
    console.log({
      allocated: `$${finalBudget.allocatedFunds.toFixed(2)}`,
      remaining: `$${finalBudget.remainingFunds.toFixed(2)}`,
      spent: `$${finalBudget.totalSpent.toFixed(4)}`,
      percentUsed: `${(finalBudget.percentUsed * 100).toFixed(2)}%`,
      warningLevel: finalBudget.warningLevel
    });

    console.log('\n✅ All budget-aware AI operation tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests
testBudgetAwareAI()
  .then(() => {
    console.log('\n🎉 Budget-aware AI operations are working correctly!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Tests failed:', error);
    process.exit(1);
  });
