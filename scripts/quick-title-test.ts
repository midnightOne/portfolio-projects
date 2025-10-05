/**
 * Quick Title Test - Generate and immediately check results
 */
async function quickTitleTest() {
  console.log('🚀 Quick Title Test...\n');
  
  const testProjectId = 'cmgctydc40000w50wzzoebhb0';
  
  try {
    // Generate chunks
    console.log('🔧 Generating chunks...');
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

    // Wait 15 seconds
    console.log('⏳ Waiting 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check chunks immediately
    console.log('📊 Checking chunks...');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  quickTitleTest();
}

export { quickTitleTest };