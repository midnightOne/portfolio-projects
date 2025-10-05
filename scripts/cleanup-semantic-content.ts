/**
 * Cleanup Script: Semantic Content
 * 
 * Completely removes all semantic content for a project to allow fresh start.
 * This is useful when the semantic structure gets corrupted.
 */
async function cleanupSemanticContent(projectId: string) {
  console.log('🧹 Cleaning up semantic content...\n');
  
  try {
    // Test 1: Check current state
    console.log('📊 Test 1: Check Current State');
    const treeResponse = await fetch(`http://localhost:3000/api/admin/semantic/projects/${projectId}/tree`);
    if (treeResponse.ok) {
      const treeData = await treeResponse.json();
      console.log('Current semantic tree structure:', JSON.stringify(treeData.tree, null, 2));
      
      // Count chunks
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
      
      console.log('Current chunk distribution:', tierCounts);
    } else {
      console.log('No semantic tree found or error fetching:', treeResponse.status);
    }

    // Test 2: Perform cleanup
    console.log('\n🗑️ Test 2: Perform Cleanup');
    const cleanupResponse = await fetch(`http://localhost:3000/api/admin/semantic/projects/${projectId}/cleanup`, {
      method: 'DELETE'
    });

    if (cleanupResponse.ok) {
      const cleanupResult = await cleanupResponse.json();
      console.log('✅ Cleanup successful!');
      console.log('Cleanup result:', cleanupResult);
      
      console.log('\nDeleted:');
      console.log(`• ${cleanupResult.deletedChunks} chunks`);
      console.log(`• ${cleanupResult.deletedEntities} content entities`);
      console.log(`• ${cleanupResult.deletedAIIndexes} AI indexes`);
      console.log(`• ${cleanupResult.deletedOperations} operations`);
    } else {
      const errorData = await cleanupResponse.json();
      console.log('❌ Cleanup failed:', cleanupResponse.status);
      console.log('Error:', errorData);
      return;
    }

    // Test 3: Verify cleanup
    console.log('\n✅ Test 3: Verify Cleanup');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a second
    
    const verifyResponse = await fetch(`http://localhost:3000/api/admin/semantic/projects/${projectId}/tree`);
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      if (!verifyData.tree || Object.keys(verifyData.tree).length === 0) {
        console.log('✅ Cleanup verified - no semantic content found');
      } else {
        console.log('⚠️ Some content may still exist:', verifyData.tree);
      }
    } else if (verifyResponse.status === 404) {
      console.log('✅ Cleanup verified - semantic tree endpoint returns 404 (no content)');
    } else {
      console.log('❌ Error verifying cleanup:', verifyResponse.status);
    }

    // Test 4: Test fresh generation
    console.log('\n🔧 Test 4: Test Fresh Generation');
    const generateResponse = await fetch('http://localhost:3000/api/admin/semantic/processing/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'project',
        projectId,
        stages: [
          { stage: 'chunking', enabled: true, mode: 'immediate' },
          { stage: 'summaries', enabled: false, mode: 'immediate' },
          { stage: 'embeddings', enabled: false, mode: 'immediate' },
          { stage: 'validation', enabled: true, mode: 'immediate' }
        ]
      })
    });

    if (generateResponse.ok) {
      const generateResult = await generateResponse.json();
      console.log('✅ Fresh generation started successfully');
      console.log('Operation ID:', generateResult.operationId);
      
      // Monitor for a few seconds
      console.log('\n📊 Monitoring fresh generation...');
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const progressResponse = await fetch(`http://localhost:3000/api/admin/semantic/processing/${generateResult.operationId}`);
        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          console.log(`Check ${i + 1}: Status=${progressData.status}, Progress=${progressData.overallProgress.toFixed(1)}%`);
          
          if (progressData.status === 'completed') {
            console.log('✅ Fresh generation completed successfully');
            break;
          } else if (progressData.status === 'failed') {
            console.log('❌ Fresh generation failed');
            if (progressData.errors && progressData.errors.length > 0) {
              console.log('Errors:', progressData.errors.map((e: any) => e.error).join(', '));
            }
            break;
          }
        }
      }
    } else {
      const errorData = await generateResponse.text();
      console.log('❌ Failed to start fresh generation:', generateResponse.status);
      console.log('Error:', errorData);
    }

    console.log('\n🎉 Cleanup and Fresh Generation Test Completed!');
    console.log('\nNext steps:');
    console.log('1. Check the semantic tree view in the admin UI');
    console.log('2. Verify the new structure has proper T0-T3 hierarchy');
    console.log('3. Confirm T2 titles are heading text (not summaries)');
    console.log('4. Verify T3 chunks contain actual content');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the cleanup for the test project
if (require.main === module) {
  const projectId = process.argv[2] || 'cmgctydc40000w50wzzoebhb0';
  console.log(`Running cleanup for project: ${projectId}\n`);
  cleanupSemanticContent(projectId);
}

export { cleanupSemanticContent };