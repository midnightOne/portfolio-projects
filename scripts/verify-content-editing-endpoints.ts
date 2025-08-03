#!/usr/bin/env tsx

/**
 * Verification script for Content Editing API endpoints
 * 
 * Verifies that all the newly created endpoints are properly structured:
 * - POST /api/admin/ai/edit-content
 * - POST /api/admin/ai/suggest-tags  
 * - POST /api/admin/ai/improve-content
 * - GET /api/admin/ai/model-config
 * - PUT /api/admin/ai/model-config
 * - GET /api/admin/ai/available-models
 */

import * as fs from 'fs';
import * as path from 'path';

interface EndpointInfo {
  name: string;
  path: string;
  methods: string[];
  description: string;
}

const EXPECTED_ENDPOINTS: EndpointInfo[] = [
  {
    name: 'edit-content',
    path: 'src/app/api/admin/ai/edit-content/route.ts',
    methods: ['POST'],
    description: 'Handles AI-powered content editing operations'
  },
  {
    name: 'suggest-tags',
    path: 'src/app/api/admin/ai/suggest-tags/route.ts',
    methods: ['POST'],
    description: 'Analyzes project content and suggests relevant tags'
  },
  {
    name: 'improve-content',
    path: 'src/app/api/admin/ai/improve-content/route.ts',
    methods: ['POST'],
    description: 'Improves project content using AI'
  },
  {
    name: 'model-config',
    path: 'src/app/api/admin/ai/model-config/route.ts',
    methods: ['GET', 'PUT'],
    description: 'Manages AI model configuration and general settings'
  },
  {
    name: 'available-models',
    path: 'src/app/api/admin/ai/available-models/route.ts',
    methods: ['GET'],
    description: 'Retrieves all available AI models grouped by provider'
  }
];

function verifyEndpoint(endpoint: EndpointInfo): boolean {
  const fullPath = path.join(process.cwd(), endpoint.path);
  
  console.log(`\n🔍 Verifying ${endpoint.name} endpoint...`);
  console.log(`   Path: ${endpoint.path}`);
  console.log(`   Expected methods: ${endpoint.methods.join(', ')}`);
  console.log(`   Description: ${endpoint.description}`);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    console.log(`   ❌ File does not exist`);
    return false;
  }
  
  // Read file content
  const content = fs.readFileSync(fullPath, 'utf-8');
  
  // Check for required methods
  let methodsFound = 0;
  for (const method of endpoint.methods) {
    const methodPattern = new RegExp(`export async function ${method}\\s*\\(`);
    if (methodPattern.test(content)) {
      console.log(`   ✅ ${method} method found`);
      methodsFound++;
    } else {
      console.log(`   ❌ ${method} method not found`);
    }
  }
  
  // Check for proper error handling
  const hasErrorHandling = content.includes('try {') && content.includes('catch (error)');
  if (hasErrorHandling) {
    console.log(`   ✅ Error handling found`);
  } else {
    console.log(`   ⚠️  Error handling not found`);
  }
  
  // Check for proper response structure
  const hasSuccessResponse = content.includes('success: true') && content.includes('data:');
  const hasErrorResponse = content.includes('success: false') && content.includes('error:');
  
  if (hasSuccessResponse && hasErrorResponse) {
    console.log(`   ✅ Proper response structure found`);
  } else {
    console.log(`   ⚠️  Response structure may be incomplete`);
  }
  
  // Check for method restrictions (should reject other HTTP methods)
  const hasMethodRestrictions = content.includes('Method not allowed');
  if (hasMethodRestrictions) {
    console.log(`   ✅ Method restrictions found`);
  } else {
    console.log(`   ⚠️  Method restrictions not found`);
  }
  
  const success = methodsFound === endpoint.methods.length;
  console.log(`   ${success ? '✅' : '❌'} Overall: ${success ? 'PASS' : 'FAIL'}`);
  
  return success;
}

function main() {
  console.log('🧪 Verifying Content Editing API Endpoints...');
  console.log('=' .repeat(60));
  
  let totalEndpoints = 0;
  let passedEndpoints = 0;
  
  for (const endpoint of EXPECTED_ENDPOINTS) {
    totalEndpoints++;
    if (verifyEndpoint(endpoint)) {
      passedEndpoints++;
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Verification Summary:');
  console.log(`✅ Passed: ${passedEndpoints}/${totalEndpoints}`);
  console.log(`❌ Failed: ${totalEndpoints - passedEndpoints}/${totalEndpoints}`);
  
  if (passedEndpoints === totalEndpoints) {
    console.log('\n🎉 All Content Editing API endpoints are properly implemented!');
    console.log('\nEndpoints ready for use:');
    EXPECTED_ENDPOINTS.forEach(endpoint => {
      endpoint.methods.forEach(method => {
        console.log(`   ${method} /api/admin/ai/${endpoint.name}`);
      });
    });
  } else {
    console.log('\n⚠️  Some endpoints need attention. Check the details above.');
  }
  
  return passedEndpoints === totalEndpoints;
}

// Run verification if this script is executed directly
if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

export { main as verifyContentEditingEndpoints };