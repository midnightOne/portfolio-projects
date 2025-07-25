// Simple test to verify authentication endpoints work
const fetch = require('node-fetch');

async function testAuth() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing authentication system...\n');
  
  try {
    // Test 1: Access public health endpoint
    console.log('1. Testing public API endpoint...');
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Public API works:', healthData.status);
    
    // Test 2: Try to access admin endpoint without auth (should fail)
    console.log('\n2. Testing admin endpoint without auth...');
    const adminResponse = await fetch(`${baseUrl}/api/admin/test`);
    console.log('Status:', adminResponse.status);
    if (adminResponse.status === 401) {
      console.log('✅ Admin endpoint properly protected');
    } else {
      console.log('❌ Admin endpoint not properly protected');
    }
    
    // Test 3: Check if login page is accessible
    console.log('\n3. Testing login page...');
    const loginResponse = await fetch(`${baseUrl}/admin/login`);
    console.log('Login page status:', loginResponse.status);
    if (loginResponse.status === 200) {
      console.log('✅ Login page accessible');
    } else {
      console.log('❌ Login page not accessible');
    }
    
    console.log('\n🎉 Authentication system basic tests completed!');
    console.log('\nTo test login functionality:');
    console.log('1. Go to http://localhost:3000/admin/login');
    console.log('2. Use credentials from .env file (ADMIN_USERNAME/ADMIN_PASSWORD)');
    console.log('3. Should redirect to admin dashboard');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuth();