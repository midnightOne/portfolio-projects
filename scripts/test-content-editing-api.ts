#!/usr/bin/env tsx

/**
 * Test script for Content Editing API endpoints
 * 
 * Tests all the newly created endpoints:
 * - POST /api/admin/ai/edit-content
 * - POST /api/admin/ai/suggest-tags  
 * - POST /api/admin/ai/improve-content
 * - GET /api/admin/ai/model-config
 * - PUT /api/admin/ai/model-config
 * - GET /api/admin/ai/available-models
 */

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  success: boolean;
  status: number;
  message: string;
  data?: any;
}

const testResults: TestResult[] = [];

async function testEndpoint(
  endpoint: string, 
  method: string, 
  body?: any,
  expectedStatus: number = 200
): Promise<TestResult> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    const success = response.status === expectedStatus;
    
    return {
      endpoint,
      method,
      success,
      status: response.status,
      message: success ? 'OK' : `Expected ${expectedStatus}, got ${response.status}`,
      data: success ? data : { error: data }
    };
  } catch (error) {
    return {
      endpoint,
      method,
      success: false,
      status: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Content Editing API Endpoints...\n');
  
  // Test 1: GET /api/admin/ai/model-config
  console.log('1. Testing GET /api/admin/ai/model-config');
  const modelConfigGet = await testEndpoint('/api/admin/ai/model-config', 'GET');
  testResults.push(modelConfigGet);
  console.log(`   ${modelConfigGet.success ? '✅' : '❌'} ${modelConfigGet.message}`);
  
  // Test 2: GET /api/admin/ai/available-models
  console.log('2. Testing GET /api/admin/ai/available-models');
  const availableModels = await testEndpoint('/api/admin/ai/available-models', 'GET');
  testResults.push(availableModels);
  console.log(`   ${availableModels.success ? '✅' : '❌'} ${availableModels.message}`);
  
  // Test 3: PUT /api/admin/ai/model-config (update model configuration)
  console.log('3. Testing PUT /api/admin/ai/model-config');
  const modelConfigPut = await testEndpoint('/api/admin/ai/model-config', 'PUT', {
    modelConfig: {
      openai: 'gpt-4o,gpt-4o-mini',
      anthropic: 'claude-3-5-sonnet-20241022'
    },
    generalSettings: {
      defaultProvider: 'openai',
      temperature: 0.7,
      maxTokens: 4000
    }
  });
  testResults.push(modelConfigPut);
  console.log(`   ${modelConfigPut.success ? '✅' : '❌'} ${modelConfigPut.message}`);
  
  // Test 4: POST /api/admin/ai/edit-content (content editing)
  console.log('4. Testing POST /api/admin/ai/edit-content');
  const editContent = await testEndpoint('/api/admin/ai/edit-content', 'POST', {
    model: 'gpt-4o-mini',
    operation: 'improve',
    content: 'This is a test project about web development.',
    context: {
      projectTitle: 'Test Project',
      projectDescription: 'A sample project for testing',
      existingTags: ['javascript', 'web'],
      fullContent: 'This is a test project about web development. It uses modern technologies.'
    }
  });
  testResults.push(editContent);
  console.log(`   ${editContent.success ? '✅' : '❌'} ${editContent.message}`);
  
  // Test 5: POST /api/admin/ai/suggest-tags (tag suggestions)
  console.log('5. Testing POST /api/admin/ai/suggest-tags');
  const suggestTags = await testEndpoint('/api/admin/ai/suggest-tags', 'POST', {
    model: 'gpt-4o-mini',
    projectTitle: 'React Dashboard',
    projectDescription: 'A modern dashboard built with React and TypeScript',
    articleContent: 'This project is a comprehensive dashboard application built using React, TypeScript, and Tailwind CSS. It features real-time data visualization, user authentication, and responsive design.',
    existingTags: ['react', 'javascript'],
    maxSuggestions: 5
  });
  testResults.push(suggestTags);
  console.log(`   ${suggestTags.success ? '✅' : '❌'} ${suggestTags.message}`);
  
  // Test 6: POST /api/admin/ai/improve-content (content improvement)
  console.log('6. Testing POST /api/admin/ai/improve-content');
  const improveContent = await testEndpoint('/api/admin/ai/improve-content', 'POST', {
    model: 'gpt-4o-mini',
    content: 'This project is good. It has features.',
    context: {
      projectTitle: 'Portfolio Website',
      projectDescription: 'Personal portfolio website',
      existingTags: ['html', 'css'],
      fullContent: 'This project is good. It has features. Users can see my work.'
    }
  });
  testResults.push(improveContent);
  console.log(`   ${improveContent.success ? '✅' : '❌'} ${improveContent.message}`);
  
  // Test error cases
  console.log('\n🔍 Testing Error Cases...');
  
  // Test 7: Invalid method on edit-content
  console.log('7. Testing invalid method (GET) on edit-content');
  const invalidMethod = await testEndpoint('/api/admin/ai/edit-content', 'GET', null, 405);
  testResults.push(invalidMethod);
  console.log(`   ${invalidMethod.success ? '✅' : '❌'} ${invalidMethod.message}`);
  
  // Test 8: Missing required fields
  console.log('8. Testing missing required fields on edit-content');
  const missingFields = await testEndpoint('/api/admin/ai/edit-content', 'POST', {
    model: 'gpt-4o-mini'
    // Missing operation, content, context
  }, 400);
  testResults.push(missingFields);
  console.log(`   ${missingFields.success ? '✅' : '❌'} ${missingFields.message}`);
  
  // Test 9: Invalid operation
  console.log('9. Testing invalid operation on edit-content');
  const invalidOperation = await testEndpoint('/api/admin/ai/edit-content', 'POST', {
    model: 'gpt-4o-mini',
    operation: 'invalid_operation',
    content: 'test content',
    context: { projectTitle: 'Test' }
  }, 400);
  testResults.push(invalidOperation);
  console.log(`   ${invalidOperation.success ? '✅' : '❌'} ${invalidOperation.message}`);
  
  // Summary
  console.log('\n📊 Test Summary:');
  const passed = testResults.filter(r => r.success).length;
  const total = testResults.length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! Content Editing API is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the details above.');
    
    // Show failed tests
    const failed = testResults.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('\nFailed tests:');
      failed.forEach(test => {
        console.log(`- ${test.method} ${test.endpoint}: ${test.message}`);
        if (test.data?.error) {
          console.log(`  Error: ${JSON.stringify(test.data.error, null, 2)}`);
        }
      });
    }
  }
  
  return passed === total;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { runTests, testResults };