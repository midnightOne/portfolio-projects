#!/usr/bin/env tsx

/**
 * Isolate Embedding Generation Timing
 * 
 * This script tests embedding generation in isolation to determine
 * if the slowness is from OpenAI API or our processing.
 */

import dotenv from 'dotenv';
import path from 'path';
import OpenAI from 'openai';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testEmbeddingTimingIsolation() {
  console.log('🔬 Testing Embedding Generation in Isolation...\n');

  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
  });

  const testQueries = [
    'e-commerce platform',
    'impact of the E-commerce Platform project',
    'machine learning artificial intelligence'
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    
    // Test 1: Direct OpenAI API call timing
    console.log('\n🔄 Direct OpenAI API Call:');
    const directStart = Date.now();
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 1536
      });
      
      const directTime = Date.now() - directStart;
      const embedding = response.data[0].embedding;
      
      console.log(`  API call time: ${directTime}ms`);
      console.log(`  Embedding length: ${embedding.length}`);
      console.log(`  First few values: [${embedding.slice(0, 3).map(n => n.toFixed(4)).join(', ')}...]`);
      
      // Test 2: Processing the response
      const processingStart = Date.now();
      const embeddingCopy = [...embedding];
      const embeddingString = `[${embedding.join(',')}]`;
      const processingTime = Date.now() - processingStart;
      
      console.log(`  Response processing time: ${processingTime}ms`);
      console.log(`  Embedding string length: ${embeddingString.length} chars`);
      
      // Test 3: Multiple calls to same query (to test API consistency)
      console.log('\n🔄 Second API call (same query):');
      const secondStart = Date.now();
      
      const response2 = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 1536
      });
      
      const secondTime = Date.now() - secondStart;
      console.log(`  Second API call time: ${secondTime}ms`);
      
      // Compare embeddings
      const embedding2 = response2.data[0].embedding;
      const similarity = embedding.reduce((sum, val, i) => sum + val * embedding2[i], 0);
      console.log(`  Embedding similarity: ${similarity.toFixed(6)} (should be ~1.0)`);
      
    } catch (error) {
      console.error(`❌ Failed to generate embedding:`, error);
    }
    
    console.log('\n' + '='.repeat(80));
  }

  // Test 4: Batch embedding generation
  console.log('\n🔄 Batch Embedding Generation:');
  const batchStart = Date.now();
  
  try {
    const batchResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: testQueries,
      dimensions: 1536
    });
    
    const batchTime = Date.now() - batchStart;
    console.log(`  Batch API call time: ${batchTime}ms`);
    console.log(`  Embeddings generated: ${batchResponse.data.length}`);
    console.log(`  Average time per embedding: ${(batchTime / batchResponse.data.length).toFixed(1)}ms`);
    
  } catch (error) {
    console.error(`❌ Batch embedding failed:`, error);
  }

  console.log('\n✨ Embedding Timing Isolation Test Complete!');
}

// Run the test
if (require.main === module) {
  testEmbeddingTimingIsolation()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testEmbeddingTimingIsolation };