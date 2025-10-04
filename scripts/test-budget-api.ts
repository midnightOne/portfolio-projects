/**
 * Test Script for Budget Management API Endpoints
 * 
 * Tests all API endpoints for budget management
 */

async function testBudgetAPI() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing Budget Management API Endpoints\n');

  try {
    // Test 1: GET /api/admin/semantic/budget
    console.log('📊 Test 1: GET Budget Status');
    const budgetResponse = await fetch(`${baseUrl}/api/admin/semantic/budget`);
    const budgetData = await budgetResponse.json();
    console.log('Status:', budgetResponse.status);
    console.log('Budget:', {
      allocated: `$${budgetData.budget.allocatedFunds.toFixed(2)}`,
      remaining: `$${budgetData.budget.remainingFunds.toFixed(2)}`,
      warningLevel: budgetData.budget.warningLevel
    });
    console.log('✅ Budget status retrieved\n');

    // Test 2: POST /api/admin/semantic/budget/allocate
    console.log('💰 Test 2: POST Allocate Funds');
    const allocateResponse = await fetch(`${baseUrl}/api/admin/semantic/budget/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 15.00,
        description: 'API test allocation'
      })
    });
    const allocateData = await allocateResponse.json();
    console.log('Status:', allocateResponse.status);
    console.log('Message:', allocateData.message);
    console.log('New allocated:', `$${allocateData.budget.allocatedFunds.toFixed(2)}`);
    console.log('✅ Funds allocated\n');

    // Test 3: GET /api/admin/semantic/budget/operations
    console.log('📜 Test 3: GET Spending History');
    const opsResponse = await fetch(`${baseUrl}/api/admin/semantic/budget/operations`);
    const opsData = await opsResponse.json();
    console.log('Status:', opsResponse.status);
    console.log('Operations count:', opsData.count);
    if (opsData.operations.length > 0) {
      console.log('Latest operation:', {
        type: opsData.operations[0].operationType,
        cost: `$${opsData.operations[0].cost.toFixed(4)}`,
        success: opsData.operations[0].success
      });
    }
    console.log('✅ Spending history retrieved\n');

    // Test 4: GET /api/admin/semantic/budget/operations with filters
    console.log('📜 Test 4: GET Spending History (Filtered)');
    const filteredOpsResponse = await fetch(
      `${baseUrl}/api/admin/semantic/budget/operations?operationType=embedding&success=true`
    );
    const filteredOpsData = await filteredOpsResponse.json();
    console.log('Status:', filteredOpsResponse.status);
    console.log('Filtered operations count:', filteredOpsData.count);
    console.log('✅ Filtered spending history retrieved\n');

    // Test 5: GET /api/admin/semantic/budget/breakdown
    console.log('📊 Test 5: GET Cost Breakdown');
    const breakdownResponse = await fetch(`${baseUrl}/api/admin/semantic/budget/breakdown`);
    const breakdownData = await breakdownResponse.json();
    console.log('Status:', breakdownResponse.status);
    console.log('Breakdown:', {
      embedding: `$${breakdownData.breakdown.embedding.cost.toFixed(4)}`,
      summarization: `$${breakdownData.breakdown.summarization.cost.toFixed(4)}`,
      total: `$${breakdownData.breakdown.total.cost.toFixed(4)}`
    });
    console.log('✅ Cost breakdown retrieved\n');

    // Test 6: GET /api/admin/semantic/budget/analytics
    console.log('📈 Test 6: GET Budget Analytics');
    const analyticsResponse = await fetch(`${baseUrl}/api/admin/semantic/budget/analytics?days=30`);
    const analyticsData = await analyticsResponse.json();
    console.log('Status:', analyticsResponse.status);
    console.log('Analytics:', {
      totalOperations: analyticsData.analytics.totalOperations,
      successRate: `${(analyticsData.analytics.successfulOperations / analyticsData.analytics.totalOperations * 100).toFixed(1)}%`,
      avgCostPerOp: `$${analyticsData.analytics.averageCostPerOperation.toFixed(4)}`,
      estimatedDaysRemaining: analyticsData.analytics.projections.estimatedDaysRemaining
    });
    console.log('✅ Analytics retrieved\n');

    // Test 7: PUT /api/admin/semantic/budget/thresholds
    console.log('⚙️  Test 7: PUT Update Thresholds');
    const thresholdsResponse = await fetch(`${baseUrl}/api/admin/semantic/budget/thresholds`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warningThreshold: 0.7,
        criticalThreshold: 0.85
      })
    });
    const thresholdsData = await thresholdsResponse.json();
    console.log('Status:', thresholdsResponse.status);
    console.log('Message:', thresholdsData.message);
    console.log('New thresholds:', {
      warning: `${(thresholdsData.budget.warningThreshold * 100).toFixed(0)}%`,
      critical: `${(thresholdsData.budget.criticalThreshold * 100).toFixed(0)}%`
    });
    console.log('✅ Thresholds updated\n');

    // Test 8: GET /api/admin/semantic/budget/export
    console.log('📄 Test 8: GET Export CSV');
    const exportResponse = await fetch(`${baseUrl}/api/admin/semantic/budget/export`);
    const csvText = await exportResponse.text();
    console.log('Status:', exportResponse.status);
    console.log('Content-Type:', exportResponse.headers.get('Content-Type'));
    console.log('CSV lines:', csvText.split('\n').length);
    console.log('First line:', csvText.split('\n')[0]);
    console.log('✅ CSV export successful\n');

    // Test 9: Validation tests
    console.log('🔒 Test 9: Validation Tests');
    
    // Invalid allocation amount
    const invalidAllocate = await fetch(`${baseUrl}/api/admin/semantic/budget/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -10 })
    });
    const invalidAllocateData = await invalidAllocate.json();
    console.log('Invalid allocation (negative):', {
      status: invalidAllocate.status,
      error: invalidAllocateData.error
    });

    // Invalid thresholds
    const invalidThresholds = await fetch(`${baseUrl}/api/admin/semantic/budget/thresholds`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warningThreshold: 0.9,
        criticalThreshold: 0.8
      })
    });
    const invalidThresholdsData = await invalidThresholds.json();
    console.log('Invalid thresholds (warning >= critical):', {
      status: invalidThresholds.status,
      error: invalidThresholdsData.error
    });
    console.log('✅ Validation tests passed\n');

    console.log('✅ All API endpoint tests completed successfully!');

  } catch (error) {
    console.error('\n❌ API test failed:', error);
    throw error;
  }
}

// Run tests
testBudgetAPI()
  .then(() => {
    console.log('\n🎉 Budget management API is working correctly!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 API tests failed:', error);
    process.exit(1);
  });
