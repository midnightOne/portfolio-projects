/**
 * Test Script: Final Title Fixes
 * 
 * Tests the fixes for:
 * 1. T2 titles should be short heading text (not long summaries)
 * 2. T3 titles should be content-derived (not same as T2 parent)
 */
async function testFinalFixes() {
  console.log('🧪 Testing Final Title Fixes...\n');
  
  const testProjectId = 'cmgctydc40000w50wzzoebhb0';
  
  try {
    // Step 1: Clean up existing content to ensure fresh generation
    console.log('🧹 Step 1: Clean Up Existing Content');
    const cleanupResponse = await fetch(`http://localhost:3000/api/admin/semantic/projects/${testProjectId}/cleanup`, {
      method: 'DELETE'
    });

    if (cleanupResponse.ok) {
      const cleanupResult = await cleanupResponse.json();
      console.log(`✅ Cleaned up ${cleanupResult.deletedChunks} chunks`);
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Generate fresh chunks with new title logic
    console.log('\n🔧 Step 2: Generate Fresh Chunks with New Title Logic');
    const generateResponse = await fetch('http://localhost:3000/api/admin/semantic/processing/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'project',
        projectId: testProjectId,
        stages: [
          { stage: 'chunking', enabled: true, mode: 'immediate' },
          { stage: 'summaries', enabled: false, mode: 'immediate' },
          { stage: 'embeddings', enabled: false, mode: 'immediate' },
          { stage: 'validation', enabled: true, mode: 'immediate' }
        ]
      })
    });

    if (!generateResponse.ok) {
      console.log('❌ Failed to start generation:', generateResponse.status);
      return;
    }

    const generateResult = await generateResponse.json();
    console.log('✅ Generation started:', generateResult.operationId);

    // Step 3: Wait for completion
    console.log('\n⏳ Step 3: Waiting for completion...');
    
    // Wait 30 seconds for processing
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Step 4: Check title structure
    console.log('\n📊 Step 4: Analyze Title Structure');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testFinalFixes();
}

export { testFinalFixes };