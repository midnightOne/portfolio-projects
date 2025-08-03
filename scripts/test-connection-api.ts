#!/usr/bin/env tsx

/**
 * Test script for the AI connection testing API endpoint
 * 
 * This script tests the /api/admin/ai/test-connection endpoint with various scenarios:
 * - Valid provider connection tests
 * - Invalid provider handling
 * - Missing provider parameter
 * - HTTP method validation
 */

import { spawn } from 'child_process';
import { join } from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

async function makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response;
}

async function testConnectionAPI(): Promise<TestResult[]> {
  const baseUrl = 'http://localhost:3000/api/admin/ai/test-connection';
  const results: TestResult[] = [];

  console.log('🧪 Testing AI Connection API Endpoint...\n');

  // Test 1: Valid OpenAI connection test
  try {
    const response = await makeRequest(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ provider: 'openai' })
    });
    
    const data = await response.json();
    const passed = response.ok && (data.success === true || data.success === false);
    
    results.push({
      name: 'OpenAI Connection Test',
      passed,
      details: passed 
        ? `Status: ${response.status}, Connected: ${data.data?.connected || data.success}, Message: ${data.data?.message || data.error?.message}`
        : `Failed with status ${response.status}: ${JSON.stringify(data)}`
    });
  } catch (error) {
    results.push({
      name: 'OpenAI Connection Test',
      passed: false,
      details: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // Test 2: Valid Anthropic connection test
  try {
    const response = await makeRequest(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ provider: 'anthropic' })
    });
    
    const data = await response.json();
    const passed = response.ok && (data.success === true || data.success === false);
    
    results.push({
      name: 'Anthropic Connection Test',
      passed,
      details: passed 
        ? `Status: ${response.status}, Connected: ${data.data?.connected || data.success}, Message: ${data.data?.message || data.error?.message}`
        : `Failed with status ${response.status}: ${JSON.stringify(data)}`
    });
  } catch (error) {
    results.push({
      name: 'Anthropic Connection Test',
      passed: false,
      details: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // Test 3: Invalid provider
  try {
    const response = await makeRequest(baseUrl, {
      method: 'POST',
      body: JSON.stringify({ provider: 'invalid-provider' })
    });
    
    const data = await response.json();
    const passed = response.status === 400 && data.success === false && data.error?.code === 'INVALID_PROVIDER';
    
    results.push({
      name: 'Invalid Provider Handling',
      passed,
      details: passed 
        ? `Correctly rejected invalid provider with 400 status`
        : `Expected 400 with INVALID_PROVIDER error, got: ${response.status} - ${JSON.stringify(data)}`
    });
  } catch (error) {
    results.push({
      name: 'Invalid Provider Handling',
      passed: false,
      details: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // Test 4: Missing provider parameter
  try {
    const response = await makeRequest(baseUrl, {
      method: 'POST',
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    const passed = response.status === 400 && data.success === false && data.error?.code === 'MISSING_PROVIDER';
    
    results.push({
      name: 'Missing Provider Parameter',
      passed,
      details: passed 
        ? `Correctly rejected missing provider with 400 status`
        : `Expected 400 with MISSING_PROVIDER error, got: ${response.status} - ${JSON.stringify(data)}`
    });
  } catch (error) {
    results.push({
      name: 'Missing Provider Parameter',
      passed: false,
      details: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // Test 5: Invalid JSON
  try {
    const response = await makeRequest(baseUrl, {
      method: 'POST',
      body: 'invalid-json'
    });
    
    const data = await response.json();
    const passed = response.status === 400 && data.success === false && data.error?.code === 'INVALID_JSON';
    
    results.push({
      name: 'Invalid JSON Handling',
      passed,
      details: passed 
        ? `Correctly rejected invalid JSON with 400 status`
        : `Expected 400 with INVALID_JSON error, got: ${response.status} - ${JSON.stringify(data)}`
    });
  } catch (error) {
    results.push({
      name: 'Invalid JSON Handling',
      passed: false,
      details: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  // Test 6: GET method (should be rejected)
  try {
    const response = await makeRequest(baseUrl, {
      method: 'GET'
    });
    
    const data = await response.json();
    const passed = response.status === 405 && data.success === false && data.error?.code === 'METHOD_NOT_ALLOWED';
    
    results.push({
      name: 'GET Method Rejection',
      passed,
      details: passed 
        ? `Correctly rejected GET method with 405 status`
        : `Expected 405 with METHOD_NOT_ALLOWED error, got: ${response.status} - ${JSON.stringify(data)}`
    });
  } catch (error) {
    results.push({
      name: 'GET Method Rejection',
      passed: false,
      details: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  return results;
}

async function startDevServer(): Promise<() => void> {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting development server...');
    
    const server = spawn('npm', ['run', 'dev'], {
      cwd: join(process.cwd(), 'portfolio-projects'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverReady = false;
    
    server.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready') || output.includes('localhost:3000')) {
        if (!serverReady) {
          serverReady = true;
          console.log('✅ Development server is ready\n');
          resolve(() => {
            server.kill();
            console.log('🛑 Development server stopped');
          });
        }
      }
    });

    server.stderr?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('EADDRINUSE')) {
        console.log('📡 Development server already running\n');
        resolve(() => {}); // No-op cleanup since we didn't start the server
      }
    });

    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

async function main() {
  let cleanup: (() => void) | null = null;
  
  try {
    // Start development server
    cleanup = await startDevServer();
    
    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run tests
    const results = await testConnectionAPI();
    
    // Display results
    console.log('\n📊 Test Results:');
    console.log('================');
    
    let passedCount = 0;
    results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.name}`);
      console.log(`   ${result.details}\n`);
      if (result.passed) passedCount++;
    });
    
    console.log(`📈 Summary: ${passedCount}/${results.length} tests passed`);
    
    if (passedCount === results.length) {
      console.log('🎉 All tests passed! Connection testing API is working correctly.');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed. Please check the implementation.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  process.exit(1);
});

main().catch(console.error);