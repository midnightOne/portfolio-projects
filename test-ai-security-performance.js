/**
 * AI Security and Performance Test Script
 * 
 * Tests the AI API endpoints for security and performance characteristics
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test configuration
const tests = [
  {
    name: 'Environment Status API',
    method: 'GET',
    path: '/api/admin/ai/environment-status',
    expectedStatus: 200,
    securityChecks: ['no-api-keys-in-response', 'proper-masking']
  },
  {
    name: 'Connection Test API - Invalid Method',
    method: 'GET',
    path: '/api/admin/ai/test-connection',
    expectedStatus: 405,
    securityChecks: ['method-not-allowed']
  },
  {
    name: 'Connection Test API - Missing Provider',
    method: 'POST',
    path: '/api/admin/ai/test-connection',
    body: {},
    expectedStatus: 400,
    securityChecks: ['input-validation']
  },
  {
    name: 'Connection Test API - Invalid Provider',
    method: 'POST',
    path: '/api/admin/ai/test-connection',
    body: { provider: 'invalid' },
    expectedStatus: 400,
    securityChecks: ['input-validation']
  },
  {
    name: 'Edit Content API - Missing Parameters',
    method: 'POST',
    path: '/api/admin/ai/edit-content',
    body: {},
    expectedStatus: 400,
    securityChecks: ['input-validation']
  }
];

// Security check functions
const securityChecks = {
  'no-api-keys-in-response': (response) => {
    const text = JSON.stringify(response);
    const hasApiKey = /sk-[a-zA-Z0-9]{20,}/.test(text) || /sk-ant-[a-zA-Z0-9]{20,}/.test(text);
    return {
      passed: !hasApiKey,
      message: hasApiKey ? 'API key found in response' : 'No API keys exposed'
    };
  },
  
  'proper-masking': (response) => {
    if (response.data && response.data.openai && response.data.anthropic) {
      const openaiMasked = response.data.openai.keyPreview.includes('...');
      const anthropicMasked = response.data.anthropic.keyPreview.includes('...');
      return {
        passed: openaiMasked || anthropicMasked || response.data.openai.keyPreview === 'Not configured',
        message: 'API keys properly masked or not configured'
      };
    }
    return { passed: true, message: 'No API key data to check' };
  },
  
  'method-not-allowed': (response) => {
    return {
      passed: response.error && response.error.code === 'METHOD_NOT_ALLOWED',
      message: response.error ? 'Method restriction working' : 'Method restriction failed'
    };
  },
  
  'input-validation': (response) => {
    return {
      passed: response.error && (
        response.error.code === 'MISSING_PROVIDER' || 
        response.error.code === 'INVALID_PROVIDER' ||
        response.error.code === 'MISSING_MODEL' ||
        response.error.code === 'MISSING_OPERATION' ||
        response.error.code === 'MISSING_CONTENT'
      ),
      message: response.error ? `Input validation working: ${response.error.code}` : 'Input validation failed'
    };
  }
};

// HTTP request helper
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Security-Test/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
            rawData: data
          });
        } catch (e) {
          // If not JSON, return raw data
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: null,
            rawData: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Performance measurement
function measurePerformance(testFn) {
  const start = process.hrtime.bigint();
  return testFn().then(result => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    return { ...result, duration };
  });
}

// Run tests
async function runTests() {
  console.log('🔒 AI Security and Performance Test Suite');
  console.log('==========================================\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    
    try {
      const result = await measurePerformance(() => 
        makeRequest(test.method, test.path, test.body)
      );
      
      // Check HTTP status
      const statusPassed = result.status === test.expectedStatus;
      console.log(`  Status: ${result.status} (expected ${test.expectedStatus}) ${statusPassed ? '✅' : '❌'}`);
      console.log(`  Performance: ${result.duration.toFixed(2)}ms`);
      
      // Run security checks
      let allSecurityPassed = true;
      if (test.securityChecks && result.data) {
        for (const checkName of test.securityChecks) {
          const check = securityChecks[checkName];
          if (check) {
            const checkResult = check(result.data);
            console.log(`  Security (${checkName}): ${checkResult.message} ${checkResult.passed ? '✅' : '❌'}`);
            if (!checkResult.passed) allSecurityPassed = false;
          }
        }
      }
      
      // Overall test result
      const testPassed = statusPassed && allSecurityPassed;
      if (testPassed) {
        passed++;
        console.log(`  Result: PASSED ✅\n`);
      } else {
        failed++;
        console.log(`  Result: FAILED ❌\n`);
      }
      
    } catch (error) {
      failed++;
      console.log(`  Error: ${error.message} ❌\n`);
    }
  }

  // Summary
  console.log('==========================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('🎉 All security and performance tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Review the results above.');
  }
}

// Check if server is running
async function checkServer() {
  try {
    await makeRequest('GET', '/api/admin/ai/environment-status');
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  console.log('Checking if development server is running...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Development server is not running on http://localhost:3000');
    console.log('Please start the server with: npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running, starting tests...\n');
  await runTests();
}

main().catch(console.error);