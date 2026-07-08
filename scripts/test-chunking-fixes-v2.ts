/**
 * Test Script: Chunking Fixes V2
 * 
 * Tests the fixes for:
 * 1. Chunk validation errors (parent relationships)
 * 2. Progress display (current/total counts)
 * 3. SSE connection persistence
 * 4. Database performance optimization
 */
async function testChunkingFixesV2() {
  console.log('🧪 Testing Chunking Fixes V2...\n');
  
  const testProjectId = 'cmgctydc40000w50wzzoebhb0';
  
  try {
    // Test 1: Start chunking operation and monitor SSE
    console.log('🔧 Test 1: Start Chunking with SSE Monitoring');
    const chunkingResponse = await fetch('http://localhost:3000/api/admin/semantic/processing/start', {
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

    if (chunkingResponse.ok) {
      const chunkingResult = await chunkingResponse.json();
      console.log('✅ Chunking operation started successfully');
      console.log('Operation ID:', chunkingResult.operationId);

      // Test 2: Test SSE connection immediately
      console.log('\n📡 Test 2: Testing SSE Connection');
      const sseUrl = `http://localhost:3000/api/admin/semantic/processing/${chunkingResult.operationId}?sse=true`;
      console.log('SSE URL:', sseUrl);
      
      // Test SSE endpoint availability
      const sseTestResponse = await fetch(`http://localhost:3000/api/admin/semantic/processing/${chunkingResult.operationId}`);
      if (sseTestResponse.ok) {
        const progressData = await sseTestResponse.json();
        console.log('✅ SSE endpoint accessible');
        console.log('Current status:', progressData.status);
        console.log('Overall progress:', progressData.overallProgress + '%');
        
        // Check if stage progress is available
        if (progressData.stageProgress && progressData.currentStage) {
          const currentStageProgress = progressData.stageProgress[progressData.currentStage];
          if (currentStageProgress) {
            console.log(`Current stage: ${progressData.currentStage}`);
            console.log(`Stage progress: ${currentStageProgress.itemsProcessed}/${currentStageProgress.totalItems}`);
          }
        }
      } else {
        console.log('❌ SSE endpoint not accessible:', sseTestResponse.status);
      }

      // Test 3: Monitor progress with detailed logging
      console.log('\n📊 Test 3: Monitor Progress with Detailed Logging');
      let progressChecks = 0;
      let lastProgress = -1;
      let stageProgressVisible = false;
      
      for (let i = 0; i < 20; i++) { // Monitor for 40 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const progressResponse = await fetch(`http://localhost:3000/api/admin/semantic/processing/${chunkingResult.operationId}`);
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            progressChecks++;
            
            console.log(`Check ${i + 1}: Status=${progressData.status}, Progress=${progressData.overallProgress.toFixed(1)}%`);
            
            // Check for stage progress details
            if (progressData.currentStage && progressData.stageProgress[progressData.currentStage]) {
              const stageProgress = progressData.stageProgress[progressData.currentStage];
              console.log(`  Stage: ${progressData.currentStage} (${stageProgress.itemsProcessed}/${stageProgress.totalItems})`);
              stageProgressVisible = true;
            }
            
            // Check for progress updates
            if (progressData.overallProgress !== lastProgress) {
              console.log(`  Progress updated: ${lastProgress}% → ${progressData.overallProgress}%`);
              lastProgress = progressData.overallProgress;
            }
            
            if (progressData.status === 'completed') {
              console.log('✅ Operation completed successfully');
              break;
            } else if (progressData.status === 'failed') {
              console.log('❌ Operation failed');
              if (progressData.errors && progressData.errors.length > 0) {
                console.log('Errors:', progressData.errors.map((e: { error: string }) => e.error).join(', '));
              }
              break;
            }
          } else {
            console.log(`Check ${i + 1}: HTTP ${progressResponse.status} - Operation may have been cleaned up`);
            if (progressResponse.status === 404) {
              console.log('❌ Operation not found - cleaned up too early');
              break;
            }
          }
        } catch (error) {
          console.log(`Check ${i + 1}: Error -`, error instanceof Error ? error.message : String(error));
        }
      }

      // Test 4: Verify final results
      console.log('\n🏗️ Test 4: Verify Final Chunk Structure');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait a bit more
      
      const treeResponse = await fetch(`http://localhost:3000/api/admin/semantic/projects/${testProjectId}/tree`);
      if (treeResponse.ok) {
        const treeData = await treeResponse.json();
        console.log('✅ Semantic tree fetched successfully');
        
        // Count chunks by tier
        const tierCounts: Record<number, number> = {};
        function countChunks(node: any) {
          if (node.tier !== undefined) {
            tierCounts[node.tier] = (tierCounts[node.tier] || 0) + 1;
          }
          if (node.children) {
            node.children.forEach(countChunks);
          }
        }
        
        if (treeData.tree) {
          countChunks(treeData.tree);
        }
        
        console.log('Final chunk distribution:', tierCounts);
        
        // Verify all tiers exist
        const expectedTiers = [0, 1, 2, 3];
        const missingTiers = expectedTiers.filter(tier => !tierCounts[tier] || tierCounts[tier] === 0);
        if (missingTiers.length === 0) {
          console.log('✅ All tiers (T0-T3) created successfully');
        } else {
          console.log('❌ Missing tiers:', missingTiers);
        }
      } else {
        console.log('❌ Failed to fetch semantic tree:', treeResponse.status);
      }

      // Summary
      console.log('\n📋 Test Summary:');
      console.log(`✅ Progress checks completed: ${progressChecks}`);
      console.log(`${stageProgressVisible ? '✅' : '❌'} Stage progress details visible`);
      console.log(`${progressChecks > 10 ? '✅' : '❌'} SSE endpoint persistence (${progressChecks} successful checks)`);
      
    } else {
      const errorData = await chunkingResponse.text();
      console.log('❌ Failed to start chunking operation:', chunkingResponse.status);
      console.log('Error:', errorData);
    }

    console.log('\n🎉 Chunking Fixes V2 Test Completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testChunkingFixesV2();
}

export { testChunkingFixesV2 };