#!/usr/bin/env tsx

/**
 * Test script to make an actual HTTP request to the environment status endpoint
 */

async function testEnvironmentStatusEndpoint() {
  console.log('🌐 Testing Environment Status API Endpoint...\n');
  
  try {
    // Make request to the endpoint
    const response = await fetch('http://localhost:3000/api/admin/ai/environment-status');
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    console.log('✅ API Response received successfully!');
    console.log('\n📊 Environment Status:');
    console.log(`   OpenAI configured: ${data.data.openai.configured}`);
    console.log(`   OpenAI key preview: ${data.data.openai.keyPreview}`);
    console.log(`   Anthropic configured: ${data.data.anthropic.configured}`);
    console.log(`   Anthropic key preview: ${data.data.anthropic.keyPreview}`);
    console.log(`   Has any provider: ${data.data.summary.hasAnyProvider}`);
    console.log(`   Configured providers: [${data.data.summary.configuredProviders.join(', ')}]`);
    console.log(`   Is fully configured: ${data.data.summary.isFullyConfigured}`);
    console.log(`   Total configured: ${data.data.summary.totalConfigured}/2`);
    
    if (data.data.warnings.length > 0) {
      console.log('\n⚠️  Configuration Warnings:');
      data.data.warnings.forEach((warning: string) => {
        console.log(`   - ${warning}`);
      });
    }
    
    console.log('\n🔧 Setup Instructions:');
    if (data.data.setupInstructions.openai) {
      console.log(`   OpenAI: ${data.data.setupInstructions.openai.message}`);
    } else {
      console.log('   OpenAI: ✅ Already configured');
    }
    
    if (data.data.setupInstructions.anthropic) {
      console.log(`   Anthropic: ${data.data.setupInstructions.anthropic.message}`);
    } else {
      console.log('   Anthropic: ✅ Already configured');
    }
    
    console.log(`\n🕒 Response timestamp: ${data.timestamp}`);
    
    // Show full response for debugging
    console.log('\n📋 Full API Response:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.log('❌ Connection refused. Make sure the development server is running:');
      console.log('   npm run dev');
      console.log('\nThen run this test again.');
    } else {
      console.error('❌ Error testing endpoint:', error);
    }
  }
}

// Run the test
testEnvironmentStatusEndpoint();