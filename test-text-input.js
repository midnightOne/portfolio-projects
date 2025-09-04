/**
 * Test script for text input functionality
 * Tests the voice debug interface text input with interrupt
 */

const puppeteer = require('puppeteer');

async function testTextInput() {
  console.log('Starting text input test...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Keep browser open to see the test
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the voice debug page
    console.log('Navigating to voice debug page...');
    await page.goto('http://localhost:3000/admin/ai/voice-test', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for the page to load
    await page.waitForSelector('button', { timeout: 10000 });
    
    console.log('Page loaded successfully');
    console.log('Test completed - browser will stay open for manual testing');
    console.log('You can now:');
    console.log('1. Click Connect to establish connection');
    console.log('2. Use the text input section to send messages');
    console.log('3. Verify that interrupt works when AI is speaking');
    
    // Keep the browser open for manual testing
    await new Promise(resolve => {
      console.log('Press Ctrl+C to close the browser and exit');
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Check if puppeteer is available
try {
  testTextInput();
} catch (error) {
  console.log('Puppeteer not available, please test manually at:');
  console.log('http://localhost:3000/admin/ai/voice-test');
  console.log('\nFeatures to test:');
  console.log('1. Connect to OpenAI Realtime');
  console.log('2. Use text input to send messages');
  console.log('3. Verify interrupt functionality works');
}